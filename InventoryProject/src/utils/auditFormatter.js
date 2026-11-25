const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTION_LABELS = {
  SALE: 'Sale Completed',
  SALE_COMPLETED: 'Sale Completed',
  SALE_CANCELLED: 'Sale Cancelled',
  SALE_VOIDED: 'Sale Voided',
  SALE_RETURNED: 'Items Returned',
  SALE_REFUNDED: 'Sale Refunded',
  PRODUCT_DEDUCTED: 'Product Sold',
  INGREDIENT_DEDUCTED: 'Ingredient Used',
  PURCHASE_ORDER_CREATED: 'PO Created',
  PURCHASE_ORDER_STATUS_UPDATED: 'PO Status Updated',
  PURCHASE_ORDER_CANCELLED: 'PO Cancelled',
  PURCHASE_ORDER_RESCHEDULED: 'PO Rescheduled',
  SUPPLIER_PO_DECLINED: 'PO Declined by Supplier',
  SUPPLIER_PO_STATUS_UPDATED: 'Supplier Updated PO',
  SUPPLIER_PO_ITEM_RESPONSE: 'Supplier Item Proposal',
  SHOP_PO_PROPOSAL_RESPONSE: 'PO Proposal Reviewed',
  BACKORDER_PO_CREATED: 'Backorder PO Created',
  PRODUCT_CREATED: 'Product Created',
  PRODUCT_UPDATED: 'Product Updated',
  PRODUCT_ARCHIVED: 'Product Archived',
  PRODUCT_RESTORED: 'Product Restored',
  PRODUCT_DELETED: 'Product Deleted',
  PRODUCT_STOCK_RECEIVED: 'Product Stock Received',
  RECIPE_CREATED: 'Recipe Ingredient Added',
  RECIPE_UPDATED: 'Recipe Updated',
  RECIPE_DELETED: 'Recipe Ingredient Removed',
  RAW_MATERIAL_CREATED: 'Material Added',
  RAW_MATERIAL_UPDATED: 'Material Updated',
  RAW_MATERIAL_DELETED: 'Material Deleted',
  RAW_MATERIAL_ARCHIVED: 'Material Archived',
  RAW_MATERIAL_RESTORED: 'Material Restored',
  RAW_MATERIAL_STOCK_RECEIVED: 'Material Stock Received',
  RAW_MATERIAL_CATEGORY_CREATED: 'Material Category Added',
  RAW_MATERIAL_CATEGORY_RENAMED: 'Material Category Renamed',
  RAW_MATERIAL_CATEGORY_DELETED: 'Material Category Deleted',
  CATEGORY_CREATED: 'Category Created',
  CATEGORY_RENAMED: 'Category Renamed',
  CATEGORY_DELETED: 'Category Deleted',
  CATEGORY_SETTINGS_UPDATED: 'Category Defaults Updated',
  STOCKTAKE_RECONCILED: 'Stock Count Saved',
  OCR_DOCUMENT_SCANNED: 'OCR Document Scanned',
  WASTAGE: 'Wastage Reported',
  SUPPLIER_CREATED: 'Supplier Added',
  SUPPLIER_UPDATED: 'Supplier Updated',
  SUPPLIER_ARCHIVED: 'Supplier Archived',
  SUPPLIER_RESTORED: 'Supplier Restored',
  SUPPLIER_CATALOG_PRICES_UPDATED: 'Supplier Prices Updated',
  SUPPLIER_PRICE_UPDATES_READ: 'Supplier Price Alerts Viewed',
  SHIFT_OPENED: 'Shift Opened',
  SHIFT_Z_READING_CLOSED: 'Shift Closed (Z-Reading)',
  PIN_OVERRIDE_APPROVED: 'Manager PIN Approved',
  MANAGER_PIN_UPDATED: 'Manager PIN Updated',
  POS_SETTINGS_UPDATED: 'POS Setup Updated',
  USER_CREATED: 'Account Created',
  USER_UPDATED: 'Account Updated',
  USER_STATUS_CHANGED: 'Account Status Changed',
  USER_DELETED: 'Account Deleted',
  LOGIN: 'User Signed In',
  LOGOUT: 'User Signed Out',
  LOGOUT_INACTIVE: 'Inactivity Sign Out',
  SESSION_REPLACED: 'Session Replaced',
  LOGIN_FAILED: 'Failed Sign In',
  CMS_CONTENT_UPDATED: 'Website Content Updated',
  CMS_IMAGE_UPLOADED: 'Website Image Uploaded',
  STAFF_REQUEST_CREATED: 'Staff Request Submitted',
  STAFF_REQUEST_STATUS_UPDATED: 'Staff Request Reviewed',
};

