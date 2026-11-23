import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit, canConvertUnit } from "../utils/unitUtils.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import { resolveUnitCost, fetchAllRows } from "../utils/costUtils.js";

const RECIPE_SIZE_OVERRIDES_KEY = "recipe_size_overrides_store";
let hasNativeRecipeSizeCols = null;

// Serialize read-modify-write operations on recipe_size_overrides_store
let overridesLock = Promise.resolve();
const withOverridesLock = async (fn) => {
  const prev = overridesLock;
  let release;
  overridesLock = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
};

const isMissingColumnError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column/i.test(msg)
  );
};

export const normalizeSizeKey = (s) =>
  String(s || "").trim().replace(/\s+/g, "").toLowerCase();

export const validateSizeOverridesInput = ({ size_name, size_quantities } = {}) => {
  let cleanSizeName = null;
  if (size_name !== undefined && size_name !== null && String(size_name).trim() !== "") {
    cleanSizeName = validateTextLength(size_name, {
      label: "Size name",
      min: 1,
      max: LIMITS.CATEGORY_MAX_LEN,
      required: false
    });
  }

  let cleanSizeQuantities = null;
  if (size_quantities !== undefined && size_quantities !== null) {
    if (typeof size_quantities !== "object" || Array.isArray(size_quantities)) {
      const err = new Error("size_quantities must be an object mapping size names to quantities.");
      err.status = 400;
      throw err;
    }

    const sanitized = {};
    for (const [rawKey, rawVal] of Object.entries(size_quantities)) {
      const key = String(rawKey || "").trim().replace(/\s+/g, " ");
      if (!key) continue;
      if (key.length > LIMITS.CATEGORY_MAX_LEN) {
        const err = new Error(`Size key "${key}" must be at most ${LIMITS.CATEGORY_MAX_LEN} characters.`);
        err.status = 400;
        throw err;
      }
      if (rawVal === undefined || rawVal === null || rawVal === "") continue;
      sanitized[key] = validateNumberBound(rawVal, {
        label: `Recipe quantity for size "${key}"`,
        min: LIMITS.RECIPE_QTY_MIN,
        max: LIMITS.RECIPE_QTY_MAX,
        allowZero: false
      });
    }
    if (Object.keys(sanitized).length > 0) {
      cleanSizeQuantities = sanitized;
    }
  }

  return {
    size_name: cleanSizeName,
    size_quantities: cleanSizeQuantities
  };
};

