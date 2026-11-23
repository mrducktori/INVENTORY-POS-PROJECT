import { supabase } from "../config/supabaseClient.js";
import { getIngredientById } from "./inventoryService.js";
import * as batchService from "./batchService.js";
import { logAudit } from "../utils/auditHelper.js";
import { toManilaStartOfDay, toManilaEndOfDay } from "../utils/dateUtils.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";

const computeWastageEntryCost = (entry) => {
  if (entry.estimated_cost !== undefined && entry.estimated_cost !== null && Number(entry.estimated_cost) > 0) {
    return Math.round(Number(entry.estimated_cost) * 100) / 100;
  }
  const qty = parseFloat(entry.quantity) || 0;
  const ing = entry.ingredients || entry.ingredient || {};
  const explicitUnitCost = parseFloat(ing.unit_cost) || 0;
  if (explicitUnitCost > 0) {
    return Math.round(explicitUnitCost * qty * 100) / 100;
  }
  const purchaseCost = parseFloat(ing.cost_per_purchase_unit) || 0;
  const conv = parseFloat(ing.conversion_factor) || 1;
  if (purchaseCost > 0 && conv > 0) {
    return Math.round((purchaseCost / conv) * qty * 100) / 100;
  }
  // Fallback unit cost estimate based on standard raw material unit (G, ML, PCS, KG, L)
  const unit = String(ing.unit || '').toUpperCase();
  const defaultUnitRate =
    unit === 'KG' || unit === 'L' ? 180 :
    unit === 'PCS' ? 2.5 :
    unit === 'G' || unit === 'ML' ? 0.22 : 1.0;
  return Math.round(qty * defaultUnitRate * 100) / 100;
};

// FIX #3 & #13: Added a stock sufficiency check BEFORE logging the wastage record.
// This prevents the audit log from being created if the deduction would fail,
// keeping the wastage log and actual inventory perfectly in sync.
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

  // Check current stock BEFORE logging or deducting
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

  // Deduct from batches & stock first (preferring expired batches when reason is Expiry, or using explicit batch_id)
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

    // Only log the wastage record AFTER the deduction succeeds
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

  // Create an audit log so it shows up in AuditLogs correctly
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
    .order("created_at", { ascending: false });

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

  const { data, error } = await query;

  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    estimated_cost: computeWastageEntryCost(row),
  }));
};

export const getWastageStats = async () => {
  const { data, error } = await supabase
    .from("wastage")
    .select("ingredient_id, quantity, estimated_cost, created_at, ingredients(id, name, unit, unit_cost, cost_per_purchase_unit, conversion_factor)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  // Calculate stats
  const totalWastage = Math.round(data.reduce((sum, w) => sum + (parseFloat(w.quantity) || 0), 0) * 100) / 100;
  const totalEstimatedCost = Math.round(data.reduce((sum, w) => sum + computeWastageEntryCost(w), 0) * 100) / 100;
  const wastageByIngredient = {};

  data.forEach(w => {
    if (!wastageByIngredient[w.ingredient_id]) {
      wastageByIngredient[w.ingredient_id] = 0;
    }
    wastageByIngredient[w.ingredient_id] = Math.round((wastageByIngredient[w.ingredient_id] + (parseFloat(w.quantity) || 0)) * 100) / 100;
  });

  return {
    totalWastage,
    totalEstimatedCost,
    wastageByIngredient,
    recordCount: data.length
  };
};
