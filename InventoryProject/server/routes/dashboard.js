import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import * as inventoryService from '../services/inventoryService.js';

const router = express.Router();

// Aggregate dashboard stats from existing tables
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    // 1. Basic Stats Today
    const { data: salesToday } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', `${today}T00:00:00`);

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false);

    const ingredients = await inventoryService.getIngredients();
    const lowStockIngredients = (ingredients || [])
      .filter(i => parseFloat(i.stock_quantity) <= parseFloat(i.low_stock_alert))
      .map(i => ({ name: i.name, stock: i.stock_quantity, unit: i.unit }));

    // Include Products with direct stock tracking
    const { data: lowStockProductsData } = await supabase
      .from('products')
      .select('name, stock_quantity, low_stock_threshold')
      .eq('track_stock', true)
      .eq('is_archived', false);
    
    const lowStockProducts = (lowStockProductsData || [])
      .filter(p => parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold))
      .map(p => ({ name: p.name, stock: p.stock_quantity, unit: 'PCS' }));

    const lowStockItemsDetails = [...lowStockIngredients, ...lowStockProducts];
    const lowStockCount = lowStockItemsDetails.length;

    // 2. Sales Trend (Last 7 Days)
    const { data: salesHistory } = await supabase
      .from('sales')
      .select('total_amount, created_at')
      .gte('created_at', `${startDate}T00:00:00`);

    // Group sales by day
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendMap[d.toISOString().split('T')[0]] = 0;
    }

    (salesHistory || []).forEach(s => {
      const date = s.created_at.split('T')[0];
      if (trendMap[date] !== undefined) {
        trendMap[date] += parseFloat(s.total_amount);
      }
    });

    const salesTrend = Object.keys(trendMap).sort().map(date => ({
      date: date.split('-').slice(1).join('/'), // MM/DD
      revenue: trendMap[date]
    }));

    // 3. Top Products & Category Breakdown (All Time or Last 30 Days)
    const { data: itemsData } = await supabase
      .from('sale_items')
      .select('quantity, products(name, category)');

    const productMap = {};
    const categoryMap = {};

    (itemsData || []).forEach(item => {
      const pName = item.products?.name || 'Unknown';
      const cat = item.products?.category || 'Uncategorized';
      const qty = parseInt(item.quantity) || 0;

      productMap[pName] = (productMap[pName] || 0) + qty;
      categoryMap[cat] = (categoryMap[cat] || 0) + qty;
    });

    const topProducts = Object.entries(productMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }));

    // 4. Final Aggregation
    const totalRevenue = (salesToday || []).reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const transactionsToday = (salesToday || []).length;
    const avgTransaction = transactionsToday > 0 ? totalRevenue / transactionsToday : 0;

    res.json({
      totalRevenueToday: totalRevenue,
      transactionsToday,
      activeProducts: productCount || 0,
      lowStockItems: lowStockCount,
      lowStockDetails: lowStockItemsDetails,
      avgTransactionValue: avgTransaction,
      salesTrend,
      topProducts,
      categoryData
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
