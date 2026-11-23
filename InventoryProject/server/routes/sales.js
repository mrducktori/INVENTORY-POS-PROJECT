import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { toManilaStartOfDay, toManilaEndOfDay, getManilaDateOnly, getManilaDateString } from "../utils/dateUtils.js";
import { requireRole } from "../middleware/authMiddleware.js";
import * as posOperationsService from "../services/posOperationsService.js";

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));

const pad2 = (n) => String(n).padStart(2, '0');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const shiftManilaDateStr = (dateStr, deltaDays) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDailyLabel = (dateStr) => {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${MONTH_SHORT[(m || 1) - 1]} ${d}`;
};

export const resolveSalesDateWindow = ({ period, start_date, end_date, date, year, todayOverride = null } = {}) => {
  const todayStr = todayOverride || getManilaDateOnly();
  const [curY, curM] = todayStr.split('-').map(Number);
  const normPeriod = String(period || '').trim().toLowerCase();

  if (normPeriod === 'custom' || start_date || end_date) {
    const startOnly = (start_date ? toManilaStartOfDay(start_date).slice(0, 10) : null) ||
      (end_date ? toManilaStartOfDay(end_date).slice(0, 10) : todayStr);
    const endOnly = (end_date ? toManilaEndOfDay(end_date).slice(0, 10) : null) || startOnly;
    return {
      period: 'custom',
      startStr: `${startOnly}T00:00:00+08:00`,
      endStr: `${endOnly}T23:59:59.999+08:00`,
      startDateOnly: startOnly,
      endDateOnly: endOnly,
      bucketMode: 'daily',
      targetYear: Number(startOnly.slice(0, 4))
    };
  }

  if (normPeriod === 'year' || normPeriod === 'yearly' || normPeriod === 'annual') {
    const targetYear = year !== undefined && year !== null && String(year).trim() !== ''
      ? Number(year)
      : curY;
    if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
      const err = new Error('Invalid year parameter.');
      err.status = 400;
      throw err;
    }
    return {
      period: 'yearly',
      startStr: `${targetYear}-01-01T00:00:00+08:00`,
      endStr: `${targetYear}-12-31T23:59:59.999+08:00`,
      startDateOnly: `${targetYear}-01-01`,
      endDateOnly: `${targetYear}-12-31`,
      bucketMode: 'monthly',
      targetYear
    };
  }

  if (normPeriod === 'month' || normPeriod === 'monthly') {
    const startOnly = `${curY}-${pad2(curM)}-01`;
    return {
      period: 'monthly',
      startStr: `${startOnly}T00:00:00+08:00`,
      endStr: `${todayStr}T23:59:59.999+08:00`,
      startDateOnly: startOnly,
      endDateOnly: todayStr,
      bucketMode: 'daily',
      targetYear: curY
    };
  }

  if (normPeriod === 'week' || normPeriod === 'weekly') {
    const startOnly = shiftManilaDateStr(todayStr, -6);
    return {
      period: 'weekly',
      startStr: `${startOnly}T00:00:00+08:00`,
      endStr: `${todayStr}T23:59:59.999+08:00`,
      startDateOnly: startOnly,
      endDateOnly: todayStr,
      bucketMode: 'daily',
      targetYear: curY
    };
  }

  // Default: daily (or explicit date)
  const targetDate = date ? toManilaStartOfDay(date).slice(0, 10) : todayStr;
  return {
    period: 'daily',
    startStr: `${targetDate}T00:00:00+08:00`,
    endStr: `${targetDate}T23:59:59.999+08:00`,
    startDateOnly: targetDate,
    endDateOnly: targetDate,
    bucketMode: 'daily',
    targetYear: Number(targetDate.slice(0, 4))
  };
};

export const aggregateSalesSummaryReport = (sales = [], voidsMap = {}, windowInfo = {}) => {
  const { bucketMode = 'daily', startDateOnly, endDateOnly, targetYear } = windowInfo;
  const binMap = new Map();

  if (bucketMode === 'monthly') {
    const yr = targetYear || Number((startDateOnly || getManilaDateOnly()).slice(0, 4));
    for (let m = 1; m <= 12; m++) {
      const key = `${yr}-${pad2(m)}`;
      binMap.set(key, {
        date_key: key,
        label: `${MONTH_SHORT[m - 1]} ${yr}`,
        revenue: 0,
        transactions: 0,
        items_sold: 0
      });
    }
  } else if (startDateOnly && endDateOnly) {
    let cur = startDateOnly;
    let safety = 0;
    while (cur <= endDateOnly && safety < 400) {
      binMap.set(cur, {
        date_key: cur,
        label: formatDailyLabel(cur),
        revenue: 0,
        transactions: 0,
        items_sold: 0
      });
      cur = shiftManilaDateStr(cur, 1);
      safety += 1;
    }
  }

  let total_sales = 0;
  let total_discounts = 0;
  let gross_sales = 0;
  let total_transactions = 0;
  let total_items_sold = 0;
  let voided_count = 0;
  let voided_amount = 0;

  const staffMap = {};
  const productMap = {};

  for (const sale of sales || []) {
    const saleAmt = parseFloat(sale.total_amount) || 0;
    const discAmt = parseFloat(sale.discount_amount) || 0;
    const statusUpper = String(sale.status || '').toUpperCase();
    const isVoided = Boolean(voidsMap[sale.id]) || ['VOIDED', 'REFUNDED', 'RETURNED'].includes(statusUpper);

    if (isVoided) {
      voided_count += 1;
      voided_amount += saleAmt;
      continue;
    }

    total_sales += saleAmt;
    total_discounts += discAmt;
    gross_sales += saleAmt + discAmt;
    total_transactions += 1;

    const staffId = sale.users?.id || 'unknown';
    const staffName = sale.users?.name || 'Unknown';
    if (!staffMap[staffId]) {
      staffMap[staffId] = { id: staffId, name: staffName, total_sales: 0, transactions: 0 };
    }
    staffMap[staffId].total_sales = round2(staffMap[staffId].total_sales + saleAmt);
    staffMap[staffId].transactions += 1;

    let saleItemsCount = 0;
    for (const item of sale.sale_items || []) {
      const qty = Number(item.quantity) || 0;
      saleItemsCount += qty;
      total_items_sold += qty;

      const prodId = item.products?.id;
      const prodName = item.products?.name || 'Unknown Product';
      const category = item.products?.category || 'Uncategorized';

      if (prodId) {
        if (!productMap[prodId]) {
          productMap[prodId] = { id: prodId, name: prodName, category, qty_sold: 0, revenue: 0 };
        }
        productMap[prodId].qty_sold += qty;
        productMap[prodId].revenue = round2(productMap[prodId].revenue + qty * (parseFloat(item.unit_price) || 0));
      }
    }

    if (sale.created_at) {
      const manilaDay = getManilaDateString(sale.created_at);
      const binKey = bucketMode === 'monthly' ? manilaDay.slice(0, 7) : manilaDay;
      if (!binMap.has(binKey)) {
        binMap.set(binKey, {
          date_key: binKey,
          label: bucketMode === 'monthly'
            ? `${MONTH_SHORT[(Number(binKey.slice(5, 7)) || 1) - 1]} ${binKey.slice(0, 4)}`
            : formatDailyLabel(binKey),
          revenue: 0,
          transactions: 0,
          items_sold: 0
        });
      }
      const bin = binMap.get(binKey);
      bin.revenue = round2(bin.revenue + saleAmt);
      bin.transactions += 1;
      bin.items_sold += saleItemsCount;
    }
  }

  const period_breakdown = Array.from(binMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => val);

  const staff_data = Object.values(staffMap).sort((a, b) => b.total_sales - a.total_sales);
  const product_data = Object.values(productMap).sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 50);

  return {
    gross_sales: round2(gross_sales),
    total_discounts: round2(total_discounts),
    voided_count,
    voided_amount: round2(voided_amount),
    total_sales: round2(total_sales),
    total_transactions,
    total_items_sold,
    period_breakdown,
    staff_data,
    product_data
  };
};

const resolveOrderTypeFromNotes = (notes) => {
  const s = String(notes || '');
  if (/\[TAKE-OUT\]|\[TAKE_OUT\]/i.test(s)) return 'TAKE_OUT';
  if (/\[DELIVERY\]/i.test(s)) return 'DELIVERY';
  return 'DINE_IN';
};

const enrichSalesWithMetadata = (rows = [], voidsMap = {}, metaMap = {}) =>
  (rows || []).map((sale) => {
    const voidInfo = voidsMap[sale.id] || null;
    const derivedStatus = voidInfo
      ? (voidInfo.status || (voidInfo.action_type === 'VOID' ? 'VOIDED' : voidInfo.action_type === 'REFUND' ? 'REFUNDED' : 'RETURNED'))
      : (sale.status || 'COMPLETED');
    const meta = metaMap[sale.id] || null;
    return {
      ...sale,
      status: derivedStatus,
      void_info: voidInfo,
      payments: meta?.payments || null,
      discount_details: meta?.discount_details || null,
      order_type: sale.order_type || meta?.order_type || resolveOrderTypeFromNotes(sale.notes)
    };
  });

// Get all sales with filters
router.get('/', async (req, res) => {
  try {
    // Parse pagination & fetch parameters (supports numbers up to 20,000 or 'all')
    const limitParam = req.query.limit;
    const isAll = limitParam === 'all' || limitParam === '-1';
    const parsedLimit = parseInt(limitParam, 10);
    const limit = isAll ? 20000 : Math.min(Math.max(parsedLimit || 50, 1), 20000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const searchParam = (req.query.search || '').trim().toLowerCase();
    const categoryParam = (req.query.category || '').trim();
    const paymentMethodParam = (req.query.payment_method || '').trim();
    const discountedOnly = req.query.discounted === 'true';
    const skipCount = req.query.skip_count === 'true';

    const needsInMemoryFilter = Boolean(searchParam || categoryParam);

    const applyFilters = (qb) => {
      const startDateParam = req.query.start_date || req.query.startDate;
      const endDateParam = req.query.end_date || req.query.endDate;

      if (startDateParam || endDateParam || req.query.date || req.query.period) {
        const win = resolveSalesDateWindow({
          period: req.query.period,
          start_date: startDateParam,
          end_date: endDateParam,
          date: req.query.date,
          year: req.query.year
        });
        qb = qb.gte('created_at', win.startStr).lte('created_at', win.endStr);
      }

      if (req.query.staff_id) qb = qb.eq('staff_id', req.query.staff_id);
      if (paymentMethodParam && paymentMethodParam.toUpperCase() !== 'ALL') {
        qb = qb.ilike('payment_method', paymentMethodParam);
      }
      if (discountedOnly) {
        qb = qb.gt('discount_amount', 0);
      }
      return qb;
    };

    const salesSelect = `
      *,
      users(id, name, username),
      sale_items(id, quantity, unit_price, notes, cup_size, add_ons, products(id, name, category))
    `;

    let query = supabase
      .from('sales')
      .select(salesSelect, skipCount ? undefined : { count: 'exact' })
      .order('created_at', { ascending: false });

    query = applyFilters(query);

    const effectiveLimit = needsInMemoryFilter ? Math.min(limit, 5000) : limit;
    const firstBatchLimit = Math.min(effectiveLimit, 1000);
    query = query.range(needsInMemoryFilter ? 0 : offset, (needsInMemoryFilter ? 0 : offset) + firstBatchLimit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    let filteredData = data || [];
    let total = skipCount ? filteredData.length : Math.max(count || 0, filteredData.length);

    // If requested > 1000 rows (or in-memory filter needs up to 5000 rows), paginate past PostgREST 1000-row cap
    const baseOffset = needsInMemoryFilter ? 0 : offset;
    const shouldFetchMore = skipCount || needsInMemoryFilter
      ? filteredData.length === firstBatchLimit
      : total > filteredData.length + baseOffset;

    if (effectiveLimit > 1000 && shouldFetchMore) {
      const targetCount = (skipCount || needsInMemoryFilter) ? effectiveLimit : Math.min(effectiveLimit, total - baseOffset);
      let currOffset = baseOffset + filteredData.length;

      while (filteredData.length < targetCount && ((skipCount || needsInMemoryFilter) || currOffset < total)) {
        const nextBatch = Math.min(1000, targetCount - filteredData.length);
        let nextQuery = supabase
          .from('sales')
          .select(salesSelect)
          .order('created_at', { ascending: false });

        nextQuery = applyFilters(nextQuery);
        nextQuery = nextQuery.range(currOffset, currOffset + nextBatch - 1);

        const { data: batchData, error: batchErr } = await nextQuery;
        if (batchErr) throw batchErr;
        if (!batchData || batchData.length === 0) break;
        filteredData.push(...batchData);
        currOffset += batchData.length;
        if (batchData.length < nextBatch) break;
      }

      if (skipCount) {
        total = filteredData.length;
      }
    }

    if (categoryParam) {
      filteredData = filteredData.filter(sale =>
        sale.sale_items?.some(item => item.products?.category === categoryParam)
      );
    }

    if (searchParam) {
      const cleanTerm = searchParam.replace(/^#/, '');
      filteredData = filteredData.filter(sale => {
        const receiptNum = String(sale.receipt_number || '').toLowerCase();
        const fullId = String(sale.id || '').toLowerCase();
        const staffName = String(sale.users?.name || sale.users?.username || '').toLowerCase();
        const paymentMethod = String(sale.payment_method || '').toLowerCase();
        const txRef = String(sale.transaction_reference || '').toLowerCase();
        const notes = String(sale.notes || '').toLowerCase();

        // Exact or prefix match for ID (only if searching by ID-like hex string >= 6 chars)
        const matchesId = cleanTerm.length >= 6 && fullId.startsWith(cleanTerm);

        const matchesTopLevel =
          receiptNum.includes(cleanTerm) ||
          matchesId ||
          staffName.includes(cleanTerm) ||
          paymentMethod.includes(cleanTerm) ||
          txRef.includes(cleanTerm) ||
          notes.includes(cleanTerm);

        if (matchesTopLevel) return true;

        // Check items, cup size, and add-ons inside the receipt
        return (sale.sale_items || []).some(item => {
          const prodName = String(item.products?.name || item.name || '').toLowerCase();
          const prodCat = String(item.products?.category || item.category || '').toLowerCase();
          const cupSize = String(item.cup_size || '').toLowerCase();
          const notesStr = String(item.notes || '').toLowerCase();
          
          let addOnsMatch = false;
          if (Array.isArray(item.add_ons)) {
            addOnsMatch = item.add_ons.some(ao => {
              let parsed = ao;
              if (typeof ao === 'string') {
                try { parsed = JSON.parse(ao); } catch { parsed = { name: ao }; }
              }
              const addOnName = String(parsed?.name || '').toLowerCase();
              return addOnName.includes(cleanTerm);
            });
          }

          return (
            prodName.includes(cleanTerm) ||
            prodCat.includes(cleanTerm) ||
            cupSize.includes(cleanTerm) ||
            notesStr.includes(cleanTerm) ||
            addOnsMatch
          );
        });
      });
    }

    if (needsInMemoryFilter) {
      total = filteredData.length;
      filteredData = filteredData.slice(offset, offset + limit);
    }

    const [voidsMap, metaMap] = await Promise.all([
      posOperationsService.getVoidRefundMap(),
      posOperationsService.getSaleMetadataMap()
    ]);

    res.json({
      data: enrichSalesWithMetadata(filteredData, voidsMap, metaMap),
      total,
      limit,
      offset
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

const fetchBoundedReportSales = async (startStr, endStr) => {
  const PAGE_SIZE = 1000;
  const rows = [];
  let pageIdx = 0;

  while (true) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, status, total_amount, discount_amount, created_at, users(id, name),
        sale_items(quantity, unit_price, products(id, name, category))
      `)
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    pageIdx += 1;
  }

  return rows;
};

