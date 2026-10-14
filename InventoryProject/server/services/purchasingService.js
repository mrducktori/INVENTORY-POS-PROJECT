import { supabase } from "../config/supabaseClient.js";

// === Suppliers ===
export const getSuppliers = async () => {
  const { data, error } = await supabase
    .from("suppliers")
    .select(`
      *,
      supplier_ingredients (
        ingredient_id,
        default_purchase_unit,
        default_conversion_factor,
        default_price,
        ingredients ( name, unit )
      )
    `)
    .order("name");

  if (error) throw error;
  return data;
};

export const createSupplier = async (supplierData) => {
  const { ingredient_ids, ...details } = supplierData;
  
  const { data, error } = await supabase
    .from("suppliers")
    .insert([details])
    .select()
    .single();

  if (error) throw error;

  if (ingredient_ids && ingredient_ids.length > 0) {
    const mappings = ingredient_ids.map(id => ({
      supplier_id: data.id,
      ingredient_id: id
    }));
    
    const { error: mappingError } = await supabase
      .from("supplier_ingredients")
      .insert(mappings);
      
    if (mappingError) throw mappingError;
  }

  return data;
};

export const updateSupplier = async (id, supplierData) => {
  const { ingredient_ids, ...details } = supplierData;
  
  const { data, error } = await supabase
    .from("suppliers")
    .update(details)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Delete existing mappings
  await supabase
    .from("supplier_ingredients")
    .delete()
    .eq("supplier_id", id);

  if (ingredient_ids && ingredient_ids.length > 0) {
    const mappings = ingredient_ids.map(ingId => ({
      supplier_id: id,
      ingredient_id: ingId
    }));
    
    const { error: mappingError } = await supabase
      .from("supplier_ingredients")
      .insert(mappings);
      
    if (mappingError) throw mappingError;
  }

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
        ingredient_id,
        quantity,
        quantity_received,
        is_received,
        unit_price,
        subtotal,
        purchase_unit,
        conversion_factor,
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
    subtotal: item.quantity * item.unit_price,
    purchase_unit: item.purchase_unit || 'Unit',
    conversion_factor: item.conversion_factor || 1
  }));

  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  return po;
};

export const updatePurchaseOrderStatus = async (id, status, items_received = []) => {
  const updates = { status };
  if (status === 'Received' || status === 'Partial') {
    updates.received_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // If items_received is provided, update those items and inventory stock
  if (items_received && items_received.length > 0) {
    for (const item of items_received) {
      // Fetch current item to properly add quantities
      const { data: currentItem } = await supabase
        .from("purchase_order_items")
        .select("quantity_received, quantity")
        .eq("id", item.id)
        .single();
        
      if (!currentItem) continue;

      const newQtyReceived = Number(currentItem.quantity_received || 0) + Number(item.quantity_received_now);
      const isFullyReceived = newQtyReceived >= currentItem.quantity;

      // 1. Update purchase_order_items
      await supabase
        .from("purchase_order_items")
        .update({ 
          quantity_received: newQtyReceived,
          is_received: isFullyReceived
        })
        .eq("id", item.id);
        
      // 2. Update stock
      if (item.ingredient_id && item.quantity_received_now > 0) {
        const { data: ingData } = await supabase
          .from("ingredients")
          .select("stock_quantity")
          .eq("id", item.ingredient_id)
          .single();
          
        if (ingData) {
          const conversion = Number(item.conversion_factor || 1);
          const baseUnitsReceived = Number(item.quantity_received_now) * conversion;
          const newStock = Number(ingData.stock_quantity || 0) + baseUnitsReceived;
          
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
