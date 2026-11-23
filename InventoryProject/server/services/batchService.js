import crypto from "node:crypto";
import { supabase } from "../config/supabaseClient.js";
import { getManilaDateOnly, getManilaISOString } from "../utils/dateUtils.js";
import { logAudit } from "../utils/auditHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";

const BATCHES_STORE_KEY = "inventory_batches_store";
const PERISHABILITY_META_KEY = "ingredient_perishability_meta";
const STOCKTAKE_HISTORY_KEY = "stocktake_history_store";

const EPSILON = 1e-4;
const STOCK_EPSILON = 1e-6;
const MAX_STOCKTAKE_HISTORY = 100;

let hasNativeBatchesTable = null;
let hasNativePerishabilityCols = null;
let hasNativeStocktakeTables = null;

// Per-store promise mutexes prevent concurrent read-modify-write lost updates
// (e.g., Promise.all ingredient deductions during POS checkout).
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
    if (storeLocks.get(key) === current) {
      storeLocks.delete(key);
    }
  }
};

const round6 = (val) => Math.max(0, Math.round((Number(val) || 0) * 1e6) / 1e6);

const isMissingTableError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return err.code === "42P01" || err.code === "PGRST205" || /relation .* does not exist/i.test(msg) || /could not find the table/i.test(msg);
};

const isMissingColumnError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return err.code === "42703" || err.code === "PGRST204" || /column .* does not exist/i.test(msg) || /could not find the .* column/i.test(msg);
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
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86400000);
};

export const validateOptionalExpiryDate = (rawExpiry) => {
  if (rawExpiry === undefined || rawExpiry === null || String(rawExpiry).trim() === "") {
    return null;
  }
  const str = String(rawExpiry).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const err = new Error("Expiry date must be in YYYY-MM-DD format.");
    err.status = 400;
    throw err;
  }
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    const err = new Error("Expiry date is not a valid calendar date.");
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

const readCmsJsonStore = async (sectionKey, fallback) => {
  const { data, error } = await supabase
    .from("cms_content")
    .select("description")
    .eq("section_key", sectionKey)
    .maybeSingle();

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
    .upsert(
      {
        section_key: sectionKey,
        title,
        description: JSON.stringify(payload)
      },
      { onConflict: "section_key" }
    );
  if (error) throw error;
};

const loadBatches = async () => {
  const store = await readCmsJsonStore(BATCHES_STORE_KEY, { batches: [] });
  const cmsBatches = Array.isArray(store.batches) ? store.batches : [];
  if (cmsBatches.length > 0 || hasNativeBatchesTable === false) {
    return cmsBatches;
  }
  try {
    const { data, error } = await supabase.from("inventory_batches").select("*");
    if (error) {
      if (isMissingTableError(error)) {
        hasNativeBatchesTable = false;
        return cmsBatches;
      }
      throw error;
    }
    hasNativeBatchesTable = true;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (isMissingTableError(err)) {
      hasNativeBatchesTable = false;
      return cmsBatches;
    }
    throw err;
  }
};

const saveBatches = async (batches) => {
  await writeCmsJsonStore(BATCHES_STORE_KEY, "Inventory Batches Store", { batches });
};

const syncNativeBatchUpsert = async (batchList) => {
  if (hasNativeBatchesTable === false || !Array.isArray(batchList) || batchList.length === 0) return;
  try {
    const rows = batchList.map((b) => ({
      id: b.id,
      ingredient_id: b.ingredient_id,
      batch_code: b.batch_code,
      source: b.source || "DIRECT_RECEIVE",
      initial_quantity: b.initial_quantity,
      quantity_remaining: b.quantity_remaining,
      received_at: b.received_at,
      expiry_date: b.expiry_date || null,
      po_id: b.po_id || null,
      po_item_id: b.po_item_id || null,
      purchase_unit: b.purchase_unit || null,
      purchase_quantity: b.purchase_quantity ?? null,
      conversion_factor: b.conversion_factor ?? null,
      notes: b.notes || null
    }));
    const { error } = await supabase.from("inventory_batches").upsert(rows, { onConflict: "id" });
    if (error) {
      if (isMissingTableError(error)) {
        hasNativeBatchesTable = false;
        return;
      }
      // Do not break primary CMS-backed flow on optional native FK/constraint edge mismatch
      console.warn("[batchService] Native inventory_batches upsert skipped:", error.message);
    } else {
      hasNativeBatchesTable = true;
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      hasNativeBatchesTable = false;
    }
  }
};

