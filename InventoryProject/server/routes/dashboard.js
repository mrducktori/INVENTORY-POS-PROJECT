import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import * as inventoryService from '../services/inventoryService.js';

const router = express.Router();

// Aggregate dashboard stats from existing tables
router.get('/stats', async (req, res) => {
  try {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6); // 7 days including today
    const wy = weekAgo.getFullYear();
    const wm = String(weekAgo.getMonth() + 1).padStart(2, '0');
    const wd = String(weekAgo.getDate()).padStart(2, '0');
    const startDateStr = `${wy}-${wm}-${wd}`;

    // 1. Basic Stats Today
    const { data: salesToday } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', `${todayStr}T00:00:00+08:00`)
      .lte('created_at', `${todayStr}T23:59:59+08:00`);

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
      .select('total_amount, created_at, sale_items(quantity, unit_price, products(category))')
      .gte('created_at', `${startDateStr}T00:00:00+08:00`);

    // Group sales by day (respecting Manila Timezone)
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const dayIter = new Date(now);
      dayIter.setDate(dayIter.getDate() - i);
      const dm = String(dayIter.getMonth() + 1).padStart(2, '0');
      const dd = String(dayIter.getDate()).padStart(2, '0');
      trendMap[`${dm}/${dd}`] = { revenue: 0, categories: {} };
    }

    (salesHistory || []).forEach(s => {
      const localDateObj = new Date(new Date(s.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const sm = String(localDateObj.getMonth() + 1).padStart(2, '0');
      const sd = String(localDateObj.getDate()).padStart(2, '0');
      const dateKey = `${sm}/${sd}`;

      if (trendMap[dateKey] !== undefined) {
        trendMap[dateKey].revenue += parseFloat(s.total_amount);
        
        (s.sale_items || []).forEach(item => {
           const cat = item.products?.category || 'Uncategorized';
           const itemRev = parseFloat(item.quantity) * parseFloat(item.unit_price);
           trendMap[dateKey].categories[cat] = (trendMap[dateKey].categories[cat] || 0) + itemRev;
        });
      }
    });

    const salesTrend = Object.keys(trendMap)
      .sort()
      .map(dateKey => ({
        date: dateKey,
        revenue: trendMap[dateKey].revenue,
        categories: trendMap[dateKey].categories
      }));

    // 3. Top Products (Unified & Categorized) - Filtered by period
    const period = req.query.period || 'day';
    let topSalesFilterDate = new Date(now);
    
    if (period === 'day') {
      topSalesFilterDate = `${todayStr}T00:00:00+08:00`;
    } else if (period === 'week') {
      topSalesFilterDate = `${startDateStr}T00:00:00+08:00`;
    } else {
      topSalesFilterDate = '2000-01-01T00:00:00+00:00'; // All time
    }

    const { data: salesWithItemsForTop } = await supabase
      .from('sales')
      .select('created_at, sale_items(quantity, products(name, category))')
      .gte('created_at', topSalesFilterDate);

    const productMap = {};
    const productCategoryMap = {};
    const categoryMap = {};

    (salesWithItemsForTop || []).forEach(sale => {
      (sale.sale_items || []).forEach(item => {
        const pName = item.products?.name || 'Unknown';
        const cat = item.products?.category || 'Uncategorized';
        const qty = parseInt(item.quantity) || 0;

        if (!productMap[pName]) {
          productMap[pName] = { name: pName, category: cat, value: 0 };
        }
        productMap[pName].value += qty;

        if (!productCategoryMap[cat]) {
          productCategoryMap[cat] = {};
        }
        productCategoryMap[cat][pName] = (productCategoryMap[cat][pName] || 0) + qty;
        
        categoryMap[cat] = (categoryMap[cat] || 0) + qty;
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); 

    const topProductsByCategory = {};
    for (const cat in productCategoryMap) {
      topProductsByCategory[cat] = Object.entries(productCategoryMap[cat])
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }

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
      topProductsByCategory,
      categoryData
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
