import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";

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

// Helper to enrich PO items with actual multi-receive batch events from audit logs
const enrichPOsWithReceiptHistory = async (pos) => {
  if (!pos || pos.length === 0) return pos;

  try {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('created_at, details')
      .eq('action', 'RAW_MATERIAL_STOCK_RECEIVED')
      .order('created_at', { ascending: true });

    if (!logs || logs.length === 0) return pos;

    const receiptMap = {}; // key: `${po_id}_${ingredient_id}` -> [ { date, quantity } ]
    for (const log of logs) {
      try {
        const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (d?.po_id && d?.ingredient_id) {
          const key = `${d.po_id}_${d.ingredient_id}`;
          if (!receiptMap[key]) receiptMap[key] = [];
          receiptMap[key].push({
            date: log.created_at,
            quantity: Number(d.purchase_qty || 1)
          });
        }
      } catch (e) {}
    }

    // Attach to items if they don't already have multi-batch receipt_history
    for (const po of pos) {
      if (po.purchase_order_items) {
        for (const item of po.purchase_order_items) {
          const key = `${po.id}_${item.ingredient_id}`;
          if (receiptMap[key] && receiptMap[key].length > 0) {
            item.receipt_history = receiptMap[key];
          }
        }
      }
    }
  } catch (err) {
    console.error('Error enriching POs with receipt history from audit logs:', err);
  }

  return pos;
};

// Helper to enrich PO items with supplier proposals & shop decisions from audit logs
const enrichPOsWithSupplierProposals = async (pos) => {
  if (!pos || pos.length === 0) return pos;

  try {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('created_at, action, details')
      .in('action', ['SUPPLIER_PO_ITEM_RESPONSE', 'SHOP_PO_PROPOSAL_RESPONSE'])
      .order('created_at', { ascending: true });

    if (!logs || logs.length === 0) return pos;

    const poItemResponses = {}; // po_id -> { item_id -> { status, proposed_date, reason, responded_at } }
    const poShopDecisions = {}; // po_id -> { item_id -> { decision, decided_at, split_into_backorder } }

    for (const log of logs) {
      try {
        const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (log.action === 'SUPPLIER_PO_ITEM_RESPONSE' && d?.po_id && Array.isArray(d.items)) {
          if (!poItemResponses[d.po_id]) poItemResponses[d.po_id] = {};
          d.items.forEach(item => {
            poItemResponses[d.po_id][item.item_id] = {
              status: item.status, // 'AVAILABLE' | 'PROPOSED_DATE' | 'UNAVAILABLE'
              proposed_date: item.proposed_date || null,
              reason: item.reason || null,
              responded_at: log.created_at
            };
          });
        } else if (log.action === 'SHOP_PO_PROPOSAL_RESPONSE' && d?.po_id && d?.item_id) {
          if (!poShopDecisions[d.po_id]) poShopDecisions[d.po_id] = {};
          poShopDecisions[d.po_id][d.item_id] = {
            decision: d.decision, // 'ACCEPTED' | 'DECLINED'
            decided_at: log.created_at,
            split_into_backorder: d.split_into_backorder
          };
        }
      } catch (e) {}
    }

    for (const po of pos) {
      const itemRespMap = poItemResponses[po.id] || {};
      const decisionMap = poShopDecisions[po.id] || {};
      let totalProposalsCount = 0;
      let pendingProposalsCount = 0;
      let unavailableCount = 0;

      if (po.purchase_order_items) {
        for (const item of po.purchase_order_items) {
          const resp = itemRespMap[item.id];
          const dec = decisionMap[item.id];

          if (resp) {
            item.supplier_response = resp;
            if (resp.status === 'PROPOSED_DATE') {
              totalProposalsCount++;
              if (!dec) {
                pendingProposalsCount++;
              }
            } else if (resp.status === 'UNAVAILABLE') {
              unavailableCount++;
            }
          }
          if (dec) {
            item.shop_decision = dec;
          }
        }
      }

      po.has_proposals = totalProposalsCount > 0;
      po.pending_proposals_count = pendingProposalsCount;
      po.has_unavailable_items = unavailableCount > 0;
    }
  } catch (err) {
    console.error('Error enriching POs with supplier proposals from audit logs:', err);
  }

  return pos;
};

