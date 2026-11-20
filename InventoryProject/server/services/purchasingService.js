import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { getManilaDateOnly } from "../utils/dateUtils.js";

const safeParseAuditDetails = (rawDetails) => {
  if (!rawDetails) return {};
  if (typeof rawDetails !== 'string') return rawDetails;
  try {
    return JSON.parse(rawDetails);
  } catch {
    return {};
  }
};

export const getUnacknowledgedPriceUpdateLogs = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: auditRows, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, action, details')
    .in('action', ['SUPPLIER_CATALOG_PRICES_UPDATED', 'SUPPLIER_PRICE_UPDATES_READ'])
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const parsedRows = (auditRows || []).map((row) => ({
    ...row,
    parsedDetails: safeParseAuditDetails(row.details),
    timestampMs: new Date(row.created_at).getTime()
  }));

  const lastReadSupplierAt = {};
  const lastReadItemAt = {};

  for (const row of parsedRows) {
    if (row.action !== 'SUPPLIER_PRICE_UPDATES_READ') continue;
    const suppId = row.parsedDetails?.supplier_id ? String(row.parsedDetails.supplier_id) : null;
    if (!suppId) continue;

    const ingId = row.parsedDetails?.ingredient_id ? String(row.parsedDetails.ingredient_id) : null;
    if (ingId) {
      const itemKey = `${suppId}_${ingId}`;
      if (!lastReadItemAt[itemKey] || row.timestampMs > lastReadItemAt[itemKey]) {
        lastReadItemAt[itemKey] = row.timestampMs;
      }
    } else if (!lastReadSupplierAt[suppId] || row.timestampMs > lastReadSupplierAt[suppId]) {
      lastReadSupplierAt[suppId] = row.timestampMs;
    }
  }

  const unacknowledgedLogs = [];
  for (const row of parsedRows) {
    if (row.action !== 'SUPPLIER_CATALOG_PRICES_UPDATED') continue;
    const details = row.parsedDetails;
    const suppId = details?.supplier_id ? String(details.supplier_id) : null;
    if (!suppId) continue;

    const supplierReadAt = lastReadSupplierAt[suppId] || 0;
    if (row.timestampMs <= supplierReadAt) continue;

    const rawChanges = Array.isArray(details.price_changes) ? details.price_changes : [];
    const remainingChanges = rawChanges.filter((ch) => {
      if (!ch || !ch.ingredient_id) return false;
      const itemReadAt = lastReadItemAt[`${suppId}_${String(ch.ingredient_id)}`] || 0;
      return row.timestampMs > itemReadAt;
    });

    if (remainingChanges.length === 0) continue;

    unacknowledgedLogs.push({
      id: row.id,
      created_at: row.created_at,
      supplier_id: details.supplier_id,
      supplier_name: details.supplier_name || 'Supplier',
      items_count: details.items_count || 0,
      price_changes: remainingChanges
    });
  }

  return unacknowledgedLogs;
};

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
  if (!data || data.length === 0) return [];

  try {
    const priceLogs = await getUnacknowledgedPriceUpdateLogs();

    const updatesBySupplier = {};
    for (const log of priceLogs) {
      const suppId = log.supplier_id;
      if (!suppId) continue;

      if (!updatesBySupplier[suppId]) {
        updatesBySupplier[suppId] = {
          last_updated_at: log.created_at,
          changes_count: 0,
          items: {}
        };
      }

      for (const ch of log.price_changes) {
        if (!updatesBySupplier[suppId].items[ch.ingredient_id]) {
          updatesBySupplier[suppId].items[ch.ingredient_id] = ch;
          updatesBySupplier[suppId].changes_count += 1;
        }
      }
    }

    return data.map(supp => ({
      is_archived: Boolean(supp.is_archived || (supp.description && supp.description.startsWith('[ARCHIVED]'))),
      ...supp,
      recent_price_updates: updatesBySupplier[supp.id] || null
    }));
  } catch (err) {
    console.warn('Failed to attach recent price updates to suppliers:', err);
    return data;
  }
};