const loadPerishabilityMetaMap = async () => {
  const store = await readCmsJsonStore(PERISHABILITY_META_KEY, {});
  return store && typeof store === "object" && !Array.isArray(store) ? store : {};
};

export const getPerishabilityMetaMap = loadPerishabilityMetaMap;

/**
 * Resolves perishability metadata for an ingredient from explicit metadata or smart defaults.
 */
export const getIngredientPerishability = (ing, explicitMeta = null) => {
  const meta = explicitMeta && typeof explicitMeta === "object" && explicitMeta[ing?.id]
    ? explicitMeta[ing.id]
    : explicitMeta;

  const hasMetaFlag = meta && typeof meta.is_perishable === "boolean";
  const hasRowFlag = ing && typeof ing.is_perishable === "boolean";

  const catUpper = String(ing?.category || "").trim().toUpperCase();
  const name = String(ing?.name || "");

  let defaultMeta;
  if (
    catUpper === "PACKAGING & SUPPLIES" ||
    (/CUP|LID|STRAW|CARRIER|NAPKIN|HOLDER|BAG/i.test(name) && !/COFFEE|TEA|POWDER|MILK|CREAM|SYRUP/i.test(name))
  ) {
    defaultMeta = { is_perishable: false, default_shelf_life_days: null };
  } else if (catUpper === "DAIRY & CREAMERS" || /MILK|CREAM|YAKULT|WHIP/i.test(name)) {
    defaultMeta = { is_perishable: true, default_shelf_life_days: 14 };
  } else if (catUpper === "SINKERS & TOPPINGS" || /PEARL|NATA|JELLY|PUDDING|OREO/i.test(name)) {
    defaultMeta = { is_perishable: true, default_shelf_life_days: 30 };
  } else {
    defaultMeta = { is_perishable: true, default_shelf_life_days: 180 };
  }

  if (hasMetaFlag) {
    if (!meta.is_perishable) {
      return { is_perishable: false, default_shelf_life_days: null };
    }
    const days = Number(meta.default_shelf_life_days);
    return {
      is_perishable: true,
      default_shelf_life_days: Number.isFinite(days) && days >= LIMITS.SHELF_LIFE_DAYS_MIN
        ? days
        : (defaultMeta.default_shelf_life_days || 180)
    };
  }

  if (hasRowFlag) {
    if (!ing.is_perishable) {
      return { is_perishable: false, default_shelf_life_days: null };
    }
    const days = Number(ing.default_shelf_life_days);
    return {
      is_perishable: true,
      default_shelf_life_days: Number.isFinite(days) && days >= LIMITS.SHELF_LIFE_DAYS_MIN
        ? days
        : (defaultMeta.default_shelf_life_days || 180)
    };
  }

  return defaultMeta;
};

export const setIngredientPerishability = async (ingredientId, { is_perishable = true, default_shelf_life_days = null } = {}) => {
  const perishableFlag = Boolean(is_perishable);
  let resolvedDays = null;

  if (perishableFlag) {
    const rawDays = default_shelf_life_days ?? 180;
    resolvedDays = Math.round(
      validateNumberBound(rawDays, {
        label: "Default shelf life (days)",
        min: LIMITS.SHELF_LIFE_DAYS_MIN,
        max: LIMITS.SHELF_LIFE_DAYS_MAX,
        allowZero: false
      })
    );
  }

  await withStoreLock(PERISHABILITY_META_KEY, async () => {
    const metaMap = await loadPerishabilityMetaMap();
    metaMap[ingredientId] = {
      is_perishable: perishableFlag,
      default_shelf_life_days: resolvedDays
    };
    await writeCmsJsonStore(PERISHABILITY_META_KEY, "Ingredient Perishability Metadata", metaMap);
  });

  if (hasNativePerishabilityCols !== false) {
    try {
      const { error } = await supabase
        .from("ingredients")
        .update({
          is_perishable: perishableFlag,
          default_shelf_life_days: resolvedDays
        })
        .eq("id", ingredientId);
      if (error) {
        if (isMissingColumnError(error)) {
          hasNativePerishabilityCols = false;
        }
      } else {
        hasNativePerishabilityCols = true;
      }
    } catch (err) {
      if (isMissingColumnError(err)) {
        hasNativePerishabilityCols = false;
      }
    }
  }

  return { is_perishable: perishableFlag, default_shelf_life_days: resolvedDays };
};

