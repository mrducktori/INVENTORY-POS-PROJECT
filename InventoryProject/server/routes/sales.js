import express from 'express';
import { supabase } from "../config/supabaseClient.js";

const router = express.Router();

// Get all sales with filters
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('sales')
      .select(`
        *,
        users(id, name, username),
        sale_items(id, quantity, unit_price, products(id, name, category))
      `)
      .order('created_at', { ascending: false });

    if (req.query.date) {
      const d = req.query.date;
      query = query.gte('created_at', `${d}T00:00:00`).lte('created_at', `${d}T23:59:59`);
    } else if (req.query.period) {
      const period = req.query.period;
      const now = new Date();
      let start;
      if (period === 'day' || period === 'daily') {
        start = new Date(now.toISOString().split('T')[0] + 'T00:00:00');
      } else if (period === 'week' || period === 'weekly') {
        start = new Date(now);
        start.setDate(now.getDate() - 7);
      } else {
        start = new Date(now);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      }
      query = query.gte('created_at', start.toISOString());
    }

    if (req.query.staff_id) query = query.eq('staff_id', req.query.staff_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single sale detail (Receipt)
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        users(id, name, username),
        sale_items(id, quantity, unit_price, discount_percent, notes, products(id, name, category))
      `)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sales summary by period (day/week/month)
router.get('/summary/report', async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const now = new Date();
    let start;

    if (period === 'day' || period === 'daily') {
      start = new Date(now.toISOString().split('T')[0] + 'T00:00:00');
    } else if (period === 'week' || period === 'weekly') {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
    } else {
      start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        total_amount, created_at, users(id, name),
        sale_items(quantity, unit_price, products(id, name))
      `)
      .gte('created_at', start.toISOString());

    if (error) throw error;

    const total_sales = (sales || []).reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const total_transactions = (sales || []).length;
    let total_items_sold = 0;
    
    const staffMap = {};

    (sales || []).forEach(sale => {
      const staffId = sale.users?.id;
      const staffName = sale.users?.name || 'Unknown';
      
      if (!staffMap[staffId]) {
         staffMap[staffId] = { id: staffId, name: staffName, total_sales: 0, transactions: 0 };
      }
      staffMap[staffId].total_sales += parseFloat(sale.total_amount);
      staffMap[staffId].transactions += 1;

      (sale.sale_items || []).forEach(item => {
        total_items_sold += item.quantity;
      });
    });

    const staff_data = Object.values(staffMap).sort((a, b) => b.total_sales - a.total_sales);

    res.json({ total_sales, total_transactions, total_items_sold, staff_data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
