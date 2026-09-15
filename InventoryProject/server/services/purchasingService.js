import { supabase } from "../config/supabaseClient.js";

// === Suppliers ===
export const getSuppliers = async () => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
};

export const createSupplier = async (supplierData) => {
  const { data, error } = await supabase
    .from("suppliers")
    .insert([supplierData])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// === Purchase Orders ===
export const getPurchaseOrders = async () => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      suppliers ( name ),
      purchase_order_items (
        id,
        quantity,
        unit_price,
        subtotal,
        ingredients ( name, unit )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const createPurchaseOrder = async (poData) => {
  // poData should look like: { supplier_id, expected_date, items: [{ ingredient_id, quantity, unit_price }] }
  const { items, ...poDetails } = poData;

  // Calculate total amount
  const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  
  // 1. Insert PO
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert([{ ...poDetails, total_amount, status: 'Pending' }])
    .select()
    .single();

  if (poError) throw poError;

  // 2. Insert items
  const itemsToInsert = items.map(item => ({
    purchase_order_id: po.id,
    ingredient_id: item.ingredient_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.quantity * item.unit_price
  }));

  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  return po;
};

export const updatePurchaseOrderStatus = async (id, status) => {
  const updates = { status };
  if (status === 'Received') {
    updates.received_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // If received, we should also update inventory stock
  if (status === 'Received') {
    // 1. Get the items
    const { data: items, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", id);
      
    if (itemsError) throw itemsError;

    // 2. For each item, update stock
    for (const item of items) {
      if (item.ingredient_id) {
        // We fetch current stock and add
        const { data: ingData } = await supabase
          .from("ingredients")
          .select("stock_quantity")
          .eq("id", item.ingredient_id)
          .single();
          
        if (ingData) {
          const newStock = Number(ingData.stock_quantity || 0) + Number(item.quantity);
          await supabase
            .from("ingredients")
            .update({ stock_quantity: newStock })
            .eq("id", item.ingredient_id);
        }
      }
    }
  }

  return data;
};
