import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabaseClient.js';
import { logAudit } from '../utils/auditHelper.js';
import { requireAuth, requireRole, invalidateUserAuthCache, reapInactiveUserSessions } from '../middleware/authMiddleware.js';
import { userManagementLimiter } from '../middleware/rateLimiter.js';
import { normalizeAccessFields } from '../utils/permissions.js';
import { toManilaStartOfDay, toManilaEndOfDay } from '../utils/dateUtils.js';
import { validatePasswordRules } from '../utils/passwordValidator.js';

const router = express.Router();

// Allowed roles in the system
const ALLOWED_ROLES = ['Admin', 'Owner', 'Staff', 'Supplier', 'Custom'];

// Get all users — requires authentication
router.get('/', requireAuth, async (req, res) => {
  try {
    await reapInactiveUserSessions(false);

    let query = supabase
      .from('users')
      .select('id, name, username, role, status, created_at, supplier_id, permissions, custom_role_name, current_session_id')
      .order('created_at', { ascending: false });

    if (req.query.role) query = query.eq('role', req.query.role);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user — FIX #6: requires Admin or Owner role
router.post('/', requireAuth, requireRole('Admin', 'Owner'), userManagementLimiter, async (req, res) => {
  try {
    const { name, username, password, role, supplier_id, permissions, custom_role_name } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // FIX #6: Validate the role is one of the allowed values
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    // Supplier role requires a linked supplier
    if (role === 'Supplier' && !supplier_id) {
      return res.status(400).json({ error: 'Supplier role requires a linked supplier.' });
    }

    // Password security validation
    const passwordValidation = validatePasswordRules(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const access = normalizeAccessFields(role, permissions, custom_role_name);
    if (access.error) {
      return res.status(400).json({ error: access.error });
    }

    if (role === 'Owner') {
      if (req.user.role !== 'Owner') {
        return res.status(403).json({ error: 'Only the current Owner can assign the Owner role.' });
      }
      
      // Demote current owner(s) to Admin before creating this one
      const { error: demoteError } = await supabase
        .from('users')
        .update({ role: 'Admin' })
        .eq('role', 'Owner');
      
      if (demoteError) throw demoteError;
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const insertData = {
      name, username, password_hash, role, status: 'ACTIVE',
      permissions: access.permissions,
      custom_role_name: access.custom_role_name
    };
    if (role === 'Supplier' && supplier_id) {
      insertData.supplier_id = supplier_id;
    }

    const { data, error } = await supabase
      .from('users')
      .insert([insertData])
      .select('id, name, username, role, status, created_at, supplier_id, permissions, custom_role_name')
      .single();

    if (error) throw error;

    await logAudit('USER_CREATED', req.user.id, {
      new_user_id: data.id,
      name: data.name,
      username: data.username,
      role: data.role,
      custom_role_name: data.custom_role_name,
      permissions: data.permissions,
      created_by: req.user.name
    });

    res.status(201).json(data);
  } catch (err) {
    if (err.message && err.message.includes('users_username_key')) {
      return res.status(400).json({ error: 'This username is already taken. Please choose a different one.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update user status (activate/deactivate) — requires Admin or Owner
router.put('/:id/status', requireAuth, requireRole('Admin', 'Owner'), userManagementLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Prevent deactivating yourself
    if (req.params.id === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    // Admins cannot deactivate the Owner
    if (req.user.role !== 'Owner') {
      const { data: targetUser } = await supabase.from('users').select('role').eq('id', req.params.id).single();
      if (targetUser && targetUser.role === 'Owner') {
        return res.status(403).json({ error: 'Admins cannot modify the Owner account status.' });
      }
    }

    const updatePayload = { status };
    if (status === 'INACTIVE') {
      updatePayload.current_session_id = null;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select('id, name, username, role, status, current_session_id')
      .single();
    if (error) throw error;

    invalidateUserAuthCache(req.params.id);

    await logAudit('USER_STATUS_CHANGED', req.user.id, {
      target_user_id: req.params.id,
      name: data.name,
      new_status: status,
      changed_by: req.user.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a user (name, username, password, role) — FIX #7: requires Admin or Owner
router.put('/:id', requireAuth, requireRole('Admin', 'Owner'), userManagementLimiter, async (req, res) => {
  try {
    const { name, username, password, role, supplier_id, permissions, custom_role_name } = req.body;
    if (!name || !username || !role) {
      return res.status(400).json({ error: 'Name, username, and role are required' });
    }

    // FIX #7: Validate the target role is one of the allowed values
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    // Admins cannot modify the Owner
    if (req.user.role !== 'Owner') {
      const { data: targetUser } = await supabase.from('users').select('role').eq('id', req.params.id).single();
      if (targetUser && targetUser.role === 'Owner') {
        return res.status(403).json({ error: 'Admins cannot modify the Owner account.' });
      }
    }

    if (role === 'Owner') {
      if (req.user.role !== 'Owner') {
        return res.status(403).json({ error: 'Only the current Owner can assign the Owner role.' });
      }

      // If making someone else the owner, demote all current owners to Admin
      const { data: currentOwnerData, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'Owner');
        
      if (checkError) throw checkError;

      const currentOwnerIds = currentOwnerData.map(o => o.id);

      if (!currentOwnerIds.includes(req.params.id)) {
        await supabase
          .from('users')
          .update({ role: 'Admin' })
          .eq('role', 'Owner');
      }
    } else {
      // Prevent demoting the ONLY owner directly
      const { data: targetUser } = await supabase.from('users').select('role').eq('id', req.params.id).single();
      if (targetUser && targetUser.role === 'Owner') {
        return res.status(400).json({ error: 'Cannot demote the Owner. Transfer ownership to another user instead.' });
      }
    }

    if (role === 'Supplier' && !supplier_id) {
      return res.status(400).json({ error: 'Supplier role requires a linked supplier.' });
    }

    const access = normalizeAccessFields(role, permissions, custom_role_name);
    if (access.error) {
      return res.status(400).json({ error: access.error });
    }

    const updates = {
      name, username, role,
      permissions: access.permissions,
      custom_role_name: access.custom_role_name
    };
    if (role === 'Supplier') updates.supplier_id = supplier_id;

    if (password && password.trim() !== '') {
      const passwordValidation = validatePasswordRules(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }
      const saltRounds = 10;
      updates.password_hash = await bcrypt.hash(password, saltRounds);
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, username, role, status, created_at, supplier_id, permissions, custom_role_name')
      .single();

    if (error) throw error;

    invalidateUserAuthCache(req.params.id);

    await logAudit('USER_UPDATED', req.user.id, {
      target_user_id: req.params.id,
      name: data.name,
      username: data.username,
      role: data.role,
      custom_role_name: data.custom_role_name,
      permissions: data.permissions,
      updated_by: req.user.name
    });

    res.json(data);
  } catch (err) {
    if (err.message && err.message.includes('users_username_key')) {
      return res.status(400).json({ error: 'This username is already taken. Please choose a different one.' });
    }
    res.status(500).json({ error: err.message });
  }
});

let hasEmployeeShiftsTable = null;

// Get employee shifts for a given date — requires authentication
router.get('/shifts', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    if (hasEmployeeShiftsTable !== false) {
      const { data, error } = await supabase
        .from('employee_shifts')
        .select(`
          *,
          users(id, name, username, role)
        `)
        .eq('shift_date', date)
        .order('clock_in', { ascending: true });

      if (!error) {
        hasEmployeeShiftsTable = true;
        return res.json(data);
      }

      const msg = String(error.message || '').toLowerCase();
      if (!msg.includes('could not find the table') && !msg.includes('relation') && error.code !== '42P01' && error.code !== 'PGRST205') {
        throw error;
      }
      hasEmployeeShiftsTable = false;
    }

    // Fallback: reconstruct employee shifts for the date from LOGIN / LOGOUT audit_logs
    const startIso = toManilaStartOfDay(date);
    const endIso = toManilaEndOfDay(date);

    const { data: logs, error: logErr } = await supabase
      .from('audit_logs')
      .select(`id, action, user_id, created_at, users(id, name, username, role, current_session_id)`)
      .in('action', ['LOGIN', 'LOGOUT'])
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true });

    if (logErr) throw logErr;

    const shifts = [];
    const openShiftByUser = new Map();

    for (const log of logs || []) {
      const uid = log.user_id;
      if (!uid) continue;

      if (log.action === 'LOGIN') {
        const shiftObj = {
          id: log.id,
          user_id: uid,
          shift_date: date,
          clock_in: log.created_at,
          clock_out: null,
          users: log.users || { id: uid, name: 'Staff', role: 'Staff' }
        };
        shifts.push(shiftObj);
        openShiftByUser.set(uid, shiftObj);
      } else if (log.action === 'LOGOUT') {
        const openShift = openShiftByUser.get(uid);
        if (openShift && !openShift.clock_out) {
          openShift.clock_out = log.created_at;
          openShiftByUser.delete(uid);
        } else {
          shifts.push({
            id: log.id,
            user_id: uid,
            shift_date: date,
            clock_in: null,
            clock_out: log.created_at,
            users: log.users || { id: uid, name: 'Staff', role: 'Staff' }
          });
        }
      }
    }

    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
