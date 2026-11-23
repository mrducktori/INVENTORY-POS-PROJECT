// Page permissions that may be granted to Staff / Custom accounts.
// Keep in sync with src/utils/permissions.js (PERMISSION_GROUPS).
// Account management, CMS and Transaction Logs are intentionally excluded:
// those remain restricted to Admin / Owner.
export const GRANTABLE_PERMISSIONS = [
  'Dashboard',
  'POS',
  'ReportWastage',
  'Products',
  'ManageProducts',
  'RawMaterialTracker',
  'ProductStockTracker',
  'ManageRawMaterials',
  'LowStockAlerts',
  'StockReceived',
  'ManageSuppliers',
  'PurchaseOrders',
  'AuditLogs',
  'SalesReceiptJournal',
  'SalesSummaryReport',
  'Forecasting',
  'Reports',
];

/**
 * Validates and normalizes the permission/role-name fields for a user payload.
 * Returns { error } or { permissions, custom_role_name }.
 */
export const normalizeAccessFields = (role, permissions, customRoleName) => {
  if (role !== 'Staff' && role !== 'Custom') {
    return { permissions: null, custom_role_name: null };
  }

  let list = null;
  if (permissions !== undefined && permissions !== null) {
    if (!Array.isArray(permissions)) {
      return { error: 'Permissions must be a list of pages.' };
    }
    const invalid = permissions.filter((p) => !GRANTABLE_PERMISSIONS.includes(p));
    if (invalid.length) {
      return { error: `Invalid permissions: ${invalid.join(', ')}` };
    }
    list = [...new Set(permissions)];
  }

  if (role === 'Custom') {
    const name = typeof customRoleName === 'string' ? customRoleName.trim() : '';
    if (!name) return { error: 'Custom role name is required.' };
    if (name.length > 40) return { error: 'Custom role name must be 40 characters or fewer.' };
    if (!list || list.length === 0) {
      return { error: 'Select at least one page for the custom role.' };
    }
    return { permissions: list, custom_role_name: name };
  }

  // Staff: an empty list means "use the default Staff access"
  return { permissions: list && list.length ? list : null, custom_role_name: null };
};

