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

export const createIngredient = async ({ name, unit, stock_quantity, low_stock_alert }) => {
  const { data, error } = await supabase
    .from("ingredients")
    .insert([{
      name,
      unit,
      stock_quantity: stock_quantity || 0,
      low_stock_alert: low_stock_alert || 10,
      is_archived: false
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateIngredient = async (id, { name, unit, low_stock_alert, stock_quantity }) => {
  const { data, error } = await supabase
    .from("ingredients")
    .update({ name, unit, low_stock_alert, stock_quantity })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateStock = async (id, quantity, operation = "add") => {
  const ingredient = await getIngredientById(id);
  const newStock = operation === "add"
    ? ingredient.stock_quantity + quantity
    : ingredient.stock_quantity - quantity;

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

export const receiveStock = async (id, quantity) => {
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

