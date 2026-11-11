import { supabase } from '../config/supabaseClient.js';
import { getManilaISOString } from './dateUtils.js';

// A fallback system UUID used when no real user is known (e.g. failed login attempts).
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Infers entity_type and entity_id from the action name and details payload
 * so all columns in `audit_logs` (`action_type`, `entity_type`, `entity_id`, `new_value`)
 * are consistently populated in the database.
 */
function inferEntityMetadata(action = '', details = {}) {
  const act = String(action || '').toUpperCase();
  const d = details && typeof details === 'object' ? details : {};

  if (act.includes('PRODUCT') || d.product_id) {
    return { entity_type: 'PRODUCT', entity_id: d.product_id || d.id || null };
  }
  if (act.includes('RAW_MATERIAL') || act.includes('INGREDIENT') || d.ingredient_id) {
    return { entity_type: 'INGREDIENT', entity_id: d.ingredient_id || d.id || null };
  }
  if (act.includes('PURCHASE_ORDER') || act.includes('PO_') || d.po_id) {
    return { entity_type: 'PURCHASE_ORDER', entity_id: d.po_id || d.id || null };
  }
  if (act.includes('SUPPLIER') || d.supplier_id) {
    return { entity_type: 'SUPPLIER', entity_id: d.supplier_id || d.id || null };
  }
  if (act.includes('USER') || act === 'LOGIN' || act === 'LOGOUT' || d.target_user_id || d.new_user_id) {
    return { entity_type: 'USER', entity_id: d.target_user_id || d.new_user_id || d.user_id || null };
  }
  if (act.includes('SALE') || d.sale_id) {
    return { entity_type: 'SALE', entity_id: d.sale_id || d.id || null };
  }
  if (act.includes('WASTAGE')) {
    return { entity_type: 'WASTAGE', entity_id: d.ingredient_id || d.id || null };
  }
  if (act.includes('RECIPE') || d.recipe_id) {
    return { entity_type: 'RECIPE', entity_id: d.recipe_id || d.product_id || null };
  }
  if (act.includes('CMS') || d.section_key) {
    return { entity_type: 'CMS', entity_id: d.section_key || null };
  }
  if (act.includes('REQUEST') || d.request_id) {
    return { entity_type: 'REQUEST', entity_id: d.request_id || d.id || null };
  }
  return { entity_type: 'SYSTEM', entity_id: d.id || null };
}

function buildAuditRow(actionOrObj, userId, details = {}) {
  let action = actionOrObj;
  let resolvedUserId = userId;
  let resolvedDetails = details;
  let explicitEntityType = null;
  let explicitEntityId = null;
  let explicitNewValue = null;

  if (actionOrObj && typeof actionOrObj === 'object') {
    action = actionOrObj.action || actionOrObj.action_type || 'SYSTEM';
    resolvedUserId = actionOrObj.user_id || userId || null;
    resolvedDetails = actionOrObj.details ?? {};
    explicitEntityType = actionOrObj.entity_type || null;
    explicitEntityId = actionOrObj.entity_id || null;
    explicitNewValue = actionOrObj.new_value || null;
  }

  const detailsObj =
    typeof resolvedDetails === 'object' && resolvedDetails !== null
      ? resolvedDetails
      : (() => {
          try {
            return JSON.parse(resolvedDetails);
          } catch {
            return { message: String(resolvedDetails || '') };
          }
        })();

  const detailsStr =
    typeof resolvedDetails === 'string'
      ? resolvedDetails
      : JSON.stringify(resolvedDetails ?? {});

  const inferred = inferEntityMetadata(action, detailsObj);
  const entity_type = explicitEntityType || inferred.entity_type;
  const rawEntityId = explicitEntityId || inferred.entity_id || resolvedUserId || null;
  const entity_id = rawEntityId ? String(rawEntityId) : null;

  return {
    action,
    action_type: action,
    entity_type,
    entity_id,
    user_id: resolvedUserId || SYSTEM_USER_ID,
    details: detailsStr,
    new_value: explicitNewValue || detailsObj,
    created_at: getManilaISOString()
  };
}

/**
 * Write a single audit log entry to `audit_logs` in Supabase.
 * Supports both positional `(action, userId, details)` and object `({ action, user_id, details, ... })` signatures.
 */
export async function logAudit(actionOrObj, userId, details = {}) {
  try {
    const row = buildAuditRow(actionOrObj, userId, details);
    const { error } = await supabase.from('audit_logs').insert([row]);

    if (error) {
      console.error('[AUDIT] Insert failed:', error.message, '| Action:', row.action);
    }
  } catch (err) {
    // Never crash the main request because of a failed audit write
    console.error('[AUDIT] Exception writing log:', err.message);
  }
}

/**
 * Batch-inserts multiple audit log entries in a single Supabase round-trip.
 * Accepts an array of positional tuples/arrays or `{ action, user_id, details, ... }` objects.
 */
export async function logAuditBatch(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  try {
    const rows = entries.map((entry) =>
      Array.isArray(entry) ? buildAuditRow(entry[0], entry[1], entry[2]) : buildAuditRow(entry)
    );
    const { error } = await supabase.from('audit_logs').insert(rows);
    if (error) {
      console.error('[AUDIT] Batch insert failed:', error.message);
    }
  } catch (err) {
    console.error('[AUDIT] Exception writing batch logs:', err.message);
  }
}
