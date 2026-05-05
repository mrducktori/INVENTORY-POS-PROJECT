import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import { logAudit } from "../utils/auditHelper.js";

export const getProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_archived", false);

  if (error) throw error;
  return data;
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

  // 1. Create the Sale record
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

  // 2. Insert Sale Items
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

  // 3. Deduct Stock (Direct Product Stock OR Recipe-based Ingredients)
  for (const item of cart) {
    const { data: product, error: prodFetchError } = await supabase
      .from("products")
      .select("track_stock, stock_quantity, name")
      .eq("id", item.id)
      .single();

    if (prodFetchError) continue;

    if (product.track_stock) {
      // MODE A: Direct Product Stock Deduction (e.g., Pastries)
      const newProductStock = parseFloat(product.stock_quantity) - item.qty;
      
      const { error: prodUpdateError } = await supabase
        .from("products")
        .update({ stock_quantity: newProductStock })
        .eq("id", item.id);

      if (!prodUpdateError) {
        // Log product stock movement to audit_logs
        await logAudit('PRODUCT_DEDUCTED', staff_id, {
          product_id: item.id,
          name: product.name,
          quantity: -item.qty,
          new_stock: newProductStock,
          sale_id: sale.id,
          type: 'SALE'
        });
      }
    } else {
      // MODE B: Recipe-based Ingredient Deduction (e.g., Coffee)
      const { data: recipes, error: recipeError } = await supabase
        .from("recipes")
        .select("ingredient_id, quantity_used, recipe_unit")
        .eq("product_id", item.id);

      if (recipeError) continue;

      if (recipes && recipes.length > 0) {
        for (const recipe of recipes) {
          // Fetch ingredient stock AND unit so we can convert
          const { data: ingredient, error: fetchError } = await supabase
            .from("ingredients")
            .select("stock_quantity, unit")
            .eq("id", recipe.ingredient_id)
            .single();

          if (fetchError) continue;

          // Convert recipe quantity into the ingredient's storage unit
          const deductionPerUnit = convertToBaseUnit(
            recipe.quantity_used,
            recipe.recipe_unit || ingredient.unit, // fall back to stock unit if no recipe_unit set
            ingredient.unit
          );
          const totalDeduction = deductionPerUnit * item.qty;

          const newStock = parseFloat(ingredient.stock_quantity) - totalDeduction;

          const { error: updateError } = await supabase
            .from("ingredients")
            .update({ stock_quantity: newStock })
            .eq("id", recipe.ingredient_id);

          if (!updateError) {
            // Log ingredient movement to audit_logs
            await logAudit('INGREDIENT_DEDUCTED', staff_id, {
              ingredient_id: recipe.ingredient_id,
              name: ingredient.name,
              quantity: -totalDeduction,
              new_stock: newStock,
              sale_id: sale.id,
              product_name: product.name,
              type: 'SALE'
            });
          }
        }
      }

      // MODE C: Deduct Size Cup (if mapped)
      if (item.cup_size_obj && item.cup_size_obj.ingredient_id) {
        const { data: ingredient, error: fetchError } = await supabase
          .from("ingredients")
          .select("stock_quantity")
          .eq("id", item.cup_size_obj.ingredient_id)
          .single();

        if (!fetchError && ingredient) {
          const totalDeduction = 1 * item.qty; // 1 cup per drink
          const newStock = parseFloat(ingredient.stock_quantity) - totalDeduction;
          const { error: updateError } = await supabase.from("ingredients").update({ stock_quantity: newStock }).eq("id", item.cup_size_obj.ingredient_id);
          
          if (!updateError) {
            await logAudit('INGREDIENT_DEDUCTED', staff_id, {
              ingredient_id: item.cup_size_obj.ingredient_id,
              type: 'CUP_DEDUCTION',
              quantity: -totalDeduction,
              new_stock: newStock,
              sale_id: sale.id,
              product_name: product.name
            });
          }
        }
      }

      // MODE D: Deduct Add-ons (if mapped)
      if (item.add_ons_objs && item.add_ons_objs.length > 0) {
        for (const addon of item.add_ons_objs) {
          if (!addon.ingredient_id) continue;
          
          const { data: ingredient, error: fetchError } = await supabase
            .from("ingredients")
            .select("stock_quantity, unit")
            .eq("id", addon.ingredient_id)
            .single();

          if (fetchError) continue;

          const deductionPerUnit = convertToBaseUnit(
            addon.quantity || 0,
            addon.unit || ingredient.unit,
            ingredient.unit
          );
          const totalDeduction = deductionPerUnit * item.qty;

          const newStock = parseFloat(ingredient.stock_quantity) - totalDeduction;
          const { error: updateError } = await supabase.from("ingredients").update({ stock_quantity: newStock }).eq("id", addon.ingredient_id);

          if (!updateError) {
            await logAudit('INGREDIENT_DEDUCTED', staff_id, {
              ingredient_id: addon.ingredient_id,
              name: addon.name,
              type: 'ADDON_DEDUCTION',
              quantity: -totalDeduction,
              new_stock: newStock,
              sale_id: sale.id,
              product_name: product.name
            });
          }
        }
      }
    }
  }

  // 4. Log to audit_logs
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