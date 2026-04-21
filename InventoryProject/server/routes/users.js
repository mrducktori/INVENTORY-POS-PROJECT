import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabaseClient.js';
import { userManagementLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Get all users with optional filters
router.get('/', async (req, res) => {
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

// Create a new user
router.post('/', userManagementLimiter, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, username, password_hash, role, status: 'ACTIVE' }])
      .select('id, name, username, role, status, created_at')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user status (activate/deactivate)
router.put('/:id/status', userManagementLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', req.params.id)
      .select('id, name, username, role, status')
      .single();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a user (name, username, password, role)
router.put('/:id', userManagementLimiter, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !role) {
      return res.status(400).json({ error: 'Name, username, and role are required' });
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
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employee shifts for a given date (defaults to today)
router.get('/shifts', async (req, res) => {
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