const annotateAndSortBatchesFEFO = (batches = [], todayManila = getManilaDateOnly()) => {
  const annotated = batches
    .filter((b) => Number(b?.quantity_remaining) > EPSILON)
    .map((b) => {
      const expiryDate = b.expiry_date ? String(b.expiry_date).slice(0, 10) : null;
      const daysUntilExpiry = expiryDate ? diffDaysManila(todayManila, expiryDate) : null;
      const isExpired = Boolean(expiryDate && expiryDate < todayManila);

      let expiryStatus = "NO_EXPIRY";
      if (expiryDate) {
        if (isExpired) {
          expiryStatus = "EXPIRED";
        } else if (daysUntilExpiry <= 7) {
          expiryStatus = "EXPIRING_SOON";
        } else {
          expiryStatus = "FRESH";
        }
      }

      return {
        ...b,
        quantity_remaining: round6(b.quantity_remaining),
        expiry_date: expiryDate,
        is_expired: isExpired,
        days_until_expiry: daysUntilExpiry,
        expiry_status: expiryStatus
      };
    });

  // FEFO order: (1) non-expired with expiry_date ASC, (2) non-expired without expiry_date by received_at ASC, (3) expired by expiry_date ASC
  return annotated.sort((a, b) => {
    const groupOf = (item) => {
      if (!item.is_expired && item.expiry_date) return 0;
      if (!item.is_expired && !item.expiry_date) return 1;
      return 2;
    };
    const ga = groupOf(a);
    const gb = groupOf(b);
    if (ga !== gb) return ga - gb;

    if (ga === 0 || ga === 2) {
      if (a.expiry_date !== b.expiry_date) {
        return a.expiry_date.localeCompare(b.expiry_date);
      }
    }
    return String(a.received_at || "").localeCompare(String(b.received_at || ""));
  });
};

const reconcileIngredientBatchesInArray = (ing, allBatches, perishability, todayManila) => {
  const nowIso = getManilaISOString();
  const ingBatches = allBatches.filter((b) => String(b.ingredient_id) === String(ing.id));
  const activeBatches = ingBatches.filter((b) => Number(b.quantity_remaining) > EPSILON);
  const rawStock = Math.max(0, Number(ing.stock_quantity) || 0);
  const touched = [];
  let mutated = false;

  if (rawStock > EPSILON && activeBatches.length === 0) {
    const seedBatch = {
      id: crypto.randomUUID(),
      ingredient_id: ing.id,
      batch_code: `BATCH-INIT-${String(ing.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      source: "INITIAL_SEED",
      initial_quantity: round6(rawStock),
      quantity_remaining: round6(rawStock),
      received_at: ing.created_at || nowIso,
      expiry_date:
        perishability.is_perishable && perishability.default_shelf_life_days
          ? addDaysManila(todayManila, perishability.default_shelf_life_days)
          : null,
      notes: "Auto-seeded from existing stock"
    };
    allBatches.push(seedBatch);
    touched.push(seedBatch);
    mutated = true;
  } else {
    const batchSum = round6(activeBatches.reduce((sum, b) => sum + Number(b.quantity_remaining || 0), 0));
    const diff = round6(rawStock) - batchSum;

    if (diff > EPSILON) {
      const nonExpiredNewestFirst = activeBatches
        .filter((b) => !(b.expiry_date && String(b.expiry_date).slice(0, 10) < todayManila))
        .sort((a, b) => String(b.received_at || "").localeCompare(String(a.received_at || "")));

      if (nonExpiredNewestFirst.length > 0) {
        const target = nonExpiredNewestFirst[0];
        target.quantity_remaining = round6(Number(target.quantity_remaining) + diff);
        target.initial_quantity = round6(Math.max(Number(target.initial_quantity || 0), target.quantity_remaining));
        touched.push(target);
      } else {
        const syncBatch = {
          id: crypto.randomUUID(),
          ingredient_id: ing.id,
          batch_code: `SYNC-${todayManila.replace(/-/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          source: "SYNC_ADJUSTMENT",
          initial_quantity: round6(diff),
          quantity_remaining: round6(diff),
          received_at: nowIso,
          expiry_date:
            perishability.is_perishable && perishability.default_shelf_life_days
              ? addDaysManila(todayManila, perishability.default_shelf_life_days)
              : null,
          notes: "Synchronized positive stock discrepancy"
        };
        allBatches.push(syncBatch);
        touched.push(syncBatch);
      }
      mutated = true;
    } else if (diff < -EPSILON) {
      let toTrim = Math.abs(diff);
      // FEFO trim: expired / earliest-expiry first, no-expiry last, then oldest received.
      const trimOrder = [...activeBatches].sort((a, b) => {
        const ea = a.expiry_date ? String(a.expiry_date).slice(0, 10) : "9999-12-31";
        const eb = b.expiry_date ? String(b.expiry_date).slice(0, 10) : "9999-12-31";
        if (ea !== eb) return ea.localeCompare(eb);
        return String(a.received_at || "").localeCompare(String(b.received_at || ""));
      });
      for (const b of trimOrder) {
        if (toTrim <= EPSILON) break;
        const avail = Number(b.quantity_remaining || 0);
        const take = Math.min(avail, toTrim);
        b.quantity_remaining = round6(avail - take);
        toTrim = round6(toTrim - take);
        touched.push(b);
      }
      mutated = true;
    }
  }

  return { mutated, touched };
};

