// Demand forecasting + reorder planning, built on the end-of-day `daily_product_sales` rollup.
//
// Method (deliberately simple so it can be explained on screen):
//   1. Weekday baseline: average units sold on each weekday over the last 8 weeks,
//      counting days with zero sales (a slow Tuesday is real data, not missing data).
//   2. Trend: last 4 weeks vs the 4 weeks before, damped (square root) and capped.
//   3. Season: how last year's next weeks compared with last year's previous 4 weeks
//      (same weekdays, 364 days back), capped; only used when last year has enough sales.
//   forecast(day) = baseline[weekday] x trend x season
// Accuracy is measured, not invented: the same method is re-run as if it were 4 weeks ago
// and compared with what actually sold (weekly totals).
// Gemini only writes the nightly plain-language explanation; it never changes the numbers.
import { supabase } from "../config/supabaseClient.js";
import { getManilaDateOnly } from "../utils/dateUtils.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import * as batchService from "./batchService.js";
import { getVoidRefundMap, getPosSettings } from "./posOperationsService.js";
import { validateTextLength } from "../utils/validationHelper.js";

const WINDOW_DAYS = 56;
const TREND_DAYS = 28;
const BACKTEST_DAYS = 28;
const LAST_YEAR_OFFSET = 364; // 52 weeks: keeps weekdays aligned
const SAFETY_DAYS = 2;
const ORDER_COVER_DAYS = 7;
const DEFAULT_LEAD_TIME_DAYS = 3;
const AI_MIN_FACTOR = 0.9; // the AI may nudge a forecast by at most +/-10%, never rewrite it
const AI_MAX_FACTOR = 1.1;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Fixed-date Philippine holidays the AI is told about (paydays left out: the customers are mostly students).
// shortcut: moving holidays (Holy Week, National Heroes Day) are not listed; add them if the shop's sales show it.
const PH_HOLIDAYS = [[1, 1, "New Year's Day"], [2, 25, "EDSA Revolution Day"], [4, 9, "Araw ng Kagitingan"], [5, 1, "Labor Day"],
  [6, 12, "Independence Day"], [8, 21, "Ninoy Aquino Day"], [11, 1, "All Saints' Day"], [11, 2, "All Souls' Day"],
  [11, 30, "Bonifacio Day"], [12, 8, "Immaculate Conception"], [12, 24, "Christmas Eve"], [12, 25, "Christmas Day"],
  [12, 30, "Rizal Day"], [12, 31, "New Year's Eve"]];
export const calendarEvents = (dateStr) => {
  const [, m, d] = dateStr.split("-").map(Number);
  const out = [];
  const holiday = PH_HOLIDAYS.find((h) => h[0] === m && h[1] === d);
  if (holiday) out.push(holiday[2]);
  return out;
};

const addDays = (dateStr, n) => batchService.addDaysManila(dateStr, n);
const weekdayOf = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;
const sumRange = (unitsByDate, from, to) => {
  let total = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) total += unitsByDate.get(d) || 0;
  return total;
};

// ---------------------------------------------------------------------------
// Pure engine (unit-tested in test/forecastEngine.test.js)
// ---------------------------------------------------------------------------

/**
 * @param {Map<string, number>} unitsByDate  Manila date → units (missing date = 0 sold)
 * @param {string} asOf        last complete day of data (YYYY-MM-DD)
 * @param {string} firstDate   first day this product could have sold (history start)
 */
