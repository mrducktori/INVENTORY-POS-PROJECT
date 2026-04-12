import { supabase } from "../../db.js";

export const getIngredients = async () => {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
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
      low_stock_alert: low_stock_alert || 10
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateIngredient = async (id, { name, unit, low_stock_alert }) => {
  const { data, error } = await supabase
    .from("ingredients")
    .update({ name, unit, low_stock_alert })
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
    .filter("stock_quantity", "lt", "low_stock_alert")
    .order("stock_quantity");

  if (error) throw error;
  return data;
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
