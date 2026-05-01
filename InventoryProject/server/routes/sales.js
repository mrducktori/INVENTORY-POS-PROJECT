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
        sale_items(id, quantity, unit_price, cup_size, add_ons, products(id, name, category))
      `)
      .order('created_at', { ascending: false });

    if (req.query.date) {
      const d = req.query.date;
      query = query.gte('created_at', `${d}T00:00:00+08:00`).lte('created_at', `${d}T23:59:59+08:00`);
    } else if (req.query.period) {
      const period = req.query.period;
      // Get current date in Manila timezone
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      
      let startStr;
      if (period === 'day' || period === 'daily') {
        startStr = `${y}-${m}-${d}T00:00:00+08:00`;
      } else if (period === 'week' || period === 'weekly') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const wy = weekAgo.getFullYear();
        const wm = String(weekAgo.getMonth() + 1).padStart(2, '0');
        const wd = String(weekAgo.getDate()).padStart(2, '0');
        startStr = `${wy}-${wm}-${wd}T00:00:00+08:00`;
      } else {
        startStr = `${y}-${m}-01T00:00:00+08:00`;
      }
      query = query.gte('created_at', startStr);
    }

    if (req.query.staff_id) query = query.eq('staff_id', req.query.staff_id);

    const { data, error } = await query;
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
    
    // Get current date in Manila timezone
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    
    let startStr;
    if (period === 'day' || period === 'daily') {
      startStr = `${y}-${m}-${d}T00:00:00+08:00`;
    } else if (period === 'week' || period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const wy = weekAgo.getFullYear();
      const wm = String(weekAgo.getMonth() + 1).padStart(2, '0');
      const wd = String(weekAgo.getDate()).padStart(2, '0');
      startStr = `${wy}-${wm}-${wd}T00:00:00+08:00`;
    } else {
      startStr = `${y}-${m}-01T00:00:00+08:00`;
    }

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        total_amount, created_at, users(id, name),
        sale_items(quantity, unit_price, products(id, name))
      `)
      .gte('created_at', startStr);

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

// Get single sale detail (Receipt)
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        users(id, name, username),
        sale_items(id, quantity, unit_price, discount_percent, notes, cup_size, add_ons, products(id, name, category))
      `)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



export default router;
