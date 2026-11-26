import { supabase } from "../config/supabaseClient.js";
import { getArchiveTimestampsMap, getDaysSinceArchived, invalidateArchiveMap } from "../utils/archiveHelper.js";
import { checkCompositeDuplicate } from "../utils/stringHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import { invalidateCmsCache } from "./cmsService.js";
import * as batchService from "./batchService.js";
import { getIngredientReorderPlan, getProductReorderPlan } from "./forecastService.js";
import { resolveUnitCost } from "../utils/costUtils.js";

export const getIngredients = async ({ includeArchived = false } = {}) => {
  let query = supabase
    .from("ingredients")
    .select("*");

  if (!includeArchived) {
    query = query.neq("is_archived", true);
  }

  const { data, error } = await query.order("name");

  if (error) throw error;

  let rows = data || [];
  if (includeArchived) {
    const archiveMap = await getArchiveTimestampsMap();
    rows = rows.map(item => {
      if (!item.is_archived) return item;
      const archivedAt = archiveMap.ingredients[item.id] || item.created_at || null;
      return {
        ...item,
        archived_at: archivedAt,
        days_since_archived: getDaysSinceArchived(archivedAt)
      };
    });
  }

  return await batchService.enrichIngredientsWithBatches(rows);
};

export const getIngredientById = async (id) => {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  const [enriched] = await batchService.enrichIngredientsWithBatches([data]);
  return enriched;
};

const validateIngredientInput = (payload, { isUpdate = false } = {}) => {
  const name = validateTextLength(payload.name, {
    label: 'Raw material name',
    min: 1,
    max: LIMITS.NAME_MAX_LEN,
    required: true
  });

  let category;
  if (payload.category !== undefined && payload.category !== null && String(payload.category).trim() !== '') {
    category = validateTextLength(payload.category, {
      label: 'Category',
      min: 0,
      max: LIMITS.CATEGORY_MAX_LEN,
      required: false
    });
  } else if (payload.category === undefined && isUpdate) {
    category = undefined;
  } else {
    category = null;
  }

  const hasLowStock = payload.low_stock_alert !== undefined && payload.low_stock_alert !== null && payload.low_stock_alert !== '';
  const low_stock_alert = hasLowStock
    ? validateNumberBound(payload.low_stock_alert, {
        label: 'Low stock alert',
        min: LIMITS.THRESHOLD_MIN,
        max: LIMITS.THRESHOLD_MAX
      })
    : (isUpdate ? undefined : 10);

  let stock_quantity = 0;
  if (!isUpdate && payload.stock_quantity !== undefined && payload.stock_quantity !== null && payload.stock_quantity !== '') {
    stock_quantity = validateNumberBound(payload.stock_quantity, {
      label: 'Stock quantity',
      min: LIMITS.STOCK_QTY_MIN,
      max: LIMITS.STOCK_QTY_MAX
    });
  }

  const hasConv = payload.conversion_factor !== undefined && payload.conversion_factor !== null && payload.conversion_factor !== '';
  const conversion_factor = hasConv
    ? validateNumberBound(payload.conversion_factor, {
        label: 'Conversion factor',
        min: LIMITS.CONVERSION_FACTOR_MIN,
        max: LIMITS.CONVERSION_FACTOR_MAX,
        allowZero: false
      })
    : (isUpdate ? undefined : 1);

  const hasPurchaseCost = payload.cost_per_purchase_unit !== undefined && payload.cost_per_purchase_unit !== null && payload.cost_per_purchase_unit !== '';
  const cost_per_purchase_unit = hasPurchaseCost
    ? validateNumberBound(payload.cost_per_purchase_unit, {
        label: 'Purchase cost',
        min: LIMITS.PURCHASE_COST_MIN,
        max: LIMITS.PURCHASE_COST_MAX
      })
    : (isUpdate ? undefined : 0);

  const hasUnitCost = payload.unit_cost !== undefined && payload.unit_cost !== null && payload.unit_cost !== '';
  const unit_cost = hasUnitCost
    ? validateNumberBound(payload.unit_cost, {
        label: 'Unit cost',
        min: LIMITS.PURCHASE_COST_MIN,
        max: LIMITS.PURCHASE_COST_MAX
      })
    : undefined;

  return {
    name,
    category,
    low_stock_alert,
    stock_quantity,
    conversion_factor,
    cost_per_purchase_unit,
    unit_cost
  };
};

