import { supabase } from "../config/supabaseClient.js";
import { getArchiveTimestampsMap, getDaysSinceArchived, invalidateArchiveMap } from "../utils/archiveHelper.js";

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

import { findSimilarName } from "../utils/stringHelper.js";

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
  // Check for duplicates
  if (!force_create) {
    const { data: existingIngredients } = await supabase.from("ingredients").select("name");
    if (existingIngredients) {
      const existingNames = existingIngredients.map(i => i.name);
      const similar = findSimilarName(name, existingNames);
      if (similar) {
        throw { 
          message: `An ingredient with a similar name ("${similar}") already exists.`,
          is_duplicate_warning: true 
        };
      }
    }
  }

  const computedUnitCost = computeUnitCost({ unit, unit_cost, cost_per_purchase_unit, conversion_factor });

  const insertPayload = {
    name,
    unit,
    category: category || null,
    image_url,
    stock_quantity: stock_quantity || 0,
    low_stock_alert: low_stock_alert || 10,
    purchase_unit: purchase_unit || 'Unit',
    conversion_factor: parseFloat(conversion_factor) || 1,
    cost_per_purchase_unit: parseFloat(cost_per_purchase_unit) || 0,
    unit_cost: computedUnitCost,
    is_archived: false
  };

  const { data, error } = await supabase
    .from("ingredients")
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// FIX #2: stock_quantity is intentionally excluded — stock must only be changed
// through receiveStock() (add) or the POS/wastage flow (subtract).
export const updateIngredient = async (id, { name, unit, category, low_stock_alert, image_url, purchase_unit, conversion_factor, cost_per_purchase_unit, unit_cost }) => {
  const updatePayload = { name, unit, low_stock_alert, image_url };
  if (category !== undefined) updatePayload.category = category || null;
  
  // Include PO defaults if provided and keep unit_cost synced
  if (purchase_unit !== undefined) updatePayload.purchase_unit = purchase_unit;
  if (conversion_factor !== undefined) updatePayload.conversion_factor = conversion_factor;
  if (cost_per_purchase_unit !== undefined) updatePayload.cost_per_purchase_unit = cost_per_purchase_unit;
  if (cost_per_purchase_unit !== undefined || conversion_factor !== undefined || unit_cost !== undefined) {
    updatePayload.unit_cost = computeUnitCost({ unit, unit_cost, cost_per_purchase_unit, conversion_factor });
  }
  
  const { data, error } = await supabase
    .from("ingredients")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// FIX #4: Added floor guard — will throw if the result would go below 0.
export const updateStock = async (id, quantity, operation = "add") => {
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

// FIX #12: Validates that quantity is a positive number before adding to stock.
export const receiveStock = async (id, quantity) => {
  if (!quantity || quantity <= 0 || isNaN(quantity)) {
    throw new Error("Quantity received must be a positive number.");
  }
  return updateStock(id, quantity, "add");
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