// Sales summary by period (daily / weekly / monthly / yearly / custom)
const handleSalesSummaryReport = async (req, res) => {
  try {
    const windowInfo = resolveSalesDateWindow({
      period: req.query.period || 'day',
      start_date: req.query.start_date || req.query.startDate,
      end_date: req.query.end_date || req.query.endDate,
      date: req.query.date,
      year: req.query.year
    });

    const [sales, voidsMap] = await Promise.all([
      fetchBoundedReportSales(windowInfo.startStr, windowInfo.endStr),
      posOperationsService.getVoidRefundMap()
    ]);

    const summary = aggregateSalesSummaryReport(sales, voidsMap, windowInfo);

    res.json({
      ...summary,
      period: windowInfo.period,
      year: windowInfo.targetYear,
      date_range: {
        startDate: windowInfo.startStr,
        endDate: windowInfo.endStr
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

router.get('/summary/report', handleSalesSummaryReport);
router.get('/reports/summary', handleSalesSummaryReport);

// Void / Return / Refund a sale
router.post('/:id/void', async (req, res) => {
  try {
    const record = await posOperationsService.voidOrRefundSale({
      sale_id: req.params.id,
      action_type: req.body?.action_type,
      reason: req.body?.reason,
      restock_policy: req.body?.restock_policy,
      manager_pin: req.body?.manager_pin,
      requested_by_user: req.user
    });
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get single sale detail (Receipt)
router.get('/:id', async (req, res) => {
  try {
    const [{ data, error }, voidsMap, metaMap] = await Promise.all([
      supabase
        .from('sales')
        .select(`
          *,
          users(id, name, username),
          sale_items(id, quantity, unit_price, discount_percent, notes, cup_size, add_ons, products(id, name, category))
        `)
        .eq('id', req.params.id)
        .single(),
      posOperationsService.getVoidRefundMap(),
      posOperationsService.getSaleMetadataMap()
    ]);
    if (error) throw error;
    res.json(enrichSalesWithMetadata([data], voidsMap, metaMap)[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
