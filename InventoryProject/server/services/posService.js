import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import { logAuditBatch } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";
import { getManilaDateString } from "../utils/dateUtils.js";

const STOCK_EPSILON = 1e-9;

const roundStock = (value) => Math.max(0, Math.round(value * 1e6) / 1e6);

export const computeProductAvailability = (product, prodRecipes = [], ingMap = {}) => {
  const has_recipe = Array.isArray(prodRecipes) && prodRecipes.length > 0;

  if (product?.track_stock || !has_recipe) {
    const max_orderable = Math.max(0, Math.floor((parseFloat(product?.stock_quantity) || 0) + STOCK_EPSILON));
    return {
      is_available: max_orderable > 0,
      has_recipe,
      max_orderable
    };
  }

  let minOrderable = Infinity;
  for (const recipe of prodRecipes) {
    const ing = ingMap[recipe.ingredient_id];
    if (!ing) {
      return { is_available: false, has_recipe: true, max_orderable: 0 };
    }

    const deductionPerUnit = convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
    if (deductionPerUnit > 0) {
      const possible = Math.max(0, Math.floor(((parseFloat(ing.stock_quantity) || 0) + STOCK_EPSILON) / deductionPerUnit));
      minOrderable = Math.min(minOrderable, possible);
    }
  }

  const max_orderable = Number.isFinite(minOrderable) ? minOrderable : 0;
  return {
    is_available: max_orderable > 0,
    has_recipe: true,
    max_orderable
  };
};

