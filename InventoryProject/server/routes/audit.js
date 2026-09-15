import express from 'express';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// Get audit logs with optional filters
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
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
    if (req.query.action) query = query.ilike('action', `%${req.query.action}%`);
    if (req.query.start_date) query = query.gte('created_at', req.query.start_date);
    if (req.query.end_date) query = query.lte('created_at', req.query.end_date);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create audit log entry
router.post('/', async (req, res) => {
  try {
    const { action, user_id, details } = req.body;
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([{ action, user_id, details }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
