import React, { useState, useEffect } from 'react';
import { getSupplierOwnOrders, updateSupplierOrderStatus, submitSupplierItemResponses } from '../../api/purchasingApi';
import { supabase } from '../../config/supabaseClient';
import { formatDisplayDate, isDatePast, getDaysOverdue } from '../../utils/dateUtils';
import SupplierReviewPOModal from './components/SupplierReviewPOModal';
import SupplierCatalogSection from './components/SupplierCatalogSection';

const SupplierPortal = () => {
  const [mainView, setMainView] = useState('ORDERS'); // 'ORDERS' | 'CATALOG'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [tabFilter, setTabFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PROPOSALS' | 'ACTIVE' | 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState('');
  const [postponeModal, setPostponeModal] = useState({ show: false, orderId: null, date: '' });
  const [reviewModal, setReviewModal] = useState({ show: false, order: null });
  const [declineModal, setDeclineModal] = useState({ show: false, orderId: null, reason: '' });

  const fetchOrders = async () => {
    try {
      if (orders.length === 0) setLoading(true);
      const data = await getSupplierOwnOrders();
      setOrders(data || []);
    } catch (err) {
      setError('Failed to load orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('supplier_orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_order_items' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (id, newStatus) => {
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
      fetchOrders();
    } catch (err) {
      setError('Failed to update status: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeclineSubmit = async (e) => {
    e.preventDefault();
    if (!declineModal.reason || !declineModal.reason.trim()) {
      setError('A decline reason is required.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    try {
      await updateSupplierOrderStatus(declineModal.orderId, 'Declined', null, declineModal.reason.trim());
      setDeclineModal({ show: false, orderId: null, reason: '' });
      fetchOrders();
    } catch (err) {
      setError('Failed to decline order: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handlePostponeSubmit = async (e) => {
    e.preventDefault();
    if (!postponeModal.date) return;
    try {
      await updateSupplierOrderStatus(postponeModal.orderId, 'Postponed', postponeModal.date);
      setPostponeModal({ show: false, orderId: null, date: '' });
      fetchOrders();
    } catch (err) {
      setError('Failed to postpone: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleReviewSubmit = async (poId, itemsPayload) => {
    await submitSupplierItemResponses(poId, itemsPayload);
    setReviewModal({ show: false, order: null });
    fetchOrders();
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Overdue detection
  const isPOOverdue = (po) => {
    if (!po) return false;
    if (po.is_overdue !== undefined) return Boolean(po.is_overdue);
    const isTerminal = ['Received', 'Cancelled', 'Declined', 'DECLINED'].includes(po.status);
    return !isTerminal && isDatePast(po.expected_date);
  };

  const getPODaysOverdue = (po) => {
    if (po?.days_overdue) return po.days_overdue;
    return getDaysOverdue(po?.expected_date);
  };

  // Counts
  const overdueCount = orders.filter(isPOOverdue).length;
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const proposalsCount = orders.filter(o => o.has_proposals || o.status === 'Proposal Pending' || o.status === 'Partially Accepted').length;
  const activeCount = orders.filter(o => ['Accepted', 'To Be Delivered', 'Delivering', 'Partial'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'Received').length;

  // Filtered orders
  const filteredOrders = orders.filter(po => {
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

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Supplier Portal</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">
            {mainView === 'ORDERS' 
              ? 'Manage incoming purchase orders from the store.' 
              : 'Review catalog items, customize packaging units, and update pricing.'}
          </p>
        </div>

        {/* Top View Switcher */}
        <div className="inline-flex p-1 bg-gray-200/80 rounded-xl gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMainView('ORDERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              mainView === 'ORDERS'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Orders {orders.length > 0 ? `(${orders.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setMainView('CATALOG')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              mainView === 'CATALOG'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Catalog & Pricing
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl text-sm font-bold bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {mainView === 'CATALOG' ? (
        <SupplierCatalogSection />
      ) : (
        <>
      {/* Summary Stats */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div 
            onClick={() => setTabFilter('ALL')}
            className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
              tabFilter === 'ALL' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white border-gray-200 text-zinc-900 hover:border-zinc-400'
            }`}
          >
            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'ALL' ? 'text-zinc-400' : 'text-gray-500'}`}>Total Orders</span>
            <span className="text-2xl font-extrabold">{orders.length}</span>
          </div>

          <div 
            onClick={() => setTabFilter('OVERDUE')}
            className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
              tabFilter === 'OVERDUE' ? 'bg-rose-700 text-white border-rose-700 shadow-md' : overdueCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-900 hover:border-rose-400' : 'bg-white border-gray-200 text-zinc-900 hover:border-zinc-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'OVERDUE' ? 'text-rose-100' : overdueCount > 0 ? 'text-rose-700' : 'text-gray-500'}`}>Overdue</span>
              {overdueCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
            </div>
            <span className="text-2xl font-extrabold">{overdueCount}</span>
          </div>

          <div 
            onClick={() => setTabFilter('PENDING')}
            className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
              tabFilter === 'PENDING' ? 'bg-yellow-600 text-white border-yellow-600 shadow-md' : 'bg-yellow-50 border-yellow-200 text-yellow-900 hover:border-yellow-400'
            }`}
          >
            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'PENDING' ? 'text-yellow-100' : 'text-yellow-700'}`}>Pending Review</span>
            <span className="text-2xl font-extrabold">{pendingCount}</span>
          </div>

          <div 
            onClick={() => setTabFilter('PROPOSALS')}
            className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
              tabFilter === 'PROPOSALS' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-400'
            }`}
          >
            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'PROPOSALS' ? 'text-amber-100' : 'text-amber-700'}`}>Proposals</span>
            <span className="text-2xl font-extrabold">{proposalsCount}</span>
          </div>

          <div 
            onClick={() => setTabFilter('ACTIVE')}
            className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
              tabFilter === 'ACTIVE' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:border-indigo-400'
            }`}
          >
            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'ACTIVE' ? 'text-indigo-100' : 'text-indigo-700'}`}>Active Deliveries</span>
            <span className="text-2xl font-extrabold">{activeCount}</span>
          </div>
        </div>
      )}

      {/* Main Table Card with Tabs */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        {/* Navigation Tabs Bar + Search */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setTabFilter('ALL')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'ALL'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-gray-200 hover:bg-zinc-100'
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              onClick={() => setTabFilter('OVERDUE')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tabFilter === 'OVERDUE'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : overdueCount > 0
                    ? 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
                    : 'bg-white text-zinc-600 border border-gray-200 hover:bg-zinc-100'
              }`}
            >
              <span>Overdue ({overdueCount})</span>
              {overdueCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
            </button>
            <button
              onClick={() => setTabFilter('PENDING')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'PENDING'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-gray-200 hover:bg-zinc-100'
              }`}
            >
              Pending Review ({pendingCount})
            </button>
            <button
              onClick={() => setTabFilter('PROPOSALS')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tabFilter === 'PROPOSALS'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-gray-200 hover:bg-zinc-100'
              }`}
            >
              <span>Proposals & Rescheduled ({proposalsCount})</span>
              {proposalsCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
            </button>
            <button
              onClick={() => setTabFilter('ACTIVE')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'ACTIVE'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-gray-200 hover:bg-zinc-100'
              }`}
            >
              Active Deliveries ({activeCount})
            </button>
            <button
              onClick={() => setTabFilter('COMPLETED')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'COMPLETED'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-gray-200 hover:bg-zinc-100'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search PO #, status, or ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
               aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading orders...</div>
        ) : filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">PO ID</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Expected</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Items Summary</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map(po => {
                  const isOverdue = isPOOverdue(po);
                  const daysOverdue = getPODaysOverdue(po);
                  const itemNames = (po.purchase_order_items || [])
                    .map(i => i.ingredients?.name)
                    .filter(Boolean);

                  return (
                    <React.Fragment key={po.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => toggleExpand(po.id)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] transition-transform ${expandedId === po.id ? 'rotate-180' : ''}`}>▼</span>
                            <span className="text-sm font-bold text-gray-900">#{po.id.substring(0, 8).toUpperCase()}</span>
                            {po.has_proposals && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                Proposals
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {isOverdue ? (
                            <div className="flex flex-col">
                              <span className="text-rose-700 font-bold flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatDisplayDate(po.expected_date)}
                              </span>
                              <span className="text-[11px] font-extrabold text-rose-600">
                                {daysOverdue}d late
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-600">{formatDisplayDate(po.expected_date)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-600 max-w-[260px]">
                          <div className="font-bold text-gray-800">
                            {po.purchase_order_items ? `${po.purchase_order_items.length} ingredient${po.purchase_order_items.length === 1 ? '' : 's'}` : '0 items'}
                          </div>
                          {itemNames.length > 0 && (
                            <div className="text-xs text-gray-500 truncate" title={itemNames.join(', ')}>
                              {itemNames.slice(0, 2).join(', ')}{itemNames.length > 2 ? ` +${itemNames.length - 2} more` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">₱{Number(po.total_amount).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          {isOverdue ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Overdue ({daysOverdue}d late)
                              </span>
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                                Stage: {po.status}
                              </span>
                            </div>
                          ) : (
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                              ${po.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                po.status === 'Proposal Pending' ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold' :
                                po.status === 'Partially Accepted' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                po.status === 'Accepted' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                po.status === 'To Be Delivered' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                po.status === 'Delivering' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                (po.status === 'Declined' || po.status === 'DECLINED') ? 'bg-red-50 text-red-700 border border-red-200' :
                                po.status === 'Received' ? 'bg-green-50 text-green-700 border border-green-200' :
                                'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}>
                              {po.status}
                            </span>
                          )}
                          {(po.status === 'Declined' || po.status === 'DECLINED') && po.decline_reason && (
                            <div className="mt-1 text-xs text-red-600 font-medium max-w-xs truncate" title={po.decline_reason}>
                              Reason: {po.decline_reason}
                            </div>
                          )}
                          {po.status === 'Cancelled' && po.cancellation_reason && (
                            <div className="mt-1 text-xs text-rose-600 font-medium max-w-xs truncate" title={po.cancellation_reason}>
                              Reason: {po.cancellation_reason}
                            </div>
                          )}
                        </td>
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        {po.status === 'Pending' && (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleStatusChange(po.id, 'Declined')} 
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Decline
                            </button>
                            <button 
                              onClick={() => setReviewModal({ show: true, order: po })} 
                              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                            >
                              Review & Accept Items →
                            </button>
                          </div>
                        )}
                        {po.status === 'Proposal Pending' && (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setReviewModal({ show: true, order: po })} 
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Edit Proposals
                            </button>
                            <button 
                              onClick={() => handleStatusChange(po.id, 'To Be Delivered')} 
                              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Deliver Ready Items
                            </button>
                          </div>
                        )}
                        {po.status === 'Accepted' && (
                          <button 
                            onClick={() => handleStatusChange(po.id, 'To Be Delivered')} 
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Mark To Be Delivered
                          </button>
                        )}
                        {po.status === 'To Be Delivered' && (
                          <div className="flex justify-end gap-2">
                            {!isOverdue && (
                              <button 
                                onClick={() => handleStatusChange(po.id, 'Delivering')} 
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Mark Delivering
                              </button>
                            )}
                            <button 
                              onClick={() => handleStatusChange(po.id, 'Postponed')} 
                              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                isOverdue
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold shadow-2xs'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                              }`}
                              title={isOverdue ? 'Order past due: reschedule a new delivery date' : 'Postpone delivery date'}
                            >
                              {isOverdue ? 'Postpone & Reschedule' : 'Postpone'}
                            </button>
                          </div>
                        )}
                        {(po.status === 'Delivering' || po.status === 'Partial') && (
                          <button 
                            onClick={() => handleStatusChange(po.id, 'Postponed')} 
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Postpone
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === po.id && (
                      <tr className="bg-[#fafafa] border-b border-gray-200">
                        <td colSpan="6" className="p-0">
                          <div className="p-6 md:p-8 flex flex-col gap-6">
                            <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-gray-200 pb-6">
                              <div>
                                <h4 className="m-0 text-sm font-extrabold text-gray-900 tracking-tight">Order Details</h4>
                                <p className="m-0 text-xs text-gray-500 mt-1">
                                  Placed on: {new Date(po.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                              </div>
                              <div className="flex gap-8">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Items</span>
                                  <span className="text-lg font-extrabold text-gray-900">{po.purchase_order_items?.length || 0}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expected Delivery</span>
                                  <span className="text-sm font-bold text-gray-900 mt-1">{formatDisplayDate(po.expected_date)}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Items Ordered & Availability Status
                                </h4>
                                {po.status === 'Pending' && (
                                  <button
                                    onClick={() => setReviewModal({ show: true, order: po })}
                                    className="text-xs font-bold text-zinc-900 hover:underline cursor-pointer"
                                  >
                                    Review / Change Availability →
                                  </button>
                                )}
                              </div>
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                  <thead className="bg-gray-50/80">
                                    <tr>
                                      <th className="px-5 py-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Item Description</th>
                                      <th className="px-5 py-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Availability Status</th>
                                      <th className="px-5 py-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider text-right">Quantity Ordered</th>
                                      <th className="px-5 py-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
                                      <th className="px-5 py-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {po.purchase_order_items?.map(item => {
                                      const resp = item.supplier_response;
                                      const dec = item.shop_decision;

                                      return (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                          <td className="px-5 py-4">
                                            <div className="text-sm font-bold text-gray-900">{item.ingredients?.name || 'Unknown'}</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">ID: {item.ingredient_id.substring(0, 8)}</div>
                                          </td>
                                          <td className="px-5 py-4">
                                            {resp ? (
                                              <div>
                                                {resp.status === 'AVAILABLE' && (
                                                  <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    Confirmed Available
                                                  </span>
                                                )}
                                                {resp.status === 'PROPOSED_DATE' && (
                                                  <div className="flex flex-col gap-0.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                      Proposed: {formatDisplayDate(resp.proposed_date)}
                                                    </span>
                                                    {resp.reason && (
                                                      <span className="text-[10px] text-zinc-500 font-medium">
                                                        Note: {resp.reason}
                                                      </span>
                                                    )}
                                                    {dec ? (
                                                      <span className={`text-[10px] font-black uppercase mt-1 ${dec.decision === 'ACCEPTED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                        Shop Decision: {dec.decision}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[10px] font-bold text-amber-600 mt-0.5">
                                                        Awaiting Shop Approval
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                                {resp.status === 'UNAVAILABLE' && (
                                                  <div className="flex flex-col gap-0.5">
                                                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                      Unavailable
                                                    </span>
                                                    {resp.reason && (
                                                      <span className="text-[10px] text-zinc-500 font-medium">
                                                        Reason: {resp.reason}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-xs text-zinc-400 font-medium italic">
                                                Awaiting review
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-5 py-4 text-sm font-medium text-gray-600 text-right">
                                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-bold">{item.quantity}</span> <span className="text-xs">{item.purchase_unit}</span>
                                          </td>
                                          <td className="px-5 py-4 text-sm font-medium text-gray-900 text-right">₱{Number(item.unit_price).toFixed(2)}</td>
                                          <td className="px-5 py-4 text-sm font-extrabold text-gray-900 text-right">₱{Number(item.subtotal).toFixed(2)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                            {po.notes && (
                              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                                <h4 className="m-0 text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-2">Special Notes / Instructions</h4>
                                <p className="m-0 text-sm text-orange-900">{po.notes}</p>
                              </div>
                            )}

                            {(po.status === 'Declined' || po.status === 'DECLINED') && po.decline_reason && (
                              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                  <h4 className="m-0 text-xs font-bold text-red-800 uppercase tracking-wider">Decline Reason Recorded</h4>
                                  <p className="m-0 text-sm font-medium text-red-900 mt-0.5">{po.decline_reason}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 h-full">
            <p className="m-0 text-sm font-medium">No purchase orders found matching your filters.</p>
          </div>
        )}
      </div>
        </>
      )}

      {/* Decline Order Modal */}
      {declineModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeclineModal({ show: false, orderId: null, reason: '' })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="m-0 text-xl font-black text-gray-900">Decline Purchase Order</h3>
                <p className="m-0 text-xs text-gray-500 font-medium">Order #{declineModal.orderId?.substring(0, 8).toUpperCase()}</p>
              </div>
            </div>
            
            <p className="m-0 text-sm text-gray-600 mb-5 font-medium">
              Please specify the reason for declining this purchase order. This reason will be recorded and communicated directly to the store manager.
            </p>

            <form onSubmit={handleDeclineSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Decline Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-medium"
                  placeholder="e.g., Raw materials temporarily out of stock, supplier maintenance..."
                  value={declineModal.reason}
                  onChange={e => setDeclineModal({ ...declineModal, reason: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer" 
                  onClick={() => setDeclineModal({ show: false, orderId: null, reason: '' })}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {postponeModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPostponeModal({ show: false, orderId: null, date: '' })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8" onClick={e => e.stopPropagation()}>
            <h3 className="m-0 text-xl md:text-2xl font-black text-gray-900 mb-2">Postpone Order</h3>
            <p className="m-0 text-sm md:text-base text-gray-600 mb-6 font-medium">Select a new expected delivery date for this order.</p>
            <form onSubmit={handlePostponeSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm md:text-base font-bold text-gray-700">New Expected Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                  value={postponeModal.date}
                  onChange={e => setPostponeModal({ ...postponeModal, date: e.target.value })}
                  min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm md:text-base uppercase rounded-lg hover:bg-gray-200 transition-colors cursor-pointer" onClick={() => setPostponeModal({ show: false, orderId: null, date: '' })}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white font-bold text-sm md:text-base uppercase rounded-lg hover:bg-black transition-colors cursor-pointer">Postpone</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review & Accept Items Modal */}
      <SupplierReviewPOModal
        isOpen={reviewModal.show}
        onClose={() => setReviewModal({ show: false, order: null })}
        order={reviewModal.order}
        onSubmit={handleReviewSubmit}
      />
    </div>
  );
};

export default SupplierPortal;