export const forecastFromHistory = (unitsByDate, asOf, firstDate, { horizon = 14 } = {}) => {
  const windowStart = addDays(asOf, -(WINDOW_DAYS - 1));
  const effectiveStart = firstDate > windowStart ? firstDate : windowStart;
  const historyDays = effectiveStart > asOf ? 0 : Math.round((Date.parse(asOf) - Date.parse(effectiveStart)) / 86400000) + 1;

  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  let windowUnits = 0;
  let sellingDays = 0;
  for (let d = effectiveStart; d <= asOf; d = addDays(d, 1)) {
    const u = unitsByDate.get(d) || 0;
    totals[weekdayOf(d)] += u;
    counts[weekdayOf(d)] += 1;
    windowUnits += u;
    if (u > 0) sellingDays += 1;
  }
  const overallAvg = historyDays > 0 ? windowUnits / historyDays : 0;
  const weekdayBase = totals.map((t, i) => (counts[i] > 0 ? t / counts[i] : overallAvg));

  const recent = sumRange(unitsByDate, addDays(asOf, -(TREND_DAYS - 1)), asOf);
  const previous = historyDays >= TREND_DAYS * 2
    ? sumRange(unitsByDate, addDays(asOf, -(TREND_DAYS * 2 - 1)), addDays(asOf, -TREND_DAYS))
    : null;
  const trendRatio = previous === null ? 1 : (recent + 1) / (previous + 1);
  const trendFactor = clamp(Math.sqrt(trendRatio), 0.85, 1.2);

  const lyAsOf = addDays(asOf, -LAST_YEAR_OFFSET);
  const lyRecent = sumRange(unitsByDate, addDays(lyAsOf, -(TREND_DAYS - 1)), lyAsOf);
  const lyNext = sumRange(unitsByDate, addDays(lyAsOf, 1), addDays(lyAsOf, horizon));
  const seasonFactor = lyRecent >= 10 && firstDate <= addDays(lyAsOf, -(TREND_DAYS - 1))
    ? clamp((lyNext / horizon) / (lyRecent / TREND_DAYS), 0.75, 1.33)
    : 1;

  const daily = [];
  for (let i = 1; i <= horizon; i += 1) {
    const date = addDays(asOf, i);
    daily.push({ date, units: round1(weekdayBase[weekdayOf(date)] * trendFactor * seasonFactor) });
  }

  let status = "OK";
  if (historyDays < 14) status = "NEW_PRODUCT";
  else if (windowUnits === 0) status = "NO_RECENT_SALES";

  const peak = weekdayBase.indexOf(Math.max(...weekdayBase));
  return {
    status,
    daily,
    weekdayProfile: weekdayBase.map(round1),
    peakDay: windowUnits > 0 ? WEEKDAYS[peak] : null,
    recentDailyAvg: round1(overallAvg),
    sellingDays,
    historyDays,
    trendPct: previous === null ? null : Math.round((trendRatio - 1) * 100),
    trendFactor: round1(trendFactor * 100) / 100,
    seasonPct: seasonFactor === 1 ? null : Math.round((seasonFactor - 1) * 100),
    seasonFactor: Math.round(seasonFactor * 100) / 100
  };
};

/** Re-run the method as of 4 weeks ago and compare weekly totals with what actually sold. */
export const backtestForecast = (unitsByDate, asOf, firstDate) => {
  const pastAsOf = addDays(asOf, -BACKTEST_DAYS);
  if (firstDate > addDays(pastAsOf, -13)) return null; // not enough history to test
  const { daily } = forecastFromHistory(unitsByDate, pastAsOf, firstDate, { horizon: BACKTEST_DAYS });
  const weeks = [];
  for (let w = 0; w < BACKTEST_DAYS / 7; w += 1) {
    const days = daily.slice(w * 7, w * 7 + 7);
    weeks.push({
      start: days[0].date,
      predicted: round1(days.reduce((s, d) => s + d.units, 0)),
      actual: days.reduce((s, d) => s + (unitsByDate.get(d.date) || 0), 0)
    });
  }
  const actualTotal = weeks.reduce((s, w) => s + w.actual, 0);
  const absError = weeks.reduce((s, w) => s + Math.abs(w.predicted - w.actual), 0);
  const accuracyPct = actualTotal > 0 ? Math.max(0, Math.round((1 - absError / actualTotal) * 100)) : null;
  return { weeks, accuracyPct };
};

export const confidenceFrom = (status, accuracyPct) => {
  if (status !== "OK" || accuracyPct === null || accuracyPct === undefined) return "Not enough data";
  if (accuracyPct >= 80) return "High";
  if (accuracyPct >= 60) return "Medium";
  return "Low";
};

