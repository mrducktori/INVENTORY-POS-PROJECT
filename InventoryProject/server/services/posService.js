import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import { logAuditBatch } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";
import { getManilaDateString } from "../utils/dateUtils.js";
import * as batchService from "./batchService.js";
import * as recipesService from "./recipesService.js";

const STOCK_EPSILON = 1e-9;

const roundStock = (value) => Math.max(0, Math.round(value * 1e6) / 1e6);

const computeOrderableForSize = (prodRecipes = [], ingMap = {}, cupSizeObj = null) => {
  let minOrderable = Infinity;
  for (const recipe of prodRecipes) {
    const ing = ingMap[recipe.ingredient_id];
    if (!ing) {
      return 0;
    }

    const qtyForSize = cupSizeObj
      ? recipesService.resolveRecipeQuantityForSize(recipe, cupSizeObj.name, cupSizeObj)
      : (parseFloat(recipe.quantity_used) || 0);
    if (qtyForSize <= 0) continue;

    const deductionPerUnit = convertToBaseUnit(qtyForSize, recipe.recipe_unit || ing.unit, ing.unit);
    if (deductionPerUnit > 0) {
      const usableQty = ing.usable_stock !== undefined ? parseFloat(ing.usable_stock) : parseFloat(ing.stock_quantity);
      const possible = Math.max(0, Math.floor(((usableQty || 0) + STOCK_EPSILON) / deductionPerUnit));
      minOrderable = Math.min(minOrderable, possible);
    }
  }

  if (cupSizeObj?.ingredient_id) {
    const cupIng = ingMap[cupSizeObj.ingredient_id];
    if (!cupIng) return 0;
    const usableCup = cupIng.usable_stock !== undefined ? parseFloat(cupIng.usable_stock) : parseFloat(cupIng.stock_quantity);
    minOrderable = Math.min(minOrderable, Math.max(0, Math.floor((usableCup || 0) + STOCK_EPSILON)));
  }

  return Number.isFinite(minOrderable) ? minOrderable : 0;
};

export const computeProductAvailability = (product, prodRecipes = [], ingMap = {}, resolvedSizes = null) => {
  const has_recipe = Array.isArray(prodRecipes) && prodRecipes.length > 0;

  if (product?.track_stock || !has_recipe) {
    const max_orderable = Math.max(0, Math.floor((parseFloat(product?.stock_quantity) || 0) + STOCK_EPSILON));
    return {
      is_available: max_orderable > 0,
      has_recipe,
      max_orderable
    };
  }

  const sizesToCheck = Array.isArray(resolvedSizes)
    ? resolvedSizes
    : (Array.isArray(product?.sizes) ? product.sizes : []);

  let max_orderable;
  if (sizesToCheck.length > 0) {
    max_orderable = Math.max(
      0,
      ...sizesToCheck.map((sz) => computeOrderableForSize(prodRecipes, ingMap, sz))
    );
  } else {
    max_orderable = computeOrderableForSize(prodRecipes, ingMap, null);
  }

  return {
    is_available: max_orderable > 0,
    has_recipe: true,
    max_orderable
  };
};

const attachOverridesToRecipes = (recipes = [], overridesMap = {}) =>
  (recipes || []).map((r) => {
    const ov = overridesMap[r.id];
    return {
      ...r,
      size_name: ov?.size_name ?? r.size_name ?? null,
      size_quantities: ov?.size_quantities ?? r.size_quantities ?? null
    };
  });

const buildCatalogMaps = (products = [], recipes = [], ingredients = [], categorySizesMap = null) => {
  const ingMap = {};
  ingredients.forEach(i => { ingMap[i.id] = i; });

  const recMap = {};
  recipes.forEach(r => {
    if (!recMap[r.product_id]) recMap[r.product_id] = [];
    recMap[r.product_id].push(r);
  });

  const productsWithAvailability = products.map(product => {
    const ownSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const fallbackSizes = categorySizesMap ? (categorySizesMap.get(normalizeCategoryKey(product.category)) || []) : [];
    const resolvedSizes = ownSizes.length > 0 ? ownSizes : fallbackSizes;
    const availability = computeProductAvailability(product, recMap[product.id] || [], ingMap, resolvedSizes);
    return {
      ...product,
      ...availability
    };
  });

  return productsWithAvailability;
};