const buildEnrichedIngredient = (ing, allBatches, perishability, todayManila) => {
  const ingBatches = allBatches.filter((b) => String(b.ingredient_id) === String(ing.id));
  const sortedBatches = annotateAndSortBatchesFEFO(ingBatches, todayManila);

  const usableStock = round6(
    sortedBatches.filter((b) => !b.is_expired).reduce((s, b) => s + b.quantity_remaining, 0)
  );
  const expiredStock = round6(
    sortedBatches.filter((b) => b.is_expired).reduce((s, b) => s + b.quantity_remaining, 0)
  );
  const expiringSoonStock = round6(
    sortedBatches.filter((b) => b.expiry_status === "EXPIRING_SOON").reduce((s, b) => s + b.quantity_remaining, 0)
  );

  const firstNonExpiredWithDate = sortedBatches.find((b) => !b.is_expired && b.expiry_date);
  const firstExpiredWithDate = sortedBatches.find((b) => b.is_expired && b.expiry_date);
  const nearestExpiryDate = firstNonExpiredWithDate?.expiry_date ?? firstExpiredWithDate?.expiry_date ?? null;

  return {
    ...ing,
    is_perishable: perishability.is_perishable,
    default_shelf_life_days: perishability.default_shelf_life_days,
    batches: sortedBatches,
    usable_stock: usableStock,
    expired_stock: expiredStock,
    expiring_soon_stock: expiringSoonStock,
    nearest_expiry_date: nearestExpiryDate
  };
};

