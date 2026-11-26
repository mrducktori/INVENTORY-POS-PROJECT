import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import * as inventoryService from '../services/inventoryService.js';
import * as batchService from '../services/batchService.js';
import * as posOperationsService from '../services/posOperationsService.js';
import { toManilaStartOfDay, toManilaEndOfDay, getManilaDateOnly } from '../utils/dateUtils.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));

/** Fetches sales in bounded pages to get past PostgREST's 1,000-row single-query limit. */
async function fetchBoundedSales(boundStart, boundEnd, selectCols) {
  const PAGE_SIZE = 1000;
  const rows = [];
  let pageIdx = 0;

  while (true) {
    const { data, error } = await supabase
      .from('sales')
      .select(selectCols)
      .gte('created_at', boundStart)
      .lte('created_at', boundEnd)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    pageIdx += 1;
  }

  // Exclude voided/refunded/returned sales (by status or void/refund map) from revenue.
  const voidsMap = await posOperationsService.getVoidRefundMap();
  return rows.filter((s) =>
    !voidsMap[s.id] && !['VOIDED', 'REFUNDED', 'RETURNED'].includes(String(s.status || '').toUpperCase())
  );
}

const VALID_PERIODS = new Set(['day', 'week', '7d', '14d', '30d', 'month']);
const MAX_RANGE_DAYS = 366;
const pad2 = (n) => String(n).padStart(2, '0');
const isoKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

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

    if (!reqStart && !reqEnd && !VALID_PERIODS.has(period)) {
      return res.status(400).json({ error: `Invalid period '${period}'. Use one of: ${[...VALID_PERIODS].join(', ')}` });
    }

    // Bounds are Asia/Manila (+08:00).
    let boundStart;
    let boundEnd;

    if (reqStart || reqEnd) {
      boundStart = toManilaStartOfDay(reqStart || reqEnd);
      boundEnd = toManilaEndOfDay(reqEnd || reqStart || todayStr);
      const spanDays = (new Date(boundEnd) - new Date(boundStart)) / 86400000;
      if (!(spanDays >= 0) || spanDays > MAX_RANGE_DAYS) {
        return res.status(400).json({ error: `Date range must be valid and at most ${MAX_RANGE_DAYS} days` });
      }
    } else if (period === 'day') {
      boundStart = `${todayStr}T00:00:00+08:00`;
      boundEnd = `${todayStr}T23:59:59.999+08:00`;
    } else if (period === 'week' || period === '7d' || period === '14d' || period === '30d') {
      const daysBack = period === '30d' ? 29 : period === '14d' ? 13 : 6;
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      now.setDate(now.getDate() - daysBack);
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
    }

    const startDateObj = new Date(new Date(boundStart).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const endDateObj = new Date(new Date(boundEnd).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const needsTrendHistory = period === 'day' && !reqStart && !reqEnd;
    const salesQueryStart = needsTrendHistory
      ? toManilaStartOfDay(new Date(new Date(`${todayStr}T00:00:00+08:00`).getTime() - 6 * 86400000))
      : boundStart;

    // Independent queries run concurrently; one bounded sales scan covers today and the 7-day trend.
    const [
      fetchedSales,
      { count: productCount },
      lowStockAlerts,
      expiryAlerts
    ] = await Promise.all([
      fetchBoundedSales(
        salesQueryStart,
        boundEnd,
        'id, total_amount, created_at, status, sale_items(quantity, unit_price, products(id, name, category))'
      ),
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false),
      inventoryService.getLowStockAlerts(),
      batchService.getExpiryAlerts()
    ]);

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

    // Same list as the Low Stock Alerts tab, so the card count always matches it.
    const lowStockItemsDetails = (lowStockAlerts || []).map((i) => ({
      name: i.name,
      stock: Number(i.usable_stock) || 0,
      usable_stock: Number(i.usable_stock) || 0,
      expired_stock: Number(i.expired_stock) || 0,
      unit: i.unit,
      threshold: Number(i.low_stock_threshold) || 0
    }));
    const lowStockCount = lowStockItemsDetails.length;

    const trendMap = {};
    if (needsTrendHistory) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(endDateObj);
        d.setDate(d.getDate() - i);
        trendMap[isoKey(d)] = { revenue: 0, categories: {} };
      }

      (trendHistory || []).forEach(s => {
        const localDateObj = new Date(new Date(s.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const dateKey = isoKey(localDateObj);

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
      const cur = new Date(startDateObj);
      while (cur <= endDateObj) {
        trendMap[isoKey(cur)] = { revenue: 0, categories: {} };
        cur.setDate(cur.getDate() + 1);
      }

      salesList.forEach(s => {
        const localDateObj = new Date(new Date(s.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const dateKey = isoKey(localDateObj);

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
      date: dateKey.slice(5).replace('-', '/'), // MM/DD label (frontend parses this)
      isoDate: dateKey,
      revenue: trendMap[dateKey].revenue,
      categories: trendMap[dateKey].categories
    }));

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
      expiryAlerts,
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
