import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import { toManilaStartOfDay, toManilaEndOfDay } from '../utils/dateUtils.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Get audit logs with optional filters
router.get('/', requireRole('Owner', 'Admin', 'Staff', 'Custom'), requirePermission('AuditLogs', 'Reports'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 2000);
    const offset = parseInt(req.query.offset) || 0;

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        users(id, name, username, role)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    if (req.query.action) {
      if (req.query.action.includes(',')) {
        const actionList = req.query.action.split(',').map(a => a.trim()).filter(Boolean);
        query = query.in('action', actionList);
      } else {
        query = query.ilike('action', `%${req.query.action}%`);
      }
    }
    
    const startDate = req.query.start_date || req.query.startDate;
    const endDate = req.query.end_date || req.query.endDate;
    if (startDate) query = query.gte('created_at', toManilaStartOfDay(startDate));
    if (endDate) query = query.lte('created_at', toManilaEndOfDay(endDate));

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// No POST route on purpose: audit entries are written only by the server, so clients cannot forge them.

export default router;
