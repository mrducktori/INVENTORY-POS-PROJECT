import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import { convertToBaseUnit } from '../utils/unitUtils.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import * as batchService from '../services/batchService.js';
import * as recipesService from '../services/recipesService.js';
import * as posOperationsService from '../services/posOperationsService.js';
import {
  forecastStockUsingAI,
  invalidateAiForecastCache,
  isPhilippineHoliday,
  isPhilippinePayday,
  getMultiYearProductSummary
} from '../services/aiForecastingService.js';

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));
router.use(requirePermission('Dashboard', 'Forecasting', 'Reports'));

let cached90DaySales = null;
let cached90DayAt = 0;
let inflight90DayPromise = null;
let analyticsCacheEpoch = 0;
const SALES_CACHE_TTL_MS = 60 * 1000;

export function invalidateAnalyticsCache() {
  analyticsCacheEpoch++;
  cached90DaySales = null;
  cached90DayAt = 0;
  inflight90DayPromise = null;
  invalidateAiForecastCache();
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Simulates FEFO consumption across non-expired expiring batches to project spoilage remainder.
 */
export const simulateFefoSpoilage = (batches = [], avgDailyBurnRate = 0) => {
  const burnRate = Number(avgDailyBurnRate) || 0;
  if (burnRate <= 0 || !Array.isArray(batches) || batches.length === 0) {
    return 0;
  }

  const expiringBatches = batches
    .filter((b) => !b?.is_expired && b?.expiry_date && Number(b?.quantity_remaining) > 0)
    .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));

  let consumedBurnUnits = 0;
  let projectedSpoilage = 0;

  for (const batch of expiringBatches) {
    const batchQty = Number(batch.quantity_remaining) || 0;
    const daysLeft = Math.max(0, Number(batch.days_until_expiry) || 0);
    const maxBurnBeforeExpiry = daysLeft * burnRate;
    const availableCapacity = Math.max(0, maxBurnBeforeExpiry - consumedBurnUnits);
    const consumedFromBatch = Math.min(batchQty, availableCapacity);
    const spoiledFromBatch = Math.max(0, batchQty - consumedFromBatch);

    consumedBurnUnits += consumedFromBatch;
    projectedSpoilage += spoiledFromBatch;
  }

  return round2(projectedSpoilage);
};

export const computeIngredientForecastMetrics = (item, avgDailyBurnRate = 0) => {
  const rawStock = parseFloat(item.stock_quantity) || 0;
  const usableStock = parseFloat(item.usable_stock ?? item.stock_quantity) || 0;
  const expiredStock = parseFloat(item.expired_stock) || 0;
  const expiringSoonStock = parseFloat(item.expiring_soon_stock) || 0;
  const lowStockAlert = parseFloat(item.low_stock_alert) || 0;
  const burnRate = Math.max(0, Number(avgDailyBurnRate) || 0);

  const projectedSpoilageQty = simulateFefoSpoilage(item.batches || [], burnRate);
  const effectiveUsableStock = Math.max(0, round2(usableStock - projectedSpoilageQty));

  let daysRemaining = null;
  let depletionDate = null;
  let urgencyStatus = 'HEALTHY';

  const maxStock = parseFloat(item.max_stock) || parseFloat(item.max_capacity) || (lowStockAlert * 2) || 20;
  const lowStockThreshold = maxStock * 0.5;

  if (usableStock <= 0) {
    daysRemaining = 0;
    urgencyStatus = 'OUT_OF_STOCK';
  } else if (burnRate > 0) {
    const rawDays = effectiveUsableStock / burnRate;
    daysRemaining = parseFloat(rawDays.toFixed(1));

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Math.round(rawDays));
    depletionDate = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

    if (daysRemaining <= 3) {
      urgencyStatus = 'CRITICAL';
    } else if (daysRemaining <= 7 || effectiveUsableStock <= lowStockThreshold) {
      urgencyStatus = 'LOW_STOCK';
    } else {
      urgencyStatus = 'HEALTHY';
    }
  } else if (effectiveUsableStock <= lowStockThreshold) {
    urgencyStatus = 'LOW_STOCK';
  }

  const isPerishable = Boolean(item.is_perishable);
  const defaultShelfLifeDays = item.default_shelf_life_days ? Number(item.default_shelf_life_days) : null;
  const recommendedHorizonDays = (isPerishable && defaultShelfLifeDays)
    ? Math.min(14, Math.max(3, Math.floor(defaultShelfLifeDays * 0.85)))
    : 14;

  const rawTargetStock = Math.max(burnRate * 14, lowStockAlert * 1.5);
  const shelfLifeMaxStock = (isPerishable && defaultShelfLifeDays)
    ? Math.max(lowStockAlert, burnRate * recommendedHorizonDays)
    : rawTargetStock;
  const shelfLifeCapped = Boolean(isPerishable && defaultShelfLifeDays && shelfLifeMaxStock < rawTargetStock);
  const targetStock = shelfLifeCapped ? shelfLifeMaxStock : rawTargetStock;
  const stockDeficit = Math.max(0, targetStock - effectiveUsableStock);

  const spoilageRisk = (expiredStock > 0 || projectedSpoilageQty > 0)
    ? 'HIGH'
    : (expiringSoonStock > 0 ? 'MODERATE' : 'LOW');

  return {
    rawStock,
    usableStock,
    expiredStock,
    expiringSoonStock,
    projectedSpoilageQty,
    effectiveUsableStock,
    daysRemaining,
    depletionDate,
    urgencyStatus,
    recommendedHorizonDays,
    shelfLifeCapped,
    stockDeficit,
    spoilageRisk,
    isPerishable,
    defaultShelfLifeDays
  };
};

