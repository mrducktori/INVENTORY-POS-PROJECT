import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import { logAudit } from "../utils/auditHelper.js";

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

  // --- 1. PRE-FLIGHT INVENTORY CHECK ---
  const requiredProducts = {};    // { id: { name, qty } }
  const requiredIngredients = {}; // { id: { name, qty } }

  for (const item of cart) {
    const { data: product, error: prodFetchError } = await supabase
      .from("products")
      .select("track_stock, name")
      .eq("id", item.id)
      .single();

    if (prodFetchError || !product) {
      throw new Error(`Product not found: ${item.name || item.id}`);
    }

    if (product.track_stock) {
      if (!requiredProducts[item.id]) {
        requiredProducts[item.id] = { name: product.name, qty: 0 };
      }
      requiredProducts[item.id].qty += item.qty;
    } else {
      // Recipe Ingredients
      const { data: recipes, error: recipeError } = await supabase
        .from("recipes")
        .select("ingredient_id, quantity_used, recipe_unit, ingredients(name, unit)")
        .eq("product_id", item.id);

      if (!recipeError && recipes) {
        for (const recipe of recipes) {
          const ing = recipe.ingredients;
          if (!ing) continue;

          const deductionPerUnit = convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
          const totalDeduction = deductionPerUnit * item.qty;

          if (!requiredIngredients[recipe.ingredient_id]) {
            requiredIngredients[recipe.ingredient_id] = { name: ing.name, qty: 0 };
          }
          requiredIngredients[recipe.ingredient_id].qty += totalDeduction;
        }
      }

      // Cup Size Deduction
      if (item.cup_size_obj && item.cup_size_obj.ingredient_id) {
        const { data: ingData } = await supabase
          .from("ingredients")
          .select("name")
          .eq("id", item.cup_size_obj.ingredient_id)
          .single();

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

          const { data: ingData } = await supabase
            .from("ingredients")
            .select("name, unit")
            .eq("id", addon.ingredient_id)
            .single();

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

  // Verify against current DB stock
  const insufficient = [];

  const pIds = Object.keys(requiredProducts);
  if (pIds.length > 0) {
    const { data: prodStocks } = await supabase.from("products").select("id, stock_quantity").in("id", pIds);
    if (prodStocks) {
      for (const p of prodStocks) {
        const currentStock = parseFloat(p.stock_quantity || 0);
        const req = requiredProducts[p.id].qty;
        if (currentStock < req) {
          insufficient.push(`${requiredProducts[p.id].name} (Requires ${req}, Has ${currentStock})`);
        } else {
          requiredProducts[p.id].newStock = currentStock - req;
        }
      }
    }
  }

  const iIds = Object.keys(requiredIngredients);
  if (iIds.length > 0) {
    const { data: ingStocks } = await supabase.from("ingredients").select("id, stock_quantity").in("id", iIds);
    if (ingStocks) {
      for (const i of ingStocks) {
        const currentStock = parseFloat(i.stock_quantity || 0);
        const req = requiredIngredients[i.id].qty;
        if (currentStock < req) {
          // Format ingredient requirements to 2 decimal places to avoid floating point length issues
          insufficient.push(`${requiredIngredients[i.id].name} (Requires ${req.toFixed(2)}, Has ${currentStock.toFixed(2)})`);
        } else {
          requiredIngredients[i.id].newStock = currentStock - req;
        }
      }
    }
  }

  // IF THERE IS ANY INSUFFICIENT STOCK, ABORT SALE
  if (insufficient.length > 0) {
    throw new Error(`Insufficient stock for: ${insufficient.join(', ')}`);
  }

  // --- 2. CREATE THE SALE RECORD ---
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert([{ 
      total_amount: total, 
      payment_method, 
      staff_id,
      receipt_number,
      discount_amount,
      tax_amount,
      status,
      payment_status,
      amount_received,
      change_amount,
      transaction_reference,
      notes
    }])
    .select()
    .single();

  if (saleError) throw saleError;

  // --- 3. INSERT SALE ITEMS ---
  const saleItems = cart.map(item => ({
    sale_id: sale.id,
    product_id: item.id,
    quantity: item.qty,
    unit_price: item.price,
    cup_size: item.cup_size || null,
    add_ons: item.add_ons || [],
    discount_percent: item.discount_percent || 0,
    notes: item.notes || ""
  }));

  const { error: itemError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemError) throw itemError;

  // --- 4. APPLY STOCK DEDUCTIONS ---
  // Since we pre-validated, we can just apply the newStock amounts
  for (const pid of pIds) {
    const pData = requiredProducts[pid];
    const { error: prodUpdateError } = await supabase
      .from("products")
      .update({ stock_quantity: pData.newStock })
      .eq("id", pid);

    if (!prodUpdateError) {
      await logAudit('PRODUCT_DEDUCTED', staff_id, {
        product_id: pid,
        name: pData.name,
        quantity: -pData.qty,
        new_stock: pData.newStock,
        sale_id: sale.id,
        type: 'SALE'
      });
    }
  }

  for (const iid of iIds) {
    const iData = requiredIngredients[iid];
    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ stock_quantity: iData.newStock })
      .eq("id", iid);

    if (!updateError) {
      await logAudit('INGREDIENT_DEDUCTED', staff_id, {
        ingredient_id: iid,
        name: iData.name,
        quantity: -iData.qty,
        new_stock: iData.newStock,
        sale_id: sale.id,
        type: 'SALE'
      });
    }
  }

  // --- 5. LOG TO AUDIT ---
  await supabase.from("audit_logs").insert([{
    action: "SALE",
    action_type: "SALE",
    entity_type: "SALE",
    entity_id: sale.id,
    user_id: staff_id,
    details: `Completed sale of ${cart.length} items for ₱${total}. Inventory deducted.`,
    new_value: { sale_id: sale.id, items: cart.length, total: total }
  }]);

  return sale;
};