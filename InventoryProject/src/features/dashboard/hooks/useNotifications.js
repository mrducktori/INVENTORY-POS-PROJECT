import { useState, useEffect, useMemo, useCallback } from 'react';
import { getPurchaseOrders, getSupplierPriceUpdates } from '../../../api/purchasingApi.js';
import { getDashboardStats } from '../../../api/dashboardApi.js';
import { supabase } from '../../../config/supabaseClient.js';
import { formatDisplayDate } from '../../../utils/dateUtils.js';
import { formatQuantity } from '../../../utils/productUtils.js';
import { canAccess } from '../../../utils/permissions.js';
import { getCurrentUser } from '../../../utils/authUtils.js';

export const EMPTY_LOW_STOCK = [];

const getReadStorageKey = (userId) => `coftea_inbox_read_${userId || 'guest'}_v2`;
const getDismissedStorageKey = (userId) => `coftea_inbox_dismissed_${userId || 'guest'}_v2`;

const loadStoredArray = (key, fallbackKey = null) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    if (fallbackKey) {
      const fallback = localStorage.getItem(fallbackKey);
      return fallback ? JSON.parse(fallback) : [];
    }
    return [];
  } catch {
    return [];
  }
};

/**
 * Role-Based Notification Access Policy
 * Determines if a given notification should be delivered to the specified user.
 */
export const isNotificationAllowedForUser = (notification, user) => {
  if (!user) return false;

  const rawRole = user.role || '';
  const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();

  // 1. External Suppliers: Only allowed to inspect POs specifically addressed to them
  if (role === 'Supplier') {
    if (notification.category !== 'PO') return false;
    if (user.supplier_id && notification.supplierId && notification.supplierId !== user.supplier_id) {
      return false;
    }
    return true;
  }

  // 2. Executive Owners and System Administrators: Full 360-degree operational visibility
  if (role === 'Owner' || role === 'Admin') {
    return true;
  }

  // 3. Frontline Operations Staff (Cashiers, Baristas, Crew)
  if (role === 'Staff') {
    // Supplier price changes are confidential procurement matters — hidden from Staff
    if (notification.category === 'SUPPLIER') return false;

    // Purchase Order updates: Regular staff do not manage procurement or wholesale spend.
    // Only surface POs if the user has been explicitly granted PurchaseOrders permission.
    if (notification.category === 'PO') {
      return canAccess(user, 'PurchaseOrders');
    }

    // Stock Alerts (Stockouts & Low Stock):
    // Crucial for frontliners to know what cannot be punched, brewed, or what needs replenishment!
    if (notification.category === 'STOCK') {
      return true;
    }

    return false;
  }

  // 4. Custom Accounts (Granular permission evaluation)
  if (role === 'Custom') {
    if (notification.category === 'SUPPLIER') {
      return canAccess(user, 'ManageSuppliers');
    }
    if (notification.category === 'PO') {
      return canAccess(user, 'PurchaseOrders');
    }
    if (notification.category === 'STOCK') {
      return (
        canAccess(user, 'ProductStockTracker') ||
        canAccess(user, 'RawMaterialTracker') ||
        canAccess(user, 'ManageRawMaterials') ||
        canAccess(user, 'POS') ||
        canAccess(user, 'Products')
      );
    }
    return false;
  }

  return false;
};

/**
 * Resolves the destination navigation tab for a notification based on user permissions.
 * Prevents broken action buttons that link to forbidden pages.
 */