// Helper to build supplier ingredient mappings with prices, units, and conversion factors
const buildSupplierIngredientMappings = async (supplierId, ingredientItems, ingredientIds, existingPriceMap = new Map()) => {
  if (Array.isArray(ingredientItems) && ingredientItems.length > 0) {
    return ingredientItems.map(item => {
      // If supplier already set an agreed price, preserve it from admin overwrites!
      const finalPrice = existingPriceMap.has(item.ingredient_id)
        ? existingPriceMap.get(item.ingredient_id)
        : (parseFloat(item.default_price ?? item.price ?? item.unit_price) || 0);

      return {
        supplier_id: supplierId,
        ingredient_id: item.ingredient_id,
        default_purchase_unit: item.default_purchase_unit || item.purchase_unit || 'Unit',
        default_conversion_factor: parseFloat(item.default_conversion_factor || item.conversion_factor) || 1,
        default_price: parseFloat(finalPrice) || 0
      };
    });
  }

  if (Array.isArray(ingredientIds) && ingredientIds.length > 0) {
    const { data: defaultIngs } = await supabase
      .from('ingredients')
      .select('id, purchase_unit, conversion_factor, cost_per_purchase_unit')
      .in('id', ingredientIds);

    const defaultMap = {};
    (defaultIngs || []).forEach(ing => {
      defaultMap[ing.id] = ing;
    });

    return ingredientIds.map(id => {
      const def = defaultMap[id] || {};
      return {
        supplier_id: supplierId,
        ingredient_id: id,
        default_purchase_unit: def.purchase_unit || 'Unit',
        default_conversion_factor: parseFloat(def.conversion_factor) || 1,
        default_price: parseFloat(def.cost_per_purchase_unit) || 0
      };
    });
  }

  return [];
};

const sanitizeSupplierDetails = (details) => {
  const payload = { ...details };
  if (!payload.contact_info && (payload.contact_person || payload.contact_number || payload.email)) {
    payload.contact_info = [payload.contact_person, payload.contact_number, payload.email].filter(Boolean).join(' | ');
  }
  return payload;
};

export const createSupplier = async (supplierData) => {
  const { ingredient_ids, ingredient_items, ...details } = supplierData;
  const payload = sanitizeSupplierDetails(details);
  
  let res = await supabase.from("suppliers").insert([payload]).select().single();
  if (res.error && res.error.message && res.error.message.includes('description')) {
    delete payload.description;
    res = await supabase.from("suppliers").insert([payload]).select().single();
  }
  if (res.error) throw res.error;
  const data = res.data;

  const mappings = await buildSupplierIngredientMappings(data.id, ingredient_items, ingredient_ids);
  if (mappings.length > 0) {
    const { error: mappingError } = await supabase
      .from("supplier_ingredients")
      .insert(mappings);
    if (mappingError) throw mappingError;
  }

  return data;
};

export const updateSupplier = async (id, supplierData) => {
  const { ingredient_ids, ingredient_items, ...details } = supplierData;
  const payload = sanitizeSupplierDetails(details);
  
  let res = await supabase.from("suppliers").update(payload).eq("id", id).select().single();
  if (res.error && res.error.message && res.error.message.includes('description')) {
    delete payload.description;
    res = await supabase.from("suppliers").update(payload).eq("id", id).select().single();
  }
  if (res.error) throw res.error;
  const data = res.data;

  // Preserve existing supplier prices so admin edits do not overwrite prices set by supplier!
  const { data: existingSupplierItems } = await supabase
    .from("supplier_ingredients")
    .select("ingredient_id, default_price")
    .eq("supplier_id", id);
  const existingPriceMap = new Map((existingSupplierItems || []).map(r => [r.ingredient_id, r.default_price]));

  // Delete existing mappings
  await supabase
    .from("supplier_ingredients")
    .delete()
    .eq("supplier_id", id);

  const mappings = await buildSupplierIngredientMappings(id, ingredient_items, ingredient_ids, existingPriceMap);
  if (mappings.length > 0) {
    const { error: mappingError } = await supabase
      .from("supplier_ingredients")
      .insert(mappings);
    if (mappingError) throw mappingError;
  }

  return data;
};

