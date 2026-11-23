// Keep in sync with STAFF_DEFAULT_PERMISSIONS in src/utils/permissions.js.
const STAFF_DEFAULT_PERMISSIONS = [
  'POS',
  'Products',
  'RawMaterialTracker',
  'LowStockAlerts',
  'StockReceived',
  'ProductStockTracker',
  'ReportWastage',
];

const hasAnyPermission = (user, keys) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  let held = [];
  if (Array.isArray(user?.permissions) && user.permissions.length > 0) held = user.permissions;
  else if (role === 'staff') held = STAFF_DEFAULT_PERMISSIONS;
  else return false;
  return keys.some((k) => held.includes(k));
};

/** Allow Owner/Admin, or Staff/Custom holding ANY of the given page permissions. */
export const requirePermission = (...keys) => (req, res, next) => {
  if (hasAnyPermission(req.user, keys)) return next();
  return res.status(403).json({ error: 'You do not have access to this page.' });
};