const assertNoIngredientDuplicate = async ({ name, category, excludeId = null, force = false }) => {
  const { data: existingIngredients, error } = await supabase
    .from("ingredients")
    .select("id, name, category, is_archived");
  if (error) throw error;

  let effectiveCategory = category;
  if (effectiveCategory === undefined && excludeId !== null && excludeId !== undefined) {
    const current = (existingIngredients || []).find((i) => String(i.id) === String(excludeId));
    effectiveCategory = current?.category ?? null;
  }

  const dup = checkCompositeDuplicate(name, effectiveCategory, existingIngredients || [], excludeId);
  if (!dup) return;

  if (dup.isHardDuplicate) {
    const archivedNote = dup.isArchived ? ' (archived)' : '';
    const err = new Error(
      `Raw material "${dup.matchName}"${archivedNote} already exists under category "${dup.matchCategory}". Duplicate items in the same category are not allowed.`
    );
    err.status = 409;
    err.is_hard_duplicate = true;
    throw err;
  }

  if (dup.isDuplicateWarning && !force) {
    const msg = dup.reason === 'SAME_NAME_DIFF_CATEGORY'
      ? `An ingredient named "${dup.matchName}" already exists under category "${dup.matchCategory}".`
      : `An ingredient with a similar name ("${dup.matchName}" in "${dup.matchCategory}") already exists.`;
    const err = new Error(msg);
    err.status = 409;
    err.is_duplicate_warning = true;
    throw err;
  }
};

// unit_cost column is written as 0 when no real cost is known (never an invented default).
const computeUnitCost = (ing) => resolveUnitCost(ing) ?? 0;

export const createIngredient = async ({
  name,
  unit,
  category,
  stock_quantity,
  low_stock_alert,
  image_url,
  purchase_unit,
  conversion_factor,
  cost_per_purchase_unit,
  unit_cost,
  is_perishable,
  default_shelf_life_days,
  force_create
}) => {
  const validated = validateIngredientInput({
    name,
    category,
    stock_quantity,
    low_stock_alert,
    conversion_factor,
    cost_per_purchase_unit,
    unit_cost
  });

  if (is_perishable !== undefined && Boolean(is_perishable)) {
    validateNumberBound(default_shelf_life_days ?? 180, {
      label: 'Default shelf life (days)',
      min: LIMITS.SHELF_LIFE_DAYS_MIN,
      max: LIMITS.SHELF_LIFE_DAYS_MAX,
      allowZero: false
    });
  } else if (is_perishable === undefined && default_shelf_life_days !== undefined && default_shelf_life_days !== null && default_shelf_life_days !== '') {
    validateNumberBound(default_shelf_life_days, {
      label: 'Default shelf life (days)',
      min: LIMITS.SHELF_LIFE_DAYS_MIN,
      max: LIMITS.SHELF_LIFE_DAYS_MAX,
      allowZero: false
    });
  }

  await assertNoIngredientDuplicate({
    name: validated.name,
    category: validated.category,
    force: Boolean(force_create)
  });

  const computedUnitCost = computeUnitCost({
    unit,
    unit_cost: validated.unit_cost,
    cost_per_purchase_unit: validated.cost_per_purchase_unit,
    conversion_factor: validated.conversion_factor
  });

  const insertPayload = {
    name: validated.name,
    unit,
    category: validated.category,
    image_url,
    // Stock starts at 0; the opening amount is added below as a batch (the trigger keeps the total).
    stock_quantity: 0,
    low_stock_alert: validated.low_stock_alert,
    purchase_unit: purchase_unit || 'Unit',
    conversion_factor: validated.conversion_factor,
    cost_per_purchase_unit: validated.cost_per_purchase_unit,
    unit_cost: computedUnitCost,
    is_archived: false
  };

  const { data, error } = await supabase
    .from("ingredients")
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const err = new Error('An ingredient with this name and category already exists.');
      err.status = 409;
      err.is_hard_duplicate = true;
      throw err;
    }
    throw error;
  }

  if (is_perishable !== undefined || (default_shelf_life_days !== undefined && default_shelf_life_days !== null && default_shelf_life_days !== '')) {
    await batchService.setIngredientPerishability(data.id, {
      is_perishable: is_perishable === undefined ? true : (is_perishable === null ? null : Boolean(is_perishable)), // null = use category default
      default_shelf_life_days
    });
  }

  if (Number(validated.stock_quantity) > 0) {
    await batchService.createBatch({
      ingredient_id: data.id,
      source: 'INITIAL_STOCK',
      initial_quantity: validated.stock_quantity,
      notes: 'Opening stock when the raw material was created'
    });
  }

  const fresh = await getIngredientById(data.id);
  return fresh || data;
};