const HIDDEN_DETAIL_KEYS = new Set([
  'id',
  'product_id',
  'ingredient_id',
  'supplier_id',
  'po_id',
  'sale_id',
  'recipe_id',
  'request_id',
  'shift_id',
  'new_user_id',
  'target_user_id',
  'user_id',
  'approved_by_id',
  'requested_by_id',
  'updated_by_id',
  'declinereason',
  'decline_reason',
  'cancellation_reason',
  'reschedule_reason'
]);

const shortCode = (id) => {
  if (!id) return '';
  const str = String(id).trim();
  if (!str) return '';
  return str.slice(0, 8).toUpperCase();
};

const formatCurrency = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00';
};

const parseDetailsObject = (rawDetails) => {
  if (!rawDetails) return { obj: {}, text: '' };
  if (typeof rawDetails === 'object' && !Array.isArray(rawDetails)) {
    return { obj: rawDetails, text: '' };
  }
  const str = String(rawDetails).trim();
  if (!str) return { obj: {}, text: '' };
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { obj: parsed, text: '' };
      }
    } catch {
      // fall through as plain string
    }
  }
  return { obj: {}, text: str };
};

export const formatActionLabel = (action) => {
  if (!action) return 'System Event';
  const upper = String(action).trim().toUpperCase();
  if (ACTION_LABELS[upper]) return ACTION_LABELS[upper];
  return upper
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
};

export const getActionCategory = (action) => {
  if (!action) return { label: 'System', css: 'system' };
  const a = String(action).toUpperCase();
  if (a.startsWith('SALE') || a === 'PRODUCT_DEDUCTED') return { label: 'Sale', css: 'sale' };
  if (a.includes('PURCHASE_ORDER') || a.includes('PO_') || a.startsWith('SUPPLIER')) {
    return { label: 'Purchase Order', css: 'po' };
  }
  if (a.startsWith('PRODUCT_STOCK')) return { label: 'Stock (Product)', css: 'stock' };
  if (a.startsWith('RAW_MATERIAL_STOCK') || a === 'STOCKTAKE_RECONCILED' || a === 'INGREDIENT_DEDUCTED') {
    return { label: 'Stock (Raw)', css: 'stock' };
  }
  if (a === 'WASTAGE') return { label: 'Wastage', css: 'wastage' };
  if (a.startsWith('SHIFT') || a.includes('PIN') || a.startsWith('POS_')) {
    return { label: 'POS / Shift', css: 'pos' };
  }
  if (a.startsWith('PRODUCT') || a.startsWith('RECIPE') || a.startsWith('CATEGORY')) {
    return { label: 'Catalog', css: 'catalog' };
  }
  if (a.startsWith('USER') || a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('SESSION')) {
    return { label: 'Security', css: 'security' };
  }
  return { label: 'System', css: 'system' };
};

export const formatEntityReference = (log) => {
  if (!log) return '—';
  const { obj } = parseDetailsObject(log.details);
  if (obj.receipt_number) return `Receipt #${obj.receipt_number}`;
  if (obj.po_id) return `PO #${shortCode(obj.po_id)}`;
  if (obj.name) return String(obj.name);
  if (obj.category) return String(obj.category);
  if (obj.username) return `@${obj.username}`;

  const entityType = String(log.entity_type || '').trim().toUpperCase();
  const entityId = log.entity_id ? String(log.entity_id).trim() : '';
  if (!entityType) return '—';

  const friendlyType = entityType
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');

  if (!entityId || UUID_REGEX.test(entityId)) {
    return entityType === 'PURCHASE_ORDER' && entityId ? `PO #${shortCode(entityId)}` : friendlyType;
  }
  return `${friendlyType} (${entityId})`;
};