const buildCatalogMaps = (products = [], recipes = [], ingredients = []) => {
  const ingMap = {};
  ingredients.forEach(i => { ingMap[i.id] = i; });

  const recMap = {};
  recipes.forEach(r => {
    if (!recMap[r.product_id]) recMap[r.product_id] = [];
    recMap[r.product_id].push(r);
  });

  const productsWithAvailability = products.map(product => {
    const availability = computeProductAvailability(product, recMap[product.id] || [], ingMap);
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
  // 1. Fetch active products, recipes, ingredients, and category settings concurrently for maximum speed
  const [
    { data: products, error: prodError },
    { data: recipes, error: recError },
    { data: ingredients, error: ingError },
    { data: categorySettings, error: catError }
  ] = await Promise.all([
    supabase.from("products").select("*").eq("is_archived", false),
    supabase.from("recipes").select("*"),
    supabase.from("ingredients").select("*"),
    supabase.from("category_settings").select("category, sizes")
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

  const catalog = buildCatalogMaps(products || [], recipes || [], ingredients || []);

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
    { data: ingredients, error: ingError }
  ] = await Promise.all([
    supabase.from("products").select("*").eq("is_archived", false),
    supabase.from("recipes").select("id, product_id, ingredient_id, quantity_used, recipe_unit"),
    supabase.from("ingredients").select("id, name, unit, stock_quantity, low_stock_alert, max_stock, is_archived")
  ]);

  if (prodError) throw prodError;
  if (recError) throw recError;
  if (ingError) throw ingError;

  const productsWithAvailability = buildCatalogMaps(products || [], recipes || [], ingredients || []);

  return {
    products: productsWithAvailability,
    recipes: recipes || [],
    ingredients: ingredients || []
  };
};

const generateReceiptNumber = () => {
  const date = new Date();
  const datePart = getManilaDateString(date).replace(/-/g, '');
  const timestamp = date.getTime().toString().slice(-6);
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `RCP-${datePart}-${timestamp}${rand}`;
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
  notes = "" 
}) => {
  const receipt_number = generateReceiptNumber();
  const resolvedTotal = Number(total ?? total_amount ?? final_amount ?? 0);

  // --- 1. BATCH PRE-FLIGHT INVENTORY CHECK (Single parallel DB round-trip) ---
  const productIds = [...new Set(cart.map(item => item.id).filter(Boolean))];
  const extraIngredientIds = [
    ...new Set(
      cart.flatMap(item => {
        const ids = [];
        if (item.cup_size_obj?.ingredient_id) ids.push(item.cup_size_obj.ingredient_id);
        if (Array.isArray(item.add_ons)) {
          item.add_ons.forEach(ao => {
            if (ao?.ingredient_id) ids.push(ao.ingredient_id);
          });
        }
        return ids;
      })
    )
  ];

  const [
    { data: fetchedProducts, error: prodFetchError },
    { data: fetchedRecipes, error: recipeFetchError },
    extraIngredientsRes
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, track_stock, stock_quantity")
      .eq("is_archived", false)
      .in("id", productIds),
    supabase
      .from("recipes")
      .select("product_id, ingredient_id, quantity_used, recipe_unit, ingredients(id, name, unit, stock_quantity)")
      .in("product_id", productIds),
    extraIngredientIds.length > 0
      ? supabase
          .from("ingredients")
          .select("id, name, unit, stock_quantity")
          .in("id", extraIngredientIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (prodFetchError) throw prodFetchError;
  if (recipeFetchError) throw recipeFetchError;
  if (extraIngredientsRes?.error) throw extraIngredientsRes.error;

  const productMap = new Map((fetchedProducts || []).map(p => [p.id, p]));
  if (productMap.size !== productIds.length) {
    throw new Error("One or more selected products are archived or unavailable.");
  }
  const recipesByProduct = new Map();
  (fetchedRecipes || []).forEach(r => {
    if (!recipesByProduct.has(r.product_id)) recipesByProduct.set(r.product_id, []);
    recipesByProduct.get(r.product_id).push(r);
  });

  const ingredientMap = new Map();
  (fetchedRecipes || []).forEach(r => {
    if (r.ingredients?.id) ingredientMap.set(r.ingredients.id, r.ingredients);
  });
  (extraIngredientsRes?.data || []).forEach(ing => {
    if (ing?.id) ingredientMap.set(ing.id, ing);
  });

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
        const ing = recipe.ingredients || ingredientMap.get(recipe.ingredient_id);
        if (!ing) {
          insufficient.push(`${product.name} (Missing recipe ingredient)`);
          continue;
        }

        const deductionPerUnit = convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
        const totalDeduction = deductionPerUnit * item.qty;

        if (!requiredIngredients[recipe.ingredient_id]) {
          requiredIngredients[recipe.ingredient_id] = { name: ing.name, qty: 0 };
        }
        requiredIngredients[recipe.ingredient_id].qty += totalDeduction;
      }

      // Cup Size Deduction
      if (item.cup_size_obj && item.cup_size_obj.ingredient_id) {
        const ingData = ingredientMap.get(item.cup_size_obj.ingredient_id);
        if (!ingData) {
          insufficient.push(`${product.name} (Missing cup ingredient for ${item.cup_size_obj.name || item.cup_size || 'cup size'})`);
        } else {
          const totalDeduction = 1 * item.qty;
          if (!requiredIngredients[item.cup_size_obj.ingredient_id]) {
            requiredIngredients[item.cup_size_obj.ingredient_id] = { name: ingData.name, qty: 0 };
          }
          requiredIngredients[item.cup_size_obj.ingredient_id].qty += totalDeduction;
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
    const currentStock = parseFloat(ing?.stock_quantity || 0);
    const req = requiredIngredients[iid].qty;
    if (currentStock + STOCK_EPSILON < req) {
      // Format ingredient requirements to 2 decimal places to avoid floating point length issues
      insufficient.push(`${requiredIngredients[iid].name} (Requires ${req.toFixed(2)}, Has ${currentStock.toFixed(2)})`);
    } else {
      requiredIngredients[iid].newStock = roundStock(currentStock - req);
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

  const saleData = {
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
    notes
  };

  const saleItems = cart.map(item => ({
    product_id: item.id,
    quantity: item.qty,
    unit_price: item.price,
    cup_size: item.cup_size || null,
    add_ons: Array.isArray(item.add_ons)
      ? item.add_ons.map(ao => typeof ao === 'string' ? ao : JSON.stringify(ao))
      : [],
    discount_percent: item.discount_percent || 0,
    notes: item.notes || ""
  }));

  let sale = null;
  let createdSaleId = null;
  const appliedProductDeductions = [];
  const appliedIngredientDeductions = [];

  try {
    // 2a. Insert Sale Record
    const { data: insertedSale, error: saleError } = await supabase
      .from("sales")
      .insert([saleData])
      .select()
      .single();

    if (saleError) throw saleError;
    sale = insertedSale;
    createdSaleId = sale.id;

    // 2b + 2c + 2d. Insert Sale Items and deduct Product/Ingredient Stocks concurrently
    const itemsToInsert = saleItems.map(item => ({
      ...item,
      sale_id: createdSaleId
    }));

    const parallelOps = [
      supabase.from("sale_items").insert(itemsToInsert).then(({ error }) => {
        if (error) throw error;
      }),
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
        const { error: ingUpdateError } = await supabase
          .from("ingredients")
          .update({ stock_quantity: iData.newStock })
          .eq("id", iid);

        if (ingUpdateError) throw ingUpdateError;
        appliedIngredientDeductions.push({ iid, restoreStock: iData.newStock + iData.qty });
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
        supabase.from("ingredients").update({ stock_quantity: item.restoreStock }).eq("id", item.iid)
      ),
      ...(createdSaleId
        ? [supabase.from("sales").delete().eq("id", createdSaleId)]
        : [])
    ]);

    throw new Error(`Transaction aborted: ${atomicError.message}`, { cause: atomicError });
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
        sale_id: sale.id,
        type: 'SALE'
      }];
    }),
    {
      action: "SALE",
      entity_type: "SALE",
      entity_id: sale.id,
      user_id: staff_id,
      details: `Completed sale of ${cart.length} items for ₱${resolvedTotal}. Inventory deducted atomically.`,
      new_value: { sale_id: sale.id, items: cart.length, total: resolvedTotal }
    }
  ];

  void logAuditBatch(auditEntries).catch((err) => {
    console.error('[AUDIT] Async batch log failed:', err.message);
  });

  invalidateAnalyticsCache();

  return sale;
};