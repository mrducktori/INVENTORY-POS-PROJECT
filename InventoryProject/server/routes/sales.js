import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { toManilaStartOfDay, toManilaEndOfDay } from "../utils/dateUtils.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));

// Get all sales with filters
router.get('/', async (req, res) => {
  try {
    // Parse pagination parameters (default limit 50, max 500, offset 0)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const searchParam = (req.query.search || '').trim().toLowerCase();
    const categoryParam = (req.query.category || '').trim();
    const paymentMethodParam = (req.query.payment_method || '').trim();
    const discountedOnly = req.query.discounted === 'true';

    const needsInMemoryFilter = Boolean(searchParam || categoryParam);

    let query = supabase
      .from('sales')
      .select(`
        *,
        users(id, name, username),
        sale_items(id, quantity, unit_price, cup_size, add_ons, products(id, name, category))
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (!needsInMemoryFilter) {
      query = query.range(offset, offset + limit - 1);
    } else {
      // Safety ceiling: prevent unbounded queries from exhausting Node.js heap memory
      query = query.limit(1000);
    }

    // Date range filtering (supports both snake_case and camelCase)
    const startDateParam = req.query.start_date || req.query.startDate;
    const endDateParam = req.query.end_date || req.query.endDate;

    if (startDateParam && endDateParam) {
      query = query
        .gte('created_at', toManilaStartOfDay(startDateParam))
        .lte('created_at', toManilaEndOfDay(endDateParam));
    } else if (startDateParam) {
      query = query.gte('created_at', toManilaStartOfDay(startDateParam));
    } else if (endDateParam) {
      query = query.lte('created_at', toManilaEndOfDay(endDateParam));
    } else if (req.query.date) {
      const d = req.query.date;
      query = query.gte('created_at', toManilaStartOfDay(d)).lte('created_at', toManilaEndOfDay(d));
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
    if (paymentMethodParam && paymentMethodParam.toUpperCase() !== 'ALL') {
      query = query.ilike('payment_method', paymentMethodParam);
    }
    if (discountedOnly) {
      query = query.gt('discount_amount', 0);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    let filteredData = data || [];
    let total = Math.max(count || 0, filteredData.length);

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

    res.json({ data: filteredData, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sales summary by period (day/week/month)
router.get('/summary/report', async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const customStart = req.query.start_date || req.query.startDate;
    const customEnd = req.query.end_date || req.query.endDate;
    
    // Get current date in Manila timezone
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    
    let startStr;
    let endStr = null;

    if ((period === 'custom' || customStart || customEnd) && (customStart || customEnd)) {
      startStr = toManilaStartOfDay(customStart || customEnd);
      endStr = toManilaEndOfDay(customEnd || customStart);
    } else if (period === 'day' || period === 'daily') {
      startStr = `${y}-${m}-${d}T00:00:00+08:00`;
      endStr = `${y}-${m}-${d}T23:59:59.999+08:00`;
    } else if (period === 'week' || period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const wy = weekAgo.getFullYear();
      const wm = String(weekAgo.getMonth() + 1).padStart(2, '0');
      const wd = String(weekAgo.getDate()).padStart(2, '0');
      startStr = `${wy}-${wm}-${wd}T00:00:00+08:00`;
      endStr = `${y}-${m}-${d}T23:59:59.999+08:00`;
    } else {
      startStr = `${y}-${m}-01T00:00:00+08:00`;
      endStr = `${y}-${m}-${d}T23:59:59.999+08:00`;
    }

    let query = supabase
      .from('sales')
      .select(`
        total_amount, created_at, users(id, name),
        sale_items(quantity, unit_price, products(id, name))
      `)
      .gte('created_at', startStr);

    if (endStr) {
      query = query.lte('created_at', endStr);
    }

    const { data: sales, error } = await query;

    if (error) throw error;

    const total_sales = (sales || []).reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const total_transactions = (sales || []).length;
    let total_items_sold = 0;
    
    const staffMap = {};
    const productMap = {};

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
        
        const prodId = item.products?.id;
        const prodName = item.products?.name || 'Unknown Product';
        const category = item.products?.category || 'Uncategorized';
        
        if (prodId) {
          if (!productMap[prodId]) {
            productMap[prodId] = { id: prodId, name: prodName, category, qty_sold: 0, revenue: 0 };
          }
          productMap[prodId].qty_sold += item.quantity;
          productMap[prodId].revenue += (item.quantity * parseFloat(item.unit_price));
        }
      });
    });

    const staff_data = Object.values(staffMap).sort((a, b) => b.total_sales - a.total_sales);
    const product_data = Object.values(productMap).sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 10);

    res.json({ total_sales, total_transactions, total_items_sold, staff_data, product_data });
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