const normalizeCategoryKey = (category) =>
  String(category || "").trim().replace(/\s+/g, " ").toUpperCase();

export const getProducts = async () => {
  // 1. Fetch active products, recipes, ingredients, category settings, and size overrides concurrently
  const [
    { data: products, error: prodError },
    { data: recipes, error: recError },
    { data: ingredients, error: ingError },
    { data: categorySettings, error: catError },
    recipeOverridesMap
  ] = await Promise.all([
    supabase.from("products").select("*").eq("is_archived", false),
    supabase.from("recipes").select("*"),
    supabase.from("ingredients").select("*"),
    supabase.from("category_settings").select("category, sizes"),
    recipesService.getRecipeSizeOverridesMap()
  ]);

  if (prodError) throw prodError;
  if (recError) throw recError;
  if (ingError) throw ingError;
  if (catError) throw catError;

  const categorySizesMap = new Map();
  (categorySettings || []).forEach((row) => {
    const key = normalizeCategoryKey(row.category);
    if (key && Array.isArray(row.sizes) && row.sizes.length > 0) {
      categorySizesMap.set(key, row.sizes);
    }
  });

  const enrichedRecipes = attachOverridesToRecipes(recipes || [], recipeOverridesMap);
  const enrichedIngredients = await batchService.enrichIngredientsWithBatches(ingredients || []);
  const catalog = buildCatalogMaps(products || [], enrichedRecipes, enrichedIngredients, categorySizesMap);

  return catalog.map((product) => {
    const ownSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const resolvedSizes =
      ownSizes.length > 0
        ? ownSizes
        : (categorySizesMap.get(normalizeCategoryKey(product.category)) || []);

    return {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      description: product.description ?? null,
      image_url: product.image_url ?? null,
      sizes: resolvedSizes,
      add_ons: Array.isArray(product.add_ons) ? product.add_ons : [],
      track_stock: Boolean(product.track_stock),
      is_available: Boolean(product.is_available),
      is_out_of_stock:
        product.is_out_of_stock !== undefined
          ? Boolean(product.is_out_of_stock)
          : !product.is_available
    };
  });
};

export const getPosCatalog = async () => {
  const [
    { data: products, error: prodError },
    { data: recipes, error: recError },
    { data: ingredients, error: ingError },
    recipeOverridesMap
  ] = await Promise.all([
    supabase.from("products").select("*").eq("is_archived", false),
    supabase.from("recipes").select("id, product_id, ingredient_id, quantity_used, recipe_unit"),
    supabase.from("ingredients").select("id, name, category, unit, stock_quantity, low_stock_alert, max_stock, is_archived, created_at"),
    recipesService.getRecipeSizeOverridesMap()
  ]);

  if (prodError) throw prodError;
  if (recError) throw recError;
  if (ingError) throw ingError;

  const enrichedRecipes = attachOverridesToRecipes(recipes || [], recipeOverridesMap);
  const enrichedIngredients = await batchService.enrichIngredientsWithBatches(ingredients || []);
  const productsWithAvailability = buildCatalogMaps(products || [], enrichedRecipes, enrichedIngredients);

  return {
    products: productsWithAvailability,
    recipes: enrichedRecipes,
    ingredients: enrichedIngredients
  };
};

const generateReceiptNumber = () => {
  const date = new Date();
  const datePart = getManilaDateString(date).replace(/-/g, '');
  const timestamp = date.getTime().toString().slice(-6);
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `RCP-${datePart}-${timestamp}${rand}`;
};

const SUGAR_SCALE_MAP = { "0%": 0, "25%": 0.25, "50%": 0.5, "75%": 0.75, "100%": 1 };
let hasNativeSalesOrderTypeCol = null;
let hasNativeSaleItemsModifiersCol = null;

const isMissingOptionalColError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column/i.test(msg)
  );
};