// === Purchase Orders ===
export const getPurchaseOrders = async () => {
  let { data, error } = await supabase
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
        receipt_history,
        ingredients ( name, unit )
      )
    `)
    .order("created_at", { ascending: false });

  // Fallback if receipt_history column doesn't exist yet in the database
  if (error && (error.code === '42703' || error.message?.includes('receipt_history'))) {
    const fallback = await supabase
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

    if (fallback.error) throw fallback.error;
    data = fallback.data;
    error = null;
  } else if (error) {
    throw error;
  }

  const withReceipts = await enrichPOsWithReceiptHistory(data);
  return await enrichPOsWithSupplierProposals(withReceipts);
};

// Get purchase orders for a specific supplier (Supplier Portal)
export const getPurchaseOrdersBySupplier = async (supplierId) => {
  let { data, error } = await supabase
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
        receipt_history,
        ingredients ( name, unit )
      )
    `)
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  // Fallback if receipt_history column doesn't exist yet
  if (error && (error.code === '42703' || error.message?.includes('receipt_history'))) {
    const fallback = await supabase
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
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    if (fallback.error) throw fallback.error;
    data = fallback.data;
    error = null;
  } else if (error) {
    throw error;
  }

  const withReceipts = await enrichPOsWithReceiptHistory(data);
  return await enrichPOsWithSupplierProposals(withReceipts);
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