// stock_quantity is excluded: stock changes only via receiveStock() (add) or the POS/wastage flow
// (subtract).
export const updateIngredient = async (id, { name, unit, category, low_stock_alert, image_url, purchase_unit, conversion_factor, cost_per_purchase_unit, unit_cost, is_perishable, default_shelf_life_days, force_update }) => {
  const validated = validateIngredientInput(
    { name, category, low_stock_alert, conversion_factor, cost_per_purchase_unit, unit_cost },
    { isUpdate: true }
  );

  if (is_perishable !== undefined && Boolean(is_perishable)) {
    validateNumberBound(default_shelf_life_days ?? 180, {
      label: 'Default shelf life (days)',
      min: LIMITS.SHELF_LIFE_DAYS_MIN,
      max: LIMITS.SHELF_LIFE_DAYS_MAX,
      allowZero: false
    });
  } else if (is_perishable === undefined && default_shelf_life_days !== undefined && default_shelf_life_days !== null && default_shelf_life_days !== '') {
    validateNumberBound(default_shelf_life_days, {
      label: 'Default shelf life (days)',
      min: LIMITS.SHELF_LIFE_DAYS_MIN,
      max: LIMITS.SHELF_LIFE_DAYS_MAX,
      allowZero: false
    });
  }

  await assertNoIngredientDuplicate({
    name: validated.name,
    category: validated.category,
    excludeId: id,
    force: Boolean(force_update)
  });

  const updatePayload = { name: validated.name, unit, image_url };
  if (validated.low_stock_alert !== undefined) updatePayload.low_stock_alert = validated.low_stock_alert;
  if (validated.category !== undefined) updatePayload.category = validated.category;

  // Purchase-order defaults, when provided, also keep unit_cost in sync.
  if (purchase_unit !== undefined) updatePayload.purchase_unit = purchase_unit;
  if (validated.conversion_factor !== undefined) updatePayload.conversion_factor = validated.conversion_factor;
  if (validated.cost_per_purchase_unit !== undefined) updatePayload.cost_per_purchase_unit = validated.cost_per_purchase_unit;
  if (validated.cost_per_purchase_unit !== undefined || validated.conversion_factor !== undefined || validated.unit_cost !== undefined) {
    // Merge stored values so a partial update (e.g. only conversion_factor) can't wipe a real cost.
    const { data: stored } = await supabase
      .from("ingredients")
      .select("unit_cost, cost_per_purchase_unit, conversion_factor")
      .eq("id", id)
      .single();
    const v = validated;
    const explicitOnly = v.unit_cost !== undefined && v.cost_per_purchase_unit === undefined && v.conversion_factor === undefined;
    updatePayload.unit_cost = computeUnitCost({
      unit_cost: v.unit_cost ?? stored?.unit_cost,
      cost_per_purchase_unit: explicitOnly ? null : (v.cost_per_purchase_unit ?? stored?.cost_per_purchase_unit),
      conversion_factor: v.conversion_factor ?? stored?.conversion_factor
    });
  }

  const { data, error } = await supabase
    .from("ingredients")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const err = new Error('An ingredient with this name and category already exists.');
      err.status = 409;
      err.is_hard_duplicate = true;
      throw err;
    }
    throw error;
  }

  if (is_perishable !== undefined || (default_shelf_life_days !== undefined && default_shelf_life_days !== null && default_shelf_life_days !== '')) {
    await batchService.setIngredientPerishability(id, {
      is_perishable: is_perishable === undefined ? true : (is_perishable === null ? null : Boolean(is_perishable)), // null = use category default
      default_shelf_life_days
    });
  }

  const [enriched] = await batchService.enrichIngredientsWithBatches([data]);
  return enriched || data;
};