export const enrichIngredientsWithBatches = async (ingredients = []) => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return [];
  const todayManila = getManilaDateOnly();

  const [initialBatches, metaMap] = await Promise.all([loadBatches(), loadPerishabilityMetaMap()]);

  // Read-only: reconcile on a clone for display only; write paths persist reconciliation under the lock.
  const finalBatches = structuredClone(initialBatches);
  for (const ing of ingredients) {
    reconcileIngredientBatchesInArray(ing, finalBatches, getIngredientPerishability(ing, metaMap), todayManila);
  }

  return ingredients.map((ing) => {
    const perishability = getIngredientPerishability(ing, metaMap);
    return buildEnrichedIngredient(ing, finalBatches, perishability, todayManila);
  });
};

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
  prior_stock = null,
  // When set, stock is raised by this amount inside the same lock (fresh read), after the batch is persisted.
  stock_increment = null,
  stock_max = LIMITS.STOCK_QTY_MAX
}) => {
  const qty = validateNumberBound(initial_quantity, {
    label: "Batch initial quantity",
    min: 0.0001,
    max: LIMITS.STOCK_QTY_MAX,
    allowZero: false
  });
  const validatedCode = validateOptionalBatchCode(batch_code);
  const validatedExpiry = validateOptionalExpiryDate(expiry_date);
  const todayManila = getManilaDateOnly();

  const [{ data: ing }, metaMap] = await Promise.all([
    supabase.from("ingredients").select("id, name, category, created_at, is_perishable, default_shelf_life_days").eq("id", ingredient_id).maybeSingle(),
    loadPerishabilityMetaMap()
  ]);

  const perishability = getIngredientPerishability(ing || { id: ingredient_id }, metaMap);
  let resolvedExpiry = validatedExpiry;
  if (!resolvedExpiry && perishability.is_perishable && perishability.default_shelf_life_days) {
    resolvedExpiry = addDaysManila(todayManila, perishability.default_shelf_life_days);
  }

  const finalCode = validatedCode || `LOT-${todayManila.replace(/-/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const newBatch = {
    id: crypto.randomUUID(),
    ingredient_id,
    batch_code: finalCode,
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

  await withStoreLock(BATCHES_STORE_KEY, async () => {
    const batches = await loadBatches();
    const touched = [];
    let freshStock = null;
    if (stock_increment !== null) {
      const { data: cur, error: curErr } = await supabase.from("ingredients").select("stock_quantity").eq("id", ingredient_id).single();
      if (curErr) throw curErr;
      freshStock = Number(cur?.stock_quantity || 0);
      if (freshStock + Number(stock_increment) > stock_max) {
        const err = new Error(`Resulting stock quantity cannot exceed ${Number(stock_max).toLocaleString()}.`);
        err.status = 400;
        throw err;
      }
      prior_stock = freshStock;
    }
    if (prior_stock !== null && prior_stock !== undefined && Number(prior_stock) > EPSILON) {
      const seedRes = reconcileIngredientBatchesInArray(
        { ...(ing || { id: ingredient_id }), stock_quantity: Number(prior_stock) },
        batches,
        perishability,
        todayManila
      );
      if (seedRes.mutated) {
        touched.push(...seedRes.touched);
      }
    }
    batches.push(newBatch);
    touched.push(newBatch);
    await saveBatches(batches);
    if (freshStock !== null) {
      const { error: stockErr } = await supabase
        .from("ingredients")
        .update({ stock_quantity: round6(freshStock + Number(stock_increment)) })
        .eq("id", ingredient_id);
      if (stockErr) {
        await saveBatches(batches.filter((b) => b.id !== newBatch.id));
        throw stockErr;
      }
    }
    await syncNativeBatchUpsert(touched);
  });

  const [annotated] = annotateAndSortBatchesFEFO([newBatch], todayManila);
  return annotated || newBatch;
};

/**
 * Pure FEFO/batch deduction planner (also useful for unit testing without DB).
 */
const planBatchDeduction = (
  ingredientBatches,
  quantityNeeded,
  { allowExpired = false, preferExpired = false, targetBatchId = null, todayManila = getManilaDateOnly() } = {}
) => {
  const annotated = annotateAndSortBatchesFEFO(ingredientBatches, todayManila);
  let pool = allowExpired ? [...annotated] : annotated.filter((b) => !b.is_expired);

  if (preferExpired) {
    pool.sort((a, b) => {
      if (a.is_expired !== b.is_expired) return a.is_expired ? -1 : 1;
      return 0;
    });
  }

  if (targetBatchId) {
    const idx = annotated.findIndex((b) => String(b.id) === String(targetBatchId));
    if (idx === -1) {
      const err = new Error("Selected batch was not found or has no remaining stock.");
      err.status = 404;
      throw err;
    }
    const target = annotated[idx];
    if (!allowExpired && target.is_expired) {
      const err = new Error(`Batch "${target.batch_code}" is expired and cannot be deducted.`);
      err.status = 409;
      throw err;
    }
    pool = [target, ...pool.filter((b) => String(b.id) !== String(targetBatchId))];
  }

  const eligibleStock = round6(pool.reduce((sum, b) => sum + b.quantity_remaining, 0));
  if (eligibleStock + STOCK_EPSILON < quantityNeeded) {
    const err = new Error(
      `Insufficient usable stock. Available: ${eligibleStock}, Required: ${round6(quantityNeeded)}.`
    );
    err.status = 409;
    throw err;
  }

  let remaining = quantityNeeded;
  const deductedBatches = [];
  const updates = new Map();

  for (const batch of pool) {
    if (remaining <= STOCK_EPSILON) break;
    const take = Math.min(batch.quantity_remaining, remaining);
    const nextQty = round6(batch.quantity_remaining - take);
    updates.set(String(batch.id), nextQty);
    deductedBatches.push({
      batch_id: batch.id,
      batch_code: batch.batch_code,
      expiry_date: batch.expiry_date || null,
      quantity_deducted: round6(take)
    });
    remaining = round6(remaining - take);
  }

  const updatedAll = annotated.map((b) =>
    updates.has(String(b.id)) ? { ...b, quantity_remaining: updates.get(String(b.id)) } : b
  );
  const newTotalStock = round6(updatedAll.reduce((sum, b) => sum + b.quantity_remaining, 0));
  const remainingUsableStock = round6(
    updatedAll.filter((b) => !b.is_expired).reduce((sum, b) => sum + b.quantity_remaining, 0)
  );

  return {
    deductedBatches,
    updates,
    newTotalStock,
    remainingUsableStock
  };
};

export const deductStockFEFO = async (ingredientId, quantityNeeded, options = {}) => {
  const qty = Number(quantityNeeded);
  if (!Number.isFinite(qty) || qty <= 0) {
    const err = new Error("Deduction quantity must be greater than 0.");
    err.status = 400;
    throw err;
  }

  const todayManila = getManilaDateOnly();

  return await withStoreLock(BATCHES_STORE_KEY, async () => {
    const [{ data: ing, error: ingErr }, metaMap, allBatches] = await Promise.all([
      supabase.from("ingredients").select("*").eq("id", ingredientId).single(),
      loadPerishabilityMetaMap(),
      loadBatches()
    ]);

    if (ingErr || !ing) {
      const err = new Error("Raw material not found.");
      err.status = 404;
      throw err;
    }

    const perishability = getIngredientPerishability(ing, metaMap);
    reconcileIngredientBatchesInArray(ing, allBatches, perishability, todayManila);

    const ingBatches = allBatches.filter((b) => String(b.ingredient_id) === String(ingredientId));

    let plan;
    try {
      plan = planBatchDeduction(ingBatches, qty, { ...options, todayManila });
    } catch (err) {
      if (err.status === 409 && !options.targetBatchId) {
        const annotated = annotateAndSortBatchesFEFO(ingBatches, todayManila);
        const usable = round6(annotated.filter((b) => !b.is_expired).reduce((s, b) => s + b.quantity_remaining, 0));
        const expired = round6(annotated.filter((b) => b.is_expired).reduce((s, b) => s + b.quantity_remaining, 0));
        const expiredHint = expired > 0 ? ` (${expired} ${ing.unit} expired excluded)` : "";
        const detailedErr = new Error(
          `Insufficient usable stock for "${ing.name}". Usable: ${usable} ${ing.unit}${expiredHint}, Required: ${round6(qty)} ${ing.unit}.`
        );
        detailedErr.status = 409;
        throw detailedErr;
      }
      throw err;
    }

    const touched = [];
    for (const batch of allBatches) {
      if (plan.updates.has(String(batch.id))) {
        batch.quantity_remaining = plan.updates.get(String(batch.id));
        touched.push(batch);
      }
    }

    const { error: stockUpdateErr } = await supabase
      .from("ingredients")
      .update({ stock_quantity: plan.newTotalStock })
      .eq("id", ingredientId);
    if (stockUpdateErr) throw stockUpdateErr;

    await saveBatches(allBatches);
    await syncNativeBatchUpsert(touched);

    return {
      deductedBatches: plan.deductedBatches,
      newTotalStock: plan.newTotalStock,
      remainingUsableStock: plan.remainingUsableStock
    };
  });
};

/**
 * Restores previously deducted batch quantities (e.g. during sale or wastage rollback).
 */
export const restoreDeductedBatches = async (ingredientId, deductedBatches = []) => {
  if (!ingredientId || !Array.isArray(deductedBatches) || deductedBatches.length === 0) return null;

  return await withStoreLock(BATCHES_STORE_KEY, async () => {
    const allBatches = await loadBatches();
    const batchMap = new Map(allBatches.map((b) => [String(b.id), b]));
    const touched = [];

    for (const item of deductedBatches) {
      const target = batchMap.get(String(item.batch_id));
      const qty = Number(item.quantity_deducted) || 0;
      if (target && qty > 0) {
        target.quantity_remaining = round6(Number(target.quantity_remaining || 0) + qty);
        touched.push(target);
      }
    }

    const newTotalStock = round6(
      allBatches
        .filter((b) => String(b.ingredient_id) === String(ingredientId) && Number(b.quantity_remaining) > EPSILON)
        .reduce((sum, b) => sum + Number(b.quantity_remaining || 0), 0)
    );

    await saveBatches(allBatches);
    await syncNativeBatchUpsert(touched);

    const { error } = await supabase
      .from("ingredients")
      .update({ stock_quantity: newTotalStock })
      .eq("id", ingredientId);
    if (error) throw error;

    return { newTotalStock };
  });
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
      batches.push({
        ...b,
        ingredient_name: ing.name,
        unit: ing.unit,
        category: ing.category || null
      });
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

  for (const ing of enriched) {
    for (const b of ing.batches || []) {
      if (b.quantity_remaining <= EPSILON) continue;
      const entry = {
        ...b,
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        unit: ing.unit,
        category: ing.category || null
      };
      if (b.expiry_status === "EXPIRED") {
        expiredBatches.push(entry);
      } else if (b.expiry_status === "EXPIRING_SOON") {
        expiringSoonBatches.push(entry);
      }
    }
  }

  expiredBatches.sort((a, b) => String(a.expiry_date || "").localeCompare(String(b.expiry_date || "")));
  expiringSoonBatches.sort((a, b) => String(a.expiry_date || "").localeCompare(String(b.expiry_date || "")));

  return {
    expiredBatches,
    expiringSoonBatches,
    expiredCount: expiredBatches.length,
    expiringSoonCount: expiringSoonBatches.length
  };
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
      if (isMissingTableError(sessErr)) {
        hasNativeStocktakeTables = false;
      }
      return;
    }
    hasNativeStocktakeTables = true;

    if (adjustedItems.length > 0) {
      const itemRows = adjustedItems.map((it) => ({
        session_id: session.id,
        ingredient_id: it.ingredient_id,
        system_quantity: it.system_quantity,
        physical_count: it.physical_count,
        variance: it.variance,
        reason: it.reason || null
      }));
      await supabase.from("stocktake_items").insert(itemRows);
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      hasNativeStocktakeTables = false;
    }
  }
};

export const performStocktake = async ({ counts, notes = "", user }) => {
  if (!Array.isArray(counts) || counts.length === 0) {
    const err = new Error("At least one stocktake count is required.");
    err.status = 400;
    throw err;
  }

  const cleanNotes = validateTextLength(notes, {
    label: "Stocktake notes",
    min: 0,
    max: LIMITS.DESC_MAX_LEN,
    required: false
  });

  const rawValidated = counts.map((entry) => {
    if (!entry || !entry.ingredient_id) {
      const err = new Error("Each stocktake entry must include an ingredient_id.");
      err.status = 400;
      throw err;
    }
    const physical_count = round6(
      validateNumberBound(entry.physical_count, {
        label: "Physical count",
        min: LIMITS.STOCKTAKE_COUNT_MIN,
        max: LIMITS.STOCKTAKE_COUNT_MAX
      })
    );
    const reason = validateTextLength(entry.reason ?? entry.note ?? "", {
      label: "Adjustment reason",
      min: 0,
      max: LIMITS.DESC_MAX_LEN,
      required: false
    });
    return {
      ingredient_id: entry.ingredient_id,
      physical_count,
      reason: reason || "Physical Count Correction"
    };
  });

  // Duplicate ingredient_id entries: last one wins.
  const validatedCounts = [...new Map(rawValidated.map((c) => [String(c.ingredient_id), c])).values()];
  const targetIds = validatedCounts.map((c) => c.ingredient_id);
  const { data: ingRows, error: ingErr } = await supabase
    .from("ingredients")
    .select("*")
    .in("id", targetIds);
  if (ingErr) throw ingErr;

  const ingMap = new Map((ingRows || []).map((i) => [String(i.id), i]));
  const todayManila = getManilaDateOnly();
  const adjustedItems = [];

  for (const item of validatedCounts) {
    const ing = ingMap.get(String(item.ingredient_id));
    if (!ing) {
      const err = new Error(`Raw material not found: ${item.ingredient_id}`);
      err.status = 404;
      throw err;
    }

    const systemQty = round6(Number(ing.stock_quantity || 0));
    const signedVariance = Math.round((item.physical_count - systemQty) * 1e6) / 1e6;

    if (Math.abs(signedVariance) <= EPSILON) continue;

    if (signedVariance < 0) {
      await deductStockFEFO(ing.id, Math.abs(signedVariance), {
        allowExpired: true,
        preferExpired: true
      });
    } else {
      await withStoreLock(BATCHES_STORE_KEY, async () => {
        const [allBatches, metaMap] = await Promise.all([loadBatches(), loadPerishabilityMetaMap()]);
        const perishability = getIngredientPerishability(ing, metaMap);
        reconcileIngredientBatchesInArray(ing, allBatches, perishability, todayManila);

        const activeNonExpired = allBatches
          .filter(
            (b) =>
              String(b.ingredient_id) === String(ing.id) &&
              Number(b.quantity_remaining) > EPSILON &&
              !(b.expiry_date && String(b.expiry_date).slice(0, 10) < todayManila)
          )
          .sort((a, b) => String(b.received_at || "").localeCompare(String(a.received_at || "")));

        const touched = [];
        if (activeNonExpired.length > 0) {
          const target = activeNonExpired[0];
          target.quantity_remaining = round6(Number(target.quantity_remaining) + signedVariance);
          target.initial_quantity = round6(Math.max(Number(target.initial_quantity || 0), target.quantity_remaining));
          touched.push(target);
        } else {
          const adjBatch = {
            id: crypto.randomUUID(),
            ingredient_id: ing.id,
            batch_code: `STK-${todayManila.replace(/-/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
            source: "STOCKTAKE_ADJUSTMENT",
            initial_quantity: round6(signedVariance),
            quantity_remaining: round6(signedVariance),
            received_at: getManilaISOString(),
            expiry_date:
              perishability.is_perishable && perishability.default_shelf_life_days
                ? addDaysManila(todayManila, perishability.default_shelf_life_days)
                : null,
            notes: item.reason
          };
          allBatches.push(adjBatch);
          touched.push(adjBatch);
        }

        const { error: upErr } = await supabase
          .from("ingredients")
          .update({ stock_quantity: item.physical_count })
          .eq("id", ing.id);
        if (upErr) throw upErr;

        await saveBatches(allBatches);
        await syncNativeBatchUpsert(touched);
      });
    }

    adjustedItems.push({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      unit: ing.unit,
      system_quantity: systemQty,
      physical_count: item.physical_count,
      variance: signedVariance,
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
    const store = await readCmsJsonStore(STOCKTAKE_HISTORY_KEY, { sessions: [] });
    const sessions = Array.isArray(store.sessions) ? store.sessions : [];
    const updated = [session, ...sessions].slice(0, MAX_STOCKTAKE_HISTORY);
    await writeCmsJsonStore(STOCKTAKE_HISTORY_KEY, "Stocktake History Store", { sessions: updated });
  });

  await syncNativeStocktake(session, adjustedItems);

  await logAudit("STOCKTAKE_RECONCILED", user?.id || null, {
    session_id: session.id,
    total_checked: session.total_checked,
    items_adjusted: session.items_adjusted,
    notes: session.notes,
    adjustments: adjustedItems
  });

  return session;
};