export const updatePurchaseOrderStatus = async (id, status, items_received = [], expected_date = null) => {
  const updates = { status };
  if (status === 'Received' || status === 'Partial') {
    updates.received_at = new Date().toISOString();
  }
  if (expected_date) {
    updates.expected_date = expected_date;
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
      let currentItem = null;
      let hasReceiptHistory = true;

      const { data: itemWithHistory, error: historyErr } = await supabase
        .from("purchase_order_items")
        .select("quantity_received, quantity, receipt_history")
        .eq("id", item.id)
        .single();

      if (historyErr && (historyErr.code === '42703' || historyErr.message?.includes('receipt_history'))) {
        hasReceiptHistory = false;
        const { data: itemWithoutHistory } = await supabase
          .from("purchase_order_items")
          .select("quantity_received, quantity")
          .eq("id", item.id)
          .single();
        currentItem = itemWithoutHistory;
      } else {
        currentItem = itemWithHistory;
      }
        
      if (!currentItem) continue;

      const newQtyReceived = Number(currentItem.quantity_received || 0) + Number(item.quantity_received_now);
      const isFullyReceived = newQtyReceived >= currentItem.quantity;
      
      const itemUpdate = { 
        quantity_received: newQtyReceived,
        is_received: isFullyReceived
      };

      if (hasReceiptHistory) {
        let currentHistory = [];
        try {
          if (typeof currentItem.receipt_history === 'string') {
            currentHistory = JSON.parse(currentItem.receipt_history);
          } else if (Array.isArray(currentItem.receipt_history)) {
            currentHistory = currentItem.receipt_history;
          }
        } catch (e) {
          currentHistory = [];
        }
        
        const newHistoryEvent = {
          date: new Date().toISOString(),
          quantity: Number(item.quantity_received_now)
        };
        itemUpdate.receipt_history = [...currentHistory, newHistoryEvent];
      }

      // 1. Update purchase_order_items
      await supabase
        .from("purchase_order_items")
        .update(itemUpdate)
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

// Supplier submits item availability, proposed dates, or reasons for unavailable items
export const submitSupplierItemResponses = async (poId, items, supplierUserId) => {
  // items: [{ item_id, status: 'AVAILABLE' | 'PROPOSED_DATE' | 'UNAVAILABLE', proposed_date, reason }]
  const hasProposed = items.some(i => i.status === 'PROPOSED_DATE');
  const hasAvailable = items.some(i => i.status === 'AVAILABLE');
  const allUnavailable = items.length > 0 && items.every(i => i.status === 'UNAVAILABLE');

  let newPOStatus = 'Accepted';
  if (allUnavailable) {
    newPOStatus = 'Declined';
  } else if (hasProposed) {
    newPOStatus = 'Proposal Pending';
  } else if (hasAvailable && items.some(i => i.status === 'UNAVAILABLE')) {
    newPOStatus = 'Partially Accepted';
  }

  const { data: updatedPO, error: poErr } = await supabase
    .from('purchase_orders')
    .update({ status: newPOStatus })
    .eq('id', poId)
    .select()
    .single();

  if (poErr) throw poErr;

  // Log audit event to capture item breakdown & proposals
  await logAudit('SUPPLIER_PO_ITEM_RESPONSE', supplierUserId, {
    po_id: poId,
    items,
    new_status: newPOStatus
  });

  return updatedPO;
};

// Shop accepts or declines proposed delivery date for an unavailable item
export const respondToSupplierProposal = async (poId, itemId, decision, splitIntoBackorder, userId) => {
  // Log audit event for shop decision
  await logAudit('SHOP_PO_PROPOSAL_RESPONSE', userId, {
    po_id: poId,
    item_id: itemId,
    decision,
    split_into_backorder: splitIntoBackorder
  });

  let backorderPO = null;

  if (decision === 'ACCEPTED') {
    // Fetch original PO and items
    const { data: origPO } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('id', poId)
      .single();

    const targetItem = origPO?.purchase_order_items?.find(i => i.id === itemId);

    // Retrieve proposed date from audit log
    const { data: recentLogs } = await supabase
      .from('audit_logs')
      .select('details')
      .eq('action', 'SUPPLIER_PO_ITEM_RESPONSE')
      .order('created_at', { ascending: false });

    let proposedDate = origPO?.expected_date;
    for (const log of (recentLogs || [])) {
      try {
        const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (d?.po_id === poId && Array.isArray(d.items)) {
          const match = d.items.find(it => it.item_id === itemId);
          if (match?.proposed_date) {
            proposedDate = match.proposed_date;
            break;
          }
        }
      } catch (e) {}
    }

    // If split into a new backorder PO is enabled
    if (splitIntoBackorder && targetItem && origPO) {
      const backorderTotal = Number(targetItem.quantity) * Number(targetItem.unit_price);
      const { data: createdPO, error: boErr } = await supabase
        .from('purchase_orders')
        .insert([{
          supplier_id: origPO.supplier_id,
          expected_date: proposedDate,
          total_amount: backorderTotal,
          status: 'Accepted'
        }])
        .select()
        .single();

      if (!boErr && createdPO) {
        backorderPO = createdPO;
        await supabase
          .from('purchase_order_items')
          .insert([{
            purchase_order_id: createdPO.id,
            ingredient_id: targetItem.ingredient_id,
            quantity: targetItem.quantity,
            unit_price: targetItem.unit_price,
            subtotal: targetItem.subtotal,
            purchase_unit: targetItem.purchase_unit,
            conversion_factor: targetItem.conversion_factor
          }]);

        await logAudit('BACKORDER_PO_CREATED', userId, {
          parent_po_id: poId,
          backorder_po_id: createdPO.id,
          ingredient_id: targetItem.ingredient_id
        });
      }
    }
  }

  // Check if all proposals for this PO are now resolved
  const { data: checkPO } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('id', poId)
    .single();

  if (checkPO && checkPO.status === 'Proposal Pending') {
    const [enriched] = await enrichPOsWithSupplierProposals([checkPO]);
    if (enriched && enriched.pending_proposals_count === 0) {
      await supabase
        .from('purchase_orders')
        .update({ status: 'Accepted' })
        .eq('id', poId);
    }
  }

  return { success: true, backorderPO };
};

