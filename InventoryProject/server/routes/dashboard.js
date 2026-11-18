import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import * as inventoryService from '../services/inventoryService.js';
import { toManilaStartOfDay, toManilaEndOfDay, getManilaDateOnly } from '../utils/dateUtils.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));

/**
 * Fetches bounded sales records bypassing PostgREST's 1,000-row single-query limit when needed.
 */
async function fetchBoundedSales(boundStart, boundEnd, selectCols) {
  const PAGE_SIZE = 1000;
  const firstPage = await supabase
    .from('sales')
    .select(selectCols)
    .gte('created_at', boundStart)
    .lte('created_at', boundEnd)
    .order('created_at', { ascending: true })
    .range(0, PAGE_SIZE - 1);

  if (firstPage.error) throw firstPage.error;
  const rows = firstPage.data || [];
  if (rows.length < PAGE_SIZE) return rows;

  const extraPages = await Promise.all([1, 2, 3].map(idx =>
    supabase
      .from('sales')
      .select(selectCols)
      .gte('created_at', boundStart)
      .lte('created_at', boundEnd)
      .order('created_at', { ascending: true })
      .range(idx * PAGE_SIZE, (idx + 1) * PAGE_SIZE - 1)
  ));
  for (const p of extraPages) {
    if (p.error) throw p.error;
    if (p.data?.length) rows.push(...p.data);
  }
  return rows;
}

/**
 * GET /api/dashboard/stats
 * Aggregate dashboard metrics strictly bounded by startDate / endDate (or period),
 * and calculates low stock using configurable (max_stock * 0.5) thresholds.
 */
