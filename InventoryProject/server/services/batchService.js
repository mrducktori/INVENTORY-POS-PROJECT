// Raw-material batches (lots). The `inventory_batches` table is the single source of truth:
// a database trigger keeps ingredients.stock_quantity equal to the sum of quantity_remaining,
// and every deduction/restore runs inside a Postgres function that locks the ingredient row.
// See docs/database/phase5_batches_source_of_truth.sql.
import crypto from "node:crypto";
import { supabase } from "../config/supabaseClient.js";
import { getManilaDateOnly, getManilaISOString } from "../utils/dateUtils.js";
import { logAudit } from "../utils/auditHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";

const STOCKTAKE_HISTORY_KEY = "stocktake_history_store";
const EPSILON = 1e-4;
const MAX_STOCKTAKE_HISTORY = 100;
export const EXPIRING_SOON_DAYS = 7;

// Finer expiry levels so the owner can act early: use-first, promote, then throw away.
//   EXPIRED  past its date            -> remove and record wastage
//   CRITICAL 0-2 days left            -> use first, promote or discount today
//   WARNING  3-6 days left            -> use first (FEFO), avoid reordering
//   WATCH    7-14 days left           -> keep an eye on it
export const expiryLevelFor = (daysUntilExpiry) => {
  if (daysUntilExpiry === null || daysUntilExpiry === undefined) return "NONE";
  if (daysUntilExpiry < 0) return "EXPIRED";
  if (daysUntilExpiry <= 2) return "CRITICAL";
  if (daysUntilExpiry <= 6) return "WARNING";
  if (daysUntilExpiry <= 14) return "WATCH";
  return "OK";
};
const EXPIRY_LEVEL_RANK = { NONE: 0, OK: 0, WATCH: 1, WARNING: 2, CRITICAL: 3, EXPIRED: 4 };

let hasNativeStocktakeTables = null;

// Only the stocktake history still lives in a JSON store; this serializes its read-modify-write.
const storeLocks = new Map();
const withStoreLock = async (key, fn) => {
  const prev = storeLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  storeLocks.set(key, prev.then(() => current, () => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (storeLocks.get(key) === current) storeLocks.delete(key);
  }
};

const round6 = (val) => Math.max(0, Math.round((Number(val) || 0) * 1e6) / 1e6);

const isMissingTableError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return err.code === "42P01" || err.code === "PGRST205" || /relation .* does not exist/i.test(msg) || /could not find the table/i.test(msg);
};

// Postgres functions raise SQLSTATE 'PT4xx'; turn that into an Error with an HTTP status.
const rpcError = (error) => {
  const match = /^PT(\d{3})$/.exec(String(error?.code || ""));
  const err = new Error(error?.message || "Inventory database error.");
  err.status = match ? Number(match[1]) : 500;
  return err;
};

export const addDaysManila = (dateStr, days) => {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || "").trim())
    ? String(dateStr).trim()
    : getManilaDateOnly();
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + (Number(days) || 0)));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const diffDaysManila = (fromDateStr, toDateStr) => {
  const [fy, fm, fd] = fromDateStr.split("-").map(Number);
  const [ty, tm, td] = toDateStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
};

/** Exact YYYY-MM-DD (or a full ISO timestamp); `rejectPast` blocks receiving already-expired stock. */
export const validateOptionalExpiryDate = (rawExpiry, { rejectPast = false } = {}) => {
  if (rawExpiry === undefined || rawExpiry === null || String(rawExpiry).trim() === "") {
    return null;
  }
  const raw = String(rawExpiry).trim();
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(raw)) {
    const err = new Error("Expiry date must be in YYYY-MM-DD format.");
    err.status = 400;
    throw err;
  }
  const str = raw.slice(0, 10);
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    const err = new Error("Expiry date is not a valid calendar date.");
    err.status = 400;
    throw err;
  }
  if (rejectPast && str < getManilaDateOnly()) {
    const err = new Error(`Expiry date ${str} is already past; do not receive expired stock.`);
    err.status = 400;
    throw err;
  }
  return str;
};

export const validateOptionalBatchCode = (rawCode) => {
  if (rawCode === undefined || rawCode === null || String(rawCode).trim() === "") {
    return null;
  }
  return validateTextLength(rawCode, {
    label: "Batch code",
    min: 1,
    max: LIMITS.BATCH_CODE_MAX_LEN,
    required: false
  });
};

