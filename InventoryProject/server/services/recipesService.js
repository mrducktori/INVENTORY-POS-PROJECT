import { supabase } from "../../db.js";

export const getRecipes = async () => {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      *,
      products(id, name),
      ingredients(id, name, unit)
    `)
    .order("products(name)");

  if (error) throw error;
  return data;
};

export const getRecipesByProduct = async (product_id) => {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      *,
      ingredients(id, name, unit, stock_quantity)
    `)
    .eq("product_id", product_id);

  if (error) throw error;
  return data;
};

export const createRecipe = async ({ product_id, ingredient_id, quantity_used }) => {
  // Check if recipe already exists
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("product_id", product_id)
    .eq("ingredient_id", ingredient_id)
    .single();

  if (existing) {
    throw new Error("Recipe for this product-ingredient combination already exists");
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert([{
      product_id,
      ingredient_id,
      quantity_used
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateRecipe = async (id, { quantity_used }) => {
  const { data, error } = await supabase
    .from("recipes")
    .update({ quantity_used })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteRecipe = async (id) => {
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
};