// Low stock = usable (non-expired) stock at or below the reorder point, where
// reorder point = forecast daily usage x (supplier lead time + safety days).
// Items with no recipe usage fall back to their manual low_stock_alert threshold.
export const getLowStockAlerts = async () => {
  let plan;
  try {
    plan = await getIngredientReorderPlan();
  } catch (err) {
    // If the forecast data is unavailable, alerts must still work: use the owner's manual thresholds.
    console.warn("[low-stock] reorder plan unavailable, using manual thresholds:", err.message);
    const { data, error } = await supabase.from("ingredients").select("*").neq("is_archived", true);
    if (error) throw error;
    plan = (await batchService.enrichIngredientsWithBatches(data || [])).map((i) => {
      const floor = Number(i.low_stock_alert) || 0;
      const usable = Number(i.usable_stock) || 0;
      return { ...i, daily_usage: 0, reorder_point: 0, alert: usable <= 0 ? "OUT_OF_STOCK" : floor > 0 && usable <= floor ? "BELOW_MANUAL_THRESHOLD" : null };
    });
  }
  const ingredientAlerts = plan
    .filter((i) => i.alert)
    .map((i) => ({
      ...i,
      // fields the existing alert UI reads
      low_stock_threshold: Math.max(Number(i.reorder_point) || 0, Number(i.low_stock_alert) || 0),
      max_stock: Number(i.max_stock) || null
    }));

  return [...ingredientAlerts, ...(await getLowStockProductAlerts())];
};

// Stock-tracked products alert from the forecast-based plan (or their own threshold).
const getLowStockProductAlerts = async () => {
  let plan;
  try {
    plan = await getProductReorderPlan();
  } catch (err) {
    console.warn("[low-stock] product stock unavailable:", err.message);
    return [];
  }
  return plan
    .filter((p) => p.alert)
    .map((p) => ({
      id: `product-${p.product_id}`, // distinct from ingredient ids in the shared table
      kind: "product",
      name: p.name,
      unit: "pcs",
      usable_stock: p.stock,
      expired_stock: 0,
      low_stock_threshold: Math.max(p.reorder_point, p.low_stock_threshold),
      nearest_expiry_date: null,
      days_of_cover: p.days_of_cover,
      suggested_order_qty: p.suggested_make_qty,
      alert: p.alert
    }));
};

export { getIngredientReorderPlan, getProductReorderPlan };

// Quantity must be within bounds before stock is added and a batch is recorded.
export const receiveStock = async (id, quantity, options = {}) => {
  const parsedQty = validateNumberBound(quantity, {
    label: 'Quantity received',
    min: LIMITS.RECEIVE_QTY_MIN,
    max: LIMITS.RECEIVE_QTY_MAX,
    allowZero: false
  });
  const validatedExpiry = batchService.validateOptionalExpiryDate(options.expiry_date);
  const validatedBatchCode = batchService.validateOptionalBatchCode(options.batch_code);

  const createdBatch = await batchService.createBatch({
    ingredient_id: id,
    source: 'DIRECT_RECEIVE',
    initial_quantity: parsedQty,
    expiry_date: validatedExpiry,
    batch_code: validatedBatchCode,
    notes: options.notes || null,
    stock_max: LIMITS.STOCK_QTY_MAX
  });

  const updated = await getIngredientById(id);
  return {
    ...updated,
    created_batch: createdBatch
  };
};

export const deleteIngredient = async (id) => {
  const { data: ingredient, error: fetchErr } = await supabase
    .from("ingredients")
    .select("id, name, is_archived, created_at")
    .eq("id", id)
    .single();

  if (fetchErr || !ingredient) {
    throw new Error("Raw material not found.");
  }

  if (!ingredient.is_archived) {
    throw new Error("Only archived raw materials can be permanently deleted.");
  }

  // Must have been archived for 30+ days.
  const archiveMap = await getArchiveTimestampsMap(true);
  const archivedAt = archiveMap.ingredients[id];
  if (!archivedAt) {
    const err = new Error("Archive date unknown; cannot verify the 30-day hold");
    err.status = 409;
    throw err;
  }
  const daysElapsed = getDaysSinceArchived(archivedAt);

  if (daysElapsed < 30) {
    const remaining = Math.max(1, 30 - daysElapsed);
    throw new Error(`Cannot permanently delete raw material yet. Must be archived for at least 30 days (${remaining} day(s) remaining).`);
  }

  // Referenced by purchase orders or wastage records: it must stay archived for audit integrity.
  const { count: poCount } = await supabase
    .from("purchase_order_items")
    .select("id", { count: "exact", head: true })
    .eq("ingredient_id", id);

  if (poCount && poCount > 0) {
    throw new Error(`Cannot delete raw material "${ingredient.name}" because it is referenced in ${poCount} purchase order item(s). For auditing integrity, it must remain archived.`);
  }

  const { count: wastageCount } = await supabase
    .from("wastage")
    .select("id", { count: "exact", head: true })
    .eq("ingredient_id", id);

  if (wastageCount && wastageCount > 0) {
    throw new Error(`Cannot delete raw material "${ingredient.name}" because it is referenced in ${wastageCount} wastage record(s). For auditing integrity, it must remain archived.`);
  }

  // supplier_ingredients cascades; recipes.ingredient_id is ON DELETE RESTRICT (supabase_schema.sql),
  // so snapshot recipes, delete them, delete the ingredient, and restore the snapshot if that fails.
  const { data: recipeRows, error: snapErr } = await supabase.from("recipes").select("*").eq("ingredient_id", id);
  if (snapErr) throw snapErr;
  if (recipeRows?.length) {
    const { error: recDelErr } = await supabase.from("recipes").delete().eq("ingredient_id", id);
    if (recDelErr) throw recDelErr;
  }

  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id);

  if (error) {
    if (recipeRows?.length) {
      const { error: restoreErr } = await supabase.from("recipes").insert(recipeRows);
      if (restoreErr) console.error("[deleteIngredient] Failed to restore recipes:", restoreErr.message);
    }
    throw error;
  }
  invalidateArchiveMap();
  return { success: true, name: ingredient.name };
};