// Shelf life: ingredient override, then raw-material category default, else perishable with no
// default.

/** Map of UPPERCASE category → { is_perishable, default_shelf_life_days }. */
export const getPerishabilityMetaMap = async () => {
  const { data, error } = await supabase
    .from("raw_material_category_shelf_life")
    .select("category, is_perishable, default_shelf_life_days");
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [String(r.category).trim().toUpperCase(), r]));
};

export const getIngredientPerishability = (ing, categoryMap = {}) => {
  const cat = categoryMap[String(ing?.category || "").trim().toUpperCase()] || null;
  const isPerishable = typeof ing?.is_perishable === "boolean"
    ? ing.is_perishable
    : (typeof cat?.is_perishable === "boolean" ? cat.is_perishable : true);
  if (!isPerishable) {
    return { is_perishable: false, default_shelf_life_days: null, source: ing?.is_perishable === false ? "ITEM" : "CATEGORY" };
  }
  const itemDays = Number(ing?.default_shelf_life_days);
  if (Number.isFinite(itemDays) && itemDays >= LIMITS.SHELF_LIFE_DAYS_MIN) {
    return { is_perishable: true, default_shelf_life_days: itemDays, source: "ITEM" };
  }
  const catDays = Number(cat?.default_shelf_life_days);
  if (Number.isFinite(catDays) && catDays >= LIMITS.SHELF_LIFE_DAYS_MIN) {
    return { is_perishable: true, default_shelf_life_days: catDays, source: "CATEGORY" };
  }
  return { is_perishable: true, default_shelf_life_days: null, source: "NONE" };
};

/** Item-level override. `is_perishable: null` clears the override (falls back to the category). */
export const setIngredientPerishability = async (ingredientId, { is_perishable = true, default_shelf_life_days = null } = {}) => {
  let flag = is_perishable === null ? null : Boolean(is_perishable);
  let days = null;
  if (flag && default_shelf_life_days !== null && default_shelf_life_days !== undefined && default_shelf_life_days !== "") {
    days = Math.round(validateNumberBound(default_shelf_life_days, {
      label: "Default shelf life (days)",
      min: LIMITS.SHELF_LIFE_DAYS_MIN,
      max: LIMITS.SHELF_LIFE_DAYS_MAX,
      allowZero: false
    }));
  }
  const { error } = await supabase
    .from("ingredients")
    .update({ is_perishable: flag, default_shelf_life_days: days })
    .eq("id", ingredientId);
  if (error) throw error;
  return { is_perishable: flag, default_shelf_life_days: days };
};

export const getCategoryShelfLifeSettings = async () => {
  const { data, error } = await supabase
    .from("raw_material_category_shelf_life")
    .select("category, is_perishable, default_shelf_life_days, updated_at")
    .order("category");
  if (error) throw error;
  return data || [];
};

export const setCategoryShelfLife = async (category, { is_perishable = true, default_shelf_life_days = null } = {}) => {
  const key = String(category || "").trim().toUpperCase();
  if (!key) {
    const err = new Error("Category is required.");
    err.status = 400;
    throw err;
  }
  const flag = Boolean(is_perishable);
  const days = flag && default_shelf_life_days !== null && default_shelf_life_days !== undefined && default_shelf_life_days !== ""
    ? Math.round(validateNumberBound(default_shelf_life_days, {
      label: "Default shelf life (days)",
      min: LIMITS.SHELF_LIFE_DAYS_MIN,
      max: LIMITS.SHELF_LIFE_DAYS_MAX,
      allowZero: false
    }))
    : null;
  const { data, error } = await supabase
    .from("raw_material_category_shelf_life")
    .upsert({ category: key, is_perishable: flag, default_shelf_life_days: days, updated_at: new Date().toISOString() }, { onConflict: "category" })
    .select()
    .single();
  if (error) throw error;
  return data;
};