export const resolveNotificationAction = (notification, user) => {
  if (!user) return { actionTab: null, actionLabel: null };

  if (notification.category === 'STOCK') {
    const isPcs = notification.unit === 'PCS';
    const primaryTab = isPcs ? 'ProductStockTracker' : 'RawMaterialTracker';
    if (canAccess(user, primaryTab)) {
      return { actionTab: primaryTab, actionLabel: 'Inspect Stock' };
    }
    if (canAccess(user, 'RawMaterialTracker')) {
      return { actionTab: 'RawMaterialTracker', actionLabel: 'Inspect Stock' };
    }
    if (canAccess(user, 'ProductStockTracker')) {
      return { actionTab: 'ProductStockTracker', actionLabel: 'Inspect Stock' };
    }
    if (canAccess(user, 'POS')) {
      return { actionTab: 'POS', actionLabel: 'Open POS' };
    }
    return { actionTab: null, actionLabel: null };
  }

  if (notification.category === 'PO') {
    if (user.role === 'Supplier') {
      return { actionTab: 'SupplierPortal', actionLabel: 'View in Portal' };
    }
    if (canAccess(user, 'PurchaseOrders')) {
      return { actionTab: 'PurchaseOrders', actionLabel: notification.defaultActionLabel || 'View Order' };
    }
    return { actionTab: null, actionLabel: null };
  }

  if (notification.category === 'SUPPLIER') {
    if (canAccess(user, 'ManageSuppliers')) {
      return { actionTab: 'ManageSuppliers', actionLabel: 'Inspect Catalog' };
    }
    return { actionTab: null, actionLabel: null };
  }

  return { actionTab: null, actionLabel: null };
};

// Shared singleton state across all mounted useNotifications() callers
const sharedStore = {
  orders: [],
  internalLowStock: [],
  priceUpdates: [],
  loading: true,
  userStates: {}, // { [userId]: { readIds: [], dismissedIds: [] } }
  lastPoFetchTime: 0,
  lastPriceFetchTime: 0,
  lastLowStockTime: 0,
  poPromise: null,
  pricePromise: null,
  lowStockPromise: null,
  channel: null,
  subscriberCount: 0,
  listeners: new Set()
};

const notifyListeners = () => {
  sharedStore.listeners.forEach((listener) => listener({ ...sharedStore }));
};

const getUserState = (userId) => {
  const key = userId || 'guest';
  if (!sharedStore.userStates[key]) {
    sharedStore.userStates[key] = {
      readIds: loadStoredArray(getReadStorageKey(key), 'coftea_inbox_read_v1'),
      dismissedIds: loadStoredArray(getDismissedStorageKey(key), 'coftea_inbox_dismissed_v1')
    };
  }
  return sharedStore.userStates[key];
};

const fetchSharedPOs = async (force = false) => {
  const now = Date.now();
  if (!force && sharedStore.lastPoFetchTime > 0 && now - sharedStore.lastPoFetchTime < 15000) {
    return sharedStore.orders;
  }
  if (sharedStore.poPromise) return sharedStore.poPromise;

  sharedStore.lastPoFetchTime = now;
  sharedStore.poPromise = getPurchaseOrders()
    .then((data) => {
      sharedStore.orders = Array.isArray(data) ? data : [];
      return sharedStore.orders;
    })
    .catch((err) => {
      console.error('Failed to load purchase orders for notifications:', err);
      return sharedStore.orders;
    })
    .finally(() => {
      sharedStore.loading = false;
      sharedStore.poPromise = null;
      notifyListeners();
    });

  return sharedStore.poPromise;
};

const fetchSharedPriceUpdates = async (force = false) => {
  const now = Date.now();
  if (!force && sharedStore.lastPriceFetchTime > 0 && now - sharedStore.lastPriceFetchTime < 30000) {
    return sharedStore.priceUpdates;
  }
  if (sharedStore.pricePromise) return sharedStore.pricePromise;

  sharedStore.lastPriceFetchTime = now;
  sharedStore.pricePromise = getSupplierPriceUpdates()
    .then((data) => {
      sharedStore.priceUpdates = Array.isArray(data) ? data : [];
      notifyListeners();
      return sharedStore.priceUpdates;
    })
    .catch(() => sharedStore.priceUpdates)
    .finally(() => {
      sharedStore.pricePromise = null;
    });

  return sharedStore.pricePromise;
};

