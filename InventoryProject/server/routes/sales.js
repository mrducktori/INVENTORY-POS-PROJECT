import express from 'express';
import { supabase } from '../../db.js';

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
    }
    if (req.query.staff_id) query = query.eq('staff_id', req.query.staff_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single sale detail
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        users(id, name, username),
        sale_items(id, quantity, unit_price, products(id, name, category))
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

    if (period === 'day') {
      start = new Date(now.toISOString().split('T')[0] + 'T00:00:00');
    } else if (period === 'week') {
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
        total_amount, created_at,
        sale_items(quantity, unit_price, products(id, name))
      `)
      .gte('created_at', start.toISOString());

    if (error) throw error;

    const totalRevenue = (sales || []).reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const totalTransactions = (sales || []).length;

    // Aggregate products sold
    const productMap = {};
    (sales || []).forEach(sale => {
      (sale.sale_items || []).forEach(item => {
        const name = item.products?.name || 'Unknown';
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
        productMap[name].qty += item.quantity;
        productMap[name].revenue += item.quantity * parseFloat(item.unit_price);
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({ totalRevenue, totalTransactions, topProducts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