const loadBatches = async (ingredientIds = null) => {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = supabase
      .from("inventory_batches")
      .select("*")
      .gt("quantity_remaining", 0)
      .order("id")
      .range(from, from + pageSize - 1);
    if (Array.isArray(ingredientIds)) q = q.in("ingredient_id", ingredientIds);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

/** FEFO display order: usable with expiry (soonest first), usable without expiry, then expired. */
export const annotateAndSortBatchesFEFO = (batches = [], todayManila = getManilaDateOnly()) => {
  const annotated = batches
    .filter((b) => Number(b?.quantity_remaining) > EPSILON)
    .map((b) => {
      const expiryDate = b.expiry_date ? String(b.expiry_date).slice(0, 10) : null;
      const daysUntilExpiry = expiryDate ? diffDaysManila(todayManila, expiryDate) : null;
      const isExpired = Boolean(expiryDate && expiryDate < todayManila);
      let expiryStatus = "NO_EXPIRY";
      if (expiryDate) {
        if (isExpired) expiryStatus = "EXPIRED";
        else if (daysUntilExpiry <= EXPIRING_SOON_DAYS) expiryStatus = "EXPIRING_SOON";
        else expiryStatus = "FRESH";
      }
      return {
        ...b,
        quantity_remaining: round6(b.quantity_remaining),
        expiry_date: expiryDate,
        is_expired: isExpired,
        days_until_expiry: daysUntilExpiry,
        expiry_status: expiryStatus,
        expiry_level: expiryLevelFor(daysUntilExpiry)
      };
    });

  const groupOf = (item) => (!item.is_expired && item.expiry_date ? 0 : !item.is_expired ? 1 : 2);
  // received_at is a timestamptz from Postgres; compare as instants, not strings.
  const ts = (v) => (v ? new Date(v).getTime() || 0 : 0);
  return annotated.sort((a, b) => {
    const ga = groupOf(a);
    const gb = groupOf(b);
    if (ga !== gb) return ga - gb;
    if ((ga === 0 || ga === 2) && a.expiry_date !== b.expiry_date) {
      return a.expiry_date.localeCompare(b.expiry_date);
    }
    return ts(a.received_at) - ts(b.received_at);
  });
};

const buildEnrichedIngredient = (ing, ingBatches, perishability, todayManila) => {
  const sortedBatches = annotateAndSortBatchesFEFO(ingBatches, todayManila);
  const sum = (pred) => round6(sortedBatches.filter(pred).reduce((s, b) => s + b.quantity_remaining, 0));
  const firstUsable = sortedBatches.find((b) => !b.is_expired && b.expiry_date);
  const firstExpired = sortedBatches.find((b) => b.is_expired && b.expiry_date);

  // Worst level among lots that still have stock, and how much sits at each level.
  const expiryQty = { EXPIRED: 0, CRITICAL: 0, WARNING: 0, WATCH: 0 };
  let worstLevel = "NONE";
  for (const b of sortedBatches) {
    if (b.expiry_level in expiryQty) expiryQty[b.expiry_level] = round6(expiryQty[b.expiry_level] + b.quantity_remaining);
    if (EXPIRY_LEVEL_RANK[b.expiry_level] > EXPIRY_LEVEL_RANK[worstLevel]) worstLevel = b.expiry_level;
  }
  if (worstLevel === "NONE" && sortedBatches.some((b) => b.expiry_level === "OK")) worstLevel = "OK";

  return {
    ...ing,
    expiry_level: worstLevel,
    expiring_qty_by_level: expiryQty,
    is_perishable: perishability.is_perishable,
    default_shelf_life_days: perishability.default_shelf_life_days,
    shelf_life_source: perishability.source,
    batches: sortedBatches,
    usable_stock: sum((b) => !b.is_expired),
    expired_stock: sum((b) => b.is_expired),
    expiring_soon_stock: sum((b) => b.expiry_status === "EXPIRING_SOON"),
    nearest_expiry_date: firstUsable?.expiry_date ?? firstExpired?.expiry_date ?? null
  };
};

export const enrichIngredientsWithBatches = async (ingredients = []) => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return [];
  const todayManila = getManilaDateOnly();
  const ids = ingredients.map((i) => i.id).filter(Boolean);
  // Large lists (inventory page) load everything once instead of a huge IN (...) filter.
  const [batches, categoryMap] = await Promise.all([
    loadBatches(ids.length > 200 ? null : ids),
    getPerishabilityMetaMap()
  ]);
  const byIngredient = new Map();
  for (const b of batches) {
    const key = String(b.ingredient_id);
    if (!byIngredient.has(key)) byIngredient.set(key, []);
    byIngredient.get(key).push(b);
  }
  return ingredients.map((ing) =>
    buildEnrichedIngredient(ing, byIngredient.get(String(ing.id)) || [], getIngredientPerishability(ing, categoryMap), todayManila)
  );
};