router.get('/stats', async (req, res) => {
  try {
    const todayStr = getManilaDateOnly();
    const reqStart = req.query.startDate || req.query.start_date;
    const reqEnd = req.query.endDate || req.query.end_date;
    const period = req.query.period || 'day';

    // 1. Determine strict bounding timestamps (Asia/Manila +08:00)
    let boundStart;
    let boundEnd;

    if (reqStart || reqEnd) {
      boundStart = toManilaStartOfDay(reqStart || reqEnd);
      boundEnd = toManilaEndOfDay(reqEnd || reqStart || todayStr);
    } else if (period === 'day') {
      boundStart = `${todayStr}T00:00:00+08:00`;
      boundEnd = `${todayStr}T23:59:59.999+08:00`;
    } else if (period === 'week') {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      now.setDate(now.getDate() - 6);
      const wy = now.getFullYear();
      const wm = String(now.getMonth() + 1).padStart(2, '0');
      const wd = String(now.getDate()).padStart(2, '0');
      boundStart = `${wy}-${wm}-${wd}T00:00:00+08:00`;
      boundEnd = `${todayStr}T23:59:59.999+08:00`;
    } else if (period === 'month') {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const my = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      boundStart = `${my}-${mm}-01T00:00:00+08:00`;
      boundEnd = `${todayStr}T23:59:59.999+08:00`;
    } else {
      boundStart = '2020-01-01T00:00:00+08:00';
      boundEnd = `${todayStr}T23:59:59.999+08:00`;
    }

    const startDateObj = new Date(new Date(boundStart).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const endDateObj = new Date(new Date(boundEnd).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const needsTrendHistory = period === 'day' && !reqStart && !reqEnd;
    const salesQueryStart = needsTrendHistory
      ? toManilaStartOfDay(new Date(new Date(`${todayStr}T00:00:00+08:00`).getTime() - 6 * 86400000))
      : boundStart;

    // 2. Execute all independent dashboard queries concurrently (single bounded sales scan covers both today & 7-day trend)
    const [
      fetchedSales,
      { count: productCount },
      ingredients,
      { data: lowStockProductsData }
    ] = await Promise.all([
      fetchBoundedSales(
        salesQueryStart,
        boundEnd,
        'id, total_amount, created_at, sale_items(quantity, unit_price, products(id, name, category))'
      ),
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false),
      inventoryService.getIngredients(),
      supabase
        .from('products')
        .select('name, stock_quantity, low_stock_threshold, max_stock')
        .eq('track_stock', true)
        .eq('is_archived', false)
    ]);

    // 3. Basic metrics from bounded sales
    const boundStartMs = new Date(boundStart).getTime();
    const boundEndMs = new Date(boundEnd).getTime();
    const trendHistory = needsTrendHistory ? (fetchedSales || []) : null;
    const salesList = needsTrendHistory
      ? (fetchedSales || []).filter((s) => {
          const ts = new Date(s.created_at).getTime();
          return ts >= boundStartMs && ts <= boundEndMs;
        })
      : (fetchedSales || []);
    const totalRevenue = salesList.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    const transactionsCount = salesList.length;
    const avgTransactionValue = transactionsCount > 0 ? (totalRevenue / transactionsCount) : 0;

    // 4. Products count & Configurable Threshold Low Stock Alerts
    const lowStockIngredients = (ingredients || [])
      .filter(i => {
        const currentStock = parseFloat(i.stock_quantity) || 0;
        const maxStock = parseFloat(i.max_stock) || parseFloat(i.max_capacity) || (parseFloat(i.low_stock_alert || 10) * 2);
        const threshold = maxStock * 0.5;
        return currentStock <= threshold;
      })
      .map(i => {
        const currentStock = parseFloat(i.stock_quantity) || 0;
        const maxStock = parseFloat(i.max_stock) || parseFloat(i.max_capacity) || (parseFloat(i.low_stock_alert || 10) * 2);
        return {
          name: i.name,
          stock: currentStock,
          unit: i.unit,
          max_stock: maxStock,
          threshold: maxStock * 0.5
        };
      });

    const lowStockProducts = (lowStockProductsData || [])
      .filter(p => {
        const currentStock = parseFloat(p.stock_quantity) || 0;
        const maxStock = parseFloat(p.max_stock) || parseFloat(p.max_capacity) || (parseFloat(p.low_stock_threshold || 10) * 2);
        const threshold = maxStock * 0.5;
        return currentStock <= threshold;
      })
      .map(p => {
        const currentStock = parseFloat(p.stock_quantity) || 0;
        const maxStock = parseFloat(p.max_stock) || parseFloat(p.max_capacity) || (parseFloat(p.low_stock_threshold || 10) * 2);
        return {
          name: p.name,
          stock: currentStock,
          unit: 'PCS',
          max_stock: maxStock,
          threshold: maxStock * 0.5
        };
      });

    const lowStockItemsDetails = [...lowStockIngredients, ...lowStockProducts];
    const lowStockCount = lowStockItemsDetails.length;

    // 5. Build Sales Trend (Daily bins across bounding date range)
    const trendMap = {};
    if (needsTrendHistory) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(endDateObj);
        d.setDate(d.getDate() - i);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        trendMap[`${mm}/${dd}`] = { revenue: 0, categories: {} };
      }

      (trendHistory || []).forEach(s => {
        const localDateObj = new Date(new Date(s.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const sm = String(localDateObj.getMonth() + 1).padStart(2, '0');
        const sd = String(localDateObj.getDate()).padStart(2, '0');
        const dateKey = `${sm}/${sd}`;

        if (trendMap[dateKey] !== undefined) {
          trendMap[dateKey].revenue += parseFloat(s.total_amount) || 0;
          (s.sale_items || []).forEach(item => {
            const cat = item.products?.category || 'Uncategorized';
            const itemRev = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            trendMap[dateKey].categories[cat] = (trendMap[dateKey].categories[cat] || 0) + itemRev;
          });
        }
      });
    } else {
      // Dynamic daily bins between boundStart and boundEnd
      const cur = new Date(startDateObj);
      while (cur <= endDateObj) {
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        trendMap[`${mm}/${dd}`] = { revenue: 0, categories: {} };
        cur.setDate(cur.getDate() + 1);
      }

      salesList.forEach(s => {
        const localDateObj = new Date(new Date(s.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const sm = String(localDateObj.getMonth() + 1).padStart(2, '0');
        const sd = String(localDateObj.getDate()).padStart(2, '0');
        const dateKey = `${sm}/${sd}`;

        if (trendMap[dateKey] !== undefined) {
          trendMap[dateKey].revenue += parseFloat(s.total_amount) || 0;
          (s.sale_items || []).forEach(item => {
            const cat = item.products?.category || 'Uncategorized';
            const itemRev = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            trendMap[dateKey].categories[cat] = (trendMap[dateKey].categories[cat] || 0) + itemRev;
          });
        }
      });
    }

    const salesTrend = Object.keys(trendMap).map(dateKey => ({
      date: dateKey,
      revenue: trendMap[dateKey].revenue,
      categories: trendMap[dateKey].categories
    }));

    // 6. Top Products & Categories within Bounded Date Range
    const productMap = {};
    const productCategoryMap = {};
    const categoryMap = {};

    salesList.forEach(sale => {
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

    // 7. Return complete metrics matching bounded dates
    res.json({
      totalRevenueToday: totalRevenue,
      totalRevenue,
      transactionsToday: transactionsCount,
      transactions: transactionsCount,
      activeProducts: productCount || 0,
      lowStockItems: lowStockCount,
      lowStockDetails: lowStockItemsDetails,
      lowStockItemsDetails: lowStockItemsDetails,
      avgTransactionValue,
      salesTrend,
      topProducts,
      topProductsByCategory,
      categoryData,
      dateRange: {
        startDate: boundStart,
        endDate: boundEnd
      }
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
