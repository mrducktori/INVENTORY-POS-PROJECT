import { supabase } from "../config/supabaseClient.js";
import { getIngredientById } from "./inventoryService.js";
import { updateStock } from "./inventoryService.js";
import { logAudit } from "../utils/auditHelper.js";
import { toManilaStartOfDay, toManilaEndOfDay } from "../utils/dateUtils.js";

// FIX #3 & #13: Added a stock sufficiency check BEFORE logging the wastage record.
// This prevents the audit log from being created if the deduction would fail,
// keeping the wastage log and actual inventory perfectly in sync.
export const reportWastage = async ({ ingredient_id, quantity, reason, reported_by }) => {
  const qty = parseFloat(quantity);
  if (!qty || qty <= 0 || isNaN(qty)) {
    throw new Error("Wastage quantity must be a positive number.");
  }

  // Check current stock BEFORE logging or deducting
  const ingredient = await getIngredientById(ingredient_id);
  if (parseFloat(ingredient.stock_quantity) < qty) {
    throw new Error(
      `Cannot report wastage of ${qty} ${ingredient.unit} for "${ingredient.name}". ` +
      `Current stock is only ${ingredient.stock_quantity} ${ingredient.unit}.`
    );
  }

  // Deduct from stock first (most important step)
  await updateStock(ingredient_id, qty, "subtract");

  // Only log the wastage record AFTER the deduction succeeds
  const { data, error } = await supabase
    .from("wastage")
    .insert([{
      ingredient_id,
      quantity: qty,
      reason,
      reported_by
    }])
    .select()
    .single();

  if (error) throw error;

  // Create an audit log so it shows up in AuditLogs correctly
  await logAudit("WASTAGE", reported_by, {
    ingredient_id,
    ingredient_name: ingredient.name,
    quantity: qty,
    reason
  });

  return data;
};

export const getWastageHistory = async (filters = {}) => {
  let query = supabase
    .from("wastage")
    .select(`
      *,
      ingredients(id, name, unit),
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
  return data;
};

export const getWastageStats = async () => {
  const { data, error } = await supabase
    .from("wastage")
    .select("ingredient_id, quantity, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  // Calculate stats
  const totalWastage = data.reduce((sum, w) => sum + w.quantity, 0);
  const wastageByIngredient = {};

  data.forEach(w => {
    if (!wastageByIngredient[w.ingredient_id]) {
      wastageByIngredient[w.ingredient_id] = 0;
    }
    wastageByIngredient[w.ingredient_id] += w.quantity;
  });

  return {
    totalWastage,
    wastageByIngredient,
    recordCount: data.length
  };
};