/**
 * Fetches all 90-day (3-month) non-voided sales with their sale_items using indexed two-step queries
 * (avoiding slow lateral joins and bypassing PostgREST's 1,000-row single-query cap)
 * with a shared 60-second cache and in-flight request deduplication.
 */
async function fetchSalesSince(sinceIso) {
  const now = Date.now();
  if (cached90DaySales && now - cached90DayAt < SALES_CACHE_TTL_MS) {
    return cached90DaySales;
  }
  if (inflight90DayPromise) {
    return inflight90DayPromise;
  }

  const startEpoch = analyticsCacheEpoch;
  const promise = (async () => {
    try {
      const PAGE_SIZE = 1000;
      const sales = [];
      let pageIdx = 0;
      while (true) {
        const { data: page, error } = await supabase
          .from('sales')
          .select('id, created_at, status')
          .gte('created_at', sinceIso)
          .order('id', { ascending: true })
          .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        sales.push(...page);
        if (page.length < PAGE_SIZE) break;
        pageIdx++;
      }

      const voidsMap = await posOperationsService.getVoidRefundMap();
      const validSales = sales.filter((s) => {
        const statusUpper = String(s.status || '').toUpperCase();
        return !voidsMap[s.id] && !['VOIDED', 'REFUNDED', 'RETURNED'].includes(statusUpper);
      });

      if (validSales.length === 0) {
        if (analyticsCacheEpoch === startEpoch) {
          cached90DaySales = [];
          cached90DayAt = Date.now();
        }
        return [];
      }

      // 100 ids per chunk, each chunk paged past PostgREST's 1000-row cap.
      const CHUNK = 100;
      const chunks = [];
      for (let i = 0; i < validSales.length; i += CHUNK) {
        chunks.push(validSales.slice(i, i + CHUNK).map(s => s.id));
      }

      const fetchChunkItems = async (ids) => {
        const rows = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase
            .from('sale_items')
            .select('sale_id, product_id, quantity, unit_price, cup_size, add_ons')
            .in('sale_id', ids)
            .order('id', { ascending: true })
            .range(from, from + 999);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        return rows;
      };
      const itemPages = await Promise.all(chunks.map(fetchChunkItems));

      const itemsBySale = new Map();
      for (const rows of itemPages) {
        for (const item of rows) {
          let arr = itemsBySale.get(item.sale_id);
          if (!arr) {
            arr = [];
            itemsBySale.set(item.sale_id, arr);
          }
          arr.push(item);
        }
      }

      const result = validSales.map(s => ({
        created_at: s.created_at,
        sale_items: itemsBySale.get(s.id) || []
      }));

      if (analyticsCacheEpoch === startEpoch) {
        cached90DaySales = result;
        cached90DayAt = Date.now();
      }
      return result;
    } finally {
      if (inflight90DayPromise === promise) {
        inflight90DayPromise = null;
      }
    }
  })();

  inflight90DayPromise = promise;
  return promise;
}

