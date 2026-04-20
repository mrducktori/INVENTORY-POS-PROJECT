import { supabase } from "../config/supabaseClient.js";

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

export const createSale = async ({ cart, total, staff_id, discount_amount = 0, tax_amount = 0, status = "COMPLETED", payment_status = "PAID", payment_method = "CASH", notes = "" }) => {
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
    discount_percent: item.discount_percent || 0,
    notes: item.notes || ""
  }));

  const { error: itemError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemError) throw itemError;

  // 3. Deduct Ingredients based on Recipes
  for (const item of cart) {
    // Get recipe for this product
    const { data: recipes, error: recipeError } = await supabase
      .from("recipes")
      .select("ingredient_id, quantity_used")
      .eq("product_id", item.id);

    if (recipeError) {
      console.error(`Error fetching recipe for product ${item.id}:`, recipeError);
      continue;
    }

    if (recipes && recipes.length > 0) {
      for (const recipe of recipes) {
        const totalDeduction = recipe.quantity_used * item.qty;
        
        // Update ingredient stock
        // Note: In a production environment, this should ideally be an atomic decrement in Postgres
        // via an RPC or a database trigger to avoid race conditions.
        const { data: ingredient, error: fetchError } = await supabase
          .from("ingredients")
          .select("stock_quantity")
          .eq("id", recipe.ingredient_id)
          .single();

        if (fetchError) {
          console.error(`Error fetching ingredient ${recipe.ingredient_id}:`, fetchError);
          continue;
        }

        const newStock = ingredient.stock_quantity - totalDeduction;

        const { error: updateError } = await supabase
          .from("ingredients")
          .update({ stock_quantity: newStock })
          .eq("id", recipe.ingredient_id);

        if (updateError) {
          console.error(`Error updating stock for ingredient ${recipe.ingredient_id}:`, updateError);
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