/** Adds a new lot. The DB trigger raises ingredients.stock_quantity by the same amount. */
export const createBatch = async ({
  ingredient_id,
  source = "DIRECT_RECEIVE",
  initial_quantity,
  batch_code = null,
  expiry_date = null,
  received_at = null,
  po_id = null,
  po_item_id = null,
  purchase_unit = null,
  purchase_quantity = null,
  conversion_factor = null,
  notes = null,
  stock_max = LIMITS.STOCK_QTY_MAX
}) => {
  const qty = validateNumberBound(initial_quantity, {
    label: "Batch initial quantity",
    min: 0.0001,
    max: LIMITS.STOCK_QTY_MAX,
    allowZero: false
  });
  const validatedCode = validateOptionalBatchCode(batch_code);
  const isReceipt = source === "DIRECT_RECEIVE" || source === "PURCHASE_ORDER" || source === "INITIAL_STOCK";
  const validatedExpiry = validateOptionalExpiryDate(expiry_date, { rejectPast: isReceipt });
  const todayManila = getManilaDateOnly();

  const [{ data: ing, error: ingErr }, categoryMap] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, category, stock_quantity, is_perishable, default_shelf_life_days")
      .eq("id", ingredient_id)
      .maybeSingle(),
    getPerishabilityMetaMap()
  ]);
  if (ingErr) throw ingErr;
  if (!ing) {
    const err = new Error("Raw material not found.");
    err.status = 404;
    throw err;
  }
  if (Number(ing.stock_quantity || 0) + qty > stock_max) {
    const err = new Error(`Resulting stock quantity cannot exceed ${Number(stock_max).toLocaleString()}.`);
    err.status = 400;
    throw err;
  }

  const perishability = getIngredientPerishability(ing, categoryMap);
  const resolvedExpiry = validatedExpiry
    || (perishability.is_perishable && perishability.default_shelf_life_days
      ? addDaysManila(todayManila, perishability.default_shelf_life_days)
      : null);

  const row = {
    id: crypto.randomUUID(),
    ingredient_id,
    batch_code: validatedCode || `LOT-${todayManila.replace(/-/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
    source,
    initial_quantity: round6(qty),
    quantity_remaining: round6(qty),
    received_at: received_at || getManilaISOString(),
    expiry_date: resolvedExpiry,
    po_id: po_id || null,
    po_item_id: po_item_id || null,
    purchase_unit: purchase_unit || null,
    purchase_quantity: purchase_quantity ?? null,
    conversion_factor: conversion_factor ?? null,
    notes: notes ? String(notes).trim().slice(0, LIMITS.DESC_MAX_LEN) : null
  };

  const { data, error } = await supabase.from("inventory_batches").insert([row]).select().single();
  if (error) throw error;
  const [annotated] = annotateAndSortBatchesFEFO([data], todayManila);
  return annotated || data;
};

/** FEFO deduction, atomic in Postgres (row lock per ingredient). */
export const deductStockFEFO = async (ingredientId, quantityNeeded, options = {}) => {
  const qty = Number(quantityNeeded);
  if (!Number.isFinite(qty) || qty <= 0) {
    const err = new Error("Deduction quantity must be greater than 0.");
    err.status = 400;
    throw err;
  }
  const { data, error } = await supabase.rpc("inv_deduct_fefo", {
    p_ingredient_id: ingredientId,
    p_qty: round6(qty),
    p_allow_expired: Boolean(options.allowExpired),
    p_prefer_expired: Boolean(options.preferExpired),
    p_target_batch_id: options.targetBatchId || null,
    p_today: getManilaDateOnly()
  });
  if (error) throw rpcError(error);
  return {
    deductedBatches: data?.deductedBatches || [],
    newTotalStock: Number(data?.newTotalStock || 0),
    remainingUsableStock: Number(data?.remainingUsableStock || 0)
  };
};

/** Puts previously deducted quantities back into the same batches (rollback / void). */
export const restoreDeductedBatches = async (ingredientId, deductedBatches = []) => {
  if (!ingredientId || !Array.isArray(deductedBatches) || deductedBatches.length === 0) return null;
  const { data, error } = await supabase.rpc("inv_restore_batches", {
    p_ingredient_id: ingredientId,
    p_items: deductedBatches
  });
  if (error) throw rpcError(error);
  return { newTotalStock: Number(data || 0) };
};

/** Receives one PO line atomically (batch + stock + quantity_received). Null when nothing was left. */
export const receivePurchaseOrderItem = async ({ po_id, po_item_id, quantity, batch_code = null, expiry_date = null, purchase_unit = null }) => {
  const { data, error } = await supabase.rpc("inv_receive_po_item", {
    p_po_id: po_id,
    p_po_item_id: po_item_id,
    p_qty: quantity,
    p_batch_code: validateOptionalBatchCode(batch_code),
    p_expiry: validateOptionalExpiryDate(expiry_date, { rejectPast: true }),
    p_purchase_unit: purchase_unit
  });
  if (error) throw rpcError(error);
  return data || null;
};

export const getBatches = async ({ ingredientId = null } = {}) => {
  let query = supabase.from("ingredients").select("*").neq("is_archived", true).order("name");
  if (ingredientId) {
    query = supabase.from("ingredients").select("*").eq("id", ingredientId);
  }
  const { data: ingredients, error } = await query;
  if (error) throw error;

  const enriched = await enrichIngredientsWithBatches(ingredients || []);
  const batches = [];
  for (const ing of enriched) {
    for (const b of ing.batches || []) {
      batches.push({ ...b, ingredient_name: ing.name, unit: ing.unit, category: ing.category || null });
    }
  }
  return batches;
};

export const getExpiryAlerts = async () => {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("*")
    .neq("is_archived", true);
  if (error) throw error;

  const enriched = await enrichIngredientsWithBatches(ingredients || []);
  const expiredBatches = [];
  const expiringSoonBatches = [];
  const watchBatches = []; // 7-14 days left: listed for awareness, not counted as "expiring soon"

  for (const ing of enriched) {
    for (const b of ing.batches || []) {
      if (b.quantity_remaining <= EPSILON) continue;
      const entry = { ...b, ingredient_id: ing.id, ingredient_name: ing.name, unit: ing.unit, category: ing.category || null };
      if (b.expiry_status === "EXPIRED") expiredBatches.push(entry);
      else if (b.expiry_status === "EXPIRING_SOON") expiringSoonBatches.push(entry);
      else if (b.expiry_level === "WATCH") watchBatches.push(entry);
    }
  }

  const byExpiry = (a, b) => String(a.expiry_date || "").localeCompare(String(b.expiry_date || ""));
  expiredBatches.sort(byExpiry);
  expiringSoonBatches.sort(byExpiry);
  watchBatches.sort(byExpiry);

  return {
    expiredBatches,
    expiringSoonBatches,
    watchBatches,
    expiredCount: expiredBatches.length,
    expiringSoonCount: expiringSoonBatches.length
  };
};


const readCmsJsonStore = async (sectionKey, fallback) => {
  const { data, error } = await supabase.from("cms_content").select("description").eq("section_key", sectionKey).maybeSingle();
  if (error) throw error;
  if (!data?.description) return fallback;
  try {
    const parsed = JSON.parse(data.description);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeCmsJsonStore = async (sectionKey, title, payload) => {
  const { error } = await supabase
    .from("cms_content")
    .upsert({ section_key: sectionKey, title, description: JSON.stringify(payload) }, { onConflict: "section_key" });
  if (error) throw error;
};

export const getStocktakeHistory = async () => {
  const store = await readCmsJsonStore(STOCKTAKE_HISTORY_KEY, { sessions: [] });
  return Array.isArray(store.sessions) ? store.sessions : [];
};

const syncNativeStocktake = async (session, adjustedItems) => {
  if (hasNativeStocktakeTables === false) return;
  try {
    const { error: sessErr } = await supabase.from("stocktake_sessions").insert([
      {
        id: session.id,
        conducted_by: session.conducted_by || null,
        conducted_by_name: session.conducted_by_name || null,
        total_checked: session.total_checked,
        items_adjusted: session.items_adjusted,
        notes: session.notes || null,
        conducted_at: session.conducted_at
      }
    ]);
    if (sessErr) {
      if (isMissingTableError(sessErr)) hasNativeStocktakeTables = false;
      return;
    }
    hasNativeStocktakeTables = true;
    if (adjustedItems.length > 0) {
      await supabase.from("stocktake_items").insert(adjustedItems.map((it) => ({
        session_id: session.id,
        ingredient_id: it.ingredient_id,
        system_quantity: it.system_quantity,
        physical_count: it.physical_count,
        variance: it.variance,
        reason: it.reason || null
      })));
    }
  } catch (err) {
    if (isMissingTableError(err)) hasNativeStocktakeTables = false;
  }
};

export const performStocktake = async ({ counts, notes = "", user }) => {
  if (!Array.isArray(counts) || counts.length === 0) {
    const err = new Error("At least one stocktake count is required.");
    err.status = 400;
    throw err;
  }

  const cleanNotes = validateTextLength(notes, { label: "Stocktake notes", min: 0, max: LIMITS.DESC_MAX_LEN, required: false });

  const rawValidated = counts.map((entry) => {
    if (!entry || !entry.ingredient_id) {
      const err = new Error("Each stocktake entry must include an ingredient_id.");
      err.status = 400;
      throw err;
    }
    const physical_count = round6(validateNumberBound(entry.physical_count, {
      label: "Physical count",
      min: LIMITS.STOCKTAKE_COUNT_MIN,
      max: LIMITS.STOCKTAKE_COUNT_MAX
    }));
    const reason = validateTextLength(entry.reason ?? entry.note ?? "", {
      label: "Adjustment reason",
      min: 0,
      max: LIMITS.DESC_MAX_LEN,
      required: false
    });
    return { ingredient_id: entry.ingredient_id, physical_count, reason: reason || "Physical Count Correction" };
  });

  // Duplicate ingredient_id entries: last one wins.
  const validatedCounts = [...new Map(rawValidated.map((c) => [String(c.ingredient_id), c])).values()];
  const adjustedItems = [];
  let stocktakeError = null;

  for (const item of validatedCounts) {
    const { data: ing, error: ingErr } = await supabase
      .from("ingredients")
      .select("id, name, unit, stock_quantity")
      .eq("id", item.ingredient_id)
      .maybeSingle();
    if (ingErr) throw ingErr;
    if (!ing) {
      const err = new Error(`Raw material not found: ${item.ingredient_id}`);
      err.status = 404;
      throw err;
    }

    const systemQty = round6(Number(ing.stock_quantity || 0));
    const variance = Math.round((item.physical_count - systemQty) * 1e6) / 1e6;
    if (Math.abs(variance) <= EPSILON) continue;

    try {
      if (variance > 0) {
        // Found more than the system had: record it as its own lot so it stays traceable.
        await createBatch({
          ingredient_id: ing.id,
          source: "STOCKTAKE_ADJUSTMENT",
          initial_quantity: variance,
          batch_code: `STK-${getManilaDateOnly().replace(/-/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          notes: item.reason
        });
      } else {
        // Missing stock is taken from expired lots first, then FEFO.
        await deductStockFEFO(ing.id, Math.abs(variance), { allowExpired: true, preferExpired: true });
      }
    } catch (err) {
      // Earlier items are already applied: keep their record, then report the failure below.
      if (adjustedItems.length === 0) throw err;
      stocktakeError = err;
      break;
    }

    adjustedItems.push({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      unit: ing.unit,
      system_quantity: systemQty,
      physical_count: item.physical_count,
      variance,
      reason: item.reason
    });
  }

  const nowIso = getManilaISOString();
  const session = {
    id: crypto.randomUUID(),
    conducted_at: nowIso,
    created_at: nowIso,
    conducted_by: user?.id || null,
    conducted_by_name: user?.name || "System",
    total_checked: validatedCounts.length,
    items_adjusted: adjustedItems.length,
    notes: cleanNotes || "",
    items: adjustedItems
  };

  await withStoreLock(STOCKTAKE_HISTORY_KEY, async () => {
    const sessions = await getStocktakeHistory();
    await writeCmsJsonStore(STOCKTAKE_HISTORY_KEY, "Stocktake History Store", {
      sessions: [session, ...sessions].slice(0, MAX_STOCKTAKE_HISTORY)
    });
  });

  await syncNativeStocktake(session, adjustedItems);

  await logAudit("STOCKTAKE_RECONCILED", user?.id || null, {
    session_id: session.id,
    total_checked: session.total_checked,
    items_adjusted: session.items_adjusted,
    notes: session.notes,
    adjustments: adjustedItems
  });

  if (stocktakeError) {
    stocktakeError.message = `${adjustedItems.length} item(s) were adjusted and saved; the rest were not: ${stocktakeError.message}`;
    throw stocktakeError;
  }
  return session;
};