const fetchSharedLowStock = async (force = false) => {
  const now = Date.now();
  if (!force && sharedStore.lastLowStockTime > 0 && now - sharedStore.lastLowStockTime < 30000) {
    return sharedStore.internalLowStock;
  }
  if (sharedStore.lowStockPromise) return sharedStore.lowStockPromise;

  sharedStore.lastLowStockTime = now;
  sharedStore.lowStockPromise = getDashboardStats('day')
    .then((stats) => {
      const details = stats?.lowStockDetails || stats?.lowStockItemsDetails;
      if (Array.isArray(details)) {
        sharedStore.internalLowStock = details;
        notifyListeners();
      }
      return sharedStore.internalLowStock;
    })
    .catch(() => sharedStore.internalLowStock)
    .finally(() => {
      sharedStore.lowStockPromise = null;
    });

  return sharedStore.lowStockPromise;
};

export const getRelativeTimeString = (timestamp) => {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(time)) return 'Recently';

  const diffSeconds = Math.floor((now - time) / 1000);
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(time).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila'
  });
};

/**
 * Main Role-Aware Notifications Hook
 *
 * @param {Array} lowStockItems Optional external low stock items from parent (e.g. DashboardOverview)
 * @param {Object} userOverride Optional user object (falls back to getCurrentUser())
 */
