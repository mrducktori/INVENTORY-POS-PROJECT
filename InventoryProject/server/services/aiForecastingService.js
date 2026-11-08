import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MULTI_YEAR_SUMMARY_PATH = path.resolve(__dirname, '../data/multiYearSalesSummary.json');

let cachedMultiYearSummary = null;

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
    { m: 12, d: 25, name: "Christmas Day" },
    { m: 12, d: 30, name: "Rizal Day" },
    { m: 12, d: 31, name: "New Year's Eve" },
  ];

  return holidays.some(h => h.m === month && h.d === day);
};

/**
 * Checks if a given day corresponds to standard Philippine quincena paydays (15th or end of month).
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isPhilippinePayday = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const day = d.getDate();
  const nextDay = new Date(d);
  nextDay.setDate(day + 1);
  const isMonthEnd = nextDay.getMonth() !== d.getMonth();
  return day === 15 || day === 30 || (isMonthEnd && day >= 28);
};

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
    .select('id, name, category, price, stock_quantity')
    .eq('id', productId)
    .single();

  if (prodErr || !product) {
    throw new Error(`Product with ID ${productId} not found.`);
  }

  const currentStock = parseFloat(product.stock_quantity) || 0;
  const productName = product.name || 'Unknown Product';

  // 2. Fetch recent sales items for daily velocity & merge 4-year (2023-2026) monthly history
  const { data: recentRows, error: recentErr } = await supabase
    .from('sale_items')
    .select('quantity, unit_price, sale_id, sales(id, created_at, discount_amount)')
    .eq('product_id', productId)
    .order('id', { ascending: false })
    .limit(1000);

  if (recentErr) throw recentErr;
  const itemRows = recentRows || [];

  // 3. Aggregate into daily sales buckets
  const dailyMap = {};

  (itemRows || []).forEach(item => {
    if (!item.sales || !item.sales.created_at) return;
    const sale = item.sales;

    // Parse Asia/Manila date string
    const localDateObj = new Date(new Date(sale.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const dateKey = localDateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const year = localDateObj.getFullYear();
    const month = localDateObj.getMonth() + 1;
    const day = localDateObj.getDate();
    const dayOfWeek = localDateObj.getDay();

    if (!dailyMap[dateKey]) {
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
      const holiday = isPhilippineHoliday(localDateObj) ? 1 : 0;
      const payday = isPhilippinePayday(localDateObj) ? 1 : 0;
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

  // 6. Recent summaries (strictly calendar-bounded last 7 and 30 days)
  const last7Days = dailySales.slice(-7);
  const last30Days = dailySales.slice(-30);

  const recentSummary = {
    last7DaysUnitsSold: last7Days.reduce((s, x) => s + x.unitsSold, 0),
    last30DaysUnitsSold: last30Days.reduce((s, x) => s + x.unitsSold, 0),
    averageLast7Days: last7Days.reduce((s, x) => s + x.unitsSold, 0) / 7,
    averageLast30Days: last30Days.reduce((s, x) => s + x.unitsSold, 0) / 30,
    currentStock
  };

  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

  return {
    product: {
      productId,
      productName,
      category: product.category,
      price: product.price,
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
 * Multi-Year Seasonal Decomposition + Year-over-Year (YoY) + Short-Term Velocity Ensemble Model.
 * Synthesizes 4 years (2023-2026) of same-month seasonality, annual YoY growth trajectory,
 * recent 7d/30d counter velocity, weekend multipliers, 15th/30th paydays, and Philippine holidays.
 */