export const getRecipeSizeOverridesMap = async () => {
  const { data, error } = await supabase
    .from("cms_content")
    .select("description")
    .eq("section_key", RECIPE_SIZE_OVERRIDES_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data?.description) return {};
  try {
    const parsed = JSON.parse(data.description);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const saveRecipeSizeOverride = async (recipeId, { size_name, size_quantities }) => {
  if (!recipeId) return;
  await withOverridesLock(async () => {
    const map = await getRecipeSizeOverridesMap();
    if (!size_name && !size_quantities) {
      if (map[recipeId] === undefined) return;
      delete map[recipeId];
    } else {
      map[recipeId] = {
        size_name: size_name || null,
        size_quantities: size_quantities || null
      };
    }

    const { error } = await supabase
      .from("cms_content")
      .upsert(
        {
          section_key: RECIPE_SIZE_OVERRIDES_KEY,
          title: "Recipe Size Overrides Store",
          description: JSON.stringify(map)
        },
        { onConflict: "section_key" }
      );
    if (error) throw error;
  });
};

const attachSizeOverrides = (rows = [], overridesMap = {}) =>
  (rows || []).map((row) => {
    const override = overridesMap[row.id];
    const resolvedSizeName = override?.size_name ?? row.size_name ?? null;
    const resolvedSizeQuantities = override?.size_quantities ?? row.size_quantities ?? null;
    return {
      ...row,
      size_name: resolvedSizeName,
      size_quantities: resolvedSizeQuantities
    };
  });

/**
 * Resolves the exact ingredient quantity required for a specific cup size.
 */
export const resolveRecipeQuantityForSize = (recipe, cupSizeName, cupSizeObj = null) => {
  if (!recipe) return 0;
  const targetKey = normalizeSizeKey(cupSizeName || cupSizeObj?.name);
  const sizeMap = recipe.size_quantities;

  if (targetKey && sizeMap && typeof sizeMap === "object" && !Array.isArray(sizeMap)) {
    for (const [k, rawVal] of Object.entries(sizeMap)) {
      if (normalizeSizeKey(k) === targetKey && rawVal !== "" && rawVal !== null && rawVal !== undefined) {
        const num = Number(rawVal);
        if (Number.isFinite(num) && num >= 0) {
          return num;
        }
      }
    }
  }

  const normRecipeSize = normalizeSizeKey(recipe.size_name);
  if (normRecipeSize && normRecipeSize !== "all") {
    if (!targetKey || normRecipeSize !== targetKey) {
      return 0;
    }
    return parseFloat(recipe.quantity_used) || 0;
  }

  const baseQty = parseFloat(recipe.quantity_used) || 0;
  const mult = parseFloat(cupSizeObj?.recipe_multiplier);
  const effectiveMult = Number.isFinite(mult) && mult > 0 ? mult : 1;
  return baseQty * effectiveMult;
};

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
      recipeCost += baseQty * (resolveUnitCost(ing) ?? 0);
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
  const [data, overridesMap] = await Promise.all([
    fetchAllRows(() => supabase
      .from("recipes")
      .select(`
        *,
        products(id, name),
        ingredients(id, name, unit)
      `)
      .order("products(name)")
      .order("id")),
    getRecipeSizeOverridesMap()
  ]);

  return attachSizeOverrides(data, overridesMap);
};

export const getRecipesByProduct = async (product_id) => {
  const [{ data, error }, overridesMap] = await Promise.all([
    supabase
      .from("recipes")
      .select(`
        *,
        ingredients(id, name, category, unit, stock_quantity)
      `)
      .eq("product_id", product_id),
    getRecipeSizeOverridesMap()
  ]);

  if (error) throw error;
  return attachSizeOverrides(data || [], overridesMap);
};

// A unit with no conversion path would deduct the raw number (30 ML from a KG item = 30 KG).
export const assertRecipeUnitCompatible = async (ingredient_id, recipe_unit) => {
  if (!recipe_unit) return;
  const { data: ing, error } = await supabase.from("ingredients").select("name, unit").eq("id", ingredient_id).maybeSingle();
  if (error) throw error;
  if (ing && !canConvertUnit(recipe_unit, ing.unit)) {
    const err = new Error(`Recipe unit ${String(recipe_unit).toUpperCase()} cannot be converted to ${ing.name}'s stock unit ${ing.unit}.`);
    err.status = 400;
    throw err;
  }
};

export const createRecipe = async ({ product_id, ingredient_id, quantity_used, recipe_unit, size_name, size_quantities }) => {
  const validatedQty = validateNumberBound(quantity_used, {
    label: 'Recipe quantity',
    min: LIMITS.RECIPE_QTY_MIN,
    max: LIMITS.RECIPE_QTY_MAX,
    allowZero: false
  });
  const validatedOverrides = validateSizeOverridesInput({ size_name, size_quantities });
  await assertRecipeUnitCompatible(ingredient_id, recipe_unit);

  // Check if recipe already exists
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("product_id", product_id)
    .eq("ingredient_id", ingredient_id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    throw new Error("Recipe for this product-ingredient combination already exists");
  }

  const baseRow = {
    product_id,
    ingredient_id,
    quantity_used: validatedQty,
    recipe_unit: (recipe_unit || '').toUpperCase() || null
  };

  let data;
  if (hasNativeRecipeSizeCols !== false && (validatedOverrides.size_name || validatedOverrides.size_quantities)) {
    const resWithCols = await supabase
      .from("recipes")
      .insert([{
        ...baseRow,
        size_name: validatedOverrides.size_name,
        size_quantities: validatedOverrides.size_quantities
      }])
      .select()
      .single();

    if (resWithCols.error && isMissingColumnError(resWithCols.error)) {
      hasNativeRecipeSizeCols = false;
      const fallbackRes = await supabase.from("recipes").insert([baseRow]).select().single();
      if (fallbackRes.error) throw fallbackRes.error;
      data = fallbackRes.data;
    } else if (resWithCols.error) {
      throw resWithCols.error;
    } else {
      hasNativeRecipeSizeCols = true;
      data = resWithCols.data;
    }
  } else {
    const res = await supabase.from("recipes").insert([baseRow]).select().single();
    if (res.error) throw res.error;
    data = res.data;
  }

  await saveRecipeSizeOverride(data.id, validatedOverrides);
  await recalculateProductEstimatedCost(product_id);
  return {
    ...data,
    size_name: validatedOverrides.size_name ?? data.size_name ?? null,
    size_quantities: validatedOverrides.size_quantities ?? data.size_quantities ?? null
  };
};

export const updateRecipe = async (id, { quantity_used, recipe_unit, size_name, size_quantities }) => {
  const validatedQty = validateNumberBound(quantity_used, {
    label: 'Recipe quantity',
    min: LIMITS.RECIPE_QTY_MIN,
    max: LIMITS.RECIPE_QTY_MAX,
    allowZero: false
  });
  const hasOverridePayload = size_name !== undefined || size_quantities !== undefined;
  const validatedOverrides = hasOverridePayload
    ? validateSizeOverridesInput({ size_name, size_quantities })
    : null;
  if (recipe_unit) {
    const { data: current, error: curErr } = await supabase.from("recipes").select("ingredient_id").eq("id", id).maybeSingle();
    if (curErr) throw curErr;
    if (current) await assertRecipeUnitCompatible(current.ingredient_id, recipe_unit);
  }

  const baseUpdate = {
    quantity_used: validatedQty,
    recipe_unit: recipe_unit ? recipe_unit.toUpperCase() : null
  };

  let data;
  if (hasNativeRecipeSizeCols !== false && validatedOverrides) {
    const resWithCols = await supabase
      .from("recipes")
      .update({
        ...baseUpdate,
        size_name: validatedOverrides.size_name,
        size_quantities: validatedOverrides.size_quantities
      })
      .eq("id", id)
      .select()
      .single();

    if (resWithCols.error && isMissingColumnError(resWithCols.error)) {
      hasNativeRecipeSizeCols = false;
      const fallbackRes = await supabase
        .from("recipes")
        .update(baseUpdate)
        .eq("id", id)
        .select()
        .single();
      if (fallbackRes.error) throw fallbackRes.error;
      data = fallbackRes.data;
    } else if (resWithCols.error) {
      throw resWithCols.error;
    } else {
      hasNativeRecipeSizeCols = true;
      data = resWithCols.data;
    }
  } else {
    const res = await supabase
      .from("recipes")
      .update(baseUpdate)
      .eq("id", id)
      .select()
      .single();
    if (res.error) throw res.error;
    data = res.data;
  }

  if (validatedOverrides) {
    await saveRecipeSizeOverride(id, validatedOverrides);
  }
  if (data?.product_id) {
    await recalculateProductEstimatedCost(data.product_id);
  }

  const overridesMap = validatedOverrides
    ? { [id]: validatedOverrides }
    : await getRecipeSizeOverridesMap();
  return attachSizeOverrides([data], overridesMap)[0];
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
  await saveRecipeSizeOverride(id, { size_name: null, size_quantities: null });
  if (existing?.product_id) {
    await recalculateProductEstimatedCost(existing.product_id);
  }
  return { success: true, deleted: existing || null };
};
