// ---------------------------------------------------------------------------
// Page-level permissions
// Permission keys are the same values used for Dashboard tabs. Staff and
// Custom accounts are restricted to their `permissions` list; Admin, Owner and
// Supplier keep their fixed built-in access.
//
// Keep in sync with server/utils/permissions.js (GRANTABLE_PERMISSIONS).
// ---------------------------------------------------------------------------

export const PERMISSION_GROUPS = [
  {
    label: 'Dashboard Overview',
    pages: [{ key: 'Dashboard', label: 'Dashboard' }],
  },
  {
    label: 'POS Terminal',
    pages: [
      { key: 'POS', label: 'Sales Console' },
      { key: 'ReportWastage', label: 'Report Wastage' },
    ],
  },
  {
    label: 'Product Management',
    pages: [
      { key: 'Products', label: 'Product List' },
      { key: 'ManageProducts', label: 'Manage Products' },
    ],
  },
  {
    label: 'Inventory Control',
    pages: [
      { key: 'RawMaterialTracker', label: 'Raw Material Stock' },
      { key: 'ProductStockTracker', label: 'Product Stock' },
      { key: 'ManageRawMaterials', label: 'Material Inventory' },
      { key: 'ManageSuppliers', label: 'Manage Suppliers' },
      { key: 'PurchaseOrders', label: 'Purchase Orders' },
    ],
  },
  {
    label: 'Logs & Reports',
    pages: [
      { key: 'AuditLogs', label: 'Audit Logs' },
      { key: 'SalesReceiptJournal', label: 'Receipt Journal' },
      { key: 'Forecasting', label: 'Demand Forecasting' },
      { key: 'Reports', label: 'Reports Module' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.pages.map((p) => p.key));

// Default access for Staff accounts that have no custom permission list
export const STAFF_DEFAULT_PERMISSIONS = [
  'POS',
  'ReportWastage',
  'Products',
  'RawMaterialTracker',
  'ProductStockTracker',
];

// Tabs that are never grantable through page permissions
const OWNER_ONLY_TABS = ['TransactionLogs'];

/** True for accounts whose access is driven by a permission list. */
export const usesPagePermissions = (user) =>
  !!user && (user.role === 'Staff' || user.role === 'Custom');

/** Returns the effective permission list for Staff/Custom accounts. */
export const getUserPermissions = (user) => {
  if (!usesPagePermissions(user)) return [];
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p));
  }
  return user.role === 'Staff' ? STAFF_DEFAULT_PERMISSIONS : [];
};

/** Whether the user may open the given Dashboard tab. */
export const canAccess = (user, tab) => {
  if (!user) return false;
  if (OWNER_ONLY_TABS.includes(tab)) return user.role === 'Owner';
  if (user.role === 'Owner' || user.role === 'Admin') return true;
  if (user.role === 'Supplier') return tab === 'SupplierPortal';
  return getUserPermissions(user).includes(tab);
};

/** Display name for a user's role (custom role name when applicable). */
export const getRoleLabel = (user) =>
  user?.role === 'Custom' ? user.custom_role_name || 'Custom' : user?.role || '';

