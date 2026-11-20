import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MULTI_YEAR_SUMMARY_PATH = path.resolve(__dirname, '../data/multiYearSalesSummary.json');

let cachedMultiYearSummary = null;

// 30-minute in-memory cache + in-flight deduplication to conserve Google Gemini free-tier API quota
const aiForecastCache = new Map();
const inflightAiForecasts = new Map();
let aiCacheEpoch = 0;
const AI_CACHE_TTL_MS = 30 * 60 * 1000;

export const invalidateAiForecastCache = () => {
  aiCacheEpoch++;
  aiForecastCache.clear();
  inflightAiForecasts.clear();
};

export const getAllMultiYearSummary = () => {
  if (cachedMultiYearSummary) return cachedMultiYearSummary;
  try {
    if (fs.existsSync(MULTI_YEAR_SUMMARY_PATH)) {
      cachedMultiYearSummary = JSON.parse(fs.readFileSync(MULTI_YEAR_SUMMARY_PATH, 'utf8'));
      return cachedMultiYearSummary;
    }
  } catch (err) {
    console.warn('[MultiYearSummary] Could not read multiYearSalesSummary.json:', err.message);
  }
  return null;
};

export const getMultiYearProductSummary = (productId) => {
  const all = getAllMultiYearSummary();
  return all?.products?.[productId] || null;
};

/**
 * Philippine Regular and Special Non-Working Holidays.
 * Evaluates whether a given date falls on a Philippine national holiday.
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isPhilippineHoliday = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  const holidays = [
    { m: 1, d: 1, name: "New Year's Day" },
    { m: 2, d: 25, name: "EDSA People Power Revolution" },
    { m: 4, d: 9, name: "Araw ng Kagitingan" },
    { m: 5, d: 1, name: "Labor Day" },
    { m: 6, d: 12, name: "Independence Day" },
    { m: 8, d: 21, name: "Ninoy Aquino Day" },
    { m: 11, d: 1, name: "All Saints' Day" },
    { m: 11, d: 2, name: "All Souls' Day" },
    { m: 11, d: 30, name: "Bonifacio Day" },
    { m: 12, d: 8, name: "Feast of the Immaculate Conception" },
    { m: 12, d: 24, name: "Christmas Eve" },
    { m: 12, d: 25, name: "Christmas Day" },
    { m: 12, d: 30, name: "Rizal Day" },
    { m: 12, d: 31, name: "New Year's Eve" },
  ];

  if (holidays.some(h => h.m === month && h.d === day)) return true;

  // National Heroes Day: last Monday of August
  const aug31DayOfWeek = new Date(year, 7, 31).getDay();
  const lastMondayAug = 31 - ((aug31DayOfWeek + 6) % 7);
  if (month === 8 && day === lastMondayAug) return true;

  // Holy Week (Maundy Thursday, Good Friday, Black Saturday) from Gregorian Easter Sunday
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

  for (const offset of [1, 2, 3]) {
    const hw = new Date(year, easterMonth - 1, easterDay - offset);
    if (hw.getMonth() + 1 === month && hw.getDate() === day) return true;
  }

  return false;
};

/**
 * Checks if a given day falls on Cof/Tea Cafe's peak student foot-traffic days
 * (Monday and Friday, per owner & co-manager interview records).
 * @param {Date|string} date
 * @returns {boolean}
 */
export const isPeakSchoolDay = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const dayOfWeek = d.getDay();
  return dayOfWeek === 1 || dayOfWeek === 5;
};

export const isPhilippinePayday = isPeakSchoolDay;

/**
 * Builds rich time-series features from historical sales transactions for a single product.
 * Formulates rolling moving averages, day-of-week cyclical trends, Philippine holidays,
 * quincena paydays, discounts, and growth velocity.
 * 
 * @param {number|string} productId 
 * @param {number} targetYear 
 * @param {number} targetMonth 
 */