/**
 * GET /api/analytics/ingredient-forecast
 * Computes ingredient depletion predictions based on actual sales, per-size recipes, FEFO spoilage, and shelf-life caps.
 */
router.get('/ingredient-forecast', async (req, res) => {
  try {
    if (req.query.refresh === 'true') {
      invalidateAnalyticsCache();
    }
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Fetch ingredients, recipes (with per-size overrides), products, category settings, suppliers mapping, and 90-day sales in parallel
    const [
      { data: ingredients, error: ingErr },
      recipes,
      { data: products, error: prodErr },
      { data: categorySettings, error: catErr },
      { data: supplierMappings, error: supErr },
      salesWithItems
    ] = await Promise.all([
      supabase.from('ingredients').select('*').eq('is_archived', false),
      recipesService.getRecipes(),
      supabase.from('products').select('id, sizes, category').eq('is_archived', false),
      supabase.from('category_settings').select('category, sizes'),
      supabase.from('supplier_ingredients').select('*, suppliers(id, name)'),
      fetchSalesSince(ninetyDaysAgo.toISOString())
    ]);

    if (ingErr) throw ingErr;
    if (prodErr) throw prodErr;
    if (catErr) throw catErr;
    if (supErr) throw supErr;

    const enrichedIngredients = await batchService.enrichIngredientsWithBatches(ingredients || []);

    const normCat = (c) => String(c || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const catSizesMap = new Map((categorySettings || []).map(c => [normCat(c.category), c.sizes || []]));
    const productMap = new Map();
    for (const p of products || []) {
      const ownSizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : (catSizesMap.get(normCat(p.category)) || []);
      productMap.set(p.id, { ...p, resolvedSizes: ownSizes });
    }

    // Map recipes by product_id
    const recipeMap = {};
    (recipes || []).forEach(r => {
      if (!recipeMap[r.product_id]) recipeMap[r.product_id] = [];
      recipeMap[r.product_id].push(r);
    });

    // Map supplier mapping by ingredient_id (primary + full list)
    const supplierMap = {};
    const supplierListMap = {};
    (supplierMappings || []).forEach(sm => {
      if (!supplierMap[sm.ingredient_id]) {
        supplierMap[sm.ingredient_id] = sm;
      }
      if (!supplierListMap[sm.ingredient_id]) {
        supplierListMap[sm.ingredient_id] = [];
      }
      if (sm.suppliers?.id) {
        supplierListMap[sm.ingredient_id].push({
          supplier_id: sm.suppliers.id,
          supplier_name: sm.suppliers.name,
          default_purchase_unit: sm.default_purchase_unit || null,
          default_conversion_factor: parseFloat(sm.default_conversion_factor) || null,
          default_price: parseFloat(sm.default_price) || null,
        });
      }
    });

    // Map ingredients by id for unit lookup
    const ingredientLookup = {};
    enrichedIngredients.forEach(ing => {
      ingredientLookup[ing.id] = ing;
    });

    // Calculate actual ingredient consumption across 90d, 30d, and 14d windows using per-size recipe overrides
    const consumption90Days = {};
    const consumption30Days = {};
    const consumption14Days = {};

    (salesWithItems || []).forEach(sale => {
      const saleTime = new Date(sale.created_at);
      const isWithin30 = saleTime >= thirtyDaysAgo;
      const isRecent = saleTime >= fourteenDaysAgo;
      (sale.sale_items || []).forEach(si => {
        const prodRecipes = recipeMap[si.product_id] || [];
        const soldQty = parseFloat(si.quantity) || 0;
        const prodInfo = productMap.get(si.product_id);
        const sizeObj = si.cup_size && prodInfo?.resolvedSizes
          ? prodInfo.resolvedSizes.find(s => String(s?.name || '').trim().toLowerCase() === String(si.cup_size).trim().toLowerCase()) || null
          : null;

        prodRecipes.forEach(rec => {
          const ing = ingredientLookup[rec.ingredient_id];
          if (!ing) return;

          const qtyForSize = recipesService.resolveRecipeQuantityForSize(rec, si.cup_size, sizeObj);
          if (qtyForSize <= 0) return;

          const baseAmount = convertToBaseUnit(qtyForSize, rec.recipe_unit || ing.unit, ing.unit) * soldQty;

          consumption90Days[rec.ingredient_id] = (consumption90Days[rec.ingredient_id] || 0) + baseAmount;
          if (isWithin30) {
            consumption30Days[rec.ingredient_id] = (consumption30Days[rec.ingredient_id] || 0) + baseAmount;
          }
          if (isRecent) {
            consumption14Days[rec.ingredient_id] = (consumption14Days[rec.ingredient_id] || 0) + baseAmount;
          }
        });
      });
    });

    let criticalCount = 0;
    let lowStockCount = 0;
    let healthyCount = 0;
    let totalRestockCapital = 0;

    const forecastedIngredients = enrichedIngredients.map(item => {
      const lowStockAlert = parseFloat(item.low_stock_alert) || 0;
      const unit = item.unit || 'units';

      const totalUsed90 = consumption90Days[item.id] || 0;
      const totalUsed30 = consumption30Days[item.id] || 0;
      const totalUsed14 = consumption14Days[item.id] || 0;

      const dailyRate90 = totalUsed90 / 90;
      const dailyRate30 = totalUsed30 / 30;
      const dailyRate14 = totalUsed14 / 14;

      // 3-tier weighted daily burn rate: 50% recent 14 days, 30% last 30 days, 20% 90-day quarterly baseline
      const avgDailyBurnRate = dailyRate14 > 0
        ? (dailyRate14 * 0.50 + dailyRate30 * 0.30 + dailyRate90 * 0.20)
        : (dailyRate30 > 0 ? (dailyRate30 * 0.65 + dailyRate90 * 0.35) : dailyRate90);

      const metrics = computeIngredientForecastMetrics(item, avgDailyBurnRate);

      if (metrics.urgencyStatus === 'OUT_OF_STOCK' || metrics.urgencyStatus === 'CRITICAL') {
        criticalCount++;
      } else if (metrics.urgencyStatus === 'LOW_STOCK') {
        lowStockCount++;
      } else {
        healthyCount++;
      }

      const supMapping = supplierMap[item.id];
      const purchaseUnit = item.purchase_unit || supMapping?.default_purchase_unit || unit;
      const conversionFactor = parseFloat(item.conversion_factor) || parseFloat(supMapping?.default_conversion_factor) || 1;
      const suggestedPurchaseQty = metrics.stockDeficit > 0 ? Math.ceil(metrics.stockDeficit / conversionFactor) : 0;

      const unitCost = parseFloat(supMapping?.default_price) || (parseFloat(item.unit_cost) * conversionFactor) || parseFloat(item.cost_per_purchase_unit) || 0;
      const estimatedCost = suggestedPurchaseQty * unitCost;

      if (suggestedPurchaseQty > 0) {
        totalRestockCapital += estimatedCost;
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category || 'Raw Materials',
        stock_quantity: metrics.rawStock,
        usable_stock: metrics.usableStock,
        effective_usable_stock: metrics.effectiveUsableStock,
        expired_stock: metrics.expiredStock,
        expiring_soon_stock: metrics.expiringSoonStock,
        nearest_expiry_date: item.nearest_expiry_date || null,
        is_perishable: metrics.isPerishable,
        default_shelf_life_days: metrics.defaultShelfLifeDays,
        recommended_horizon_days: metrics.recommendedHorizonDays,
        projected_spoilage_qty: metrics.projectedSpoilageQty,
        shelf_life_capped: metrics.shelfLifeCapped,
        spoilage_risk: metrics.spoilageRisk,
        unit: unit,
        low_stock_alert: lowStockAlert,
        avg_daily_burn_rate: parseFloat(avgDailyBurnRate.toFixed(2)),
        days_remaining: metrics.daysRemaining,
        depletion_date: metrics.depletionDate,
        urgency_status: metrics.urgencyStatus,
        stock_health_percentage: lowStockAlert > 0 ? Math.min(Math.round((metrics.usableStock / (lowStockAlert * 2)) * 100), 100) : 100,

        // Purchasing & Restock Data
        purchase_unit: purchaseUnit,
        conversion_factor: conversionFactor,
        suggested_purchase_qty: suggestedPurchaseQty,
        unit_price: unitCost,
        estimated_restock_cost: parseFloat(estimatedCost.toFixed(2)),
        supplier_id: supMapping?.suppliers?.id || null,
        supplier_name: supMapping?.suppliers?.name || 'Unassigned Supplier',
        available_suppliers: supplierListMap[item.id] || []
      };
    });

    const priorityWeight = { 'OUT_OF_STOCK': 0, 'CRITICAL': 1, 'LOW_STOCK': 2, 'HEALTHY': 3 };
    forecastedIngredients.sort((a, b) => {
      const pDiff = priorityWeight[a.urgency_status] - priorityWeight[b.urgency_status];
      if (pDiff !== 0) return pDiff;
      const aDays = a.days_remaining !== null ? a.days_remaining : 9999;
      const bDays = b.days_remaining !== null ? b.days_remaining : 9999;
      return aDays - bDays;
    });

    res.json({
      summary: {
        totalIngredients: enrichedIngredients.length,
        criticalCount,
        lowStockCount,
        healthyCount,
        totalRestockCapitalRequired: parseFloat(totalRestockCapital.toFixed(2))
      },
      ingredients: forecastedIngredients
    });
  } catch (err) {
    console.error("Ingredient Forecast Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analytics/ai-forecast
 * Generates an AI-driven stock & demand forecast for a target product and month.
 * Adapted from classmate's AI_API_StockForecastingService architecture.
 * Request body: { productId, year, month }
 */
router.post('/ai-forecast', async (req, res) => {
  try {
    const { productId, year, month } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }
    const manilaYear = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })).getFullYear();
    const m = month == null || month === '' ? null : Number(month);
    const y = year == null || year === '' ? null : Number(year);
    if (m !== null && !(Number.isInteger(m) && m >= 1 && m <= 12)) {
      return res.status(400).json({ error: 'month must be an integer 1-12' });
    }
    if (y !== null && !(Number.isInteger(y) && Math.abs(y - manilaYear) <= 1)) {
      return res.status(400).json({ error: `year must be within ${manilaYear - 1}-${manilaYear + 1}` });
    }

    const forecast = await forecastStockUsingAI({ productId, year: y, month: m });
    res.json(forecast);
  } catch (err) {
    console.error('AI Stock Forecasting Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/demand-forecast
 * Computes detailed demand forecasts across active products using a 90-day (3-month) rolling baseline and Philippine calendar intelligence.
 */
router.get('/demand-forecast', async (req, res) => {
  try {
    if (req.query.refresh === 'true') {
      invalidateAnalyticsCache();
    }
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // 1. Fetch 90-day sale items and products with current stock in parallel
    const [
      salesWithItems,
      { data: allProducts, error: prodError }
    ] = await Promise.all([
      fetchSalesSince(ninetyDaysAgo.toISOString(), 'created_at, sale_items(product_id, quantity, unit_price)'),
      supabase
        .from('products')
        .select('id, name, category, price, stock_quantity, track_stock')
        .eq('is_archived', false)
    ]);

    if (prodError) throw prodError;

    const productMap = {};
    (allProducts || []).forEach(p => {
      productMap[p.id] = {
        id: p.id,
        name: p.name,
        category: p.category || 'General',
        track_stock: p.track_stock !== false,
        currentStock: parseFloat(p.stock_quantity) || 0,
        price: parseFloat(p.price) || 0,
        totalQty: 0,  // last 90 days
        qty30: 0,     // last 30 days
        recentQty: 0, // last 14 days
        priorQty: 0,  // 14-30 days ago
        weekendQty: 0,
        paydayQty: 0,
        holidayQty: 0
      };
    });

    const holidayDateKeys = new Set();

    (salesWithItems || []).forEach(s => {
      const rawSaleDate = new Date(s.created_at);
      const saleDate = new Date(rawSaleDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const isWithin30 = rawSaleDate >= thirtyDaysAgo;
      const isRecent = rawSaleDate >= fourteenDaysAgo;
      const dayOfWeek = saleDate.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      const isHoliday = isPhilippineHoliday(saleDate);
      const isPayday = isPhilippinePayday(saleDate) && !isHoliday;
      if (isHoliday) {
        holidayDateKeys.add(`${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}-${String(saleDate.getDate()).padStart(2, '0')}`);
      }

      (s.sale_items || []).forEach(si => {
        const pid = si.product_id;
        if (!productMap[pid]) return; // archived/unknown product: not forecastable

        const qty = parseFloat(si.quantity) || 0;
        productMap[pid].totalQty += qty;
        if (isWithin30) {
          productMap[pid].qty30 += qty;
          if (isRecent) productMap[pid].recentQty += qty;
          else productMap[pid].priorQty += qty;
        }

        if (isWeekend) productMap[pid].weekendQty += qty;
        if (isPayday) productMap[pid].paydayQty += qty;
        if (isHoliday) productMap[pid].holidayQty += qty;
      });
    });

    // 2. Generate Forecasts with Multi-Year Seasonality (2023-2026), YoY Trends, 90-Day Velocity & Calendar Intelligence
    const manilaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentYear = manilaNow.getFullYear();
    const currentMonth = manilaNow.getMonth() + 1;
    const forecasts = Object.values(productMap).map(stats => {
      const avgDaily90 = stats.totalQty / 90;
      const avgDaily30 = stats.qty30 / 30;
      const avgDaily = avgDaily30 > 0 ? avgDaily30 : avgDaily90;

      // Short-term velocity growth: recent 14 days vs prior 16 days
      const recentDaily = stats.recentQty / 14;
      const priorDaily = stats.priorQty / 16;

      let shortTermGrowth = 0;
      if (priorDaily > 0.5) {
        shortTermGrowth = ((recentDaily - priorDaily) / priorDaily) * 100;
      } else if (avgDaily > 0.1) {
        shortTermGrowth = ((recentDaily - avgDaily) / avgDaily) * 50;
      }
      shortTermGrowth = Math.max(-100, Math.min(100, shortTermGrowth));

      // Multi-Year (2023-2026) Seasonal Decomposition & Year-over-Year (YoY) History
      const multiYearMeta = getMultiYearProductSummary(stats.id);
      const seasonalIndices = multiYearMeta?.seasonalIndices || {};
      const currentSeasonalIndex = seasonalIndices[currentMonth] || 1.0;
      const yoyGrowthPct = multiYearMeta?.yoyGrowthPct ?? 12.0;

      // Same-month in completed prior years
      const priorSameMonths = (multiYearMeta?.monthlySales || []).filter(
        m => m.month === currentMonth && m.year < currentYear
      );
      const lastYearSameMonth = (multiYearMeta?.monthlySales || []).find(
        m => m.month === currentMonth && m.year === currentYear - 1
      );

      // Compute multi-year seasonal baseline daily rate for current month
      let multiYearDailyBaseline = avgDaily;
      if (priorSameMonths.length > 0) {
        const avgPriorSameMonthDaily =
          priorSameMonths.reduce((s, m) => s + (m.avgDailyUnits || 0), 0) / priorSameMonths.length;
        const yoyLift = Math.max(0.85, Math.min(1.35, 1 + (yoyGrowthPct / 100) * 0.6));
        multiYearDailyBaseline = avgPriorSameMonthDaily * yoyLift;
      }

      // 3-tier weighted counter velocity: 50% 14d, 30% 30d, 20% 90d baseline; blended 65/35 with 4-year YoY seasonality
      const weightedRecentDaily = recentDaily > 0
        ? (recentDaily * 0.50 + avgDaily30 * 0.30 + avgDaily90 * 0.20)
        : (avgDaily30 > 0 ? (avgDaily30 * 0.65 + avgDaily90 * 0.35) : avgDaily90);
      const blendedBaseDaily = multiYearDailyBaseline > 0
        ? (weightedRecentDaily * 0.65 + multiYearDailyBaseline * 0.35)
        : weightedRecentDaily;

      // Blended trend indicator (65% recent momentum + 35% YoY trajectory)
      const growthRate = Math.max(-100, Math.min(100, shortTermGrowth * 0.65 + yoyGrowthPct * 0.35));

      // 7-day & 30-day cyclical projection with exact mean-preserving calendar normalization
      const holDaysObserved = holidayDateKeys.size;
      const nonHolDaysObserved = Math.max(1, 90 - holDaysObserved);
      const avgHolDaily = holDaysObserved > 0 && stats.holidayQty > 0 ? stats.holidayQty / holDaysObserved : null;
      const avgNonHolDaily = (stats.totalQty - (stats.holidayQty || 0)) / nonHolDaysObserved;
      const holidayMult = avgHolDaily !== null && avgNonHolDaily > 0
        ? Math.max(0.75, Math.min(1.20, avgHolDaily / avgNonHolDaily))
        : 0.85;

      const futureDayRows = [];
      for (let i = 1; i <= 30; i++) {
        const futureDate = new Date(manilaNow);
        futureDate.setDate(futureDate.getDate() + i);
        const fMonth = futureDate.getMonth() + 1;
        const dayOfWeek = futureDate.getDay();
        const isWknd = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHol = isPhilippineHoliday(futureDate);
        const isPay = isPhilippinePayday(futureDate);

        const futureMonthSeasonIdx = seasonalIndices[fMonth] || 1.0;
        const seasonRatio = currentSeasonalIndex > 0 ? (futureMonthSeasonIdx / currentSeasonalIndex) : 1.0;

        let calMult = 1;
        if (isWknd) calMult *= 1.24;
        if (isPay && !isHol) calMult *= 1.20;
        if (isHol) calMult *= holidayMult;

        futureDayRows.push({ dayIdx: i, seasonRatio, calMult });
      }

      const mean30CalMult = futureDayRows.reduce((s, r) => s + r.calMult, 0) / Math.max(1, futureDayRows.length);
      const momentumFactor = 1 + Math.max(-0.3, Math.min(0.4, growthRate / 100)) * 0.35;

      let next7DaysPredicted = 0;
      let next30DaysPredicted = 0;
      for (const row of futureDayRows) {
        const dayEst = (blendedBaseDaily / (mean30CalMult || 1)) * row.seasonRatio * momentumFactor * row.calMult;
        if (row.dayIdx <= 7) next7DaysPredicted += dayEst;
        next30DaysPredicted += dayEst;
      }

      const trackStock = stats.track_stock !== false;
      const predictedNext7Days = Math.round(next7DaysPredicted);
      const predictedNext30Days = Math.round(next30DaysPredicted);
      const recommendedOrderQuantity = trackStock ? Math.max(0, predictedNext7Days - stats.currentStock) : 0;
      const confidence = Math.min(96, 78 + (multiYearMeta?.totalMonthsAnalyzed ? 12 : 0) + (stats.totalQty > 20 ? 5 : 0));

      return {
        id: stats.id,
        name: stats.name,
        category: stats.category,
        track_stock: trackStock,
        currentStock: stats.currentStock,
        avgDailySales: avgDaily.toFixed(1),
        predictedNext7Days,
        predictedNext30Days,
        recommendedOrderQuantity,
        growthRate: growthRate.toFixed(1),
        shortTermGrowth: shortTermGrowth.toFixed(1),
        yoyGrowth: yoyGrowthPct.toFixed(1),
        seasonalIndex: currentSeasonalIndex.toFixed(2),
        sameMonthLastYearUnits: lastYearSameMonth ? Math.round(lastYearSameMonth.unitsSold) : null,
        yearsAnalyzed: multiYearMeta?.yearsCovered?.length || 4,
        confidence,
        stockoutRisk: !trackStock
          ? null
          : (stats.currentStock <= 0 ? 'Out of Stock' : (stats.currentStock < predictedNext7Days ? 'High' : (growthRate > 5 ? 'Medium' : 'Low'))),
        seasonalImpact: currentSeasonalIndex >= 1.12 ? 'Peak Season' : (currentSeasonalIndex <= 0.90 ? 'Off-Peak' : 'Normal'),
        weekendRatio: stats.totalQty > 0 ? ((stats.weekendQty / stats.totalQty) * 100).toFixed(0) : '0'
      };
    }).sort((a, b) => b.predictedNext7Days - a.predictedNext7Days);

    res.json(forecasts);
  } catch (err) {
    console.error("Forecast Analytics Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

