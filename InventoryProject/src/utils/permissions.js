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
    pages: [{ key: 'Dashboard', label: 'Dashboard Overview' }],
  },
  {
    label: 'POS & Register',
    pages: [
      { key: 'POS', label: 'POS Register, KDS, Voids & Shifts' },
    ],
  },
  {
    label: 'Products & Recipes',
    pages: [
      { key: 'Products', label: 'Menu Catalog' },
      { key: 'ManageProducts', label: 'Add / Modify Products & Categories' },
    ],
  },
  {
    label: 'Inventory & Batches',
    pages: [
      { key: 'RawMaterialTracker', label: 'Raw Material Batches & Stocktake' },
      { key: 'LowStockAlerts', label: 'Low-Stock & Expiry Alerts' },
      { key: 'StockReceived', label: 'Receive Stock & OCR' },
      { key: 'ManageRawMaterials', label: 'Manage Raw Materials' },
      { key: 'ProductStockTracker', label: 'Direct Product Stock' },
      { key: 'ReportWastage', label: 'Report Wastage' },
    ],
  },
  {
    label: 'Purchasing & Suppliers',
    pages: [
      { key: 'PurchaseOrders', label: 'Purchase Orders' },
      { key: 'ManageSuppliers', label: 'Manage Suppliers' },
    ],
  },
  {
    label: 'Analytics & Reports',
    pages: [
      { key: 'Forecasting', label: 'AI Demand Forecasting' },
      { key: 'SalesSummaryReport', label: 'Sales Summary (D/W/M/Y)' },
      { key: 'Reports', label: 'Reports & Exports' },
      { key: 'SalesReceiptJournal', label: 'Receipt Journal' },
      { key: 'AuditLogs', label: 'Audit Logs' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.pages.map((p) => p.key));

// Default access for Staff accounts that have no custom permission list
export const STAFF_DEFAULT_PERMISSIONS = [
  'POS',
  'Products',
  'RawMaterialTracker',
  'LowStockAlerts',
  'StockReceived',
  'ProductStockTracker',
  'ReportWastage',
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

/** Whether the user may open the given Dashboard tab (supports base/sub routes like POS/KDS). */
export const canAccess = (user, tab) => {
  if (!user) return false;
  const [baseTab, subTab] = String(tab || '').split('/');
  if (!baseTab) return false;
  if (OWNER_ONLY_TABS.includes(baseTab)) return user.role === 'Owner';
  if (baseTab === 'POS' && subTab === 'SETUP') {
    return user.role === 'Owner' || user.role === 'Admin';
  }
  if (baseTab === 'AccountManager') {
    return user.role === 'Owner' || user.role === 'Admin';
  }
  if (user.role === 'Owner' || user.role === 'Admin') return true;
  if (user.role === 'Supplier') return baseTab === 'SupplierPortal';
  return getUserPermissions(user).includes(baseTab);
};

/** Display name for a user's role (custom role name when applicable). */
export const getRoleLabel = (user) =>
  user?.role === 'Custom' ? user.custom_role_name || 'Custom' : user?.role || '';

