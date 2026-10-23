import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { getManilaDateOnly } from "../utils/dateUtils.js";

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

// Helper to enrich POs with decline reasons, cancellation reasons, and overdue metrics
const enrichPOsWithMetadata = async (pos) => {
  if (!pos || pos.length === 0) return pos;

  const todayManila = getManilaDateOnly();

  try {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('created_at, details, action')
      .in('action', [
        'PURCHASE_ORDER_CREATED',
        'SUPPLIER_PO_DECLINED', 
        'PURCHASE_ORDER_STATUS_UPDATED', 
        'PURCHASE_ORDER_CANCELLED', 
        'PURCHASE_ORDER_RESCHEDULED'
      ])
      .order('created_at', { ascending: false });

    const declineMap = {};
    const cancellationMap = {};
    const rescheduleMap = {};
    const notesMap = {};

    if (logs) {
      for (const log of logs) {
        try {
          const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          const poId = d?.po_id;
          if (!poId) continue;

          // Decline reason
          const decReason = d?.decline_reason || d?.declineReason;
          if (decReason && !declineMap[poId]) {
            declineMap[poId] = decReason;
          }

          // Cancellation reason
          const canReason = d?.cancellation_reason || d?.cancellationReason || (log.action === 'PURCHASE_ORDER_CANCELLED' ? d?.reason : null);
          if (canReason && !cancellationMap[poId]) {
            cancellationMap[poId] = canReason;
          }

          // Reschedule history
          if (log.action === 'PURCHASE_ORDER_RESCHEDULED' || (d?.expected_date && d?.reschedule_reason)) {
            if (!rescheduleMap[poId]) rescheduleMap[poId] = [];
            rescheduleMap[poId].push({
              date: log.created_at,
              new_expected_date: d.expected_date,
              reason: d.reschedule_reason || d.reason || null
            });
          }

          // Notes
          if (log.action === 'PURCHASE_ORDER_CREATED' && d?.notes && !notesMap[poId]) {
            notesMap[poId] = d.notes;
          }
        } catch (e) {}
      }
    }

    for (const po of pos) {
      // 1. Decline reasons
      if (!po.decline_reason && declineMap[po.id]) {
        po.decline_reason = declineMap[po.id];
      }
      if (po.decline_reason) {
        po.declineReason = po.decline_reason;
      }

      // 2. Cancellation reasons
      if (!po.cancellation_reason && cancellationMap[po.id]) {
        po.cancellation_reason = cancellationMap[po.id];
      }
      if (po.cancellation_reason) {
        po.cancellationReason = po.cancellation_reason;
      }

      // 3. Reschedule history
      if (rescheduleMap[po.id]) {
        po.reschedule_history = rescheduleMap[po.id];
      }

      // 4. Notes
      if (!po.notes && notesMap[po.id]) {
        po.notes = notesMap[po.id];
      }

      // 5. Overdue detection
      const isTerminal = ['Received', 'Cancelled', 'Declined', 'DECLINED'].includes(po.status);
      const isOverdue = !isTerminal && Boolean(po.expected_date && po.expected_date < todayManila);
      let daysOverdue = 0;
      if (isOverdue) {
        const diffMs = new Date(todayManila + 'T00:00:00') - new Date(po.expected_date + 'T00:00:00');
        daysOverdue = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }
      po.is_overdue = isOverdue;
      po.days_overdue = daysOverdue;
    }
  } catch (err) {
    console.error('Error enriching POs with metadata from audit logs:', err);
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
  const withProposals = await enrichPOsWithSupplierProposals(withReceipts);
  return await enrichPOsWithMetadata(withProposals);
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
  const withProposals = await enrichPOsWithSupplierProposals(withReceipts);
  return await enrichPOsWithMetadata(withProposals);
};

export const createPurchaseOrder = async (poData) => {
  // poData should look like: { supplier_id, expected_date, notes, items: [{ ingredient_id, quantity, unit_price }] }
  const { items, notes, ...poDetails } = poData;

  // Calculate total amount
  const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  
  // Base PO payload with guaranteed existing columns
  const basePo = {
    supplier_id: poDetails.supplier_id,
    expected_date: poDetails.expected_date || null,
    total_amount,
    status: 'Pending'
  };

  // 1. Insert PO (attempt with notes if provided; if column is missing from schema cache, fallback gracefully)
  let po = null;
  let poError = null;

  if (notes) {
    const resWithNotes = await supabase
      .from("purchase_orders")
      .insert([{ ...basePo, notes }])
      .select()
      .single();

    if (resWithNotes.error && (resWithNotes.error.code === '42703' || resWithNotes.error.code === 'PGRST204' || resWithNotes.error.message?.toLowerCase().includes('notes'))) {
      const fallbackRes = await supabase
        .from("purchase_orders")
        .insert([basePo])
        .select()
        .single();
      po = fallbackRes.data;
      poError = fallbackRes.error;
    } else {
      po = resWithNotes.data;
      poError = resWithNotes.error;
    }
  } else {
    const res = await supabase
      .from("purchase_orders")
      .insert([basePo])
      .select()
      .single();
    po = res.data;
    poError = res.error;
  }

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

export const updatePurchaseOrderStatus = async (id, status = null, items_received = [], expected_date = null, reason = null) => {
  const updates = {};
  if (status) {
    updates.status = status;
    if (status === 'Received' || status === 'Partial') {
      updates.received_at = new Date().toISOString();
    }
  }
  if (expected_date) {
    updates.expected_date = expected_date;
  }
  if (reason) {
    const sUpper = (status || '').toUpperCase();
    if (sUpper === 'DECLINED') {
      updates.decline_reason = reason;
    } else if (sUpper === 'CANCELLED') {
      updates.cancellation_reason = reason;
    }
  }

  let data = null;
  const result = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (result.error && (result.error.code === '42703' || result.error.message?.includes('decline_reason') || result.error.message?.includes('cancellation_reason'))) {
    // If decline_reason or cancellation_reason column doesn't exist yet, retry without custom columns
    delete updates.decline_reason;
    delete updates.cancellation_reason;
    const fallback = await supabase
      .from("purchase_orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
    if (reason) {
      const sUpper = (status || '').toUpperCase();
      if (sUpper === 'DECLINED') {
        data.decline_reason = reason;
        data.declineReason = reason;
      } else if (sUpper === 'CANCELLED') {
        data.cancellation_reason = reason;
        data.cancellationReason = reason;
      }
    }
  } else if (result.error) {
    throw result.error;
  } else {
    data = result.data;
  }

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

