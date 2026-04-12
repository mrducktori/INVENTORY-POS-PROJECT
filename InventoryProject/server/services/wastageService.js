import { supabase } from "../../db.js";
import { updateStock } from "./inventoryService.js";

export const reportWastage = async ({ ingredient_id, quantity, reason, reported_by }) => {
  // Record the wastage
  const { data, error } = await supabase
    .from("wastage")
    .insert([{
      ingredient_id,
      quantity,
      reason,
      reported_by
    }])
    .select()
    .single();

  if (error) throw error;

  // Deduct from stock
  await updateStock(ingredient_id, quantity, "subtract");

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

  if (filters.start_date) {
    query = query.gte("created_at", filters.start_date);
  }

  if (filters.end_date) {
    query = query.lte("created_at", filters.end_date);
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