export const archiveSupplier = async (id) => {
  let { error } = await supabase.from("suppliers").update({ is_archived: true }).eq("id", id);
  if (error && (error.message.includes('is_archived') || error.code === '42703')) {
    const { data: s } = await supabase.from("suppliers").select("description").eq("id", id).single();
    const currentDesc = s?.description || '';
    const newDesc = currentDesc.startsWith('[ARCHIVED]') ? currentDesc : `[ARCHIVED] ${currentDesc}`.trim();
    const fallback = await supabase.from("suppliers").update({ description: newDesc }).eq("id", id);
    if (fallback.error) throw fallback.error;
  } else if (error) {
    throw error;
  }
  return { success: true };
};

export const restoreSupplier = async (id) => {
  let { error } = await supabase.from("suppliers").update({ is_archived: false }).eq("id", id);
  if (error && (error.message.includes('is_archived') || error.code === '42703')) {
    const { data: s } = await supabase.from("suppliers").select("description").eq("id", id).single();
    const currentDesc = s?.description || '';
    const newDesc = currentDesc.replace(/^\[ARCHIVED\]\s*/, '').trim();
    const fallback = await supabase.from("suppliers").update({ description: newDesc || null }).eq("id", id);
    if (fallback.error) throw fallback.error;
  } else if (error) {
    throw error;
  }
  return { success: true };
};

export const deleteSupplier = async (id) => {
  return archiveSupplier(id);
};

// Cache schema capabilities so we don't repeat failed fallback queries on every request
let hasPoReceiptHistoryCol = true;

const PO_AUDIT_ACTIONS = [
  'RAW_MATERIAL_STOCK_RECEIVED',
  'SUPPLIER_PO_ITEM_RESPONSE',
  'SHOP_PO_PROPOSAL_RESPONSE',
  'PURCHASE_ORDER_CREATED',
  'SUPPLIER_PO_DECLINED',
  'PURCHASE_ORDER_STATUS_UPDATED',
  'PURCHASE_ORDER_CANCELLED',
  'PURCHASE_ORDER_RESCHEDULED'
];