export const archiveIngredient = async (id) => {
  const { data, error } = await supabase
    .from("ingredients")
    .update({ is_archived: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  invalidateArchiveMap();
  return data;
};

export const restoreIngredient = async (id) => {
  const { data, error } = await supabase
    .from("ingredients")
    .update({ is_archived: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  invalidateArchiveMap();
  return data;
};


const RAW_MATERIAL_CATEGORIES_KEY = "raw_material_categories";
const MAX_CATEGORY_LENGTH = 40;
const RESERVED_CATEGORIES = new Set(["ALL", "OTHERS", "UNCATEGORIZED"]);

const DEFAULT_RAW_MATERIAL_CATEGORIES = [
  "COFFEE & TEA BASES",
  "DAIRY & CREAMERS",
  "SWEETENERS & SYRUPS",
  "FLAVORING POWDERS",
  "SINKERS & TOPPINGS",
  "BEVERAGE ENHANCERS",
  "PACKAGING & SUPPLIES",
  "ADD-ONS"
];

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const normalizeCategoryName = (raw) =>
  String(raw || "").trim().replace(/\s+/g, " ").toUpperCase();

const hasInvalidCategoryChars = (str) => {
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return /[\\/%]/.test(str);
};

const validateCategoryName = (raw) => {
  const value = normalizeCategoryName(raw);
  if (!value) {
    return { ok: false, value, error: "Category name is required." };
  }
  if (value.length > MAX_CATEGORY_LENGTH) {
    return { ok: false, value, error: `Category name must be ${MAX_CATEGORY_LENGTH} characters or less.` };
  }
  if (hasInvalidCategoryChars(value)) {
    return { ok: false, value, error: "Category name cannot contain /, \\, %, or control characters." };
  }
  if (RESERVED_CATEGORIES.has(value)) {
    return { ok: false, value, error: `"${value}" is a reserved category name.` };
  }
  return { ok: true, value };
};

const parsePersistedCategories = (description) => {
  if (!description || typeof description !== "string") {
    return { initialized: false, categories: [] };
  }
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) {
      return {
        initialized: true,
        categories: parsed.map(normalizeCategoryName).filter(Boolean)
      };
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.categories)) {
      return {
        initialized: Boolean(parsed.initialized),
        categories: parsed.categories.map(normalizeCategoryName).filter(Boolean)
      };
    }
  } catch {
    // Fallback to uninitialized if description is not valid JSON
  }
  return { initialized: false, categories: [] };
};

const loadCategoryState = async () => {
  const [cmsRes, ingredientsRes] = await Promise.all([
    supabase
      .from("cms_content")
      .select("description")
      .eq("section_key", RAW_MATERIAL_CATEGORIES_KEY)
      .maybeSingle(),
    supabase
      .from("ingredients")
      .select("id, category")
  ]);

  if (cmsRes.error) throw cmsRes.error;
  if (ingredientsRes.error) throw ingredientsRes.error;

  const { initialized, categories: persisted } = parsePersistedCategories(cmsRes.data?.description);
  const baseList = initialized ? persisted : DEFAULT_RAW_MATERIAL_CATEGORIES;

  const categoryMap = new Map();
  for (const cat of baseList) {
    const normalized = normalizeCategoryName(cat);
    if (normalized && !RESERVED_CATEGORIES.has(normalized)) {
      categoryMap.set(normalized, 0);
    }
  }

  const ingredientRows = ingredientsRes.data || [];
  for (const row of ingredientRows) {
    const normalized = normalizeCategoryName(row.category);
    if (!normalized || RESERVED_CATEGORIES.has(normalized)) continue;
    categoryMap.set(normalized, (categoryMap.get(normalized) || 0) + 1);
  }

  return { categoryMap, ingredientRows };
};

const savePersistedCategories = async (categories) => {
  const uniqueSorted = Array.from(
    new Set(categories.map(normalizeCategoryName).filter((c) => c && !RESERVED_CATEGORIES.has(c)))
  ).sort((a, b) => a.localeCompare(b));

  const payload = {
    section_key: RAW_MATERIAL_CATEGORIES_KEY,
    title: "Raw Material Categories",
    description: JSON.stringify({ categories: uniqueSorted, initialized: true })
  };

  const { error } = await supabase
    .from("cms_content")
    .upsert(payload, { onConflict: "section_key" });

  if (error) throw error;
  invalidateCmsCache();
  return uniqueSorted;
};

/** Fetches all raw material categories with their ingredient counts. */
export const getRawMaterialCategories = async () => {
  const { categoryMap } = await loadCategoryState();
  return Array.from(categoryMap.entries())
    .map(([category, ingredient_count]) => ({ category, ingredient_count }))
    .sort((a, b) => a.category.localeCompare(b.category));
};

/** Creates a raw material category in CMS persistence. */
export const createRawMaterialCategory = async (rawName) => {
  const validation = validateCategoryName(rawName);
  if (!validation.ok) {
    throw createHttpError(400, validation.error);
  }

  const name = validation.value;
  const { categoryMap } = await loadCategoryState();

  if (categoryMap.has(name)) {
    throw createHttpError(409, `Category "${name}" already exists.`);
  }

  const updated = Array.from(categoryMap.keys());
  updated.push(name);
  await savePersistedCategories(updated);

  return { category: name, ingredient_count: 0 };
};

/** Renames a raw material category across ingredients and CMS persistence. */
export const renameRawMaterialCategory = async (rawOldName, rawNewName) => {
  const oldName = normalizeCategoryName(rawOldName);
  if (!oldName || RESERVED_CATEGORIES.has(oldName)) {
    throw createHttpError(400, "Invalid or reserved category name.");
  }

  const validation = validateCategoryName(rawNewName);
  if (!validation.ok) {
    throw createHttpError(400, validation.error);
  }
  const newName = validation.value;

  const { categoryMap, ingredientRows } = await loadCategoryState();

  if (!categoryMap.has(oldName)) {
    throw createHttpError(404, `Category "${oldName}" not found.`);
  }
  if (categoryMap.has(newName)) {
    throw createHttpError(409, `Category "${newName}" already exists.`);
  }

  const matchedIds = ingredientRows
    .filter((row) => normalizeCategoryName(row.category) === oldName)
    .map((row) => row.id);

  if (matchedIds.length > 0) {
    const { error: updateErr } = await supabase
      .from("ingredients")
      .update({ category: newName })
      .in("id", matchedIds);

    if (updateErr) throw updateErr;
  }

  const updatedCategories = Array.from(categoryMap.keys()).map((c) =>
    c === oldName ? newName : c
  );
  await savePersistedCategories(updatedCategories);

  // Keep the category's shelf-life rule attached to the renamed category.
  const { error: shelfErr } = await supabase
    .from("raw_material_category_shelf_life")
    .update({ category: newName })
    .eq("category", oldName);
  if (shelfErr) throw shelfErr;

  return {
    old_name: oldName,
    new_name: newName,
    updated_count: matchedIds.length
  };
};

/** Deletes an unused raw material category from CMS persistence. */
export const deleteRawMaterialCategory = async (rawName) => {
  const targetName = normalizeCategoryName(rawName);
  if (!targetName || RESERVED_CATEGORIES.has(targetName)) {
    throw createHttpError(400, "Invalid or reserved category name.");
  }

  const { categoryMap, ingredientRows } = await loadCategoryState();
  const inUseCount = ingredientRows.filter(
    (row) => normalizeCategoryName(row.category) === targetName
  ).length;

  if (inUseCount > 0) {
    throw createHttpError(400, `Cannot delete category in use by ${inUseCount} material(s).`);
  }

  if (!categoryMap.has(targetName)) {
    throw createHttpError(404, `Category "${targetName}" not found.`);
  }

  const remaining = Array.from(categoryMap.keys()).filter((c) => c !== targetName);
  await savePersistedCategories(remaining);

  return { success: true, category: targetName };
};