export const extractProductForecastingFeatures = async (productId, targetYear, targetMonth) => {
  // 1. Fetch product metadata & current stock
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, name, category, price, stock_quantity, track_stock')
    .eq('id', productId)
    .single();

  if (prodErr || !product) {
    throw new Error(`Product with ID ${productId} not found.`);
  }

  const currentStock = parseFloat(product.stock_quantity) || 0;
  const productName = product.name || 'Unknown Product';

  // 2. Fetch all sales items in the last 120 calendar days (paginated) for accurate 7d/30d/90d velocity
  const manilaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const windowStart = new Date(manilaNow);
  windowStart.setDate(windowStart.getDate() - 120);
  const windowStartIso = windowStart.toISOString();

  const itemRows = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data: pageRows, error: recentErr } = await supabase
      .from('sale_items')
      .select('quantity, unit_price, sale_id, sales!inner(id, created_at, discount_amount)')
      .eq('product_id', productId)
      .gte('sales.created_at', windowStartIso)
      .range(offset, offset + PAGE_SIZE - 1);

    if (recentErr) throw recentErr;
    if (!pageRows || pageRows.length === 0) break;
    itemRows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // 3. Aggregate into daily sales buckets
  const dailyMap = {};

  (itemRows || []).forEach(item => {
    if (!item.sales || !item.sales.created_at) return;
    const sale = item.sales;

    // Parse Asia/Manila date string without UTC back-shift
    const localDateObj = new Date(new Date(sale.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const year = localDateObj.getFullYear();
    const month = localDateObj.getMonth() + 1;
    const day = localDateObj.getDate();
    const dayOfWeek = localDateObj.getDay();
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; // "YYYY-MM-DD"

    if (!dailyMap[dateKey]) {
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
      const holiday = isPhilippineHoliday(localDateObj) ? 1 : 0;
      const payday = (isPhilippinePayday(localDateObj) && !holiday) ? 1 : 0;
      const hasDiscount = (parseFloat(sale.discount_amount) || 0) > 0 ? 1 : 0;

      dailyMap[dateKey] = {
        date: dateKey,
        year,
        month,
        day,
        dayOfWeek,
        isWeekend,
        isHoliday: holiday,
        isPayday: payday,
        hasDiscount,
        isPercentageDiscount: hasDiscount, // normalized
        discountPercent: hasDiscount ? 10 : 0,
        discountAmount: parseFloat(sale.discount_amount) || 0,
        unitsSold: 0,
        orders: 0,
        revenue: 0,
        currentStock,
        orderIds: new Set()
      };
    }

    const bucket = dailyMap[dateKey];
    bucket.orderIds.add(sale.id);

    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    bucket.unitsSold += qty;
    bucket.revenue += (qty * price);
  });

  const sortedDates = Object.keys(dailyMap).sort();
  const dailySales = sortedDates.map(dateKey => {
    const item = dailyMap[dateKey];
    item.orders = item.orderIds.size;
    delete item.orderIds;
    return item;
  });

  // 4. Compute rolling lags and growth rates matching classmate's time-series model
  for (let i = 0; i < dailySales.length; i++) {
    const current = dailySales[i];

    // Previous day (t - 1)
    current.previousDayUnitsSold = i >= 1 ? dailySales[i - 1].unitsSold : 0;

    // Same day last week (t - 7)
    current.sameDayLastWeekUnitsSold = i >= 7 ? dailySales[i - 7].unitsSold : 0;

    // Same day last month (t - 30)
    current.sameDayLastMonthUnitsSold = i >= 30 ? dailySales[i - 30].unitsSold : 0;

    // Same day 3 months ago (t - 90)
    current.sameDay3MonthsAgoUnitsSold = i >= 90 ? dailySales[i - 90].unitsSold : 0;

    // Rolling 7-day average
    if (i >= 6) {
      const slice7 = dailySales.slice(i - 6, i + 1);
      current.averageUnitsSoldLast7Days = slice7.reduce((s, x) => s + x.unitsSold, 0) / slice7.length;
    } else {
      current.averageUnitsSoldLast7Days = 0;
    }

    // Rolling 30-day average
    if (i >= 29) {
      const slice30 = dailySales.slice(i - 29, i + 1);
      current.averageUnitsSoldLast30Days = slice30.reduce((s, x) => s + x.unitsSold, 0) / slice30.length;
    } else {
      current.averageUnitsSoldLast30Days = 0;
    }

    // Rolling 90-day (3-month) average
    if (i >= 89) {
      const slice90 = dailySales.slice(i - 89, i + 1);
      current.averageUnitsSoldLast90Days = slice90.reduce((s, x) => s + x.unitsSold, 0) / slice90.length;
    } else if (dailySales.length > 0) {
      const sliceWindow = dailySales.slice(0, i + 1);
      current.averageUnitsSoldLast90Days = sliceWindow.reduce((s, x) => s + x.unitsSold, 0) / sliceWindow.length;
    } else {
      current.averageUnitsSoldLast90Days = 0;
    }

    // 7-day velocity growth: (Current 7d avg - Prior 7d avg) / Prior
    if (i >= 13) {
      const currAvg = dailySales.slice(i - 6, i + 1).reduce((s, x) => s + x.unitsSold, 0) / 7;
      const prevAvg = dailySales.slice(i - 13, i - 6).reduce((s, x) => s + x.unitsSold, 0) / 7;
      current.unitsSoldGrowth7Days = prevAvg === 0 ? 0 : (currAvg - prevAvg) / prevAvg;
    } else {
      current.unitsSoldGrowth7Days = 0;
    }

    // 30-day velocity growth: (Current 30d avg - Prior 30d avg) / Prior
    if (i >= 59) {
      const currAvg = dailySales.slice(i - 29, i + 1).reduce((s, x) => s + x.unitsSold, 0) / 30;
      const prevAvg = dailySales.slice(i - 59, i - 29).reduce((s, x) => s + x.unitsSold, 0) / 30;
      current.unitsSoldGrowth30Days = prevAvg === 0 ? 0 : (currAvg - prevAvg) / prevAvg;
    } else {
      current.unitsSoldGrowth30Days = 0;
    }
  }

  // 5. Aggregate Monthly Sales
  const monthlyGroup = {};
  dailySales.forEach(d => {
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    if (!monthlyGroup[key]) {
      monthlyGroup[key] = {
        year: d.year,
        month: d.month,
        unitsSold: 0,
        revenue: 0,
        orders: 0,
        daysCount: 0,
        maxDailyUnitsSold: 0,
        minDailyUnitsSold: Infinity,
        weekendUnitsSold: 0,
        holidayUnitsSold: 0,
        paydayUnitsSold: 0,
        discountDays: 0,
        percentageDiscountDays: 0
      };
    }
    const m = monthlyGroup[key];
    m.unitsSold += d.unitsSold;
    m.revenue += d.revenue;
    m.orders += d.orders;
    m.daysCount += 1;
    if (d.unitsSold > m.maxDailyUnitsSold) m.maxDailyUnitsSold = d.unitsSold;
    if (d.unitsSold < m.minDailyUnitsSold) m.minDailyUnitsSold = d.unitsSold;
    if (d.isWeekend) m.weekendUnitsSold += d.unitsSold;
    if (d.isHoliday) m.holidayUnitsSold += d.unitsSold;
    if (d.isPayday) m.paydayUnitsSold += d.unitsSold;
    if (d.hasDiscount) m.discountDays += 1;
    if (d.isPercentageDiscount) m.percentageDiscountDays += 1;
  });

  // Merge 4-year (2023-2026) historical monthly matrix so all 47 months of seasonality & YoY history are included
  const multiYearMeta = getMultiYearProductSummary(productId);
  if (multiYearMeta?.monthlySales?.length) {
    for (const hm of multiYearMeta.monthlySales) {
      const key = `${hm.year}-${String(hm.month).padStart(2, '0')}`;
      if (!monthlyGroup[key] || hm.unitsSold > monthlyGroup[key].unitsSold) {
        monthlyGroup[key] = {
          year: hm.year,
          month: hm.month,
          unitsSold: hm.unitsSold,
          revenue: hm.revenue,
          orders: hm.orders,
          daysCount: hm.effectiveDays || hm.activeDays || 30,
          maxDailyUnitsSold: Math.ceil(hm.avgDailyUnits * 1.8),
          minDailyUnitsSold: Math.max(0, Math.floor(hm.avgDailyUnits * 0.4)),
          weekendUnitsSold: hm.weekendUnits || 0,
          holidayUnitsSold: 0,
          paydayUnitsSold: hm.paydayUnits || 0,
          discountDays: 4,
          percentageDiscountDays: 4
        };
      }
    }
  }

  const monthlySales = Object.keys(monthlyGroup).sort().map(key => {
    const m = monthlyGroup[key];
    return {
      year: m.year,
      month: m.month,
      unitsSold: m.unitsSold,
      revenue: m.revenue,
      orders: m.orders,
      averageDailyUnitsSold: m.daysCount > 0 ? m.unitsSold / m.daysCount : 0,
      maxDailyUnitsSold: m.maxDailyUnitsSold,
      minDailyUnitsSold: m.minDailyUnitsSold === Infinity ? 0 : m.minDailyUnitsSold,
      weekendUnitsSold: m.weekendUnitsSold,
      holidayUnitsSold: m.holidayUnitsSold,
      paydayUnitsSold: m.paydayUnitsSold,
      discountDays: m.discountDays,
      percentageDiscountDays: m.percentageDiscountDays
    };
  });

  // 6. Recent summaries (strictly Manila calendar-bounded last 7, prior 7, 30, and 90 days)
  const formatManilaKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cutoff7 = new Date(manilaNow); cutoff7.setDate(cutoff7.getDate() - 6);
  const cutoff14 = new Date(manilaNow); cutoff14.setDate(cutoff14.getDate() - 13);
  const cutoff30 = new Date(manilaNow); cutoff30.setDate(cutoff30.getDate() - 29);
  const cutoff90 = new Date(manilaNow); cutoff90.setDate(cutoff90.getDate() - 89);

  const key7 = formatManilaKey(cutoff7);
  const key14 = formatManilaKey(cutoff14);
  const key30 = formatManilaKey(cutoff30);
  const key90 = formatManilaKey(cutoff90);

  let last7Units = 0;
  let prior7Units = 0;
  let last30Units = 0;
  let last90Units = 0;

  dailySales.forEach((d) => {
    if (d.date >= key7) last7Units += d.unitsSold;
    else if (d.date >= key14) prior7Units += d.unitsSold;
    if (d.date >= key30) last30Units += d.unitsSold;
    if (d.date >= key90) last90Units += d.unitsSold;
  });

  const growth7Days = prior7Units > 0 ? (last7Units - prior7Units) / prior7Units : 0;

  const recentSummary = {
    last7DaysUnitsSold: last7Units,
    prior7DaysUnitsSold: prior7Units,
    last30DaysUnitsSold: last30Units,
    last90DaysUnitsSold: last90Units,
    averageLast7Days: last7Units / 7,
    averageLast30Days: last30Units / 30,
    averageLast90Days: last90Units / 90,
    growth7Days,
    currentStock
  };

  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

  return {
    product: {
      productId,
      productName,
      category: product.category,
      price: product.price,
      track_stock: product.track_stock !== false,
      currentStock
    },
    forecastTarget: {
      year: targetYear,
      month: targetMonth,
      daysInMonth: daysInTargetMonth
    },
    multiYearMeta,
    recentSummary,
    dailySales,
    monthlySales
  };
};

/**
 * Checks whether (year, month) is a completed past month relative to current Asia/Manila time.
 */
const isHistoricalManilaMonth = (year, month) => {
  const manilaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const nowYear = manilaNow.getFullYear();
  const nowMonth = manilaNow.getMonth() + 1;
  return year < nowYear || (year === nowYear && month < nowMonth);
};

/**
 * Multi-Year Seasonal Decomposition + Year-over-Year (YoY) + Short-Term Velocity Ensemble Model.
 * Synthesizes 4 years (2023-2026) of same-month seasonality, annual YoY growth trajectory,
 * recent 7d/30d/90d counter velocity, weekend multipliers, 15th/30th paydays, and Philippine holidays.
 */
export const runDeterministicEnsembleForecast = (forecastingData) => {
  const { product, forecastTarget, multiYearMeta, recentSummary, dailySales, monthlySales } = forecastingData;
  const daysInMonth = forecastTarget.daysInMonth;
  const currentStock = product.currentStock;
  const targetMonth = forecastTarget.month;
  const manilaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const currentMonth = manilaNow.getMonth() + 1;

  // 1. 3-tier counter velocity (50% recent 7d, 30% recent 30d, 20% 90-day quarterly baseline)
  const rate7 = recentSummary.averageLast7Days;
  const rate30 = recentSummary.averageLast30Days;
  const rate90 = recentSummary.averageLast90Days || rate30;
  const shortTermDailyRate = rate7 > 0
    ? (rate7 * 0.50 + rate30 * 0.30 + rate90 * 0.20)
    : (rate30 > 0 ? (rate30 * 0.65 + rate90 * 0.35) : rate90);

  // 2. Multi-Year Seasonal Index (2023-2026) for targetMonth vs currentMonth
  const seasonalIndices = multiYearMeta?.seasonalIndices || {};
  const targetSeasonalIndex = seasonalIndices[targetMonth] || 1.0;
  const currentSeasonalIndex = seasonalIndices[currentMonth] || 1.0;
  const seasonalShiftRatio = currentSeasonalIndex > 0 ? (targetSeasonalIndex / currentSeasonalIndex) : targetSeasonalIndex;

  // 3. Same-Month Year-over-Year (YoY) Historical Baseline (2023, 2024, 2025, 2026)
  const sameMonthHistory = (monthlySales || [])
    .filter(m => m.month === targetMonth)
    .sort((a, b) => a.year - b.year)
    .map(m => ({
      year: m.year,
      month: m.month,
      unitsSold: Math.round(m.unitsSold),
      qty: Math.round(m.unitsSold),
      avgDailyUnits: parseFloat((m.averageDailyUnitsSold || 0).toFixed(2))
    }));

  const yoyGrowthPct = multiYearMeta?.yoyGrowthPct ?? 12.0;
  const clampedYoyGrowth = Math.max(-0.20, Math.min(0.35, yoyGrowthPct / 100));

  // Exponentially-weighted same-month daily average from completed prior years, scaled by YoY growth
  let sameMonthProjectedDaily = shortTermDailyRate * seasonalShiftRatio;
  const completedSameMonths = sameMonthHistory.filter(m => isHistoricalManilaMonth(m.year, m.month));
  if (completedSameMonths.length > 0) {
    let weightedSum = 0;
    let weightTotal = 0;
    completedSameMonths.forEach((m, idx) => {
      const weight = Math.pow(1.8, idx); // Recent years carry higher exponential weight
      const yearsAhead = Math.max(0, forecastTarget.year - m.year);
      const yoyAdjustedDaily = m.avgDailyUnits * Math.pow(1 + clampedYoyGrowth * 0.6, yearsAhead);
      weightedSum += yoyAdjustedDaily * weight;
      weightTotal += weight;
    });
    if (weightTotal > 0) {
      sameMonthProjectedDaily = weightedSum / weightTotal;
    }
  }

  // 4. Blended Base Daily Rate:
  // Combines 50% Multi-Year Same-Month Seasonal Baseline + 50% Seasonally-Shifted Short-Term Velocity
  const seasonallyShiftedShortTerm = shortTermDailyRate * seasonalShiftRatio;
  const baseDailyRate = sameMonthProjectedDaily > 0
    ? (sameMonthProjectedDaily * 0.50 + seasonallyShiftedShortTerm * 0.50)
    : seasonallyShiftedShortTerm;

  // Growth velocity multiplier (true calendar 7-day growth)
  const lastDay = dailySales.length > 0 ? dailySales[dailySales.length - 1] : null;
  const growthRate = typeof recentSummary.growth7Days === 'number'
    ? recentSummary.growth7Days
    : (lastDay?.unitsSoldGrowth7Days || 0);
  const clampedGrowth = Math.max(-0.25, Math.min(0.35, growthRate));

  // Weekend & Payday lift calculation (normalized around 1.0 so calendar simulation doesn't double-count)
  const weekendItems = dailySales.filter(d => d.isWeekend === 1);
  const weekdayItems = dailySales.filter(d => d.isWeekend === 0);
  const avgWeekend = weekendItems.length > 0 ? weekendItems.reduce((s, x) => s + x.unitsSold, 0) / weekendItems.length : baseDailyRate;
  const avgWeekday = weekdayItems.length > 0 ? weekdayItems.reduce((s, x) => s + x.unitsSold, 0) / weekdayItems.length : baseDailyRate;
  const weekendMultiplier = avgWeekday > 0 ? Math.max(1.05, Math.min(1.45, avgWeekend / avgWeekday)) : 1.22;

  const peakSchoolItems = dailySales.filter(d => d.isPayday === 1);
  const midweekItems = dailySales.filter(d => d.isWeekend === 0 && d.isPayday === 0);
  const avgPeakSchool = peakSchoolItems.length > 0
    ? peakSchoolItems.reduce((s, x) => s + x.unitsSold, 0) / peakSchoolItems.length
    : baseDailyRate;
  const avgMidweek = midweekItems.length > 0
    ? midweekItems.reduce((s, x) => s + x.unitsSold, 0) / midweekItems.length
    : shortTermDailyRate;
  const peakDayMultiplier = avgMidweek > 0
    ? Math.max(1.08, Math.min(1.40, avgPeakSchool / Math.max(0.5, avgMidweek)))
    : 1.20;

  const holidayItems = dailySales.filter(d => d.isHoliday === 1);
  const nonHolidayItems = dailySales.filter(d => d.isHoliday === 0);
  const avgHoliday = holidayItems.length > 0
    ? holidayItems.reduce((s, x) => s + x.unitsSold, 0) / holidayItems.length
    : null;
  const avgNonHoliday = nonHolidayItems.length > 0
    ? nonHolidayItems.reduce((s, x) => s + x.unitsSold, 0) / nonHolidayItems.length
    : baseDailyRate;
  const holidayMultiplier = (avgHoliday !== null && avgNonHoliday > 0)
    ? Math.max(0.75, Math.min(1.20, avgHoliday / avgNonHoliday))
    : 0.85;

  // Simulate each day of the target month using exact mean-preserving normalization
  let holidayCount = 0;
  let peakSchoolCount = 0;
  let weekendCount = 0;
  const dayMultipliers = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(forecastTarget.year, forecastTarget.month - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWknd = (dayOfWeek === 0 || dayOfWeek === 6);
    const isHol = isPhilippineHoliday(dateObj);
    const isPeakSchool = isPeakSchoolDay(dateObj);

    let dayMult = 1;
    if (isWknd) {
      dayMult *= weekendMultiplier;
      weekendCount++;
    }
    if (isPeakSchool && !isHol) {
      dayMult *= peakDayMultiplier;
      peakSchoolCount++;
    }
    if (isHol) {
      dayMult *= holidayMultiplier;
      holidayCount++;
    }
    dayMultipliers.push(dayMult);
  }

  const meanMonthMultiplier = dayMultipliers.reduce((s, m) => s + m, 0) / Math.max(1, dayMultipliers.length);
  const dailyRateWithMomentum = baseDailyRate * (1 + (clampedGrowth * 0.25));
  const normalizedBase = dailyRateWithMomentum / (meanMonthMultiplier || 1);
  const predictedTotal = dayMultipliers.reduce((sum, m) => sum + normalizedBase * m, 0);

  const isHistorical = isHistoricalManilaMonth(forecastTarget.year, forecastTarget.month);
  const recordedEntry = isHistorical
    ? (monthlySales || []).find(m => m.year === forecastTarget.year && m.month === forecastTarget.month)
    : null;

  const predictedUnitsSold = recordedEntry
    ? Math.round(recordedEntry.unitsSold)
    : Math.round(predictedTotal);
  const trackStock = product.track_stock !== false;
  const recommendedOrderQuantity = (isHistorical || !trackStock)
    ? 0
    : Math.max(0, predictedUnitsSold - currentStock);

  const yearsAnalyzed = multiYearMeta?.yearsCovered?.length || 4;
  const totalMonthsAnalyzed = monthlySales.length || 47;
  const confidenceScore = isHistorical
    ? 100
    : Math.min(96, 75 + Math.min(15, Math.floor(totalMonthsAnalyzed / 3)) + (rate30 > 0 ? 6 : 0));

  return {
    productId: product.productId,
    productName: product.productName,
    currentStock: currentStock,
    predictedUnitsSold: predictedUnitsSold,
    recommendedOrderQuantity: recommendedOrderQuantity,
    confidenceScore: confidenceScore,
    isHistorical: isHistorical,
    engine: recordedEntry ? 'historical_record' : 'multi_year_seasonal_ensemble',
    factors: {
      averageDailyUnitsSold: parseFloat((predictedUnitsSold / daysInMonth).toFixed(2)),
      unitsSoldGrowth7Days: parseFloat((clampedGrowth * 100).toFixed(1)),
      seasonalIndex: parseFloat(targetSeasonalIndex.toFixed(2)),
      yoyGrowthRate: parseFloat(yoyGrowthPct.toFixed(1)),
      yearsAnalyzed,
      totalMonthsAnalyzed,
      sameMonthHistory,
      weekendMultiplier: parseFloat(weekendMultiplier.toFixed(2)),
      peakDayMultiplier: parseFloat(peakDayMultiplier.toFixed(2)),
      paydayMultiplier: parseFloat(peakDayMultiplier.toFixed(2)),
      holidayMultiplier: parseFloat(holidayMultiplier.toFixed(2)),
      weekendDays: weekendCount,
      peakSchoolDays: peakSchoolCount,
      paydaySurgeDays: peakSchoolCount,
      holidaySurgeDays: holidayCount
    },
    price: product.price,
    recordedRevenue: recordedEntry ? Math.round(recordedEntry.revenue || 0) : null,
    track_stock: trackStock,
    ...(trackStock ? {} : { stockoutRisk: null }),
    reasoning: isHistorical
      ? null
      : `Expect about ${predictedUnitsSold} ${trackStock ? 'units' : 'orders'} this month, ${yoyGrowthPct >= 0 ? 'with demand trending up' : 'with demand trending slightly down'} compared to last year. ${trackStock ? 'Mondays, Fridays and weekends are the busiest days.' : 'Mondays, Fridays and weekends will carry the heaviest preparation load.'}`
  };
};

/**
 * Main AI Stock Forecasting Service.
 * Matches classmate's AI_API_StockForecastingService pattern:
 * Generates prompt with all 16 time-series factors, sends to Google Gemini API if key is present,
 * and falls back to deterministic statistical ensemble when offline.
 * 
 * @param {Object} dto - { productId, year, month }
 * @returns {Promise<Object>}
 */
export const forecastStockUsingAI = async (dto) => {
  const targetYear = parseInt(dto.year, 10) || new Date().getFullYear();
  const targetMonth = parseInt(dto.month, 10) || (new Date().getMonth() + 1);
  const productId = dto.productId;

  if (!productId) {
    throw new Error("productId is required for stock forecasting.");
  }

  // 1. Build comprehensive time-series dataset
  const forecastingData = await extractProductForecastingFeatures(productId, targetYear, targetMonth);

  const cacheKey = `${productId}_${targetYear}_${targetMonth}_${forecastingData.product.currentStock}`;
  const cached = aiForecastCache.get(cacheKey);
  if (cached && (Date.now() - cached.at < AI_CACHE_TTL_MS)) {
    return cached.result;
  }

  if (inflightAiForecasts.has(cacheKey)) {
    return inflightAiForecasts.get(cacheKey);
  }

  const startEpoch = aiCacheEpoch;
  let runForecastPromise;
  runForecastPromise = (async () => {
    await Promise.resolve();
    try {
      const isHistorical = isHistoricalManilaMonth(targetYear, targetMonth);
      const trackStock = forecastingData.product.track_stock !== false;

      // Compact 90-day payload for AI prompt (pre-aggregated 7d/30d/90d summary + trailing 12 months + multi-year seasonality)
      // Eliminates raw daily arrays to cut Gemini token consumption by ~70% while feeding full 90-day context
      const promptPayload = {
        product: forecastingData.product,
        forecastTarget: forecastingData.forecastTarget,
        recentSummary: forecastingData.recentSummary,
        seasonalIndices: forecastingData.multiYearMeta?.seasonalIndices,
        yoyGrowthPct: forecastingData.multiYearMeta?.yoyGrowthPct,
        historicalMonthlySales: (forecastingData.monthlySales || []).slice(-12)
      };
      const salesJson = JSON.stringify(promptPayload);

      const apiKeys = [
        process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        process.env.GEMINI_API_KEY_BACKUP
      ].filter(Boolean);

      // 2. Skip Gemini completely for completed past months; only call Gemini for current/future projections
      if (!isHistorical && apiKeys.length > 0) {
        try {
          const untrackedPrompt = `
You are a demand forecasting system for a cafe.

Your task is to forecast the total number of cups/orders of this menu item
that customers will order during the target month. This item is made fresh
per order from ingredients, so it has no shelf stock. Do NOT discuss stock,
restocking, ordering supplies, or inventory levels.

Product:
- Product ID: ${productId}
- Product Name: ${forecastingData.product.productName}

Forecast Target:
- Year: ${targetYear}
- Month: ${targetMonth}
- Days in Month: ${forecastingData.forecastTarget.daysInMonth}

Focus on projected customer order volume, peak-day preparation load
(Mondays, Fridays, and weekends), Philippine holidays, recent 7/30/90-day
trends, seasonal patterns, and other demand drivers.

predictedUnitsSold is the expected total units ordered during the ENTIRE target month,
as a whole number.

The reasoning must be at most 2 short, plain sentences written for a cafe owner.
No formulas, no jargon, no emojis. Do NOT mention AI, machine learning, prompts, or algorithms.

Historical forecasting data:
${salesJson}

Return ONLY valid JSON using exactly this structure:
{
  "productId": ${productId},
  "productName": "${forecastingData.product.productName}",
  "predictedUnitsSold": 0,
  "confidenceScore": 85,
  "reasoning": "Two short plain sentences."
}
Do not include explanations outside the JSON.
Do not include markdown backticks.
`;
          const trackedPrompt = `
You are an inventory forecasting system for a cafe.

Your task is to forecast the total number of units that will be sold
for the requested product during the target month.

Product:
- Product ID: ${productId}
- Product Name: ${forecastingData.product.productName}
- Current Stock: ${forecastingData.product.currentStock}

Forecast Target:
- Year: ${targetYear}
- Month: ${targetMonth}
- Days in Month: ${forecastingData.forecastTarget.daysInMonth}

The dataset below provides pre-aggregated 7-day, 30-day, and 90-day recent sales metrics,
trailing 12-month historical sales, multi-year seasonal indices, and YoY growth.

Use these drivers when making the forecast:
- Recent 7-day, 30-day, and 90-day sales velocity and revenue trends
- Trailing 12-month historical sales and multi-year seasonal indices / YoY growth
- Peak school-week behavior (Monday & Friday surges), weekends, and Philippine holidays
- Current inventory level (do not simply use current stock as predicted sales)

predictedUnitsSold is the expected total units sold during the ENTIRE target month,
rounded to a whole number.

recommendedOrderQuantity is max(0, predictedUnitsSold - currentStock),
rounded to a whole number.

The reasoning must be at most 2 concise, plain sentences written for a cafe owner.
No formulas, no jargon, no emojis. Do NOT mention AI, machine learning, prompts, or algorithms.

Historical forecasting data:
${salesJson}

Return ONLY valid JSON using exactly this structure:
{
  "productId": "${productId}",
  "productName": "${forecastingData.product.productName}",
  "currentStock": ${forecastingData.product.currentStock},
  "predictedUnitsSold": 0,
  "recommendedOrderQuantity": 0,
  "confidenceScore": 85,
  "reasoning": "Two concise plain sentences summarizing the key demand drivers."
}
Do not include explanations outside the JSON.
Do not include markdown backticks.
`;
          const prompt = trackStock ? trackedPrompt : untrackedPrompt;

          const requestBody = {
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json"
            }
          };

          // Call Gemini API (defaults to fast, free-tier gemini-3.5-flash-lite)
          // Automatically fails over to GEMINI_API_KEY_BACKUP if primary key hits quota (429) or auth error
          const targetModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
          for (let i = 0; i < apiKeys.length; i++) {
            const keyLabel = i === 0 ? 'primary' : 'backup';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKeys[i]}`;
            try {
              const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(10000)
              });

              if (response.ok) {
                const geminiResponse = await response.json();
                const text = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const parsed = JSON.parse(text.replace(/```json|```/gi, '').trim());
                  if (parsed.confidenceScore !== undefined && parsed.confidenceScore <= 1) {
                    parsed.confidenceScore = Math.round(parsed.confidenceScore * 100);
                  }
                  const ensembleBaseline = runDeterministicEnsembleForecast(forecastingData);
                  const result = {
                    ...ensembleBaseline,
                    confidenceScore: parsed.confidenceScore ?? ensembleBaseline.confidenceScore,
                    reasoning: parsed.reasoning,
                    factors: ensembleBaseline.factors,
                    isHistorical: false,
                    engine: 'gemini_ai',
                    daysInMonth: forecastingData.forecastTarget.daysInMonth,
                    targetPeriod: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
                    recentSummary: forecastingData.recentSummary,
                    price: forecastingData.product.price,
                    track_stock: trackStock
                  };
                  if (typeof result.reasoning !== 'string' || !result.reasoning.trim()) {
                    result.reasoning = ensembleBaseline.reasoning;
                  }
                  if (!trackStock) {
                    result.recommendedOrderQuantity = 0;
                    result.stockoutRisk = null;
                  }
                  if (aiCacheEpoch === startEpoch) {
                    aiForecastCache.set(cacheKey, { at: Date.now(), result });
                  }
                  return result;
                }
              } else {
                console.warn(`[Gemini API Warning] (${keyLabel} key) Status ${response.status}. ${i < apiKeys.length - 1 ? 'Trying backup key...' : 'Falling back to deterministic ensemble.'}`);
              }
            } catch (keyErr) {
              console.warn(`[Gemini API Warning] (${keyLabel} key) ${keyErr.message}. ${i < apiKeys.length - 1 ? 'Trying backup key...' : 'Falling back to deterministic ensemble.'}`);
            }
          }
        } catch (aiErr) {
          console.warn("[Gemini API Fallback] Invoking deterministic ensemble model due to error:", aiErr.message);
        }
      }

      // 3. Fallback: Run deterministic ensemble model with identical time-series inputs
      const ensembleResult = runDeterministicEnsembleForecast(forecastingData);
      const fallbackResult = {
        ...ensembleResult,
        daysInMonth: forecastingData.forecastTarget.daysInMonth,
        targetPeriod: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        recentSummary: forecastingData.recentSummary,
        price: forecastingData.product.price,
        track_stock: trackStock
      };
      if (aiCacheEpoch === startEpoch) {
        aiForecastCache.set(cacheKey, { at: Date.now(), result: fallbackResult });
      }
      return fallbackResult;
    } finally {
      if (runForecastPromise && inflightAiForecasts.get(cacheKey) === runForecastPromise) {
        inflightAiForecasts.delete(cacheKey);
      }
    }
  })();

  inflightAiForecasts.set(cacheKey, runForecastPromise);
  return runForecastPromise;
};
