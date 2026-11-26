import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupplierOwnOrders, updateSupplierOrderStatus, submitSupplierItemResponses } from '../../../api/purchasingApi';
import { isDatePast, getDaysOverdue } from '../../../utils/dateUtils';

export const isPOOverdue = (po) => {
  if (!po) return false;
  if (po.is_overdue !== undefined) return Boolean(po.is_overdue);
  const isTerminal = ['Received', 'Cancelled', 'Declined', 'DECLINED'].includes(po.status);
  return !isTerminal && isDatePast(po.expected_date);
};

export const getPODaysOverdue = (po) => {
  if (po?.days_overdue) return po.days_overdue;
  return getDaysOverdue(po?.expected_date);
};

export const useSupplierPortal = () => {
  const [mainView, setMainView] = useState('ORDERS'); // 'ORDERS' | 'CATALOG'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [tabFilter, setTabFilterState] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'PENDING' | 'PROPOSALS' | 'ACTIVE' | 'COMPLETED'
  const [searchQuery, setSearchQueryState] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderItemsPerPage, setOrderItemsPerPage] = useState(10);

  const [postponeModal, setPostponeModal] = useState({ show: false, orderId: null, date: '' });
  const [reviewModal, setReviewModal] = useState({ show: false, order: null });
  const [declineModal, setDeclineModal] = useState({ show: false, orderId: null, reason: '' });

  const setTabFilter = useCallback((val) => {
    setTabFilterState(val);
    setOrderPage(1);
  }, []);

  const setSearchQuery = useCallback((val) => {
    setSearchQueryState(val);
    setOrderPage(1);
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getSupplierOwnOrders();
      setOrders(data || []);
    } catch (err) {
      if (!silent) setError('Failed to load orders: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    // Polling instead of a Supabase realtime subscription: the anon key has no direct DB
    // access now that RLS is locked down, so refresh comes from this authenticated API poll.
    const interval = setInterval(() => fetchOrders(true), 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchOrders]);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    if (newStatus === 'Postponed') {
      setPostponeModal({ show: true, orderId: id, date: '' });
      return;
    }
    if (newStatus === 'Declined') {
      setDeclineModal({ show: true, orderId: id, reason: '' });
      return;
    }
    try {
      await updateSupplierOrderStatus(id, newStatus);
      fetchOrders(true);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  }, [fetchOrders]);

  const handleDeclineSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!declineModal.reason || !declineModal.reason.trim()) {
      setError('A decline reason is required.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    try {
      await updateSupplierOrderStatus(declineModal.orderId, 'Declined', null, declineModal.reason.trim());
      setDeclineModal({ show: false, orderId: null, reason: '' });
      fetchOrders(true);
    } catch (err) {
      setError('Failed to decline order: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  }, [declineModal, fetchOrders]);

  const handlePostponeSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!postponeModal.date) return;
    try {
      await updateSupplierOrderStatus(postponeModal.orderId, 'Postponed', postponeModal.date);
      setPostponeModal({ show: false, orderId: null, date: '' });
      fetchOrders(true);
    } catch (err) {
      setError('Failed to postpone: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  }, [postponeModal, fetchOrders]);

  const handleReviewSubmit = useCallback(async (poId, itemsPayload) => {
    await submitSupplierItemResponses(poId, itemsPayload);
    setReviewModal({ show: false, order: null });
    fetchOrders(true);
  }, [fetchOrders]);

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const { overdueCount, pendingCount, proposalsCount, activeCount, completedCount } = useMemo(() => ({
    overdueCount: orders.filter(isPOOverdue).length,
    pendingCount: orders.filter(o => o.status === 'Pending').length,
    proposalsCount: orders.filter(o => o.has_proposals || o.status === 'Proposal Pending' || o.status === 'Partially Accepted').length,
    activeCount: orders.filter(o => ['Accepted', 'To Be Delivered', 'Delivering', 'Partial'].includes(o.status)).length,
    completedCount: orders.filter(o => o.status === 'Received').length
  }), [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      if (tabFilter === 'OVERDUE' && !isPOOverdue(po)) return false;
      if (tabFilter === 'PENDING' && po.status !== 'Pending') return false;
      if (tabFilter === 'PROPOSALS' && !(po.has_proposals || po.status === 'Proposal Pending' || po.status === 'Partially Accepted')) return false;
      if (tabFilter === 'ACTIVE' && !['Accepted', 'To Be Delivered', 'Delivering', 'Partial'].includes(po.status)) return false;
      if (tabFilter === 'COMPLETED' && po.status !== 'Received') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const poId = String(po.id || '').toLowerCase();
        const status = String(po.status || '').toLowerCase();
        const itemsMatch = (po.purchase_order_items || []).some(item =>
          String(item.ingredients?.name || '').toLowerCase().includes(q)
        );
        return poId.includes(q) || status.includes(q) || itemsMatch;
      }

      return true;
    });
  }, [orders, tabFilter, searchQuery]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderItemsPerPage));
  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderItemsPerPage;
    return filteredOrders.slice(start, start + orderItemsPerPage);
  }, [filteredOrders, orderPage, orderItemsPerPage]);

  return {
    mainView, setMainView,
    orders, loading, error, fetchOrders,
    expandedId, toggleExpand,
    tabFilter, setTabFilter,
    searchQuery, setSearchQuery,
    orderPage, setOrderPage,
    orderItemsPerPage, setOrderItemsPerPage,
    orderTotalPages,
    postponeModal, setPostponeModal,
    reviewModal, setReviewModal,
    declineModal, setDeclineModal,
    handleStatusChange,
    handleDeclineSubmit,
    handlePostponeSubmit,
    handleReviewSubmit,
    overdueCount, pendingCount, proposalsCount, activeCount, completedCount,
    filteredOrders, paginatedOrders
  };
};