export const templateInsight = (name, f) => {
  if (f.status === "NEW_PRODUCT") return `${name} is new (under 2 weeks of sales), so this is a rough estimate.`;
  if (f.status === "NO_RECENT_SALES") return `${name} had no sales in the last 8 weeks.`;
  const next7 = Math.round(f.daily.slice(0, 7).reduce((s, d) => s + d.units, 0));
  const parts = [`Expect about ${next7} ${name} in the next 7 days`];
  if (f.peakDay) parts.push(`${f.peakDay} is usually the busiest day`);
  if (f.trendPct !== null && Math.abs(f.trendPct) >= 5) parts.push(`sales are ${f.trendPct > 0 ? "up" : "down"} ${Math.abs(f.trendPct)}% vs the 4 weeks before`);
  if (f.seasonPct !== null && Math.abs(f.seasonPct) >= 5) parts.push(`last year this period was ${f.seasonPct > 0 ? "busier" : "slower"} by ${Math.abs(f.seasonPct)}%`);
  return `${parts.join("; ")}.`;
};

/**
 * How much of each usable lot will expire before it is used up at `dailyUsage`
 * (lots are consumed first-expiry-first-out).
 */
export const quantityAtRiskOfExpiry = (fefoBatches, dailyUsage) => {
  let consumedDays = 0; // days of usage already claimed by earlier lots
  let atRisk = 0;
  for (const b of fefoBatches) {
    if (b.is_expired) continue;
    const qty = Number(b.quantity_remaining) || 0;
    if (b.days_until_expiry === null || b.days_until_expiry === undefined) break; // no-expiry lots come last
    const usableBeforeExpiry = Math.max(0, (b.days_until_expiry + 1 - consumedDays) * dailyUsage);
    const used = Math.min(qty, usableBeforeExpiry);
    atRisk += qty - used;
    consumedDays += dailyUsage > 0 ? used / dailyUsage : 0;
  }
  return Math.round(atRisk * 1000) / 1000;
};

// ---------------------------------------------------------------------------
// Owner-entered special dates (exam week, class suspension, school break...)
// ---------------------------------------------------------------------------

const EFFECTS = ["BUSIER", "SLOWER", "UNSURE"];
const isRealDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

export const listSpecialDates = async () => {
  // Recent past is kept so the list shows what just happened; older rows are not needed.
  const { data, error } = await supabase
    .from("forecast_special_dates")
    .select("id, label, start_date, end_date, effect")
    .gte("end_date", addDays(getManilaDateOnly(), -30))
    .order("start_date");
  if (error) throw error;
  return data || [];
};

