import { supabase } from "../config/supabaseClient.js";

export const getIngredients = async () => {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .neq("is_archived", true)
    .order("name");

  if (error) throw error;
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

export const createIngredient = async ({ name, unit, stock_quantity, low_stock_alert, image_url, force_create }) => {
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

  const { data, error } = await supabase
    .from("ingredients")
    .insert([{
      name,
      unit,
      image_url,
      stock_quantity: stock_quantity || 0,
      low_stock_alert: low_stock_alert || 10,
      is_archived: false
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// FIX #2: stock_quantity is intentionally excluded — stock must only be changed
// through receiveStock() (add) or the POS/wastage flow (subtract).
export const updateIngredient = async (id, { name, unit, low_stock_alert, image_url }) => {
  const { data, error } = await supabase
    .from("ingredients")
    .update({ name, unit, low_stock_alert, image_url })
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
  
  // Filter in JS to ensure column-to-column comparison works correctly
  return (data || []).filter(i => i.stock_quantity <= i.low_stock_alert);
};

// FIX #12: Validates that quantity is a positive number before adding to stock.
export const receiveStock = async (id, quantity) => {
  if (!quantity || quantity <= 0 || isNaN(quantity)) {
    throw new Error("Quantity received must be a positive number.");
  }
  return updateStock(id, quantity, "add");
};

export const deleteIngredient = async (id) => {
  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
};

export const archiveIngredient = async (id) => {
  const { data, error } = await supabase
    .from("ingredients")
    .update({ is_archived: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
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
  return data;
};
