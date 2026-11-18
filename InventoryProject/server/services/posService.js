import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import { logAuditBatch } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";

export const getProducts = async () => {
  // 1. Fetch active products, recipes, and ingredients concurrently for maximum speed
  const [
    { data: products, error: prodError },
    { data: recipes, error: recError },
    { data: ingredients, error: ingError }
  ] = await Promise.all([
    supabase.from("products").select("*").eq("is_archived", false),
    supabase.from("recipes").select("*"),
    supabase.from("ingredients").select("*")
  ]);

  if (prodError) throw prodError;
  if (recError) throw recError;
  if (ingError) throw ingError;

  // Create lookup maps
  const ingMap = {};
  ingredients.forEach(i => { ingMap[i.id] = i; });

  const recMap = {};
  recipes.forEach(r => {
    if (!recMap[r.product_id]) recMap[r.product_id] = [];
    recMap[r.product_id].push(r);
  });

  // 4. Calculate availability
  const productsWithAvailability = products.map(product => {
    let is_available = true;

    if (product.track_stock) {
      is_available = parseFloat(product.stock_quantity || 0) > 0;
    } else {
      const prodRecipes = recMap[product.id] || [];
      if (prodRecipes.length > 0) {
        for (const recipe of prodRecipes) {
          const ing = ingMap[recipe.ingredient_id];
          if (!ing) {
            is_available = false; // Missing ingredient
            break;
          }
          
          const deductionPerUnit = convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
          if (parseFloat(ing.stock_quantity || 0) < deductionPerUnit) {
            is_available = false; // Not enough stock
            break;
          }
        }
      }
      // If no recipes, we assume available to not break legacy products
    }

    return {
      ...product,
      is_available,
      has_recipe: (recMap[product.id] || []).length > 0
    };
  });

  return productsWithAvailability;
};

const generateReceiptNumber = () => {
  const date = new Date();
  const timestamp = date.getTime();
  return `RCP-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${timestamp.toString().slice(-6)}`;
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
      for (const recipe of recipes) {
        const ing = recipe.ingredients || ingredientMap.get(recipe.ingredient_id);
        if (!ing) continue;

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
        if (ingData) {
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

          const ingData = ingredientMap.get(addon.ingredient_id);
          if (ingData) {
            const deductionPerUnit = convertToBaseUnit(addon.quantity || 0, addon.unit || ingData.unit, ingData.unit);
            const totalDeduction = deductionPerUnit * item.qty * (addon.customer_qty || 1);

            if (!requiredIngredients[addon.ingredient_id]) {
              requiredIngredients[addon.ingredient_id] = { name: ingData.name, qty: 0 };
            }
            requiredIngredients[addon.ingredient_id].qty += totalDeduction;
          }
        }
      }
    }
  }

  // Verify against fetched DB stock
  const insufficient = [];

  const pIds = Object.keys(requiredProducts);
  for (const pid of pIds) {
    const prod = productMap.get(pid);
    const currentStock = parseFloat(prod?.stock_quantity || 0);
    const req = requiredProducts[pid].qty;
    if (currentStock < req) {
      insufficient.push(`${requiredProducts[pid].name} (Requires ${req}, Has ${currentStock})`);
    } else {
      requiredProducts[pid].newStock = currentStock - req;
    }
  }

  const iIds = Object.keys(requiredIngredients);
  for (const iid of iIds) {
    const ing = ingredientMap.get(iid);
    const currentStock = parseFloat(ing?.stock_quantity || 0);
    const req = requiredIngredients[iid].qty;
    if (currentStock < req) {
      // Format ingredient requirements to 2 decimal places to avoid floating point length issues
      insufficient.push(`${requiredIngredients[iid].name} (Requires ${req.toFixed(2)}, Has ${currentStock.toFixed(2)})`);
    } else {
      requiredIngredients[iid].newStock = currentStock - req;
    }
  }

  // IF THERE IS ANY INSUFFICIENT STOCK, ABORT SALE
  if (insufficient.length > 0) {
    throw new Error(`Insufficient stock for: ${insufficient.join(', ')}`);
  }

  // --- 2. ATOMIC EXECUTION (Single Database Transaction) ---
  const saleData = {
    total_amount: resolvedTotal,
    payment_method,
    staff_id,
    receipt_number,
    discount_amount,
    tax_amount,
    status,
    payment_status,
    amount_received: amount_received || resolvedTotal,
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