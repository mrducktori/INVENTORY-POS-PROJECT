import { supabase } from "../config/supabaseClient.js";
import { getArchiveTimestampsMap, getDaysSinceArchived, invalidateArchiveMap } from "../utils/archiveHelper.js";
import { checkCompositeDuplicate } from "../utils/stringHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import { invalidateCmsCache } from "./cmsService.js";

export const getIngredients = async ({ includeArchived = false } = {}) => {
  let query = supabase
    .from("ingredients")
    .select("*");

  if (!includeArchived) {
    query = query.neq("is_archived", true);
  }

  const { data, error } = await query.order("name");

  if (error) throw error;

  if (includeArchived) {
    const archiveMap = await getArchiveTimestampsMap();
    return (data || []).map(item => {
      if (!item.is_archived) return item;
      const archivedAt = archiveMap.ingredients[item.id] || item.created_at || null;
      return {
        ...item,
        archived_at: archivedAt,
        days_since_archived: getDaysSinceArchived(archivedAt)
      };
    });
  }

  return data;
};

export const getIngredientById = async (id) => {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
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

const computeUnitCost = ({ unit, unit_cost, cost_per_purchase_unit, conversion_factor }) => {
  const purchaseCost = parseFloat(cost_per_purchase_unit);
  const conv = parseFloat(conversion_factor) || 1;
  if (!isNaN(purchaseCost) && purchaseCost > 0 && conv > 0) {
    return Math.round((purchaseCost / conv) * 10000) / 10000;
  }
  const explicitUnitCost = parseFloat(unit_cost);
  if (!isNaN(explicitUnitCost) && explicitUnitCost > 0) {
    return Math.round(explicitUnitCost * 10000) / 10000;
  }
  const u = String(unit || '').toUpperCase();
  if (u === 'KG' || u === 'L') return 180;
  if (u === 'PCS') return 2.5;
  if (u === 'G' || u === 'ML') return 0.22;
  return 1.0;
};

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
    stock_quantity: validated.stock_quantity,
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
  return data;
};

// FIX #2: stock_quantity is intentionally excluded — stock must only be changed
// through receiveStock() (add) or the POS/wastage flow (subtract).
export const updateIngredient = async (id, { name, unit, category, low_stock_alert, image_url, purchase_unit, conversion_factor, cost_per_purchase_unit, unit_cost, force_update }) => {
  const validated = validateIngredientInput(
    { name, category, low_stock_alert, conversion_factor, cost_per_purchase_unit, unit_cost },
    { isUpdate: true }
  );

  await assertNoIngredientDuplicate({
    name: validated.name,
    category: validated.category,
    excludeId: id,
    force: Boolean(force_update)
  });

  const updatePayload = { name: validated.name, unit, image_url };
  if (validated.low_stock_alert !== undefined) updatePayload.low_stock_alert = validated.low_stock_alert;
  if (validated.category !== undefined) updatePayload.category = validated.category;

  // Include PO defaults if provided and keep unit_cost synced
  if (purchase_unit !== undefined) updatePayload.purchase_unit = purchase_unit;
  if (validated.conversion_factor !== undefined) updatePayload.conversion_factor = validated.conversion_factor;
  if (validated.cost_per_purchase_unit !== undefined) updatePayload.cost_per_purchase_unit = validated.cost_per_purchase_unit;
  if (validated.cost_per_purchase_unit !== undefined || validated.conversion_factor !== undefined || validated.unit_cost !== undefined) {
    updatePayload.unit_cost = computeUnitCost({
      unit,
      unit_cost: validated.unit_cost,
      cost_per_purchase_unit: validated.cost_per_purchase_unit,
      conversion_factor: validated.conversion_factor
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
  return data;
};

// FIX #4: Added floor guard — will throw if the result would go below 0.
export const updateStock = async (id, quantity, operation = "add", { maxLimit = null } = {}) => {
  const ingredient = await getIngredientById(id);
  const newStock = operation === "add"
    ? parseFloat(ingredient.stock_quantity) + quantity
    : parseFloat(ingredient.stock_quantity) - quantity;

  if (newStock < 0) {
    throw new Error(
      `Insufficient stock for "${ingredient.name}". ` +
      `Has: ${ingredient.stock_quantity}, Requires: ${quantity}`
    );
  }

  if (maxLimit !== null && operation === "add" && newStock > maxLimit) {
    const err = new Error(`Resulting stock quantity cannot exceed ${maxLimit.toLocaleString()}.`);
    err.status = 400;
    throw err;
  }

  const { data, error } = await supabase
    .from("ingredients")
    .update({ stock_quantity: newStock })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getLowStockAlerts = async () => {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("is_archived", false);

  if (error) throw error;
  
  // Configurable Thresholds: Flag items where current_stock <= (max_stock * 0.5)
  return (data || []).filter(i => {
    const currentStock = parseFloat(i.stock_quantity) || 0;
    const maxStock = parseFloat(i.max_stock) || parseFloat(i.max_capacity) || (parseFloat(i.low_stock_alert || 10) * 2);
    const threshold = maxStock * 0.5;
    return currentStock <= threshold;
  }).map(i => {
    const maxStock = parseFloat(i.max_stock) || parseFloat(i.max_capacity) || (parseFloat(i.low_stock_alert || 10) * 2);
    return {
      ...i,
      max_stock: maxStock,
      low_stock_threshold: maxStock * 0.5
    };
  });
};

// FIX #12: Validates that quantity is within allowed bounds before adding to stock.
export const receiveStock = async (id, quantity) => {
  const parsedQty = validateNumberBound(quantity, {
    label: 'Quantity received',
    min: LIMITS.RECEIVE_QTY_MIN,
    max: LIMITS.RECEIVE_QTY_MAX,
    allowZero: false
  });
  return updateStock(id, parsedQty, "add", { maxLimit: LIMITS.STOCK_QTY_MAX });
};

export const deleteIngredient = async (id) => {
  // 1. Fetch existing
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

  // 2. Check 30 days elapsed
  const archiveMap = await getArchiveTimestampsMap(true);
  const archivedAt = archiveMap.ingredients[id] || ingredient.created_at;
  const daysElapsed = getDaysSinceArchived(archivedAt);

  if (!archivedAt || daysElapsed < 30) {
    const remaining = Math.max(1, 30 - daysElapsed);
    throw new Error(`Cannot permanently delete raw material yet. Must be archived for at least 30 days (${remaining} day(s) remaining).`);
  }

  // 3. Check purchase orders and wastage
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

  // 4. Remove dependent recipes & supplier links
  await supabase.from("recipes").delete().eq("ingredient_id", id);
  await supabase.from("supplier_ingredients").delete().eq("ingredient_id", id);

  // 5. Delete ingredient
  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id);

  if (error) throw error;
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

// ==========================================
// RAW MATERIAL CATEGORY MANAGEMENT
// ==========================================

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

/**
 * Fetch all raw material categories with their ingredient counts.
 */
export const getRawMaterialCategories = async () => {
  const { categoryMap } = await loadCategoryState();
  return Array.from(categoryMap.entries())
    .map(([category, ingredient_count]) => ({ category, ingredient_count }))
    .sort((a, b) => a.category.localeCompare(b.category));
};

/**
 * Create a new raw material category in CMS persistence.
 */
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

/**
 * Rename an existing raw material category across ingredients and CMS persistence.
 */
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

  return {
    old_name: oldName,
    new_name: newName,
    updated_count: matchedIds.length
  };
};

/**
 * Delete an unused raw material category from CMS persistence.
 */
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
