import { useState, useEffect, useMemo, useCallback } from 'react';
import { getPurchaseOrders, getSupplierPriceUpdates } from '../../api/purchasingApi';
import { getDashboardStats } from '../../api/dashboardApi';
import { supabase } from '../../config/supabaseClient';
import { formatDisplayDate } from '../../utils/dateUtils';
import { formatQuantity } from '../../utils/productUtils';

const STORAGE_READ_KEY = 'coftea_inbox_read_v1';
const STORAGE_DISMISSED_KEY = 'coftea_inbox_dismissed_v1';
const EMPTY_LOW_STOCK = [];

const loadStoredArray = (key) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Shared singleton state across all mounted useNotifications() callers (Navbar, NotificationInbox, DashboardOverview)
// Prevents 3x duplicate API requests and 3x duplicate Supabase Realtime channels on Dashboard mount.
const sharedStore = {
  orders: [],
  internalLowStock: [],
  priceUpdates: [],
  loading: true,
  readIds: loadStoredArray(STORAGE_READ_KEY),
  dismissedIds: loadStoredArray(STORAGE_DISMISSED_KEY),
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

export const useNotifications = (lowStockItems = EMPTY_LOW_STOCK) => {
  const [snapshot, setSnapshot] = useState(() => ({ ...sharedStore }));

  const orders = snapshot.orders;
  const internalLowStock = snapshot.internalLowStock;
  const priceUpdates = snapshot.priceUpdates;
  const loading = snapshot.loading;
  const readIds = snapshot.readIds;
  const dismissedIds = snapshot.dismissedIds;

  // Save changes to localStorage and sync across all mounted hook instances
  const saveReadIds = useCallback((newReadIds) => {
    sharedStore.readIds = newReadIds;
    try {
      localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(newReadIds));
    } catch {
      // Ignore quota errors
    }
    notifyListeners();
  }, []);

  const saveDismissedIds = useCallback((newDismissedIds) => {
    sharedStore.dismissedIds = newDismissedIds;
    try {
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify(newDismissedIds));
    } catch {
      // Ignore quota errors
    }
    notifyListeners();
  }, []);

  const fetchPOs = useCallback((force = false) => fetchSharedPOs(force), []);
  const fetchLowStock = useCallback((force = false) => fetchSharedLowStock(force), []);

  // Sync external lowStockItems if provided (e.g. from DashboardOverview stats), otherwise fetch once
  useEffect(() => {
    if (Array.isArray(lowStockItems) && lowStockItems.length > 0) {
      sharedStore.internalLowStock = lowStockItems;
      sharedStore.lastLowStockTime = Date.now();
      notifyListeners();
    } else if (sharedStore.lastLowStockTime === 0) {
      fetchSharedLowStock(false);
    }
  }, [lowStockItems]);

  // Single shared Realtime subscription across all mounted notification consumers
  useEffect(() => {
    sharedStore.listeners.add(setSnapshot);
    sharedStore.subscriberCount += 1;

    fetchSharedPOs(false);
    fetchSharedPriceUpdates(false);

    if (!sharedStore.channel) {
      const channelName = `dashboard_inbox_sync_shared_${Date.now()}`;
      sharedStore.channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'purchase_orders' },
          () => {
            fetchSharedPOs(true);
            fetchSharedPriceUpdates(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ingredients' },
          () => {
            fetchSharedLowStock(true);
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
  }, []);

  // Build unified notification list
  const allNotifications = useMemo(() => {
    const list = [];
    const dismissedSet = new Set(dismissedIds);
    const readSet = new Set(readIds);

    // 1. Process Low Stock & Out of Stock Items
    const stockItems = (Array.isArray(lowStockItems) && lowStockItems.length > 0) ? lowStockItems : internalLowStock;
    if (Array.isArray(stockItems)) {
      stockItems.forEach((item) => {
        const stockNum = parseFloat(item.stock);
        const isDepleted = isNaN(stockNum) || stockNum <= 0;
        const id = `stock_${item.name}_${isDepleted ? 'out' : 'low'}`;

        if (dismissedSet.has(id)) return;

        const isRead = readSet.has(id);
        const stockDisplay = formatQuantity(item.stock, item.unit);

        if (isDepleted) {
          list.push({
            id,
            category: 'STOCK',
            type: 'STOCK_OUT',
            title: `Out of Stock: ${item.name}`,
            message: `${item.name} is completely depleted (0 ${item.unit || 'units'}). Restock immediately to prevent operational disruption.`,
            badgeText: 'Critical',
            badgeVariant: 'danger',
            actionTab: item.unit === 'PCS' ? 'ProductStockTracker' : 'RawMaterialTracker',
            actionLabel: 'Inspect Stock',
            timestamp: Date.now() - 60000, // Slight backdate for stable sort
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
            actionTab: item.unit === 'PCS' ? 'ProductStockTracker' : 'RawMaterialTracker',
            actionLabel: 'Inspect Stock',
            timestamp: Date.now() - 120000,
            isRead,
          });
        }
      });
    }

    // 2. Process Purchase Orders & Supplier Updates
    if (Array.isArray(orders)) {
      orders.forEach((po) => {
        const shortId = po.id ? po.id.slice(0, 8).toUpperCase() : '';
        const supplierName = po.suppliers?.name || 'Supplier';
        const totalFormatted = `₱${Number(po.total_amount || 0).toLocaleString()}`;
        const rawTime = po.updated_at || po.received_at || po.created_at;
        const timeNum = rawTime ? new Date(rawTime).getTime() : Date.now();

        const itemsCount = po.purchase_order_items?.length || 0;
        const firstItem = po.purchase_order_items?.[0]?.ingredients?.name;
        const itemsSummary = firstItem 
          ? `${firstItem}${itemsCount > 1 ? ` +${itemsCount - 1} more` : ''}`
          : `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`;

        switch (po.status) {
          case 'Accepted': {
            const id = `po_${po.id}_Accepted`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_ACCEPTED',
              title: `PO #${shortId} Accepted — ${supplierName}`,
              message: `${supplierName} confirmed order #${shortId} (${itemsSummary} • ${totalFormatted}). Expected delivery: ${formatDisplayDate(po.expected_date)}.`,
              badgeText: 'Accepted',
              badgeVariant: 'success',
              actionTab: 'PurchaseOrders',
              actionLabel: 'View Order',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          case 'Declined': {
            const id = `po_${po.id}_Declined`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_DECLINED',
              title: `PO #${shortId} Declined by ${supplierName}`,
              message: `${supplierName} declined order #${shortId} (${itemsSummary} • ${totalFormatted}). Review items or reorder from another supplier.`,
              badgeText: 'Declined',
              badgeVariant: 'danger',
              actionTab: 'PurchaseOrders',
              actionLabel: 'Review Order',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          case 'Proposal Pending': {
            const id = `po_${po.id}_ProposalPending`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_POSTPONED',
              title: `PO #${shortId} Date Proposals — ${supplierName}`,
              message: `${supplierName} proposed delivery dates or reported unavailable items for order #${shortId} (${itemsSummary}). Review and approve proposals.`,
              badgeText: 'Proposals',
              badgeVariant: 'warning',
              actionTab: 'PurchaseOrders',
              actionLabel: 'Review Proposals',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          case 'Postponed': {
            const id = `po_${po.id}_Postponed_${po.expected_date || ''}`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_POSTPONED',
              title: `PO #${shortId} Delivery Rescheduled`,
              message: `${supplierName} postponed order #${shortId}. New expected arrival: ${formatDisplayDate(po.expected_date)}.`,
              badgeText: 'Rescheduled',
              badgeVariant: 'warning',
              actionTab: 'PurchaseOrders',
              actionLabel: 'Check Schedule',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          case 'Delivering':
          case 'To Be Delivered': {
            const id = `po_${po.id}_${po.status.replace(/\s+/g, '_')}`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_DELIVERING',
              title: `PO #${shortId} Out for Delivery`,
              message: `${supplierName} is delivering order #${shortId} (${itemsSummary} • ${totalFormatted}). Prepare staff to inspect and receive stock.`,
              badgeText: 'Delivering',
              badgeVariant: 'info',
              actionTab: 'PurchaseOrders',
              actionLabel: 'Receive Stock',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          case 'Pending': {
            const id = `po_${po.id}_Pending`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_PENDING',
              title: `PO #${shortId} Awaiting Supplier Response`,
              message: `Order #${shortId} (${itemsSummary} • ${totalFormatted}) sent to ${supplierName} is awaiting supplier confirmation.`,
              badgeText: 'Pending',
              badgeVariant: 'neutral',
              actionTab: 'PurchaseOrders',
              actionLabel: 'Track PO',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          case 'Partial': {
            const id = `po_${po.id}_Partial`;
            if (dismissedSet.has(id)) return;
            list.push({
              id,
              category: 'PO',
              type: 'PO_PARTIAL',
              title: `PO #${shortId} Partially Received`,
              message: `A partial shipment was received for order #${shortId} (${supplierName} • ${itemsSummary}). Remaining items are still pending arrival.`,
              badgeText: 'Partial',
              badgeVariant: 'purple',
              actionTab: 'PurchaseOrders',
              actionLabel: 'Receive Remaining',
              timestamp: timeNum,
              isRead: readSet.has(id),
              poId: po.id
            });
            break;
          }

          default:
            break;
        }
      });
    }

    // 3. Process Supplier Price Updates
    if (Array.isArray(priceUpdates)) {
      priceUpdates.forEach((up) => {
        const id = `supp_price_${up.id}`;
        if (dismissedSet.has(id)) return;
        const count = up.price_changes?.length || up.items_count || 1;
        const firstChange = up.price_changes?.[0];
        const detailSnippet = firstChange 
          ? ` (${firstChange.ingredient_name}: ₱${Number(firstChange.old_price).toFixed(2)} → ₱${Number(firstChange.new_price).toFixed(2)})`
          : '';

        list.push({
          id,
          category: 'SUPPLIER',
          type: 'SUPPLIER_PRICE_UPDATE',
          title: `Price Update — ${up.supplier_name}`,
          message: `${up.supplier_name} updated catalog prices for ${count} raw material(s)${detailSnippet}. Click to inspect their catalog.`,
          badgeText: 'Price Change',
          badgeVariant: 'warning',
          actionTab: 'ManageSuppliers',
          actionLabel: 'Inspect Catalog',
          timestamp: new Date(up.created_at).getTime(),
          isRead: readSet.has(id),
          supplierId: up.supplier_id
        });
      });
    }

    // Sort newest / highest priority first
    return list.sort((a, b) => {
      // Critical stock always surfaces near the top if unread
      if (!a.isRead && a.badgeVariant === 'danger' && (b.isRead || b.badgeVariant !== 'danger')) return -1;
      if (!b.isRead && b.badgeVariant === 'danger' && (a.isRead || a.badgeVariant !== 'danger')) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [lowStockItems, internalLowStock, orders, priceUpdates, readIds, dismissedIds]);

  // Derived counts
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
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    clearReadNotifications,
    refreshPOs: fetchPOs
  };
};
