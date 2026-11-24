import { supabase } from "../config/supabaseClient.js";
import { getIngredientById } from "./inventoryService.js";
import * as batchService from "./batchService.js";
import { logAudit } from "../utils/auditHelper.js";
import { toManilaStartOfDay, toManilaEndOfDay } from "../utils/dateUtils.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import { resolveUnitCost, fetchAllRows } from "../utils/costUtils.js";

const computeWastageEntryCost = (entry) => {
  if (entry.estimated_cost !== undefined && entry.estimated_cost !== null && Number(entry.estimated_cost) > 0) {
    return Math.round(Number(entry.estimated_cost) * 100) / 100;
  }
  const qty = parseFloat(entry.quantity) || 0;
  const ing = entry.ingredients || entry.ingredient || {};
  return Math.round(qty * (resolveUnitCost(ing) ?? 0) * 100) / 100;
};

// The stock check runs before anything is logged or deducted, and the wastage record is
// inserted only after the deduction succeeds, so a failure never leaves a log entry.
export const reportWastage = async ({ ingredient_id, quantity, reason, batch_id = null, reported_by }) => {
  const qty = validateNumberBound(quantity, {
    label: 'Wastage quantity',
    min: LIMITS.WASTAGE_QTY_MIN,
    max: LIMITS.WASTAGE_QTY_MAX,
    allowZero: false
  });
  const cleanReason = validateTextLength(reason, {
    label: 'Wastage reason',
    min: 1,
    max: LIMITS.DESC_MAX_LEN,
    required: true
  });

  const ingredient = await getIngredientById(ingredient_id);
  if (ingredient.is_archived) {
    throw new Error("Cannot report wastage for an archived ingredient");
  }
  if (parseFloat(ingredient.stock_quantity) < qty) {
    throw new Error(
      `Cannot report wastage of ${qty} ${ingredient.unit} for "${ingredient.name}". ` +
      `Current stock is only ${ingredient.stock_quantity} ${ingredient.unit}.`
    );
  }

  // Deduct from batches first: expired ones when the reason is Expiry, or the explicit batch_id.
  const dedResult = await batchService.deductStockFEFO(ingredient_id, qty, {
    targetBatchId: batch_id || null,
    preferExpired: /expir/i.test(cleanReason),
    allowExpired: true
  });

  let data;
  let estimated_cost;
  try {
    estimated_cost = computeWastageEntryCost({
      quantity: qty,
      ingredient
    });

    const { data: inserted, error } = await supabase
      .from("wastage")
      .insert([{
        ingredient_id,
        quantity: qty,
        reason: cleanReason,
        reported_by,
        estimated_cost
      }])
      .select()
      .single();

    if (error) throw error;
    data = inserted;
  } catch (insertErr) {
    try {
      await batchService.restoreDeductedBatches(ingredient_id, dedResult.deductedBatches);
    } catch (rollbackErr) {
      console.error("[Wastage Rollback] Failed to restore stock after insert error:", rollbackErr.message);
    }
    throw insertErr;
  }

  invalidateAnalyticsCache();

  await logAudit("WASTAGE", reported_by, {
    ingredient_id,
    ingredient_name: ingredient.name,
    quantity: qty,
    estimated_cost,
    reason: cleanReason,
    deducted_batches: dedResult.deductedBatches
  });

  return data;
};

export const getWastageHistory = async (filters = {}) => {
  let query = supabase
    .from("wastage")
    .select(`
      *,
      ingredients(id, name, unit, unit_cost, cost_per_purchase_unit, conversion_factor),
      users(id, name, username)
    `)
    .order("created_at", { ascending: false })
    .order("id");

  if (filters.ingredient_id) {
    query = query.eq("ingredient_id", filters.ingredient_id);
  }

  if (filters.reported_by) {
    query = query.eq("reported_by", filters.reported_by);
  }

  if (filters.start_date || filters.startDate) {
    query = query.gte("created_at", toManilaStartOfDay(filters.start_date || filters.startDate));
  }

  if (filters.end_date || filters.endDate) {
    query = query.lte("created_at", toManilaEndOfDay(filters.end_date || filters.endDate));
  }

  const data = await fetchAllRows(() => query);
  return data.map(row => ({
    ...row,
    estimated_cost: computeWastageEntryCost(row),
  }));
};

export const getWastageStats = async () => {
  const data = await fetchAllRows(() => supabase
    .from("wastage")
    .select("id, ingredient_id, quantity, estimated_cost, created_at, ingredients(id, name, unit, unit_cost, cost_per_purchase_unit, conversion_factor)")
    .order("created_at", { ascending: false })
    .order("id"));

  // Quantities in different units must not be summed together (kg + ml), so group by unit.
  const totalsByUnit = {};
  data.forEach(w => {
    const u = String(w.ingredients?.unit || "UNKNOWN").toUpperCase();
    totalsByUnit[u] = Math.round(((totalsByUnit[u] || 0) + (parseFloat(w.quantity) || 0)) * 100) / 100;
  });
  const totalEstimatedCost = Math.round(data.reduce((sum, w) => sum + computeWastageEntryCost(w), 0) * 100) / 100;
  const wastageByIngredient = {};

  data.forEach(w => {
    if (!wastageByIngredient[w.ingredient_id]) {
      wastageByIngredient[w.ingredient_id] = 0;
    }
    wastageByIngredient[w.ingredient_id] = Math.round((wastageByIngredient[w.ingredient_id] + (parseFloat(w.quantity) || 0)) * 100) / 100;
  });

  return {
    totalsByUnit,
    totalEstimatedCost,
    wastageByIngredient,
    recordCount: data.length
  };
};
