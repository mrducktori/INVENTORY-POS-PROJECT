import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import * as inventoryService from '../services/inventoryService.js';

const router = express.Router();

// Aggregate dashboard stats from existing tables
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Sales today
    const { data: salesToday, error: salesErr } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    // Total active products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false);

    // Low stock ingredients - using unified service to ensure consistent archiving logic
    const ingredients = await inventoryService.getIngredients();
    const lowStockCount = (ingredients || []).filter(
      i => i.stock_quantity <= i.low_stock_alert
    ).length;


    // Items sold today
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('quantity, sales!inner(created_at)')
      .gte('sales.created_at', `${today}T00:00:00`);

    const totalRevenue = (salesToday || []).reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const totalItemsSold = (saleItems || []).reduce((s, i) => s + i.quantity, 0);

    res.json({
      totalRevenueToday: totalRevenue,
      transactionsToday: (salesToday || []).length,
      activeProducts: productCount || 0,
      lowStockItems: lowStockCount,
      itemsSoldToday: totalItemsSold
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