export const normalizeOrderType = (rawType) => {
  const cleaned = String(rawType || "DINE_IN").trim().toUpperCase().replace(/-/g, "_");
  return ["DINE_IN", "TAKE_OUT", "DELIVERY"].includes(cleaned) ? cleaned : "DINE_IN";
};

export const getSugarScaleMultiplier = (modifiers, ingredient) => {
  const rawSugar = modifiers?.sugar_level;
  if (rawSugar === undefined || rawSugar === null || String(rawSugar).trim() === "") {
    return 1;
  }
  const isSweetener =
    /SUGAR|FRUCTOSE|SWEETENER/i.test(ingredient?.name || "") ||
    String(ingredient?.category || "").trim().toUpperCase() === "SWEETENERS & SYRUPS";
  if (!isSweetener) return 1;

  const key = String(rawSugar).trim();
  if (SUGAR_SCALE_MAP[key] !== undefined) return SUGAR_SCALE_MAP[key];
  const pct = parseFloat(key);
  return Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : 1;
};

export const resolvePackagingIngredientIds = (cupSizeObj, orderType = "DINE_IN") => {
  if (!cupSizeObj) return [];
  const normalizedType = normalizeOrderType(orderType);
  const items = [];
  if (normalizedType === "DINE_IN") {
    if (!cupSizeObj.dine_in_no_cup && cupSizeObj.ingredient_id) {
      items.push({ ingredient_id: cupSizeObj.ingredient_id, label: "cup" });
    }
  } else {
    if (cupSizeObj.ingredient_id) items.push({ ingredient_id: cupSizeObj.ingredient_id, label: "cup" });
    if (cupSizeObj.lid_ingredient_id) items.push({ ingredient_id: cupSizeObj.lid_ingredient_id, label: "lid" });
    if (cupSizeObj.straw_ingredient_id) items.push({ ingredient_id: cupSizeObj.straw_ingredient_id, label: "straw" });
  }
  return items;
};

