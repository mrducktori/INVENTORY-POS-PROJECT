import { supabase } from "../../db.js";

export const getProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_archived", false);

  if (error) throw error;
  return data;
};

export const createSale = async ({ cart, total, staff_id }) => {
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert([{ total_amount: total, payment_method: "CASH", staff_id }])
    .select()
    .single();

  if (saleError) throw saleError;

  const saleItems = cart.map(item => ({
    sale_id: sale.id,
    product_id: item.id,
    quantity: item.qty,
    unit_price: item.price
  }));

  const { error: itemError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemError) throw itemError;

  return sale;
};