import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabaseClient.js';
import { logAudit } from '../utils/auditHelper.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Allowed roles in the system
const ALLOWED_ROLES = ['Admin', 'Owner', 'Staff'];

// Get all users — requires authentication
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabase
      .from('users')
      .select('id, name, username, role, status, created_at')
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
router.post('/', requireAuth, requireRole('Admin', 'Owner'), async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // FIX #6: Validate the role is one of the allowed values
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, username, password_hash, role, status: 'ACTIVE' }])
      .select('id, name, username, role, status, created_at')
      .single();

    if (error) throw error;

    await logAudit('USER_CREATED', req.user.id, {
      new_user_id: data.id,
      name: data.name,
      username: data.username,
      role: data.role,
      created_by: req.user.name
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user status (activate/deactivate) — requires Admin or Owner
router.put('/:id/status', requireAuth, requireRole('Admin', 'Owner'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Prevent deactivating yourself
    if (req.params.id === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', req.params.id)
      .select('id, name, username, role, status')
      .single();
    if (error) throw error;

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
router.put('/:id', requireAuth, requireRole('Admin', 'Owner'), async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !role) {
      return res.status(400).json({ error: 'Name, username, and role are required' });
    }

    // FIX #7: Validate the target role is one of the allowed values
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    const updates = { name, username, role };

    if (password && password.trim() !== '') {
      const saltRounds = 10;
      updates.password_hash = await bcrypt.hash(password, saltRounds);
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, username, role, status, created_at')
      .single();

    if (error) throw error;

    await logAudit('USER_UPDATED', req.user.id, {
      target_user_id: req.params.id,
      name: data.name,
      username: data.username,
      role: data.role,
      updated_by: req.user.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employee shifts for a given date — requires authentication
router.get('/shifts', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('employee_shifts')
      .select(`
        *,
        users(id, name, username, role)
      `)
      .eq('shift_date', date)
      .order('clock_in', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