export const formatAuditDescription = (action, rawDetails) => {
  const act = String(action || '').trim().toUpperCase();
  const { obj: d, text: plainText } = parseDetailsObject(rawDetails);
  if (plainText) {
    return plainText;
  }

  const pickReason = () =>
    String(d.reason || d.cancellation_reason || d.decline_reason || d.declineReason || d.reschedule_reason || '').trim();

  switch (act) {
    case 'SALE':
    case 'SALE_COMPLETED': {
      if (d.message) return String(d.message);
      if (Array.isArray(d.items)) {
        const itemNames = d.items.map((i) => `${i.qty}x ${i.name}`).join(', ');
        return `Receipt #${d.receipt_number || 'N/A'} — Total: ${formatCurrency(d.total)} (${itemNames})`;
      }
      if (d.total !== undefined) {
        return `Completed ${d.order_type ? String(d.order_type).replace(/_/g, '-') + ' ' : ''}sale for ${formatCurrency(d.total)} (${d.items ?? '?'} item(s)).`;
      }
      break;
    }
    case 'SALE_CANCELLED':
      return `Cancelled sale${d.receipt_number ? ` Receipt #${d.receipt_number}` : ''}${d.reason ? ` — Reason: ${d.reason}` : ''}.`;
    case 'SALE_VOIDED':
    case 'SALE_REFUNDED':
    case 'SALE_RETURNED': {
      const verb = act === 'SALE_REFUNDED' ? 'Refunded' : act === 'SALE_RETURNED' ? 'Processed return for' : 'Voided';
      const ref = d.receipt_number ? `Receipt #${d.receipt_number}` : `Sale #${shortCode(d.sale_id)}`;
      const amt = d.amount_voided !== undefined ? ` for ${formatCurrency(d.amount_voided)}` : '';
      const policy =
        d.restock_policy === 'WASTAGE'
          ? ' (Logged as Wastage)'
          : d.restock_policy === 'RESTOCK'
          ? ' (Stock Restored)'
          : '';
      const rsn = pickReason();
      const approver = d.approved_by_name ? ` — Approved by ${d.approved_by_name}` : '';
      return `${verb} ${ref}${amt}${policy}${rsn ? ` — Reason: ${rsn}` : ''}${approver}.`;
    }
    case 'PRODUCT_DEDUCTED':
      return `Deducted ${Math.abs(Number(d.quantity) || 0)} unit(s) of "${d.name || 'Product'}" on sale (New stock: ${d.new_stock ?? '—'}).`;
    case 'INGREDIENT_DEDUCTED':
      return `Consumed ${Math.abs(Number(d.quantity) || 0)} of "${d.name || 'Material'}" on sale (New stock: ${d.new_stock ?? '—'}).`;
    case 'PIN_OVERRIDE_APPROVED':
      return `Manager PIN approved by ${d.approved_by_name || 'Manager'}${d.approved_by_role ? ` (${d.approved_by_role})` : ''} for ${String(d.action_type || 'override').toLowerCase()}.`;
    case 'MANAGER_PIN_UPDATED':
      return `Updated Manager approval PIN${d.updated_by ? ` (by ${d.updated_by})` : ''}.`;
    case 'POS_SETTINGS_UPDATED':
      return `Updated POS Store Setup (${d.promo_count ?? 0} promo code(s) active)${d.updated_by ? ` by ${d.updated_by}` : ''}.`;
    case 'SHIFT_OPENED':
      return `Opened cashier shift (${d.cashier_name || 'Staff'}) with ${formatCurrency(d.opening_cash || 0)} opening drawer cash.`;
    case 'SHIFT_Z_READING_CLOSED':
      return `Closed cashier shift (Z-Reading) — Net Sales: ${formatCurrency(d.net_sales || 0)}, Expected Cash: ${formatCurrency(d.expected_drawer_cash || 0)}, Counted: ${formatCurrency(d.actual_cash_counted || 0)}, Variance: ${formatCurrency(d.short_over || 0)}.`;
    case 'PURCHASE_ORDER_CREATED':
      return `Created Purchase Order #${shortCode(d.po_id) || 'NEW'} totaling ${formatCurrency(d.total_amount || 0)}${d.notes ? ` — "${d.notes}"` : ''}.`;
    case 'PURCHASE_ORDER_CANCELLED': {
      const rsn = pickReason();
      return `Cancelled Purchase Order #${shortCode(d.po_id)}${rsn ? ` — Reason: ${rsn}` : ''}.`;
    }
    case 'SUPPLIER_PO_DECLINED': {
      const rsn = pickReason();
      return `Supplier declined Purchase Order #${shortCode(d.po_id)}${rsn ? ` — Reason: ${rsn}` : ''}.`;
    }
    case 'PURCHASE_ORDER_RESCHEDULED': {
      const rsn = pickReason();
      return `Rescheduled Purchase Order #${shortCode(d.po_id)}${d.expected_date ? ` to ${d.expected_date}` : ''}${rsn ? ` — Reason: ${rsn}` : ''}.`;
    }
    case 'PURCHASE_ORDER_STATUS_UPDATED':
    case 'SUPPLIER_PO_STATUS_UPDATED': {
      const rsn = pickReason();
      return `Purchase Order #${shortCode(d.po_id)} status changed to ${d.new_status || 'Updated'}${d.expected_date ? ` (ETA: ${d.expected_date})` : ''}${rsn ? ` — Reason: ${rsn}` : ''}.`;
    }
    case 'BACKORDER_PO_CREATED':
      return `Created backorder PO #${shortCode(d.po_id)} for remaining undelivered items.`;
    case 'STOCKTAKE_RECONCILED':
      return `Saved stock count across ${d.total_counted ?? d.items_counted ?? 0} material(s) (${d.adjusted_count ?? 0} adjusted).`;
    case 'OCR_DOCUMENT_SCANNED':
      return `Scanned inventory document via OCR (${d.items_count ?? d.matched_count ?? 0} item(s) detected).`;
    case 'WASTAGE':
      return `Reported wastage of ${d.quantity} ${d.unit || 'unit(s)'} for "${d.ingredient_name || 'Material'}"${d.reason ? ` — Reason: ${d.reason}` : ''}.`;
    case 'LOGIN':
      return `${d.username || 'User'} (${d.role || 'Staff'}) signed in.`;
    case 'LOGOUT':
    case 'LOGOUT_INACTIVE':
      if (act === 'LOGOUT_INACTIVE' || (d.reason && String(d.reason).toLowerCase().includes('inactivity'))) {
        return `${d.username || 'User'} (${d.role || 'Staff'}) was automatically signed out due to inactivity.`;
      }
      return `${d.username || 'User'} (${d.role || 'Staff'}) signed out${d.reason ? ` (${d.reason})` : ''}.`;
    case 'SESSION_REPLACED':
      return `${d.username || 'User'} signed in on a new device; previous active session was closed.`;
    case 'LOGIN_FAILED':
      return `Failed login attempt for "${d.username || 'unknown'}"${d.reason ? ` — ${d.reason}` : ''}.`;
    case 'PRODUCT_CREATED':
      return `Created product "${d.name}" under ${d.category} at ${formatCurrency(d.price)}.`;
    case 'PRODUCT_UPDATED':
      return `Updated product "${d.name}" (${d.category}, ${formatCurrency(d.price)}).`;
    case 'PRODUCT_ARCHIVED':
      return `Archived product "${d.name}".`;
    case 'PRODUCT_RESTORED':
      return `Restored product "${d.name}" to active menu.`;
    case 'PRODUCT_DELETED':
      return `Permanently deleted product "${d.name}".`;
    case 'PRODUCT_STOCK_RECEIVED':
      return `Received ${d.quantity_added} unit(s) of "${d.name}" (New stock: ${d.new_stock}).`;
    case 'RAW_MATERIAL_CREATED':
      return `Added raw material "${d.name}" (${d.unit}).`;
    case 'RAW_MATERIAL_UPDATED':
      return `Updated raw material "${d.name}" (${d.unit}, alert at ${d.low_stock_alert}).`;
    case 'RAW_MATERIAL_DELETED':
      return `Deleted raw material "${d.name}".`;
    case 'RAW_MATERIAL_ARCHIVED':
      return `Archived raw material "${d.name}".`;
    case 'RAW_MATERIAL_RESTORED':
      return `Restored raw material "${d.name}" to active stock.`;
    case 'RAW_MATERIAL_STOCK_RECEIVED': {
      const packInfo = d.purchase_qty && d.purchase_unit ? ` (${d.purchase_qty} ${d.purchase_unit})` : '';
      const poRef = d.po_id ? ` via PO #${shortCode(d.po_id)}` : '';
      const batchNote = d.batch_code ? ` [Batch ${d.batch_code}]` : '';
      return `Received ${d.quantity_added} ${d.unit || ''}${packInfo} of "${d.name}"${poRef}${batchNote}. New stock: ${d.new_stock} ${d.unit || ''}.`;
    }
    case 'RAW_MATERIAL_CATEGORY_CREATED':
      return `Created raw material category "${d.category || d.name}".`;
    case 'RAW_MATERIAL_CATEGORY_RENAMED':
      return `Renamed raw material category "${d.old_category}" to "${d.new_category}".`;
    case 'RAW_MATERIAL_CATEGORY_DELETED':
      return `Deleted raw material category "${d.category}".`;
    case 'CATEGORY_CREATED':
      return `Created product category "${d.category}" (${d.prep_station || 'Barista'} station).`;
    case 'CATEGORY_RENAMED':
      return `Renamed category "${d.old_category}" to "${d.new_category}" (${d.moved_count ?? 0} product(s) moved).`;
    case 'CATEGORY_DELETED':
      return `Deleted unused category "${d.category}".`;
    case 'CATEGORY_SETTINGS_UPDATED':
      return `Updated category defaults for "${d.category}" (${d.prep_station || 'Barista'} station).`;
    case 'SUPPLIER_CREATED':
      return `Added supplier "${d.name}".`;
    case 'SUPPLIER_UPDATED':
      return `Updated supplier "${d.name}".`;
    case 'SUPPLIER_ARCHIVED':
      return `Archived supplier${d.name ? ` "${d.name}"` : ''}.`;
    case 'SUPPLIER_RESTORED':
      return `Restored supplier${d.name ? ` "${d.name}"` : ''}.`;
    case 'USER_CREATED':
      return `Created ${d.role} account for "${d.name}" (@${d.username}).`;
    case 'USER_UPDATED':
      return `Updated account @${d.username} (${d.name}, role: ${d.role}).`;
    case 'USER_STATUS_CHANGED':
      return `Changed account status of "${d.name}" to ${d.new_status}.`;
    case 'USER_DELETED':
      return `Permanently deleted account "${d.name || d.username || 'User'}".`;
    case 'CMS_CONTENT_UPDATED':
      return `Updated website section "${d.section_key || 'content'}"${d.updated_by ? ` by ${d.updated_by}` : ''}.`;
    case 'CMS_IMAGE_UPLOADED':
      return `Uploaded new image asset to website CMS.`;
    default:
      break;
  }

  const entries = Object.entries(d).filter(([k, v]) => {
    const keyLower = String(k).toLowerCase();
    if (HIDDEN_DETAIL_KEYS.has(keyLower) || keyLower.endsWith('_id')) return false;
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'string' && UUID_REGEX.test(v.trim())) return false;
    return true;
  });

  if (entries.length === 0) {
    return formatActionLabel(act);
  }

  const seenValues = new Set();
  const formattedParts = [];
  for (const [k, v] of entries) {
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (keyIsDuplicateValue(k, valStr, seenValues)) continue;
    seenValues.add(valStr);
    formattedParts.push(`${label}: ${valStr}`);
  }
  return formattedParts.join(' • ');
};

function keyIsDuplicateValue(key, valStr, seenValues) {
  if (!valStr) return true;
  if (key.toLowerCase().includes('reason') && seenValues.has(valStr)) return true;
  return false;
}
