import { useState, useEffect, useMemo, useCallback } from 'react';
import { getPurchaseOrders } from '../../api/purchasingApi';
import { getDashboardStats } from '../../api/dashboardApi';
import { supabase } from '../../config/supabaseClient';
import { formatDisplayDate } from '../../utils/dateUtils';
import { formatQuantity } from '../../utils/productUtils';

const STORAGE_READ_KEY = 'coftea_inbox_read_v1';
const STORAGE_DISMISSED_KEY = 'coftea_inbox_dismissed_v1';

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

export const useNotifications = (lowStockItems = []) => {
  const [orders, setOrders] = useState([]);
  const [internalLowStock, setInternalLowStock] = useState(() => 
    Array.isArray(lowStockItems) && lowStockItems.length > 0 ? lowStockItems : []
  );
  const [loading, setLoading] = useState(true);

  // Local read & dismissed state
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_READ_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DISMISSED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save changes to localStorage
  const saveReadIds = useCallback((newReadIds) => {
    setReadIds(newReadIds);
    try {
      localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(newReadIds));
    } catch {
      // Ignore quota errors
    }
  }, []);

  const saveDismissedIds = useCallback((newDismissedIds) => {
    setDismissedIds(newDismissedIds);
    try {
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify(newDismissedIds));
    } catch {
      // Ignore quota errors
    }
  }, []);

  // Fetch purchase orders
  const fetchPOs = useCallback(async () => {
    try {
      const data = await getPurchaseOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load purchase orders for notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch low stock items automatically if not supplied by parent
  const fetchLowStock = useCallback(async () => {
    try {
      const stats = await getDashboardStats('day');
      const details = stats?.lowStockDetails || stats?.lowStockItemsDetails;
      if (Array.isArray(details)) {
        setInternalLowStock(details);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  // Sync external lowStockItems if provided
  useEffect(() => {
    if (Array.isArray(lowStockItems) && lowStockItems.length > 0) {
      setInternalLowStock(lowStockItems);
    } else {
      fetchLowStock();
    }
  }, [lowStockItems, fetchLowStock]);

  useEffect(() => {
    fetchPOs();

    const channelName = `dashboard_inbox_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => {
          fetchPOs();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ingredients' },
        () => {
          fetchLowStock();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchLowStock();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPOs, fetchLowStock]);

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

    // Sort newest / highest priority first
    return list.sort((a, b) => {
      // Critical stock always surfaces near the top if unread
      if (!a.isRead && a.badgeVariant === 'danger' && (b.isRead || b.badgeVariant !== 'danger')) return -1;
      if (!b.isRead && b.badgeVariant === 'danger' && (a.isRead || a.badgeVariant !== 'danger')) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [lowStockItems, internalLowStock, orders, readIds, dismissedIds]);

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