// Fetch all PO-related audit logs in paginated batches (bypassing PostgREST 1,000-row cap)
const fetchPoAuditLogs = async () => {
  try {
    const PAGE_SIZE = 1000;
    const allLogs = [];
    let offset = 0;
    while (true) {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('created_at, action, details')
        .in('action', PO_AUDIT_ACTIONS)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!logs || logs.length === 0) break;
      allLogs.push(...logs);
      if (logs.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return allLogs;
  } catch (err) {
    console.error('Error fetching PO audit logs:', err);
    return [];
  }
};

// Helper to enrich PO items with actual multi-receive batch events from audit logs
const enrichPOsWithReceiptHistory = async (pos, preloadedLogs = null) => {
  if (!pos || pos.length === 0) return pos;

  try {
    const logs = preloadedLogs
      ? preloadedLogs.filter(l => l.action === 'RAW_MATERIAL_STOCK_RECEIVED')
      : (await supabase
          .from('audit_logs')
          .select('created_at, details')
          .eq('action', 'RAW_MATERIAL_STOCK_RECEIVED')
          .order('created_at', { ascending: true })).data;

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
      } catch {
        // Ignore malformed audit JSON details
      }
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
const enrichPOsWithMetadata = async (pos, preloadedLogs = null) => {
  if (!pos || pos.length === 0) return pos;

  const todayManila = getManilaDateOnly();
  const metadataActions = new Set([
    'PURCHASE_ORDER_CREATED',
    'SUPPLIER_PO_DECLINED',
    'PURCHASE_ORDER_STATUS_UPDATED',
    'PURCHASE_ORDER_CANCELLED',
    'PURCHASE_ORDER_RESCHEDULED'
  ]);

  try {
    const logs = preloadedLogs
      ? [...preloadedLogs].filter(l => metadataActions.has(l.action)).reverse()
      : (await supabase
          .from('audit_logs')
          .select('created_at, details, action')
          .in('action', Array.from(metadataActions))
          .order('created_at', { ascending: false })).data;

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
        } catch {
        // Ignore malformed audit JSON details
      }
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
const enrichPOsWithSupplierProposals = async (pos, preloadedLogs = null) => {
  if (!pos || pos.length === 0) return pos;

  try {
    const logs = preloadedLogs
      ? preloadedLogs.filter(l => l.action === 'SUPPLIER_PO_ITEM_RESPONSE' || l.action === 'SHOP_PO_PROPOSAL_RESPONSE')
      : (await supabase
          .from('audit_logs')
          .select('created_at, action, details')
          .in('action', ['SUPPLIER_PO_ITEM_RESPONSE', 'SHOP_PO_PROPOSAL_RESPONSE'])
          .order('created_at', { ascending: true })).data;

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
      } catch {
        // Ignore malformed audit JSON details
      }
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

const getPoSelectColumns = () => `
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
    ${hasPoReceiptHistoryCol ? 'receipt_history,' : ''}
    ingredients ( name, unit )
  )
`;

// === Purchase Orders ===
export const getPurchaseOrders = async () => {
  const [poRes, auditLogs] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(getPoSelectColumns())
      .order("created_at", { ascending: false }),
    fetchPoAuditLogs()
  ]);

  let { data, error } = poRes;

  // Fallback if receipt_history column doesn't exist yet in the database
  if (error && (error.code === '42703' || error.message?.includes('receipt_history'))) {
    hasPoReceiptHistoryCol = false;
    const fallback = await supabase
      .from("purchase_orders")
      .select(getPoSelectColumns())
      .order("created_at", { ascending: false });

    if (fallback.error) throw fallback.error;
    data = fallback.data;
  } else if (error) {
    throw error;
  }

  const withReceipts = await enrichPOsWithReceiptHistory(data, auditLogs);
  const withProposals = await enrichPOsWithSupplierProposals(withReceipts, auditLogs);
  return await enrichPOsWithMetadata(withProposals, auditLogs);
};

// Get purchase orders for a specific supplier (Supplier Portal)
export const getPurchaseOrdersBySupplier = async (supplierId) => {
  const [poRes, auditLogs] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(getPoSelectColumns())
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false }),
    fetchPoAuditLogs()
  ]);

  let { data, error } = poRes;

  // Fallback if receipt_history column doesn't exist yet
  if (error && (error.code === '42703' || error.message?.includes('receipt_history'))) {
    hasPoReceiptHistoryCol = false;
    const fallback = await supabase
      .from("purchase_orders")
      .select(getPoSelectColumns())
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    if (fallback.error) throw fallback.error;
    data = fallback.data;
  } else if (error) {
    throw error;
  }

  const withReceipts = await enrichPOsWithReceiptHistory(data, auditLogs);
  const withProposals = await enrichPOsWithSupplierProposals(withReceipts, auditLogs);
  return await enrichPOsWithMetadata(withProposals, auditLogs);
};