export const createSale = async ({
  cart,
  total,
  total_amount,
  final_amount,
  staff_id,
  discount_amount = 0,
  tax_amount = 0,
  status = "COMPLETED",
  payment_status = "PAID",
  payment_method = "CASH",
  amount_received = 0,
  change_amount = 0,
  transaction_reference = "",
  notes = "",
  order_type = "DINE_IN",
  order_packaging_items = []
}) => {
  const receipt_number = generateReceiptNumber();
  const resolvedTotal = Number(total ?? total_amount ?? final_amount ?? 0);
  const normalizedOrderType = normalizeOrderType(order_type);
  const packagingItemsList = Array.isArray(order_packaging_items) ? order_packaging_items : [];

  // --- 1. BATCH PRE-FLIGHT INVENTORY CHECK (Single parallel DB round-trip) ---
  const productIds = [...new Set(cart.map(item => item.id).filter(Boolean))];
  const extraIngredientIds = [
    ...new Set([
      ...cart.flatMap(item => {
        const ids = [];
        if (item.cup_size_obj?.ingredient_id) ids.push(item.cup_size_obj.ingredient_id);
        if (item.cup_size_obj?.lid_ingredient_id) ids.push(item.cup_size_obj.lid_ingredient_id);
        if (item.cup_size_obj?.straw_ingredient_id) ids.push(item.cup_size_obj.straw_ingredient_id);
        if (Array.isArray(item.add_ons)) {
          item.add_ons.forEach(ao => {
            if (ao?.ingredient_id) ids.push(ao.ingredient_id);
          });
        }
        return ids;
      }),
      ...packagingItemsList.map(pkg => pkg?.ingredient_id || pkg?.id).filter(Boolean)
    ])
  ];

  const [
    { data: fetchedProducts, error: prodFetchError },
    { data: fetchedRecipes, error: recipeFetchError },
    extraIngredientsRes,
    recipeOverridesMap
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, track_stock, stock_quantity")
      .eq("is_archived", false)
      .in("id", productIds),
    supabase
      .from("recipes")
      .select("id, product_id, ingredient_id, quantity_used, recipe_unit, ingredients(id, name, category, unit, stock_quantity, created_at)")
      .in("product_id", productIds),
    extraIngredientIds.length > 0
      ? supabase
          .from("ingredients")
          .select("id, name, category, unit, stock_quantity, created_at")
          .in("id", extraIngredientIds)
      : Promise.resolve({ data: [], error: null }),
    recipesService.getRecipeSizeOverridesMap()
  ]);

  if (prodFetchError) throw prodFetchError;
  if (recipeFetchError) throw recipeFetchError;
  if (extraIngredientsRes?.error) throw extraIngredientsRes.error;

  const productMap = new Map((fetchedProducts || []).map(p => [p.id, p]));
  if (productMap.size !== productIds.length) {
    throw new Error("One or more selected products are archived or unavailable.");
  }
  const enrichedFetchedRecipes = attachOverridesToRecipes(fetchedRecipes || [], recipeOverridesMap);
  const recipesByProduct = new Map();
  enrichedFetchedRecipes.forEach(r => {
    if (!recipesByProduct.has(r.product_id)) recipesByProduct.set(r.product_id, []);
    recipesByProduct.get(r.product_id).push(r);
  });

  const rawIngredientMap = new Map();
  enrichedFetchedRecipes.forEach(r => {
    if (r.ingredients?.id) rawIngredientMap.set(r.ingredients.id, r.ingredients);
  });
  (extraIngredientsRes?.data || []).forEach(ing => {
    if (ing?.id) rawIngredientMap.set(ing.id, ing);
  });
  const enrichedIngredients = await batchService.enrichIngredientsWithBatches(Array.from(rawIngredientMap.values()));
  const ingredientMap = new Map(enrichedIngredients.map(ing => [ing.id, ing]));

  const requiredProducts = {};    // { id: { name, qty } }
  const requiredIngredients = {}; // { id: { name, qty } }
  const untrackedDirectChecks = {}; // { id: { name, qty } }
  const insufficient = [];

  for (const item of cart) {
    const product = productMap.get(item.id);
    if (!product) {
      throw new Error(`Product not found: ${item.name || item.id}`);
    }

    if (product.track_stock) {
      if (!requiredProducts[item.id]) {
        requiredProducts[item.id] = { name: product.name, qty: 0 };
      }
      requiredProducts[item.id].qty += item.qty;
    } else {
      const recipes = recipesByProduct.get(item.id) || [];
      if (recipes.length === 0) {
        if (!untrackedDirectChecks[item.id]) {
          untrackedDirectChecks[item.id] = { name: product.name, qty: 0 };
        }
        untrackedDirectChecks[item.id].qty += item.qty;
      }

      for (const recipe of recipes) {
        const ing = ingredientMap.get(recipe.ingredient_id) || recipe.ingredients;
        if (!ing) {
          insufficient.push(`${product.name} (Missing recipe ingredient)`);
          continue;
        }

        const baseQtyForSize = recipesService.resolveRecipeQuantityForSize(recipe, item.cup_size, item.cup_size_obj);
        if (baseQtyForSize <= 0) continue;

        const sugarScale = getSugarScaleMultiplier(item.modifiers, ing);
        const scaledQty = baseQtyForSize * sugarScale;
        if (scaledQty <= 0) continue;

        const deductionPerUnit = convertToBaseUnit(scaledQty, recipe.recipe_unit || ing.unit, ing.unit);
        const totalDeduction = deductionPerUnit * item.qty;

        if (!requiredIngredients[recipe.ingredient_id]) {
          requiredIngredients[recipe.ingredient_id] = { name: ing.name, qty: 0 };
        }
        requiredIngredients[recipe.ingredient_id].qty += totalDeduction;
      }

      // Order-Type Packaging Deduction (cup, lid, straw)
      if (item.cup_size_obj) {
        const pkgTargets = resolvePackagingIngredientIds(item.cup_size_obj, normalizedOrderType);
        for (const pkg of pkgTargets) {
          const ingData = ingredientMap.get(pkg.ingredient_id);
          if (!ingData) {
            insufficient.push(`${product.name} (Missing ${pkg.label} ingredient for ${item.cup_size_obj.name || item.cup_size || 'cup size'})`);
          } else {
            const totalDeduction = 1 * item.qty;
            if (!requiredIngredients[pkg.ingredient_id]) {
              requiredIngredients[pkg.ingredient_id] = { name: ingData.name, qty: 0 };
            }
            requiredIngredients[pkg.ingredient_id].qty += totalDeduction;
          }
        }
      }

      // Add-ons Deduction
      if (item.add_ons && item.add_ons.length > 0) {
        for (const addon of item.add_ons) {
          if (!addon.ingredient_id) continue;

          const perAddonQty = Math.max(0, Number(addon.quantity) || 0);
          const aoQty = Math.max(0, parseInt(addon.customer_qty ?? addon.quantity ?? 1, 10) || 0);
          if (perAddonQty * aoQty <= 0) continue;

          const ingData = ingredientMap.get(addon.ingredient_id);
          if (!ingData) {
            insufficient.push(`${addon.name || product.name} (Missing add-on ingredient)`);
            continue;
          }

          const deductionPerUnit = convertToBaseUnit(perAddonQty, addon.unit || ingData.unit, ingData.unit);
          const totalDeduction = deductionPerUnit * item.qty * aoQty;

          if (!requiredIngredients[addon.ingredient_id]) {
            requiredIngredients[addon.ingredient_id] = { name: ingData.name, qty: 0 };
          }
          requiredIngredients[addon.ingredient_id].qty += totalDeduction;
        }
      }
    }
  }

  // Order-level packaging items (e.g. take-out / delivery bags)
  if (normalizedOrderType !== "DINE_IN" && packagingItemsList.length > 0) {
    for (const pkg of packagingItemsList) {
      const pkgIngId = pkg?.ingredient_id || pkg?.id;
      const pkgQty = Math.max(0, Number(pkg?.quantity ?? 1) || 0);
      if (!pkgIngId || pkgQty <= 0) continue;
      const ingData = ingredientMap.get(pkgIngId);
      if (!ingData) {
        insufficient.push(`Order packaging (Missing ingredient ${pkgIngId})`);
      } else {
        if (!requiredIngredients[pkgIngId]) {
          requiredIngredients[pkgIngId] = { name: ingData.name, qty: 0 };
        }
        requiredIngredients[pkgIngId].qty += pkgQty;
      }
    }
  }

  // Verify against fetched DB stock
  const pIds = Object.keys(requiredProducts);
  for (const pid of pIds) {
    const prod = productMap.get(pid);
    const currentStock = parseFloat(prod?.stock_quantity || 0);
    const req = requiredProducts[pid].qty;
    if (currentStock + STOCK_EPSILON < req) {
      insufficient.push(`${requiredProducts[pid].name} (Requires ${req}, Has ${currentStock})`);
    } else {
      requiredProducts[pid].newStock = roundStock(currentStock - req);
    }
  }

  for (const pid of Object.keys(untrackedDirectChecks)) {
    const prod = productMap.get(pid);
    const currentStock = parseFloat(prod?.stock_quantity || 0);
    const req = untrackedDirectChecks[pid].qty;
    if (currentStock + STOCK_EPSILON < req) {
      insufficient.push(`${untrackedDirectChecks[pid].name} (Requires ${req}, Has ${currentStock})`);
    }
  }

  const iIds = Object.keys(requiredIngredients);
  for (const iid of iIds) {
    const ing = ingredientMap.get(iid);
    const usableStock = parseFloat(ing?.usable_stock ?? ing?.stock_quantity ?? 0);
    const expiredStock = parseFloat(ing?.expired_stock ?? 0);
    const req = requiredIngredients[iid].qty;
    if (usableStock + STOCK_EPSILON < req) {
      const expiredNote = expiredStock > 0 ? ` (${expiredStock.toFixed(2)} expired excluded)` : '';
      insufficient.push(`${requiredIngredients[iid].name} (Requires ${req.toFixed(2)}, Usable ${usableStock.toFixed(2)}${expiredNote})`);
    }
  }

  // IF THERE IS ANY INSUFFICIENT STOCK, ABORT SALE
  if (insufficient.length > 0) {
    const stockErr = new Error(`Insufficient stock for: ${insufficient.join(', ')}`);
    stockErr.status = 409;
    throw stockErr;
  }

  // --- 2. ATOMIC EXECUTION (Single Database Transaction) ---
  const parsedReceived = (amount_received !== undefined && amount_received !== null && amount_received !== '')
    ? Number(amount_received)
    : resolvedTotal;
  const resolvedReceived = Number.isFinite(parsedReceived) ? parsedReceived : resolvedTotal;

  const orderTypeTag = `[${normalizedOrderType.replace(/_/g, "-")}]`;
  const cleanSaleNotes = String(notes || "").trim();
  const formattedSaleNotes = cleanSaleNotes
    ? (cleanSaleNotes.includes(orderTypeTag) ? cleanSaleNotes : `${orderTypeTag} ${cleanSaleNotes}`)
    : orderTypeTag;

  const baseSaleData = {
    total_amount: resolvedTotal,
    payment_method,
    staff_id,
    receipt_number,
    discount_amount,
    tax_amount,
    status,
    payment_status,
    amount_received: resolvedReceived,
    change_amount,
    transaction_reference,
    notes: formattedSaleNotes
  };

  const baseSaleItems = cart.map(item => {
    const modParts = [];
    if (item.modifiers?.sugar_level) modParts.push(`Sugar: ${item.modifiers.sugar_level}`);
    if (item.modifiers?.ice_level) modParts.push(String(item.modifiers.ice_level).trim());
    if (item.modifiers?.note) modParts.push(String(item.modifiers.note).trim());
    const modStr = modParts.join(", ");
    const rawItemNote = String(item.notes || "").trim();
    const combinedNotes = [modStr, rawItemNote].filter(Boolean).join(" | ");

    return {
      product_id: item.id,
      quantity: item.qty,
      unit_price: item.price,
      cup_size: item.cup_size || null,
      add_ons: Array.isArray(item.add_ons)
        ? item.add_ons.map(ao => typeof ao === 'string' ? ao : JSON.stringify(ao))
        : [],
      discount_percent: item.discount_percent || 0,
      notes: combinedNotes,
      ...(item.modifiers ? { _modifiers: item.modifiers } : {})
    };
  });

  let sale = null;
  let createdSaleId = null;
  const appliedProductDeductions = [];
  const appliedIngredientDeductions = [];

  try {
    // 2a. Insert Sale Record (attempt optional native order_type column, fallback safely)
    if (hasNativeSalesOrderTypeCol !== false) {
      const resWithOrderType = await supabase
        .from("sales")
        .insert([{ ...baseSaleData, order_type: normalizedOrderType }])
        .select()
        .single();
      if (resWithOrderType.error && isMissingOptionalColError(resWithOrderType.error)) {
        hasNativeSalesOrderTypeCol = false;
        const fallbackSaleRes = await supabase.from("sales").insert([baseSaleData]).select().single();
        if (fallbackSaleRes.error) throw fallbackSaleRes.error;
        sale = fallbackSaleRes.data;
      } else if (resWithOrderType.error) {
        throw resWithOrderType.error;
      } else {
        hasNativeSalesOrderTypeCol = true;
        sale = resWithOrderType.data;
      }
    } else {
      const res = await supabase.from("sales").insert([baseSaleData]).select().single();
      if (res.error) throw res.error;
      sale = res.data;
    }

    if (!sale.order_type) {
      sale.order_type = normalizedOrderType;
    }
    createdSaleId = sale.id;

    // 2b + 2c + 2d. Insert Sale Items and deduct Product/Ingredient Stocks concurrently
    const insertSaleItems = async () => {
      const stripModifiers = baseSaleItems.map(({ _modifiers, ...rest }) => ({
        ...rest,
        sale_id: createdSaleId
      }));

      if (hasNativeSaleItemsModifiersCol !== false) {
        const withModifiers = baseSaleItems.map(({ _modifiers, ...rest }) => ({
          ...rest,
          sale_id: createdSaleId,
          modifiers: _modifiers || null
        }));
        const res = await supabase.from("sale_items").insert(withModifiers);
        if (res.error && isMissingOptionalColError(res.error)) {
          hasNativeSaleItemsModifiersCol = false;
          const fallback = await supabase.from("sale_items").insert(stripModifiers);
          if (fallback.error) throw fallback.error;
          return;
        }
        if (res.error) throw res.error;
        hasNativeSaleItemsModifiersCol = true;
        return;
      }

      const fallback = await supabase.from("sale_items").insert(stripModifiers);
      if (fallback.error) throw fallback.error;
    };

    const parallelOps = [
      insertSaleItems(),
      ...pIds.map(async (pid) => {
        const pData = requiredProducts[pid];
        const { error: prodUpdateError } = await supabase
          .from("products")
          .update({ stock_quantity: pData.newStock })
          .eq("id", pid);

        if (prodUpdateError) throw prodUpdateError;
        appliedProductDeductions.push({ pid, restoreStock: pData.newStock + pData.qty });
      }),
      ...iIds.map(async (iid) => {
        const iData = requiredIngredients[iid];
        const fefoResult = await batchService.deductStockFEFO(iid, iData.qty, { allowExpired: false });
        iData.newStock = fefoResult.newTotalStock;
        iData.deductedBatches = fefoResult.deductedBatches;
        appliedIngredientDeductions.push({
          iid,
          deductedBatches: fefoResult.deductedBatches,
          restoreStock: fefoResult.newTotalStock + iData.qty
        });
      })
    ];

    await Promise.all(parallelOps);
  } catch (atomicError) {
    // ROLLBACK COMPENSATION: Undo all partial operations concurrently
    console.error('[POS Transaction Rollback] An error occurred during checkout, rolling back:', atomicError);

    if (createdSaleId) {
      await supabase.from("sale_items").delete().eq("sale_id", createdSaleId);
    }

    await Promise.allSettled([
      ...appliedProductDeductions.map((item) =>
        supabase.from("products").update({ stock_quantity: item.restoreStock }).eq("id", item.pid)
      ),
      ...appliedIngredientDeductions.map((item) =>
        batchService.restoreDeductedBatches(item.iid, item.deductedBatches)
      ),
      ...(createdSaleId
        ? [supabase.from("sales").delete().eq("id", createdSaleId)]
        : [])
    ]);

    const abortErr = new Error(`Transaction aborted: ${atomicError.message}`, { cause: atomicError });
    if (atomicError?.status) abortErr.status = atomicError.status;
    throw abortErr;
  }

  // --- 3. NON-BLOCKING BATCH AUDIT LOGGING (Post-commit) ---
  const auditEntries = [
    ...pIds.map((pid) => {
      const pData = requiredProducts[pid];
      return ['PRODUCT_DEDUCTED', staff_id, {
        product_id: pid,
        name: pData.name,
        quantity: -pData.qty,
        new_stock: pData.newStock,
        sale_id: sale.id,
        type: 'SALE'
      }];
    }),
    ...iIds.map((iid) => {
      const iData = requiredIngredients[iid];
      return ['INGREDIENT_DEDUCTED', staff_id, {
        ingredient_id: iid,
        name: iData.name,
        quantity: -iData.qty,
        new_stock: iData.newStock,
        deducted_batches: iData.deductedBatches || [],
        sale_id: sale.id,
        type: 'SALE'
      }];
    }),
    {
      action: "SALE",
      entity_type: "SALE",
      entity_id: sale.id,
      user_id: staff_id,
      details: `Completed ${normalizedOrderType} sale of ${cart.length} items for ₱${resolvedTotal}. Inventory deducted atomically.`,
      new_value: { sale_id: sale.id, order_type: normalizedOrderType, items: cart.length, total: resolvedTotal }
    }
  ];

  void logAuditBatch(auditEntries).catch((err) => {
    console.error('[AUDIT] Async batch log failed:', err.message);
  });

  invalidateAnalyticsCache();

  return sale;
};