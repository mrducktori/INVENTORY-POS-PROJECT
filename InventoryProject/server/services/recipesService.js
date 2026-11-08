import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";

export const recalculateProductEstimatedCost = async (productId) => {
  if (!productId) return null;
  try {
    const [{ data: prod }, { data: recipes }] = await Promise.all([
      supabase.from("products").select("id, price").eq("id", productId).single(),
      supabase
        .from("recipes")
        .select("quantity_used, recipe_unit, ingredients(id, name, unit, unit_cost, cost_per_purchase_unit, conversion_factor)")
        .eq("product_id", productId)
    ]);

    if (!prod) return null;

    let recipeCost = 0;
    let hasCupInRecipe = false;

    for (const r of recipes || []) {
      const ing = r.ingredients;
      if (!ing) continue;
      if (/CUP/i.test(ing.name || "")) hasCupInRecipe = true;

      const baseQty = convertToBaseUnit(parseFloat(r.quantity_used) || 0, r.recipe_unit || ing.unit, ing.unit);
      const purchaseCost = parseFloat(ing.cost_per_purchase_unit) || 0;
      const conv = parseFloat(ing.conversion_factor) || 1;
      const unitCost =
        parseFloat(ing.unit_cost) > 0
          ? parseFloat(ing.unit_cost)
          : purchaseCost > 0 && conv > 0
            ? purchaseCost / conv
            : 0.22;

      recipeCost += baseQty * unitCost;
    }

    if (!hasCupInRecipe && recipeCost > 0) {
      recipeCost += 3.5;
    }

    const price = parseFloat(prod.price) || 0;
    const estimated_cost =
      recipeCost > 0
        ? Math.round(recipeCost * 100) / 100
        : Math.round(price * 0.38 * 100) / 100;

    await supabase.from("products").update({ estimated_cost }).eq("id", productId);
    return estimated_cost;
  } catch (err) {
    console.warn("[recipesService] Failed to recalculate product estimated_cost:", err.message);
    return null;
  }
};

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

export const createRecipe = async ({ product_id, ingredient_id, quantity_used, recipe_unit }) => {
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
      quantity_used,
      recipe_unit: (recipe_unit || '').toUpperCase() || null
    }])
    .select()
    .single();

  if (error) throw error;
  await recalculateProductEstimatedCost(product_id);
  return data;
};

export const updateRecipe = async (id, { quantity_used, recipe_unit }) => {
  const { data, error } = await supabase
    .from("recipes")
    .update({ 
      quantity_used,
      recipe_unit: recipe_unit ? recipe_unit.toUpperCase() : null
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (data?.product_id) {
    await recalculateProductEstimatedCost(data.product_id);
  }
  return data;
};

export const deleteRecipe = async (id) => {
  const { data: existing } = await supabase
    .from("recipes")
    .select("product_id, ingredient_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id);

  if (error) throw error;
  if (existing?.product_id) {
    await recalculateProductEstimatedCost(existing.product_id);
  }
  return { success: true, deleted: existing || null };
};