export const useNotifications = (lowStockItems = EMPTY_LOW_STOCK, userOverride = null) => {
  const [snapshot, setSnapshot] = useState(() => ({ ...sharedStore }));
  const [storedUser, setStoredUser] = useState(() => getCurrentUser());
  const [snapshotNowMs] = useState(() => Date.now());

  // Derive active user synchronously and listen for cross-tab storage changes
  const activeUser = userOverride || storedUser;

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key || e.key === 'user') {
        setStoredUser(getCurrentUser());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const userKey = activeUser?.id || 'guest';
  const userState = getUserState(userKey);
  const readIds = userState.readIds;
  const dismissedIds = userState.dismissedIds;

  const orders = snapshot.orders;
  const internalLowStock = snapshot.internalLowStock;
  const priceUpdates = snapshot.priceUpdates;
  const loading = snapshot.loading;

  // Access rights for conditional loading & rendering
  const canViewStock = !activeUser || activeUser.role === 'Owner' || activeUser.role === 'Admin' || activeUser.role === 'Staff' || canAccess(activeUser, 'ProductStockTracker') || canAccess(activeUser, 'RawMaterialTracker') || canAccess(activeUser, 'POS') || canAccess(activeUser, 'Products');
  const canViewPOs = activeUser?.role === 'Owner' || activeUser?.role === 'Admin' || canAccess(activeUser, 'PurchaseOrders') || activeUser?.role === 'Supplier';
  const canViewSuppliers = activeUser?.role === 'Owner' || activeUser?.role === 'Admin' || canAccess(activeUser, 'ManageSuppliers');

  // Persistence per user
  const saveReadIds = useCallback((newReadIds) => {
    const state = getUserState(userKey);
    state.readIds = newReadIds;
    try {
      localStorage.setItem(getReadStorageKey(userKey), JSON.stringify(newReadIds));
    } catch {
      // Storage quota safety
    }
    notifyListeners();
  }, [userKey]);

  const saveDismissedIds = useCallback((newDismissedIds) => {
    const state = getUserState(userKey);
    state.dismissedIds = newDismissedIds;
    try {
      localStorage.setItem(getDismissedStorageKey(userKey), JSON.stringify(newDismissedIds));
    } catch {
      // Storage quota safety
    }
    notifyListeners();
  }, [userKey]);

  // Sync external lowStockItems if provided
  useEffect(() => {
    if (Array.isArray(lowStockItems) && lowStockItems.length > 0) {
      sharedStore.internalLowStock = lowStockItems;
      sharedStore.lastLowStockTime = Date.now();
      notifyListeners();
    } else if (canViewStock && sharedStore.lastLowStockTime === 0) {
      fetchSharedLowStock(false);
    }
  }, [lowStockItems, canViewStock]);

  // Shared subscription & conditional role-based API loading
  useEffect(() => {
    sharedStore.listeners.add(setSnapshot);
    sharedStore.subscriberCount += 1;

    // Load only what this user's role is permitted to see
    if (canViewPOs) {
      fetchSharedPOs(false);
    }
    if (canViewSuppliers) {
      fetchSharedPriceUpdates(false);
    }
    if (canViewStock && sharedStore.lastLowStockTime === 0) {
      fetchSharedLowStock(false);
    }

    if (!sharedStore.channel) {
      const channelName = `dashboard_inbox_sync_shared_${Date.now()}`;
      sharedStore.channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'purchase_orders' },
          () => {
            if (canViewPOs) fetchSharedPOs(true);
            if (canViewSuppliers) fetchSharedPriceUpdates(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ingredients' },
          () => {
            if (canViewStock) fetchSharedLowStock(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          () => {
            fetchSharedLowStock(true);
          }
        )
        .subscribe();
    }

    return () => {
      sharedStore.listeners.delete(setSnapshot);
      sharedStore.subscriberCount = Math.max(0, sharedStore.subscriberCount - 1);
      if (sharedStore.subscriberCount === 0 && sharedStore.channel) {
        supabase.removeChannel(sharedStore.channel);
        sharedStore.channel = null;
      }
    };
  }, [canViewPOs, canViewSuppliers, canViewStock]);

  // Build unified, role-filtered notification list
  const allNotifications = useMemo(() => {
    const list = [];
    const dismissedSet = new Set(dismissedIds);
    const readSet = new Set(readIds);

    // 1. Process Low Stock & Out of Stock Items (for users with stock permission)
    if (canViewStock) {
      const stockItems = (Array.isArray(lowStockItems) && lowStockItems.length > 0) ? lowStockItems : internalLowStock;
      if (Array.isArray(stockItems)) {
        stockItems.forEach((item) => {
          const stockNum = parseFloat(item.stock);
          const isDepleted = isNaN(stockNum) || stockNum <= 0;
          const id = `stock_${item.name}_${isDepleted ? 'out' : 'low'}`;

          if (dismissedSet.has(id)) return;

          const isRead = readSet.has(id);
          const stockDisplay = formatQuantity(item.stock, item.unit);
          const actionInfo = resolveNotificationAction({ category: 'STOCK', unit: item.unit }, activeUser);

          if (isDepleted) {
            list.push({
              id,
              category: 'STOCK',
              type: 'STOCK_OUT',
              title: `Out of Stock: ${item.name}`,
              message: `${item.name} is completely depleted (0 ${item.unit || 'units'}). Restock immediately to prevent operational disruption.`,
              badgeText: 'Critical',
              badgeVariant: 'danger',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              unit: item.unit,
              timestamp: snapshotNowMs - 60000,
              isRead,
            });
          } else {
            list.push({
              id,
              category: 'STOCK',
              type: 'STOCK_LOW',
              title: `Low Stock Alert: ${item.name}`,
              message: `Current inventory is down to ${stockDisplay}, which is at or below the minimum reorder threshold.`,
              badgeText: 'Low Stock',
              badgeVariant: 'warning',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              unit: item.unit,
              timestamp: snapshotNowMs - 120000,
              isRead,
            });
          }
        });
      }
    }

    // 2. Process Purchase Orders (only for users with PO permission or assigned Suppliers)
    if (canViewPOs && Array.isArray(orders)) {
      orders.forEach((po) => {
        const shortId = po.id ? po.id.slice(0, 8).toUpperCase() : '';
        const supplierName = po.suppliers?.name || 'Supplier';
        const totalFormatted = `₱${Number(po.total_amount || 0).toLocaleString()}`;
        const rawTime = po.updated_at || po.received_at || po.created_at;
        const timeNum = rawTime ? new Date(rawTime).getTime() : snapshotNowMs;

        const itemsCount = po.purchase_order_items?.length || 0;
        const firstItem = po.purchase_order_items?.[0]?.ingredients?.name;
        const itemsSummary = firstItem 
          ? `${firstItem}${itemsCount > 1 ? ` +${itemsCount - 1} more` : ''}`
          : `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`;

        const basePoItem = {
          category: 'PO',
          supplierId: po.supplier_id,
          poId: po.id,
          timestamp: timeNum
        };

        switch (po.status) {
          case 'Accepted': {
            const id = `po_${po.id}_Accepted`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'View Order' }, activeUser);
            list.push({
              ...basePoItem,
              id,
              type: 'PO_ACCEPTED',
              title: `PO #${shortId} Accepted — ${supplierName}`,
              message: `${supplierName} confirmed order #${shortId} (${itemsSummary} • ${totalFormatted}). Expected delivery: ${formatDisplayDate(po.expected_date)}.`,
              badgeText: 'Accepted',
              badgeVariant: 'success',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Declined':
          case 'DECLINED': {
            const id = `po_${po.id}_Declined`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'Review Order' }, activeUser);
            const reasonText = po.decline_reason ? ` Reason: ${po.decline_reason}` : '';
            list.push({
              ...basePoItem,
              id,
              type: 'PO_DECLINED',
              title: `PO #${shortId} Declined by ${supplierName}`,
              message: `${supplierName} declined order #${shortId} (${itemsSummary} • ${totalFormatted}).${reasonText}`,
              badgeText: 'Declined',
              badgeVariant: 'danger',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Cancelled':
          case 'CANCELLED': {
            const id = `po_${po.id}_Cancelled`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'View Order' }, activeUser);
            const reasonText = po.cancellation_reason ? ` Reason: ${po.cancellation_reason}` : '';
            list.push({
              ...basePoItem,
              id,
              type: 'PO_CANCELLED',
              title: `PO #${shortId} Cancelled`,
              message: `Purchase order #${shortId} (${itemsSummary} • ${totalFormatted}) was cancelled.${reasonText}`,
              badgeText: 'Cancelled',
              badgeVariant: 'danger',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Proposal Pending': {
            const id = `po_${po.id}_ProposalPending`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'Review Proposals' }, activeUser);
            list.push({
              ...basePoItem,
              id,
              type: 'PO_POSTPONED',
              title: `PO #${shortId} Date Proposals — ${supplierName}`,
              message: `${supplierName} proposed delivery dates or reported unavailable items for order #${shortId} (${itemsSummary}). Review and approve proposals.`,
              badgeText: 'Proposals',
              badgeVariant: 'warning',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Postponed': {
            const id = `po_${po.id}_Postponed_${po.expected_date || ''}`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'Check Schedule' }, activeUser);
            list.push({
              ...basePoItem,
              id,
              type: 'PO_POSTPONED',
              title: `PO #${shortId} Delivery Rescheduled`,
              message: `${supplierName} postponed order #${shortId}. New expected arrival: ${formatDisplayDate(po.expected_date)}.`,
              badgeText: 'Rescheduled',
              badgeVariant: 'warning',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Delivering':
          case 'To Be Delivered': {
            const id = `po_${po.id}_${po.status.replace(/\s+/g, '_')}`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'Receive Stock' }, activeUser);
            list.push({
              ...basePoItem,
              id,
              type: 'PO_DELIVERING',
              title: `PO #${shortId} Out for Delivery`,
              message: `${supplierName} is delivering order #${shortId} (${itemsSummary} • ${totalFormatted}). Prepare staff to inspect and receive stock.`,
              badgeText: 'Delivering',
              badgeVariant: 'info',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Pending': {
            const id = `po_${po.id}_Pending`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'Track PO' }, activeUser);
            list.push({
              ...basePoItem,
              id,
              type: 'PO_PENDING',
              title: `PO #${shortId} Awaiting Supplier Response`,
              message: `Order #${shortId} (${itemsSummary} • ${totalFormatted}) sent to ${supplierName} is awaiting supplier confirmation.`,
              badgeText: 'Pending',
              badgeVariant: 'neutral',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          case 'Partial': {
            const id = `po_${po.id}_Partial`;
            if (dismissedSet.has(id)) return;
            const actionInfo = resolveNotificationAction({ ...basePoItem, defaultActionLabel: 'Receive Remaining' }, activeUser);
            list.push({
              ...basePoItem,
              id,
              type: 'PO_PARTIAL',
              title: `PO #${shortId} Partially Received`,
              message: `A partial shipment was received for order #${shortId} (${supplierName} • ${itemsSummary}). Remaining items are still pending arrival.`,
              badgeText: 'Partial',
              badgeVariant: 'purple',
              actionTab: actionInfo.actionTab,
              actionLabel: actionInfo.actionLabel,
              isRead: readSet.has(id),
            });
            break;
          }

          default:
            break;
        }
      });
    }

    // 3. Process Supplier Price Updates (strictly for procurement managers)
    if (canViewSuppliers && Array.isArray(priceUpdates)) {
      priceUpdates.forEach((up) => {
        const id = `supp_price_${up.id}`;
        if (dismissedSet.has(id)) return;
        const count = up.price_changes?.length || up.items_count || 1;
        const firstChange = up.price_changes?.[0];
        const detailSnippet = firstChange 
          ? ` (${firstChange.ingredient_name}: ₱${Number(firstChange.old_price).toFixed(2)} → ₱${Number(firstChange.new_price).toFixed(2)})`
          : '';

        const actionInfo = resolveNotificationAction({ category: 'SUPPLIER' }, activeUser);

        list.push({
          id,
          category: 'SUPPLIER',
          type: 'SUPPLIER_PRICE_UPDATE',
          title: `Price Update — ${up.supplier_name}`,
          message: `${up.supplier_name} updated catalog prices for ${count} raw material(s)${detailSnippet}. Click to inspect their catalog.`,
          badgeText: 'Price Change',
          badgeVariant: 'warning',
          actionTab: actionInfo.actionTab,
          actionLabel: actionInfo.actionLabel,
          timestamp: new Date(up.created_at).getTime(),
          isRead: readSet.has(id),
          supplierId: up.supplier_id
        });
      });
    }

    // Final security filter: Guarantee that every notification in the returned array is explicitly permitted for this user's role
    const roleFiltered = list.filter((n) => isNotificationAllowedForUser(n, activeUser));

    // Sort newest / highest priority first
    return roleFiltered.sort((a, b) => {
      if (!a.isRead && a.badgeVariant === 'danger' && (b.isRead || b.badgeVariant !== 'danger')) return -1;
      if (!b.isRead && b.badgeVariant === 'danger' && (a.isRead || a.badgeVariant !== 'danger')) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [
    canViewStock,
    canViewPOs,
    canViewSuppliers,
    lowStockItems,
    internalLowStock,
    orders,
    priceUpdates,
    readIds,
    dismissedIds,
    activeUser,
    snapshotNowMs
  ]);

  // Derived counts tailored for the current user
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.isRead).length;
  }, [allNotifications]);

  const criticalCount = useMemo(() => {
    return allNotifications.filter((n) => !n.isRead && n.badgeVariant === 'danger').length;
  }, [allNotifications]);

  // Actions
  const markAsRead = useCallback((id) => {
    if (!readIds.includes(id)) {
      saveReadIds([...readIds, id]);
    }
  }, [readIds, saveReadIds]);

  const markAsUnread = useCallback((id) => {
    saveReadIds(readIds.filter((item) => item !== id));
  }, [readIds, saveReadIds]);

  const markAllAsRead = useCallback(() => {
    const activeIds = allNotifications.map((n) => n.id);
    const combined = Array.from(new Set([...readIds, ...activeIds]));
    saveReadIds(combined);
  }, [allNotifications, readIds, saveReadIds]);

  const dismissNotification = useCallback((id) => {
    if (!dismissedIds.includes(id)) {
      saveDismissedIds([...dismissedIds, id]);
    }
  }, [dismissedIds, saveDismissedIds]);

  const clearReadNotifications = useCallback(() => {
    const idsToDismiss = allNotifications.filter((n) => n.isRead).map((n) => n.id);
    const combined = Array.from(new Set([...dismissedIds, ...idsToDismiss]));
    saveDismissedIds(combined);
  }, [allNotifications, dismissedIds, saveDismissedIds]);

  return {
    notifications: allNotifications,
    unreadCount,
    criticalCount,
    loading,
    currentUser: activeUser,
    canViewStock,
    canViewPOs,
    canViewSuppliers,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    clearReadNotifications,
    refreshPOs: fetchSharedPOs
  };
};