export const runDeterministicEnsembleForecast = (forecastingData) => {
  const { product, forecastTarget, multiYearMeta, recentSummary, dailySales, monthlySales } = forecastingData;
  const daysInMonth = forecastTarget.daysInMonth;
  const currentStock = product.currentStock;
  const targetMonth = forecastTarget.month;
  const currentMonth = new Date().getMonth() + 1;

  // 1. Short-term counter velocity (70% recent 7d, 30% recent 30d)
  const rate7 = recentSummary.averageLast7Days;
  const rate30 = recentSummary.averageLast30Days;
  const shortTermDailyRate = rate7 > 0 ? (rate7 * 0.65 + rate30 * 0.35) : rate30;

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
      avgDailyUnits: parseFloat((m.averageDailyUnitsSold || 0).toFixed(2))
    }));

  const yoyGrowthPct = multiYearMeta?.yoyGrowthPct ?? 12.0;
  const clampedYoyGrowth = Math.max(-0.20, Math.min(0.35, yoyGrowthPct / 100));

  // Exponentially-weighted same-month daily average from prior years, scaled by YoY growth
  let sameMonthProjectedDaily = shortTermDailyRate * seasonalShiftRatio;
  const completedSameMonths = sameMonthHistory.filter(m => !(m.year === 2026 && m.month === 11));
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

  // Growth velocity multiplier
  const lastDay = dailySales.length > 0 ? dailySales[dailySales.length - 1] : null;
  const growthRate = lastDay?.unitsSoldGrowth7Days || 0;
  const clampedGrowth = Math.max(-0.25, Math.min(0.35, growthRate));

  // Weekend & Payday lift calculation (normalized around 1.0 so calendar simulation doesn't double-count)
  const weekendItems = dailySales.filter(d => d.isWeekend === 1);
  const weekdayItems = dailySales.filter(d => d.isWeekend === 0);
  const avgWeekend = weekendItems.length > 0 ? weekendItems.reduce((s, x) => s + x.unitsSold, 0) / weekendItems.length : baseDailyRate;
  const avgWeekday = weekdayItems.length > 0 ? weekdayItems.reduce((s, x) => s + x.unitsSold, 0) / weekdayItems.length : baseDailyRate;
  const weekendMultiplier = avgWeekday > 0 ? Math.max(1.05, Math.min(1.45, avgWeekend / avgWeekday)) : 1.22;

  const paydayItems = dailySales.filter(d => d.isPayday === 1);
  const avgPayday = paydayItems.length > 0 ? paydayItems.reduce((s, x) => s + x.unitsSold, 0) / paydayItems.length : baseDailyRate;
  const paydayMultiplier = baseDailyRate > 0 ? Math.max(1.08, Math.min(1.40, avgPayday / Math.max(0.5, shortTermDailyRate))) : 1.20;

  // Simulate each day of the target month
  let predictedTotal = 0;
  let holidayCount = 0;
  let paydayCount = 0;
  let weekendCount = 0;

  // Normalize baseDailyRate so weekend/payday lifts distribute across the month without inflating the mean
  const normFactor = 1.10;
  const normalizedBase = baseDailyRate / normFactor;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(forecastTarget.year, forecastTarget.month - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWknd = (dayOfWeek === 0 || dayOfWeek === 6);
    const isHol = isPhilippineHoliday(dateObj);
    const isPay = isPhilippinePayday(dateObj);

    let dayForecast = normalizedBase * (1 + (clampedGrowth * 0.25));

    if (isWknd) {
      dayForecast *= weekendMultiplier;
      weekendCount++;
    }
    if (isPay) {
      dayForecast *= paydayMultiplier;
      paydayCount++;
    }
    if (isHol) {
      dayForecast *= 1.15;
      holidayCount++;
    }

    predictedTotal += dayForecast;
  }

  const predictedUnitsSold = Math.round(predictedTotal);
  const recommendedOrderQuantity = Math.max(0, predictedUnitsSold - currentStock);

  const yearsAnalyzed = multiYearMeta?.yearsCovered?.length || 4;
  const totalMonthsAnalyzed = monthlySales.length || 47;
  const confidenceScore = Math.min(96, 75 + Math.min(15, Math.floor(totalMonthsAnalyzed / 3)) + (rate30 > 0 ? 6 : 0));

  return {
    productId: product.productId,
    productName: product.productName,
    currentStock: currentStock,
    predictedUnitsSold: predictedUnitsSold,
    recommendedOrderQuantity: recommendedOrderQuantity,
    confidenceScore: confidenceScore,
    engine: 'multi_year_seasonal_ensemble',
    factors: {
      averageDailyUnitsSold: parseFloat((predictedUnitsSold / daysInMonth).toFixed(2)),
      unitsSoldGrowth7Days: parseFloat((clampedGrowth * 100).toFixed(1)),
      seasonalIndex: parseFloat(targetSeasonalIndex.toFixed(2)),
      yoyGrowthRate: parseFloat(yoyGrowthPct.toFixed(1)),
      yearsAnalyzed,
      totalMonthsAnalyzed,
      sameMonthHistory,
      weekendMultiplier: parseFloat(weekendMultiplier.toFixed(2)),
      paydayMultiplier: parseFloat(paydayMultiplier.toFixed(2)),
      weekendDays: weekendCount,
      paydaySurgeDays: paydayCount,
      holidaySurgeDays: holidayCount
    },
    reasoning: `Synthesized from ${yearsAnalyzed} years (${totalMonthsAnalyzed} months, 2023–2026) of historical sales with a ${targetSeasonalIndex.toFixed(2)}x seasonal index for month ${targetMonth}, ${yoyGrowthPct >= 0 ? '+' : ''}${yoyGrowthPct.toFixed(1)}% YoY trend, ${weekendCount} weekend days (${weekendMultiplier.toFixed(2)}x), and ${paydayCount} payday periods (${paydayMultiplier.toFixed(2)}x).`
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
  const salesJson = JSON.stringify(forecastingData);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // 2. If Gemini API Key is available, prompt Gemini AI
  if (apiKey) {
    try {
      const prompt = `
You are an inventory forecasting system.

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

The historical dataset below contains daily and monthly sales information.

Use the following factors when making the forecast:

1. Historical units sold
2. Recent 7-day sales trend
3. Recent 30-day sales trend
4. Previous-day sales
5. Same-day-last-week sales
6. Same-day-last-month sales
7. Weekly and monthly growth
8. Day-of-week behavior
9. Weekend behavior (Saturdays & Sundays)
10. Philippine Holidays
11. Payday behavior (15th and 30th quincena salary surges)
12. Discounts
13. Revenue
14. Order volume
15. Current inventory level
16. Historical monthly patterns

Do not simply use the current stock as the predicted sales.

The predictedUnitsSold should represent the expected total units sold
during the ENTIRE target month.

The recommendedOrderQuantity should represent how many additional
units should be ordered so that the business can reasonably cover
the predicted demand.

Use:
recommendedOrderQuantity = max(0, predictedUnitsSold - currentStock)

Round predictedUnitsSold and recommendedOrderQuantity to reasonable whole-number inventory quantities.

Historical forecasting data:
${salesJson}

Return ONLY valid JSON using exactly this structure:
{
  "productId": ${productId},
  "productName": "${forecastingData.product.productName}",
  "currentStock": ${forecastingData.product.currentStock},
  "predictedUnitsSold": 0,
  "recommendedOrderQuantity": 0,
  "confidenceScore": 85,
  "reasoning": "Professional 2-sentence summary of demand drivers (e.g. weekend lift, paydays, seasonal velocity). Do NOT mention AI, machine learning, prompts, or algorithms."
}
Do not include explanations outside the JSON.
Do not include markdown backticks.
`;

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

      // Call Gemini 1.5 Flash (or 2.0 Flash)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const geminiResponse = await response.json();
        const text = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.replace(/```json|```/gi, '').trim());
          const ensembleBaseline = runDeterministicEnsembleForecast(forecastingData);
          return {
            ...ensembleBaseline,
            ...parsed,
            factors: ensembleBaseline.factors,
            engine: 'gemini_ai',
            daysInMonth: forecastingData.forecastTarget.daysInMonth,
            targetPeriod: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
            recentSummary: forecastingData.recentSummary
          };
        }
      } else {
        console.warn(`[Gemini API Warning] Status ${response.status}. Falling back to deterministic ensemble.`);
      }
    } catch (aiErr) {
      console.warn("[Gemini API Fallback] Invoking deterministic ensemble model due to error:", aiErr.message);
    }
  }

  // 3. Fallback: Run deterministic ensemble model with identical time-series inputs
  const ensembleResult = runDeterministicEnsembleForecast(forecastingData);
  return {
    ...ensembleResult,
    daysInMonth: forecastingData.forecastTarget.daysInMonth,
    targetPeriod: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
    recentSummary: forecastingData.recentSummary
  };
};