export const createSpecialDate = async ({ label, start_date, end_date, effect = "UNSURE" }, userId = null) => {
  const cleanLabel = validateTextLength(label, { label: "Label", min: 2, max: 80, required: true });
  const end = end_date || start_date;
  if (!isRealDate(start_date) || !isRealDate(end)) throw badRequest("Dates must be real dates in YYYY-MM-DD format.");
  if (end < start_date) throw badRequest("End date cannot be before the start date.");
  if (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start_date}T00:00:00Z`) > 62 * 86400000) throw badRequest("A special period can be at most 62 days.");
  const cleanEffect = String(effect || "UNSURE").toUpperCase();
  if (!EFFECTS.includes(cleanEffect)) throw badRequest(`Effect must be one of ${EFFECTS.join(", ")}.`);
  const { data, error } = await supabase
    .from("forecast_special_dates")
    .insert([{ label: cleanLabel, start_date, end_date: end, effect: cleanEffect, created_by: userId }])
    .select("id, label, start_date, end_date, effect")
    .single();
  if (error) throw error;
  return data;
};

export const deleteSpecialDate = async (id) => {
  const { error } = await supabase.from("forecast_special_dates").delete().eq("id", id);
  if (error) throw error;
};

// ---------------------------------------------------------------------------
// End-of-day rollup
// ---------------------------------------------------------------------------

let lastEnsureAt = 0;
let ensureInflight = null;

const refreshRange = async (from, to) => {
  const voids = await getVoidRefundMap();
  const excluded = Object.keys(voids || {});
  // Chunks keep each call well under the PostgREST statement timeout on the first big backfill.
  for (let start = from; start <= to; start = addDays(start, 90)) {
    const end = addDays(start, 89) < to ? addDays(start, 89) : to;
    const { error } = await supabase.rpc("refresh_daily_product_sales", {
      p_from: start,
      p_to: end,
      p_excluded_sale_ids: excluded
    });
    if (error) throw error;
  }
};

/** Brings daily_product_sales up to yesterday (backfills on first run, re-checks the last 3 days). */
export const ensureDailySummary = async ({ force = false } = {}) => {
  if (!force && Date.now() - lastEnsureAt < 10 * 60 * 1000) return;
  if (ensureInflight) return ensureInflight;
  ensureInflight = (async () => {
    const today = getManilaDateOnly();
    const yesterday = addDays(today, -1);
    const { data: last, error } = await supabase
      .from("daily_product_sales")
      .select("sale_date")
      .lt("sale_date", today)
      .order("sale_date", { ascending: false })
      .limit(1);
    if (error) throw error;

    let from;
    if (last && last.length > 0) {
      const next = addDays(String(last[0].sale_date), 1);
      const recheck = addDays(yesterday, -2); // late voids / edits on recent days
      // Only the first run after a restart fills a long gap; later runs just re-check recent days.
      from = lastEnsureAt === 0 && next < recheck ? next : recheck;
    } else {
      const { data: first, error: firstErr } = await supabase
        .from("sales")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1);
      if (firstErr) throw firstErr;
      if (!first || first.length === 0) return;
      from = new Date(first[0].created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    }
    if (from <= yesterday) await refreshRange(from, yesterday);
    lastEnsureAt = Date.now();
  })().finally(() => {
    ensureInflight = null;
  });
  return ensureInflight;
};

/** Called after a Z-reading or a void so that day's totals are current. */
export const refreshDailySummaryForDate = async (dateStr = getManilaDateOnly()) => {
  await refreshRange(dateStr, dateStr);
  forecastCache = null;
};

// ---------------------------------------------------------------------------
// Forecast overview
// ---------------------------------------------------------------------------

let forecastCache = null; // { key, at, value }

const loadDailyRows = async (from, to) => {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("daily_product_sales")
      .select("sale_date, product_id, units")
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date")
      .order("product_id")
      .range(start, start + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const loadInsights = async (asOf) => {
  const { data, error } = await supabase.from("forecast_insights").select("product_id, summary, source, ai_factor, ai_reason").eq("for_date", asOf);
  if (error) throw error;
  return new Map((data || []).map((r) => [r.product_id, r]));
};

export const getForecastOverview = async ({ horizon = 14 } = {}) => {
  const h = clamp(Number(horizon) || 14, 7, 31);
  await ensureDailySummary();
  const asOf = addDays(getManilaDateOnly(), -1);
  const key = `${asOf}|${h}`;
  if (forecastCache && forecastCache.key === key && Date.now() - forecastCache.at < 10 * 60 * 1000) {
    return forecastCache.value;
  }

  const from = addDays(asOf, -(LAST_YEAR_OFFSET + TREND_DAYS + BACKTEST_DAYS));
  const [rows, productsRes, insights] = await Promise.all([
    loadDailyRows(from, asOf),
    supabase.from("products").select("id, name, category, price, track_stock, stock_quantity, is_archived, created_at"),
    loadInsights(asOf)
  ]);
  if (productsRes.error) throw productsRes.error;

  const byProduct = new Map();
  const firstSale = new Map();
  for (const r of rows) {
    const d = String(r.sale_date);
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, new Map());
    byProduct.get(r.product_id).set(d, Number(r.units) || 0);
    if (!firstSale.has(r.product_id) || d < firstSale.get(r.product_id)) firstSale.set(r.product_id, d);
  }

  const products = [];
  for (const p of productsRes.data || []) {
    if (p.is_archived) continue;
    const units = byProduct.get(p.id) || new Map();
    const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) : from;
    const firstDate = [firstSale.get(p.id), createdDate].filter(Boolean).sort()[0] || from;
    const f = forecastFromHistory(units, asOf, firstDate < from ? from : firstDate, { horizon: h });
    const bt = backtestForecast(units, asOf, firstDate < from ? from : firstDate);
    const history = [];
    for (let d = addDays(asOf, -(WINDOW_DAYS - 1)); d <= asOf; d = addDays(d, 1)) history.push({ date: d, units: units.get(d) || 0 });
    // Yesterday's AI note for this product: a bounded nudge on top of the computed forecast.
    const note = insights.get(p.id);
    const aiFactor = clamp(Number(note?.ai_factor) || 1, AI_MIN_FACTOR, AI_MAX_FACTOR);
    const adjusted = f.daily.map((d) => ({ date: d.date, units: round1(d.units * aiFactor) }));
    const sum7 = (days) => round1(days.slice(0, 7).reduce((s, d) => s + d.units, 0));
    const next7 = sum7(adjusted);
    products.push({
      product_id: p.id,
      name: p.name,
      category: p.category,
      track_stock: Boolean(p.track_stock),
      stock_quantity: Number(p.stock_quantity) || 0,
      status: f.status,
      next7,
      nextHorizon: round1(adjusted.reduce((s, d) => s + d.units, 0)),
      baseNext7: sum7(f.daily),
      aiFactor: round1(aiFactor * 100) / 100,
      aiReason: aiFactor !== 1 ? note?.ai_reason || null : null,
      recentDailyAvg: f.recentDailyAvg,
      weekdayProfile: f.weekdayProfile,
      peakDay: f.peakDay,
      trendPct: f.trendPct,
      seasonPct: f.seasonPct,
      factors: { trend: f.trendFactor, season: f.seasonFactor },
      sellingDays: f.sellingDays,
      accuracyPct: bt?.accuracyPct ?? null,
      confidence: confidenceFrom(f.status, bt?.accuracyPct ?? null),
      backtest: bt?.weeks || [],
      history,
      forecast: adjusted,
      baseForecast: f.daily,
      insight: insights.get(p.id)?.summary || templateInsight(p.name, f),
      insightSource: insights.get(p.id)?.source || "TEMPLATE"
    });
  }
  products.sort((a, b) => b.next7 - a.next7);

  const value = {
    asOf,
    horizonDays: h,
    generatedAt: new Date().toISOString(),
    method: "Weekday average of the last 8 weeks (zero-sale days included) x recent trend x last year's seasonal change. Accuracy = the same method re-run 4 weeks ago vs actual weekly sales.",
    products
  };
  forecastCache = { key, at: Date.now(), value };
  return value;
};

// ---------------------------------------------------------------------------
// Ingredient reorder plan (drives low-stock alerts)
// ---------------------------------------------------------------------------

// shortcut: daily_product_sales has no cup size, so size-specific recipe rows are averaged per
// ingredient; store size in the rollup if per-size accuracy is ever needed.
const recipeUsagePerUnit = (recipeRows) => {
  const byIng = new Map();
  for (const r of recipeRows) {
    const ing = r.ingredients;
    if (!ing) continue;
    const size = String(r.size_name || "").trim().toLowerCase();
    const qty = convertToBaseUnit(Number(r.quantity_used) || 0, r.recipe_unit || ing.unit, ing.unit);
    if (!byIng.has(ing.id)) byIng.set(ing.id, { base: null, sized: [] });
    const entry = byIng.get(ing.id);
    if (!size || size === "all") entry.base = qty;
    else entry.sized.push(qty);
  }
  const out = new Map();
  for (const [ingId, e] of byIng) {
    out.set(ingId, e.base ?? (e.sized.length ? e.sized.reduce((s, q) => s + q, 0) / e.sized.length : 0));
  }
  return out;
};

export const getIngredientReorderPlan = async () => {
  const [overview, ingRes, recipeRes, supplierRes, catRes, posSettings] = await Promise.all([
    getForecastOverview({ horizon: 14 }), // same cache entry as the forecast page; next7 is its first 7 days
    supabase.from("ingredients").select("*").neq("is_archived", true),
    supabase.from("recipes").select("product_id, quantity_used, recipe_unit, size_name, ingredients(id, unit), products(name, is_archived)"),
    supabase.from("supplier_ingredients").select("ingredient_id, supplier_id, default_price, default_purchase_unit, default_conversion_factor, suppliers(id, name, description, lead_time_days)"),
    supabase.from("category_settings").select("sizes, add_ons"),
    getPosSettings().catch(() => null)
  ]);
  for (const r of [ingRes, recipeRes, supplierRes, catRes]) if (r.error) throw r.error;

  // Ingredients can also be used outside recipes: cup-size packaging, add-ons and take-out packaging.
  // Their ids live inside JSON settings, so a text search is the simplest reliable check.
  const settingsText = JSON.stringify([catRes.data || [], posSettings?.takeout_packaging || null]);

  // Per ingredient: which active products use it and the smallest amount one serving of each needs.
  const linkedProducts = new Map();
  {
    const smallest = new Map(); // `${ingId}|${productId}` -> { name, need }
    for (const r of recipeRes.data || []) {
      if (!r.ingredients || !r.products || r.products.is_archived) continue;
      const need = convertToBaseUnit(Number(r.quantity_used) || 0, r.recipe_unit || r.ingredients.unit, r.ingredients.unit);
      if (!(need > 0)) continue;
      const key = `${r.ingredients.id}|${r.product_id}`;
      const cur = smallest.get(key);
      if (!cur || need < cur.need) smallest.set(key, { ingId: r.ingredients.id, product_id: r.product_id, name: r.products.name, need });
    }
    for (const v of smallest.values()) {
      if (!linkedProducts.has(v.ingId)) linkedProducts.set(v.ingId, []);
      linkedProducts.get(v.ingId).push({ product_id: v.product_id, name: v.name, needs: Math.round(v.need * 1000) / 1000 });
    }
  }

  const recipesByProduct = new Map();
  for (const r of recipeRes.data || []) {
    if (!recipesByProduct.has(r.product_id)) recipesByProduct.set(r.product_id, []);
    recipesByProduct.get(r.product_id).push(r);
  }
  const dailyUsage = new Map();
  for (const p of overview.products) {
    if (p.track_stock) continue; // stock-tracked products don't consume raw materials per sale
    const perUnit = recipeUsagePerUnit(recipesByProduct.get(p.product_id) || []);
    for (const [ingId, qty] of perUnit) {
      dailyUsage.set(ingId, (dailyUsage.get(ingId) || 0) + (qty * p.next7) / 7);
    }
  }
  // Every active supplier that can deliver each ingredient (one PO is made per chosen supplier).
  const leadTime = new Map();
  const suppliersByIngredient = new Map();
  for (const row of supplierRes.data || []) {
    const sup = row.suppliers;
    // Archived suppliers are marked by a "[ARCHIVED]" description prefix (there is no is_archived column).
    if (!sup || String(sup.description || "").startsWith("[ARCHIVED]")) continue;
    const days = Number(sup.lead_time_days);
    const lead = Number.isFinite(days) ? days : DEFAULT_LEAD_TIME_DAYS;
    leadTime.set(row.ingredient_id, Math.min(leadTime.get(row.ingredient_id) ?? Infinity, lead));
    if (!suppliersByIngredient.has(row.ingredient_id)) suppliersByIngredient.set(row.ingredient_id, []);
    suppliersByIngredient.get(row.ingredient_id).push({
      supplier_id: row.supplier_id,
      supplier_name: sup.name,
      lead_time_days: lead,
      default_price: Number(row.default_price) || 0,
      default_purchase_unit: row.default_purchase_unit || null,
      default_conversion_factor: Number(row.default_conversion_factor) || 1
    });
  }
  for (const list of suppliersByIngredient.values()) {
    list.sort((a, b) => a.lead_time_days - b.lead_time_days || a.default_price - b.default_price);
  }

  const enriched = await batchService.enrichIngredientsWithBatches(ingRes.data || []);
  return enriched.map((ing) => {
    const usage = Math.round((dailyUsage.get(ing.id) || 0) * 1000) / 1000;
    const lead = leadTime.get(ing.id) ?? DEFAULT_LEAD_TIME_DAYS;
    const usable = Number(ing.usable_stock) || 0;
    const reorderPoint = Math.round(usage * (lead + SAFETY_DAYS) * 1000) / 1000;
    const daysOfCover = usage > 0 ? Math.round((usable / usage) * 10) / 10 : null;
    // A perishable lot must be used before it expires: cover days can't exceed shelf life minus delivery time.
    const shelfDays = ing.is_perishable && ing.default_shelf_life_days ? Number(ing.default_shelf_life_days) : null;
    const coverDays = shelfDays ? Math.min(ORDER_COVER_DAYS, Math.max(0, shelfDays - lead - SAFETY_DAYS)) : ORDER_COVER_DAYS;
    const suggestedOrder = usage > 0 ? Math.max(0, Math.ceil(usage * (lead + SAFETY_DAYS + coverDays) - usable)) : 0;
    const expiringBeforeUse = usage > 0 ? quantityAtRiskOfExpiry(ing.batches || [], usage) : Number(ing.expiring_soon_stock) || 0;
    // Items with no recipe usage (e.g. new or unused) keep the manual threshold.
    const manualThreshold = Number(ing.low_stock_alert) || 0;

    // Some stock left, but not enough for even one serving of a product that needs it.
    const linked = linkedProducts.get(ing.id) || [];
    const blocked = usable > 0 ? linked.filter((p) => usable + 1e-6 < p.needs) : [];
    const usedOutsideRecipes = settingsText.includes(String(ing.id));
    let usageStatus = "IN_USE";
    if (linked.length === 0) usageStatus = usedOutsideRecipes ? "PACKAGING_OR_ADDON" : "NOT_IN_ANY_RECIPE";
    else if (usage === 0) usageStatus = "NO_RECENT_SALES";

    let alert = null;
    if (usable <= 0) alert = "OUT_OF_STOCK";
    else if (blocked.length > 0) alert = "CANNOT_MAKE";
    else if (usage > 0 && usable <= reorderPoint) alert = "REORDER_NOW";
    else if (manualThreshold > 0 && usable <= manualThreshold) alert = "BELOW_MANUAL_THRESHOLD"; // owner's own floor always counts

    return {
      ...ing,
      daily_usage: usage,
      lead_time_days: lead,
      available_suppliers: suppliersByIngredient.get(ing.id) || [],
      safety_days: SAFETY_DAYS,
      reorder_point: reorderPoint,
      days_of_cover: daysOfCover,
      suggested_order_qty: suggestedOrder,
      expiring_before_use_qty: expiringBeforeUse,
      expiry_risk: expiringBeforeUse > 0 || Number(ing.expired_stock) > 0,
      usage_status: usageStatus,
      linked_products_count: linked.length,
      blocked_products: blocked.slice(0, 6),
      blocked_count: blocked.length,
      alert
    };
  });
};

// ---------------------------------------------------------------------------
// Nightly explanations (Gemini optional) + scheduler
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini models are sometimes "overloaded" (503). Try each model with each key, in order, instead of
// losing the whole night to one busy moment. GEMINI_MODEL / GEMINI_FALLBACK_MODEL override the first two.
const askGemini = async (prompt) => {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP].filter(Boolean);
  const models = [...new Set([
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash",
    "gemini-3.1-flash-lite"
  ])];
  for (const model of models) {
    for (const key of keys) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
          }),
          signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) {
          console.warn(`[forecast] Gemini ${model} answered ${res.status}`);
          if (res.status === 503 || res.status === 429) await sleep(1500);
          continue;
        }
        const body = await res.json();
        const text = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        if (text) return JSON.parse(text.replace(/```json|```/gi, "").trim());
      } catch (err) {
        console.warn(`[forecast] Gemini ${model} failed: ${err.message}`);
      }
    }
  }
  return null;
};

/** Writes one explanation per product for `asOf`. Gemini rewords the computed facts; template otherwise. */
export const generateNightlyInsights = async ({ force = false } = {}) => {
  const overview = await getForecastOverview({ horizon: 14 });
  // Retry until Gemini has written today's sentences; with no key configured, template rows count as done.
  const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BACKUP);
  let done = supabase
    .from("forecast_insights")
    .select("product_id", { count: "exact", head: true })
    .eq("for_date", overview.asOf);
  if (hasKey) done = done.eq("source", "GEMINI");
  const { count, error } = await done;
  if (error) throw error;
  if (!force && count > 0) return { asOf: overview.asOf, skipped: true };

  const active = overview.products.filter((p) => p.status === "OK").slice(0, 60);
  const { data: special, error: specialErr } = await supabase
    .from("forecast_special_dates")
    .select("label, start_date, end_date, effect")
    .lte("start_date", addDays(overview.asOf, 14))
    .gte("end_date", addDays(overview.asOf, 1));
  if (specialErr) console.warn("[forecast] special dates unavailable:", specialErr.message);
  const events = [];
  for (let i = 1; i <= 14; i += 1) {
    const date = addDays(overview.asOf, i);
    const names = calendarEvents(date);
    for (const sd of special || []) {
      if (String(sd.start_date) <= date && date <= String(sd.end_date)) {
        names.push(`${sd.label} (the owner expects ${sd.effect === "UNSURE" ? "an unknown effect on sales" : sd.effect.toLowerCase()})`);
      }
    }
    if (names.length) events.push({ date, weekday: WEEKDAYS[weekdayOf(date)], events: names });
  }
  // Facts are the computed (un-adjusted) numbers; the AI only sees what the engine produced.
  const facts = active.map((p) => ({
    id: p.product_id,
    name: p.name,
    baseNext7Units: Math.round(p.baseNext7),
    busiestDay: p.peakDay,
    trendPctVsPrev4Weeks: p.trendPct,
    lastYearSeasonPct: p.seasonPct,
    measuredAccuracyPct: p.accuracyPct
  }));
  const ai = facts.length
    ? await askGemini(
      "You help a Philippine cafe owner read a demand forecast. For each product you get the computed forecast facts. " +
      "Upcoming holidays and owner-entered special dates such as exam weeks or school breaks (next 14 days): " + JSON.stringify(events) + ". " +
      "Return JSON {\"<id>\": {\"factor\": <number>, \"summary\": \"<sentence>\"}}. " +
      "factor is a multiplier for the next 14 days: 1.0 unless an upcoming holiday/special date or a clear trend/season signal in the facts justifies a change; " +
      "never outside 0.9-1.1. summary: one plain-English sentence (max 30 words) explaining the forecast and, if factor is not 1, why. " +
      "Use ONLY the numbers and events given; do not invent numbers, events or reasons. Mention accuracy only if below 60.\n" +
      JSON.stringify(facts)
    )
    : null;

  const rows = overview.products.map((p) => {
    const entry = ai ? ai[p.product_id] : null;
    const aiText = typeof entry === "string" ? entry : typeof entry?.summary === "string" ? entry.summary : "";
    const factor = clamp(Number(entry?.factor) || 1, AI_MIN_FACTOR, AI_MAX_FACTOR);
    const text = aiText.trim().slice(0, 300);
    return {
      product_id: p.product_id,
      for_date: overview.asOf,
      summary: text || p.insight,
      source: text ? "GEMINI" : "TEMPLATE",
      ai_factor: text ? factor : 1,
      ai_reason: text && factor !== 1 ? text : null
    };
  });
  if (rows.length) {
    const { error: upErr } = await supabase.from("forecast_insights").upsert(rows, { onConflict: "product_id,for_date" });
    if (upErr) throw upErr;
  }
  forecastCache = null;
  return { asOf: overview.asOf, written: rows.length, gemini: Boolean(ai) };
};

/** End-of-day job: every 30 min make sure yesterday is rolled up and explained (cheap when already done). */
export const startEndOfDayJob = () => {
  const run = async () => {
    try {
      await ensureDailySummary();
      await generateNightlyInsights();
    } catch (err) {
      console.warn("[forecast] end-of-day job skipped:", err.message);
    }
  };
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 30 * 60 * 1000).unref();
};

/** After a void/refund: recompute the day the sale was made (it may be days ago). */
export const refreshDailySummaryForSale = async (saleId) => {
  const { data, error } = await supabase.from("sales").select("created_at").eq("id", saleId).maybeSingle();
  if (error) throw error;
  if (data?.created_at) {
    await refreshDailySummaryForDate(new Date(data.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  }
};