export const createPurchaseOrder = async (poData) => {
  // poData should look like: { supplier_id, expected_date, notes, items: [{ ingredient_id, quantity, unit_price }] }
  const { items, notes, ...poDetails } = poData;
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Purchase order must include at least one item.');
    err.status = 400;
    throw err;
  }

  // Calculate total amount
  const total_amount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  
  // Base PO payload with guaranteed existing columns
  const basePo = {
    supplier_id: poDetails.supplier_id,
    expected_date: poDetails.expected_date || null,
    total_amount,
    status: 'Pending'
  };

  // 1. Insert PO (attempt with notes if provided; if column is missing from schema cache, fallback gracefully)
  let po;
  let poError;

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
  const { data: existingPO, error: existingErr } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", id)
    .single();

  if (existingErr || !existingPO) {
    const err = new Error("Purchase order not found.");
    err.status = 404;
    throw err;
  }

  const currentStatusLower = String(existingPO.status || "").toLowerCase();
  const isTerminalStatus = ["received", "cancelled", "declined"].includes(currentStatusLower);
  if (isTerminalStatus) {
    const err = new Error(`Cannot update purchase order because its status is already ${existingPO.status}.`);
    err.status = 400;
    throw err;
  }

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

  let data;
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
  const appliedReceipts = [];
  if (items_received && items_received.length > 0 && !isTerminalStatus) {
    for (const item of items_received) {
      const rawQtyNow = Number(item.quantity_received_now);
      if (!Number.isFinite(rawQtyNow) || rawQtyNow <= 0) continue;

      // Fetch current item to properly add quantities and prefer authoritative conversion factor
      let currentItem;
      let hasReceiptHistory = true;

      const { data: itemWithHistory, error: historyErr } = await supabase
        .from("purchase_order_items")
        .select("quantity_received, quantity, conversion_factor, ingredient_id, purchase_order_id, receipt_history")
        .eq("id", item.id)
        .single();

      if (historyErr && (historyErr.code === '42703' || historyErr.message?.includes('receipt_history'))) {
        hasReceiptHistory = false;
        const { data: itemWithoutHistory } = await supabase
          .from("purchase_order_items")
          .select("quantity_received, quantity, conversion_factor, ingredient_id, purchase_order_id")
          .eq("id", item.id)
          .single();
        currentItem = itemWithoutHistory;
      } else {
        currentItem = itemWithHistory;
      }
        
      if (!currentItem || String(currentItem.purchase_order_id) !== String(id)) continue;

      const remainingQty = Math.max(0, Number(currentItem.quantity) - Number(currentItem.quantity_received || 0));
      const qtyToReceive = Math.min(rawQtyNow, remainingQty);
      if (qtyToReceive <= 0) continue;

      const newQtyReceived = Number(currentItem.quantity_received || 0) + qtyToReceive;
      const isFullyReceived = newQtyReceived >= Number(currentItem.quantity);
      
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
        } catch {
          currentHistory = [];
        }
        
        const newHistoryEvent = {
          date: new Date().toISOString(),
          quantity: qtyToReceive
        };
        itemUpdate.receipt_history = [...currentHistory, newHistoryEvent];
      }

      // 1. Update purchase_order_items
      const { error: itemUpdateErr } = await supabase
        .from("purchase_order_items")
        .update(itemUpdate)
        .eq("id", item.id);
      if (itemUpdateErr) throw itemUpdateErr;
        
      // 2. Update stock
      const targetIngredientId = currentItem.ingredient_id || item.ingredient_id;
      const conversion = Number(currentItem.conversion_factor) || Number(item.conversion_factor) || 1;
      if (targetIngredientId) {
        const { data: ingData } = await supabase
          .from("ingredients")
          .select("stock_quantity")
          .eq("id", targetIngredientId)
          .single();
          
        if (ingData) {
          const baseUnitsReceived = qtyToReceive * conversion;
          const newStock = Number(ingData.stock_quantity || 0) + baseUnitsReceived;
          
          const { error: ingUpdateErr } = await supabase
            .from("ingredients")
            .update({ stock_quantity: newStock })
            .eq("id", targetIngredientId);
          if (ingUpdateErr) throw ingUpdateErr;
        }

        appliedReceipts.push({
          ingredient_id: targetIngredientId,
          quantity_received_now: qtyToReceive,
          conversion_factor: conversion,
          purchase_unit: item.purchase_unit || 'Unit'
        });
      }
    }
  }

  if (data && typeof data === 'object') {
    Object.defineProperty(data, '_appliedReceipts', {
      value: appliedReceipts,
      enumerable: false
    });
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
      } catch {
        // Ignore malformed audit JSON details
      }
    }

    // If split into a new backorder PO is enabled
    if (splitIntoBackorder && targetItem && origPO) {
      const boTotal = Number(targetItem.quantity) * Number(targetItem.unit_price);
      const { data: createdPO, error: boErr } = await supabase
        .from('purchase_orders')
        .insert([{
          supplier_id: origPO.supplier_id,
          expected_date: proposedDate,
          total_amount: boTotal,
          status: 'Accepted'
        }])
        .select()
        .single();

      if (boErr) throw boErr;

      if (createdPO) {
        backorderPO = createdPO;
        const { error: boItemError } = await supabase
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

        if (boItemError) {
          await supabase.from('purchase_orders').delete().eq('id', createdPO.id);
          throw boItemError;
        }

        const { error: deleteOrigItemErr } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('id', targetItem.id)
          .eq('purchase_order_id', poId);

        if (deleteOrigItemErr) throw deleteOrigItemErr;

        const updatedOrigTotal = Math.max(
          0,
          Math.round(((Number(origPO.total_amount) || 0) - boTotal) * 100) / 100
        );
        const { error: updateOrigPoErr } = await supabase
          .from('purchase_orders')
          .update({ total_amount: updatedOrigTotal })
          .eq('id', poId);

        if (updateOrigPoErr) throw updateOrigPoErr;

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

