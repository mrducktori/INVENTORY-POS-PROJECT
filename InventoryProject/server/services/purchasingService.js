import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { getManilaDateOnly } from "../utils/dateUtils.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import * as batchService from "./batchService.js";

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

// Builds supplier ingredient mappings with prices, units and conversion factors.
const buildSupplierIngredientMappings = async (supplierId, ingredientItems, ingredientIds, existingPriceMap = new Map()) => {
  if (Array.isArray(ingredientItems) && ingredientItems.length > 0) {
    // A blank pack size must inherit the ingredient's own unit/factor, not 1 (1 means "1 gram per pack"
    // and mis-sizes POs).
    const missingIds = ingredientItems
      .filter(i => (i.default_conversion_factor ?? i.conversion_factor ?? '') === '')
      .map(i => i.ingredient_id);
    const ingDefaults = new Map();
    if (missingIds.length > 0) {
      const { data: defs } = await supabase
        .from('ingredients')
        .select('id, purchase_unit, conversion_factor')
        .in('id', missingIds);
      (defs || []).forEach(d => ingDefaults.set(String(d.id), d));
    }
    return ingredientItems.map(item => {
      const def = ingDefaults.get(String(item.ingredient_id));
      const rawFactor = item.default_conversion_factor ?? item.conversion_factor ?? def?.conversion_factor;
      const hasFactor = rawFactor !== undefined && rawFactor !== null && rawFactor !== '';
      const conversionFactor = hasFactor
        ? validateNumberBound(rawFactor, {
            label: 'Conversion factor',
            min: LIMITS.CONVERSION_FACTOR_MIN,
            max: LIMITS.CONVERSION_FACTOR_MAX,
            allowZero: false
          })
        : 1;

      let finalPrice;
      if (existingPriceMap.has(item.ingredient_id)) {
        // If the supplier already set an agreed price, keep it so admin edits do not overwrite it.
        finalPrice = parseFloat(existingPriceMap.get(item.ingredient_id)) || 0;
      } else {
        const rawPrice = item.default_price ?? item.price ?? item.unit_price;
        const hasPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== '';
        finalPrice = hasPrice
          ? validateNumberBound(rawPrice, {
              label: 'Supplier item price',
              min: LIMITS.PURCHASE_COST_MIN,
              max: LIMITS.PURCHASE_COST_MAX
            })
          : 0;
      }

      return {
        supplier_id: supplierId,
        ingredient_id: item.ingredient_id,
        default_purchase_unit: item.default_purchase_unit || item.purchase_unit || def?.purchase_unit || 'Unit',
        default_conversion_factor: conversionFactor,
        default_price: finalPrice
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

export const sanitizeSupplierDetails = (details = {}) => {
  const payload = { ...details };
  payload.name = validateTextLength(payload.name, {
    label: 'Supplier name',
    min: 1,
    max: LIMITS.NAME_MAX_LEN,
    required: true
  });

  if (payload.contact_person !== undefined && payload.contact_person !== null) {
    payload.contact_person = validateTextLength(payload.contact_person, {
      label: 'Contact person',
      min: 1,
      max: 100,
      required: false
    });
  }

  if (payload.email !== undefined && payload.email !== null) {
    payload.email = validateTextLength(payload.email, {
      label: 'Email',
      min: 1,
      max: 120,
      required: false
    });
  }

  if (payload.address !== undefined && payload.address !== null) {
    payload.address = validateTextLength(payload.address, {
      label: 'Address',
      min: 1,
      max: 250,
      required: false
    });
  }

  if (payload.lead_time_days !== undefined && payload.lead_time_days !== null && payload.lead_time_days !== '') {
    const days = validateNumberBound(payload.lead_time_days, { label: 'Delivery lead time (days)', min: 0, max: 60 });
    if (!Number.isInteger(days)) {
      const err = new Error('Delivery lead time (days) must be a whole number between 0 and 60.');
      err.status = 400;
      throw err;
    }
    payload.lead_time_days = days;
  } else {
    delete payload.lead_time_days;
  }

  if (!payload.contact_info && (payload.contact_person || payload.contact_number || payload.email)) {
    payload.contact_info = [payload.contact_person, payload.contact_number, payload.email].filter(Boolean).join(' | ');
  }
  return payload;
};

export const createSupplier = async (supplierData) => {
  const { ingredient_ids, ingredient_items, ...details } = supplierData;
  const payload = sanitizeSupplierDetails(details);
  const prebuiltMappings = await buildSupplierIngredientMappings(null, ingredient_items, ingredient_ids);
  
  let res = await supabase.from("suppliers").insert([payload]).select().single();
  if (res.error && res.error.message && res.error.message.includes('description')) {
    delete payload.description;
    res = await supabase.from("suppliers").insert([payload]).select().single();
  }
  if (res.error) throw res.error;
  const data = res.data;

  const mappings = prebuiltMappings.map(m => ({ ...m, supplier_id: data.id }));
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

  // Keep existing supplier prices so admin edits do not overwrite prices set by the supplier.
  const { data: existingSupplierItems } = await supabase
    .from("supplier_ingredients")
    .select("ingredient_id, default_price")
    .eq("supplier_id", id);
  const existingPriceMap = new Map((existingSupplierItems || []).map(r => [r.ingredient_id, r.default_price]));

  // Validate and build new mappings before mutating the supplier or deleting old mappings
  const mappings = await buildSupplierIngredientMappings(id, ingredient_items, ingredient_ids, existingPriceMap);
  
  let res = await supabase.from("suppliers").update(payload).eq("id", id).select().single();
  if (res.error && res.error.message && res.error.message.includes('description')) {
    delete payload.description;
    res = await supabase.from("suppliers").update(payload).eq("id", id).select().single();
  }
  if (res.error) throw res.error;
  const data = res.data;

  await supabase
    .from("supplier_ingredients")
    .delete()
    .eq("supplier_id", id);

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

// Schema capability flags are cached so failed fallback queries are not repeated on every request.
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

// Fetch all PO-related audit logs in pages to get past PostgREST's 1,000-row cap.
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

// Enriches PO items with the actual multi-receive batch events from audit logs.
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

// Enriches POs with decline reasons, cancellation reasons and overdue metrics.
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

          const decReason = d?.decline_reason || d?.declineReason;
          if (decReason && !declineMap[poId]) {
            declineMap[poId] = decReason;
          }

          const canReason = d?.cancellation_reason || d?.cancellationReason || (log.action === 'PURCHASE_ORDER_CANCELLED' ? d?.reason : null);
          if (canReason && !cancellationMap[poId]) {
            cancellationMap[poId] = canReason;
          }

          if (log.action === 'PURCHASE_ORDER_RESCHEDULED' || (d?.expected_date && d?.reschedule_reason)) {
            if (!rescheduleMap[poId]) rescheduleMap[poId] = [];
            rescheduleMap[poId].push({
              date: log.created_at,
              new_expected_date: d.expected_date,
              reason: d.reschedule_reason || d.reason || null
            });
          }

          if (log.action === 'PURCHASE_ORDER_CREATED' && d?.notes && !notesMap[poId]) {
            notesMap[poId] = d.notes;
          }
        } catch {
        // Ignore malformed audit JSON details
      }
      }
    }

    for (const po of pos) {
      if (!po.decline_reason && declineMap[po.id]) {
        po.decline_reason = declineMap[po.id];
      }
      if (po.decline_reason) {
        po.declineReason = po.decline_reason;
      }

      if (!po.cancellation_reason && cancellationMap[po.id]) {
        po.cancellation_reason = cancellationMap[po.id];
      }
      if (po.cancellation_reason) {
        po.cancellationReason = po.cancellation_reason;
      }

      if (rescheduleMap[po.id]) {
        po.reschedule_history = rescheduleMap[po.id];
      }

      if (!po.notes && notesMap[po.id]) {
        po.notes = notesMap[po.id];
      }

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

// Enriches PO items with supplier proposals and shop decisions from audit logs.
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
    ingredients ( id, name, category, unit, is_perishable, default_shelf_life_days )
  )
`;

const enrichPOsWithIngredientPerishability = (pos = [], metaMap = {}) =>
  (pos || []).map((po) => ({
    ...po,
    purchase_order_items: (po.purchase_order_items || []).map((item) => {
      if (!item?.ingredients) return item;
      const perishability = batchService.getIngredientPerishability(item.ingredients, metaMap);
      return {
        ...item,
        ingredients: {
          ...item.ingredients,
          is_perishable: perishability.is_perishable,
          default_shelf_life_days: perishability.default_shelf_life_days,
          shelf_life_source: perishability.source
        }
      };
    })
  }));

const fetchPurchaseOrders = async (supplierId = null) => {
  const buildQuery = () => {
    let query = supabase
      .from("purchase_orders")
      .select(getPoSelectColumns());
    if (supplierId !== null && supplierId !== undefined) {
      query = query.eq("supplier_id", supplierId);
    }
    return query.order("created_at", { ascending: false });
  };

  const [poRes, auditLogs, metaMap] = await Promise.all([
    buildQuery(),
    fetchPoAuditLogs(),
    batchService.getPerishabilityMetaMap().catch(() => ({}))
  ]);

  let { data, error } = poRes;

  // Fallback if receipt_history column doesn't exist yet in the database
  if (error && (error.code === '42703' || error.message?.includes('receipt_history'))) {
    hasPoReceiptHistoryCol = false;
    const fallback = await buildQuery();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  } else if (error) {
    throw error;
  }

  const withReceipts = await enrichPOsWithReceiptHistory(data, auditLogs);
  const withProposals = await enrichPOsWithSupplierProposals(withReceipts, auditLogs);
  const withMeta = await enrichPOsWithMetadata(withProposals, auditLogs);
  return enrichPOsWithIngredientPerishability(withMeta, metaMap);
};

export const getPurchaseOrders = async () => fetchPurchaseOrders(null);

export const getPurchaseOrdersBySupplier = async (supplierId) => fetchPurchaseOrders(supplierId);

export const createPurchaseOrder = async (poData) => {
  // poData should look like: { supplier_id, expected_date, notes, items: [{ ingredient_id, quantity, unit_price }] }
  const { items, notes, ...poDetails } = poData;
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Purchase order must include at least one item.');
    err.status = 400;
    throw err;
  }

  const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

  const { data: supplier, error: supplierErr } = await supabase
    .from('suppliers').select('id').eq('id', poDetails.supplier_id ?? null).maybeSingle();
  if (supplierErr) throw supplierErr;
  if (!supplier) throw badRequest('Supplier not found.');

  if (items.some((i) => !i?.ingredient_id)) throw badRequest('Every item needs an ingredient_id.');
  const ingredientIds = [...new Set(items.map((i) => i.ingredient_id))];
  const [ingRes, catalogRes] = await Promise.all([
    supabase.from('ingredients').select('id').in('id', ingredientIds),
    supabase.from('supplier_ingredients').select('ingredient_id, default_price')
      .eq('supplier_id', supplier.id).in('ingredient_id', ingredientIds)
  ]);
  if (ingRes.error) throw ingRes.error;
  if (catalogRes.error) throw catalogRes.error;
  const knownIngredients = new Set((ingRes.data || []).map((r) => String(r.id)));
  if (ingredientIds.some((id) => !knownIngredients.has(String(id)))) {
    throw badRequest('One or more ingredients do not exist.');
  }
  const catalogPrice = new Map((catalogRes.data || []).map((r) => [String(r.ingredient_id), r.default_price]));

  const validatedItems = items.map((item) => {
    const quantity = validateNumberBound(item?.quantity, {
      label: 'Purchase order item quantity',
      min: LIMITS.PO_QTY_MIN,
      max: LIMITS.PO_QTY_MAX,
      allowZero: false
    });
    // Catalog price wins over the client value when the supplier lists this ingredient.
    const catalog = catalogPrice.get(String(item.ingredient_id));
    const unit_price = validateNumberBound(catalog ?? item?.unit_price, {
      label: 'Purchase order unit price',
      min: LIMITS.PURCHASE_COST_MIN,
      max: LIMITS.PURCHASE_COST_MAX
    });
    const hasConv = item?.conversion_factor !== undefined && item?.conversion_factor !== null && item?.conversion_factor !== '';
    const conversion_factor = hasConv
      ? validateNumberBound(item.conversion_factor, {
          label: 'Conversion factor',
          min: LIMITS.CONVERSION_FACTOR_MIN,
          max: LIMITS.CONVERSION_FACTOR_MAX,
          allowZero: false
        })
      : 1;

    return {
      ...item,
      quantity,
      unit_price,
      conversion_factor
    };
  });

  // Sum in integer centavos to avoid float drift.
  const total_amount = validatedItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price * 100), 0) / 100;
  
  // Base PO payload with guaranteed existing columns
  const basePo = {
    supplier_id: poDetails.supplier_id,
    expected_date: poDetails.expected_date || null,
    total_amount,
    status: 'Pending'
  };

  // Notes are optional: retry without them if the column is missing from the schema cache.
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

  const itemsToInsert = validatedItems.map(item => ({
    purchase_order_id: po.id,
    ingredient_id: item.ingredient_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: Math.round(item.quantity * item.unit_price * 100) / 100,
    purchase_unit: item.purchase_unit || 'Unit',
    conversion_factor: item.conversion_factor
  }));

  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(itemsToInsert);

  if (itemsError) {
    await supabase.from("purchase_orders").delete().eq("id", po.id); // no orphan PO
    throw itemsError;
  }

  return po;
};

// Same promise-mutex pattern as batchService/posOperationsService: serializes read-check-write per PO.
// shortcut: in-process only; multi-instance deploys rely on the conditional status write below.
const poLocks = new Map();
const withPoLock = async (key, fn) => {
  const prev = poLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  poLocks.set(key, prev.then(() => current, () => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (poLocks.get(key) === current) {
      poLocks.delete(key);
    }
  }
};

// Every PO status the app writes (staff UI, supplier portal, supplier item responses).
const PO_STATUSES = [
  'Pending', 'Proposal Pending', 'Partially Accepted', 'Accepted', 'To Be Delivered',
  'Delivering', 'Postponed', 'Partial', 'Received', 'Declined', 'Cancelled'
];
const SUPPLIER_RESPONSE_STATUSES = ['Pending', 'Proposal Pending'];

// Statuses a supplier may move a PO to, keyed by current status (anything else is a 409).
// Proposal Pending/Partially Accepted can't be Accepted by the supplier: the shop resolves proposals.
export const SUPPLIER_TRANSITIONS = {
  Pending: ['Accepted', 'Declined', 'Postponed'],
  'Proposal Pending': ['Declined'],
  'Partially Accepted': ['Declined'],
  Accepted: ['To Be Delivered', 'Delivering', 'Postponed', 'Declined'],
  'To Be Delivered': ['Delivering', 'Postponed', 'Declined'],
  Delivering: ['Postponed', 'Declined'],
  Postponed: ['Accepted', 'To Be Delivered', 'Delivering', 'Declined'],
  Partial: ['To Be Delivered', 'Delivering', 'Postponed']
};
export const isSupplierTransitionAllowed = (from, to) =>
  (SUPPLIER_TRANSITIONS[from] || []).includes(to);

/** 'Received' when every item is fully in, 'Partial' when some stock arrived, null when none did. */
export const derivePoReceiptStatus = (items) => {
  const list = items || [];
  if (!list.some((i) => Number(i.quantity_received || 0) > 0)) return null;
  return list.every((i) => Number(i.quantity_received || 0) >= Number(i.quantity || 0)) ? 'Received' : 'Partial';
};

export const updatePurchaseOrderStatus = (id, status = null, ...rest) => {
  let canonicalStatus = null;
  if (status) {
    canonicalStatus = PO_STATUSES.find((s) => s.toLowerCase() === String(status).toLowerCase());
    if (!canonicalStatus) {
      const err = new Error(`Invalid status. Allowed: ${PO_STATUSES.join(', ')}`);
      err.status = 400;
      return Promise.reject(err);
    }
  }
  return withPoLock(String(id), () => updatePurchaseOrderStatusUnlocked(id, canonicalStatus, ...rest));
};

const updatePurchaseOrderStatusUnlocked = async (id, status = null, items_received = [], expected_date = null, reason = null) => {
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

  if (Array.isArray(items_received) && items_received.length > 0) {
    for (const item of items_received) {
      validateNumberBound(item?.quantity_received_now, {
        label: 'Quantity received',
        min: LIMITS.PO_QTY_MIN,
        max: LIMITS.PO_QTY_MAX,
        allowZero: false
      });
      batchService.validateOptionalExpiryDate(item?.expiry_date, { rejectPast: true });
      batchService.validateOptionalBatchCode(item?.batch_code);
    }
  }

  // Each line is received by one Postgres function (batch + stock + quantity_received in one
  // transaction, capped at the remaining quantity), so a retried click can never double-count stock.
  const appliedReceipts = [];
  let receiveError = null;
  if (items_received && items_received.length > 0 && ['pending', 'proposal pending', 'partially accepted'].includes(currentStatusLower)) {
    const err = new Error(`This order is still "${existingPO.status}"; the supplier must accept it before stock can be received.`);
    err.status = 409;
    throw err;
  }
  // Stock can only be received once the supplier has actually sent it (Delivering) or part of it is in (Partial).
  if (items_received && items_received.length > 0 && ['accepted', 'to be delivered', 'postponed'].includes(currentStatusLower)) {
    const err = new Error(`This order is "${existingPO.status}", so it has not been sent yet. Receive it once the supplier marks it Delivering.`);
    err.status = 409;
    throw err;
  }
  if (items_received && items_received.length > 0 && !isTerminalStatus) {
    for (const item of items_received) {
      try {
      const rawQtyNow = validateNumberBound(item.quantity_received_now, {
        label: 'Quantity received',
        min: LIMITS.PO_QTY_MIN,
        max: LIMITS.PO_QTY_MAX,
        allowZero: false
      });

      const received = await batchService.receivePurchaseOrderItem({
        po_id: id,
        po_item_id: item.id,
        quantity: rawQtyNow,
        batch_code: item.batch_code || null,
        expiry_date: item.expiry_date || null,
        purchase_unit: item.purchase_unit || 'Unit'
      });
      if (!received) continue; // not on this PO, or nothing left to receive

      appliedReceipts.push({
        ingredient_id: received.ingredient_id,
        quantity_received_now: Number(received.quantity_received_now),
        conversion_factor: Number(received.conversion_factor),
        purchase_unit: item.purchase_unit || 'Unit',
        batch_code: received.batch?.batch_code || null,
        expiry_date: received.batch?.expiry_date || null
      });
      } catch (err) {
        // Earlier lines are already in stock; stop here, record them, then report the failure.
        if (appliedReceipts.length === 0) throw err;
        receiveError = err;
        break;
      }
    }
    if (receiveError && !status) status = 'Partial';
  }

  // Received/Partial must reflect what was actually received, not what the caller claims;
  // otherwise a bare status call could close the PO without adding any stock.
  if (status === 'Received' || status === 'Partial') {
    const { data: poItems, error: poItemsErr } = await supabase
      .from("purchase_order_items")
      .select("quantity, quantity_received")
      .eq("purchase_order_id", id);
    if (poItemsErr) throw poItemsErr;
    status = derivePoReceiptStatus(poItems);
    if (!status) {
      const err = new Error("Record the received quantities before marking this order Received.");
      err.status = 400;
      throw err;
    }
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

  // Conditional on the status we read: a concurrent writer (e.g. another server instance) that
  // already moved the PO makes this match zero rows instead of silently overwriting it.
  const writeStatus = (u) => {
    let q = supabase.from("purchase_orders").update(u).eq("id", id);
    q = existingPO.status == null ? q.is("status", null) : q.eq("status", existingPO.status);
    return q.select().single();
  };

  let data;
  let result = await writeStatus(updates);

  if (result.error && (result.error.code === '42703' || result.error.message?.includes('decline_reason') || result.error.message?.includes('cancellation_reason'))) {
    // If decline_reason or cancellation_reason column doesn't exist yet, retry without custom columns
    delete updates.decline_reason;
    delete updates.cancellation_reason;
    result = await writeStatus(updates);
    if (!result.error) {
      data = result.data;
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
    }
  }

  if (result.error) {
    if (result.error.code === 'PGRST116') {
      const err = new Error("Purchase order status changed while this update was in progress. Refresh and try again.");
      err.status = 409;
      throw err;
    }
    throw result.error;
  }
  data = data || result.data;
  if (receiveError) {
    receiveError.message = `${appliedReceipts.length} line(s) were received and saved; the rest failed: ${receiveError.message}`;
    throw receiveError;
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

  // Conditional write: a Received/Cancelled/in-delivery PO can't be reopened by a late supplier response.
  const { data: updatedPO, error: poErr } = await withPoLock(String(poId), () => supabase
    .from('purchase_orders')
    .update({ status: newPOStatus })
    .eq('id', poId)
    .in('status', SUPPLIER_RESPONSE_STATUSES)
    .select()
    .single());

  if (poErr?.code === 'PGRST116') {
    const err = new Error(`Item responses can only be submitted while the order is ${SUPPLIER_RESPONSE_STATUSES.join(' or ')}.`);
    err.status = 409;
    throw err;
  }
  if (poErr) throw poErr;

  await logAudit('SUPPLIER_PO_ITEM_RESPONSE', supplierUserId, {
    po_id: poId,
    items,
    new_status: newPOStatus
  });

  return updatedPO;
};

// Shop accepts or declines proposed delivery date for an unavailable item
export const respondToSupplierProposal = async (poId, itemId, decision, splitIntoBackorder, userId) => {
  if (!['ACCEPTED', 'DECLINED'].includes(decision)) {
    throw Object.assign(new Error("decision must be 'ACCEPTED' or 'DECLINED'."), { status: 400 });
  }

  const { data: statusPO, error: statusErr } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', poId)
    .maybeSingle();
  if (statusErr) throw statusErr;
  if (!statusPO) throw Object.assign(new Error('Purchase order not found.'), { status: 404 });
  if (statusPO.status !== 'Proposal Pending') {
    throw Object.assign(new Error(`Purchase order has no pending proposals (status: ${statusPO.status}).`), { status: 409 });
  }

  let backorderPO = null;

  if (decision === 'ACCEPTED') {
    const { data: origPO } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('id', poId)
      .single();

    const targetItem = origPO?.purchase_order_items?.find(i => i.id === itemId);

    // shortcut: bounded to the newest 500 proposal logs (no DB-side JSON filter), raise if POs outlive that window
    const { data: recentLogs } = await supabase
      .from('audit_logs')
      .select('details')
      .eq('action', 'SUPPLIER_PO_ITEM_RESPONSE')
      .order('created_at', { ascending: false })
      .limit(500);

    let proposedDate = origPO?.expected_date;
    for (const log of (recentLogs || [])) {
      try {
        const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (String(d?.po_id) === String(poId) && Array.isArray(d.items)) {
          const match = d.items.find(it => String(it.item_id) === String(itemId));
          if (match?.proposed_date) {
            proposedDate = match.proposed_date;
            break;
          }
        }
      } catch {
        // Ignore malformed audit JSON details
      }
    }

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

  // Audit only after the action succeeded
  await logAudit('SHOP_PO_PROPOSAL_RESPONSE', userId, {
    po_id: poId,
    item_id: itemId,
    decision,
    split_into_backorder: splitIntoBackorder
  });

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
        .eq('id', poId)
        .eq('status', 'Proposal Pending');
    }
  }

  return { success: true, backorderPO };
};

