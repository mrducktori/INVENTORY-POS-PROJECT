import React, { useState, useEffect } from 'react';
import { getPurchaseOrders, updatePurchaseOrderStatus, respondToSupplierProposal, reschedulePurchaseOrder } from '../../api/purchasingApi';
import PurchaseOrderForm from './PurchaseOrderForm';
import ReceivePOModal from './components/ReceivePOModal';
import CancelPOModal from './components/CancelPOModal';
import ReschedulePOModal from './components/ReschedulePOModal';

import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import InfoTip from '../../components/shared/InfoTip';
import { supabase } from '../../config/supabaseClient';
import { formatDisplayDateTime, formatDisplayDate, isDatePast, getDaysOverdue } from '../../utils/dateUtils';

const PurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [receivingPO, setReceivingPO] = useState(null);
  const [cancellingPO, setCancellingPO] = useState(null);
  const [reschedulingPO, setReschedulingPO] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tabFilter, setTabFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'PROPOSALS' | 'DELIVERING' | 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState('');
  const [processingProposalId, setProcessingProposalId] = useState(null);

  const fetchOrders = async () => {
    try {
      if (orders.length === 0) setLoading(true);
      const data = await getPurchaseOrders();
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('purchase_orders_changes')
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

  const handleReceiveSubmit = async (id, newStatus, items_received) => {
    try {
      await updatePurchaseOrderStatus(id, newStatus, items_received);
      setReceivingPO(null);
      fetchOrders();
    } catch (err) {
      console.error(err);
      setError('Failed to update status.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCancelConfirm = async (id, reason) => {
    try {
      setActionLoading(true);
      await updatePurchaseOrderStatus(id, 'Cancelled', [], null, reason);
      setCancellingPO(null);
      fetchOrders();
    } catch (err) {
      console.error(err);
      setError('Failed to cancel order: ' + (err.message || ''));
      setTimeout(() => setError(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleConfirm = async (id, newDate, reason) => {
    try {
      setActionLoading(true);
      await reschedulePurchaseOrder(id, newDate, reason);
      setReschedulingPO(null);
      fetchOrders();
    } catch (err) {
      console.error(err);
      setError('Failed to reschedule delivery date: ' + (err.message || ''));
      setTimeout(() => setError(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleProposalDecision = async (poId, itemId, decision, splitIntoBackorder = true) => {
    try {
      setProcessingProposalId(itemId);
      await respondToSupplierProposal(poId, itemId, decision, splitIntoBackorder);
      await fetchOrders();
    } catch (err) {
      console.error(err);
      setError('Failed to respond to proposal: ' + err.message);
      setTimeout(() => setError(''), 4000);
    } finally {
      setProcessingProposalId(null);
    }
  };

  const handleCreateSuccess = () => {
    setShowModal(false);
    fetchOrders();
  };

  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  // Overdue detection helper
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
  const proposalsCount = orders.filter(o => o.has_proposals || o.status === 'Proposal Pending' || o.status === 'Partially Accepted').length;
  const deliveringCount = orders.filter(o => ['To Be Delivered', 'Delivering', 'Partial'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'Received').length;

  // Filtered orders (tab + multi-field search)
  const filteredOrders = orders.filter(po => {
    if (tabFilter === 'OVERDUE' && !isPOOverdue(po)) return false;
    if (tabFilter === 'PROPOSALS' && !(po.has_proposals || po.status === 'Proposal Pending' || po.status === 'Partially Accepted')) return false;
    if (tabFilter === 'DELIVERING' && !['To Be Delivered', 'Delivering', 'Partial'].includes(po.status)) return false;
    if (tabFilter === 'COMPLETED' && po.status !== 'Received') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const poId = String(po.id || '').toLowerCase();
      const supplierName = String(po.suppliers?.name || '').toLowerCase();
      const status = String(po.status || '').toLowerCase();
      const itemsMatch = (po.purchase_order_items || []).some(item =>
        String(item.ingredients?.name || '').toLowerCase().includes(q)
      );
      return poId.includes(q) || supplierName.includes(q) || status.includes(q) || itemsMatch;
    }

    return true;
  });

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Purchase Orders</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Manage supplier orders, track incoming ingredients, and confirm received stock.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Current Orders</h2>
          <button 
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
            onClick={() => setShowModal(true)}
          >
            + Create Purchase Order
          </button>
        </div>

        {/* Tab Filter Navigation Bar + Search */}
        <div className="px-6 py-3.5 border-b border-gray-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setTabFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'ALL'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              onClick={() => setTabFilter('OVERDUE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tabFilter === 'OVERDUE'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : overdueCount > 0
                    ? 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <span>Overdue ({overdueCount})</span>
              {overdueCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
            </button>
            <button
              onClick={() => setTabFilter('PROPOSALS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tabFilter === 'PROPOSALS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>Supplier Proposals ({proposalsCount})</span>
              {proposalsCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
            </button>
            <button
              onClick={() => setTabFilter('DELIVERING')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'DELIVERING'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              In Transit / Delivering ({deliveringCount})
            </button>
            <button
              onClick={() => setTabFilter('COMPLETED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                tabFilter === 'COMPLETED'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
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
              placeholder="Search PO #, supplier, or ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
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
        
        <div className="p-0">
          {error && <div className="m-4 p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-bold">{error}</div>}

          {loading ? (
            <div className="p-4 md:p-6">
              <TableSkeleton rows={6} cols={7} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ID (Ref)</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Expected Date</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Items Summary</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Amount</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-400 font-medium">
                        {tabFilter === 'PROPOSALS'
                          ? 'No purchase orders with supplier proposals or rescheduled items at the moment.'
                          : 'No purchase orders found matching your filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(po => {
                      const isOverdue = isPOOverdue(po);
                      const daysOverdue = getPODaysOverdue(po);
                      const itemNames = (po.purchase_order_items || [])
                        .map(i => i.ingredients?.name)
                        .filter(Boolean);

                      return (
                        <React.Fragment key={po.id}>
                          <tr 
                            className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${expandedRow === po.id ? 'bg-gray-50/50' : ''}`}
                            onClick={() => toggleRow(po.id)}
                          >
                            <td className="px-6 py-4 font-bold text-gray-900 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] transition-transform ${expandedRow === po.id ? 'rotate-90' : ''}`}>▶</span>
                                <span>PO #{po.id.substring(0, 8).toUpperCase()}</span>
                                {po.has_proposals && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                    Proposals ({po.pending_proposals_count || 'Review'})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-800">{po.suppliers?.name || 'Unknown'}</td>
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
                                    {daysOverdue} day{daysOverdue === 1 ? '' : 's'} late
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-600 font-medium">{formatDisplayDate(po.expected_date)}</span>
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
                            <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">₱{Number(po.total_amount).toFixed(2)}</td>
                            <td className="px-6 py-4">
                              {isOverdue ? (
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                    Overdue ({daysOverdue}d late)
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    Stage: {po.status}
                                  </span>
                                </div>
                              ) : (
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                  ${po.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                    po.status === 'Proposal Pending' ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold' :
                                    po.status === 'Partially Accepted' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                    po.status === 'Accepted' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                    po.status === 'To Be Delivered' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                    po.status === 'Delivering' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                    po.status === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    (po.status === 'Declined' || po.status === 'DECLINED') ? 'bg-red-50 text-red-700 border border-red-200 font-extrabold' :
                                    po.status === 'Received' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    po.status === 'Cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
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
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              {po.status !== 'Received' && po.status !== 'Cancelled' && po.status !== 'Declined' && po.status !== 'DECLINED' && (
                                <div className="flex justify-end gap-1.5 flex-wrap">
                                  {!isOverdue && ['Accepted', 'To Be Delivered', 'Delivering', 'Partial'].includes(po.status) && (
                                    <button 
                                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-emerald-300 whitespace-nowrap cursor-pointer"
                                      onClick={() => setReceivingPO(po)}
                                    >
                                      Receive Stock
                                    </button>
                                  )}
                                  <button 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                                      isOverdue
                                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold shadow-2xs'
                                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                                    }`}
                                    onClick={() => setReschedulingPO(po)}
                                    title={isOverdue ? 'Order past due: reschedule delivery date to proceed' : 'Reschedule expected date'}
                                  >
                                    Reschedule
                                  </button>
                                  {!isOverdue && po.status === 'Postponed' && (
                                    <button 
                                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-blue-200 whitespace-nowrap cursor-pointer"
                                      onClick={() => updatePurchaseOrderStatus(po.id, 'To Be Delivered')}
                                    >
                                      Accept Date
                                    </button>
                                  )}
                                  <button 
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-rose-200 whitespace-nowrap cursor-pointer"
                                    onClick={() => setCancellingPO(po)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {expandedRow === po.id && (
                          <tr className="bg-gray-50/80">
                            <td colSpan="7" className="p-0">
                              <div className="px-8 py-6 border-b border-gray-200">
                                {isOverdue && (
                                  <div className="mb-4 px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-900">
                                    <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                      <span>Order Past Due ({daysOverdue} days late)</span>
                                    </div>
                                    <InfoTip text="Stock receiving is locked until a revised delivery date is scheduled or the order is cancelled." />
                                  </div>
                                )}
                                {(po.status === 'Declined' || po.status === 'DECLINED') && po.decline_reason && (
                                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900">
                                    <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                      <div className="text-xs font-bold uppercase tracking-wider text-red-700">Decline Reason Provided by Supplier</div>
                                      <div className="text-sm font-medium mt-0.5 text-red-900">{po.decline_reason}</div>
                                    </div>
                                  </div>
                                )}
                                {(po.status === 'Cancelled' || po.status === 'CANCELLED') && po.cancellation_reason && (
                                  <div className="mb-4 p-4 bg-zinc-100 border border-zinc-300 rounded-xl flex items-start gap-3 text-zinc-900">
                                    <svg className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-600">Cancellation Reason Recorded</div>
                                      <div className="text-sm font-semibold mt-0.5 text-zinc-900">{po.cancellation_reason}</div>
                                    </div>
                                  </div>
                                )}
                                {po.reschedule_history && po.reschedule_history.length > 0 && (
                                  <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                                    <div className="font-bold uppercase tracking-wider text-amber-800 mb-1">Delivery Reschedule History</div>
                                    <div className="space-y-1">
                                      {po.reschedule_history.map((rh, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <span className="font-semibold text-zinc-700">• Moved to {formatDisplayDate(rh.new_expected_date)}</span>
                                          {rh.reason && <span className="text-zinc-500 italic">({rh.reason})</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                  <h4 className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Order Items & Supplier Responses
                                  </h4>
                                  {po.has_proposals && (
                                    <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full">
                                      Review supplier proposed delivery dates below
                                    </span>
                                  )}
                                </div>
                                
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                  <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier Status</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ordered</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Received</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {po.purchase_order_items?.map(item => {
                                        const orderedTotal = Number(item.quantity) * Number(item.unit_price);
                                        const receivedTotal = Number(item.quantity_received || 0) * Number(item.unit_price);
                                        const balance = orderedTotal - receivedTotal;
                                        const resp = item.supplier_response;
                                        const dec = item.shop_decision;

                                        return (
                                          <React.Fragment key={item.id}>
                                            <tr className="hover:bg-gray-50/50 transition-colors">
                                              <td className="px-4 py-3 text-base font-bold text-gray-900">
                                                {item.ingredients?.name || 'Unknown'}
                                              </td>
                                              
                                              {/* Supplier Availability Status */}
                                              <td className="px-4 py-3">
                                                {resp ? (
                                                  <div className="flex flex-col gap-1">
                                                    {resp.status === 'AVAILABLE' && (
                                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        Available
                                                      </span>
                                                    )}
                                                    {resp.status === 'PROPOSED_DATE' && (
                                                      <div className="flex flex-col gap-1 max-w-sm">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                          Proposed Delivery: {formatDisplayDate(resp.proposed_date)}
                                                        </span>
                                                        {resp.reason && (
                                                          <span className="text-xs text-zinc-600 font-medium whitespace-normal">
                                                            Reason: {resp.reason}
                                                          </span>
                                                        )}
                                                        
                                                        {/* Decision Action Buttons */}
                                                        {!dec && (
                                                          <div className="flex items-center gap-2 mt-1">
                                                            <button
                                                              type="button"
                                                              disabled={processingProposalId === item.id}
                                                              onClick={() => handleProposalDecision(po.id, item.id, 'ACCEPTED', true)}
                                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                                            >
                                                              {processingProposalId === item.id ? 'Saving...' : 'Accept Date (Backorder)'}
                                                            </button>
                                                            <button
                                                              type="button"
                                                              disabled={processingProposalId === item.id}
                                                              onClick={() => handleProposalDecision(po.id, item.id, 'DECLINED', false)}
                                                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold cursor-pointer transition-colors"
                                                            >
                                                              Decline
                                                            </button>
                                                          </div>
                                                        )}

                                                        {dec && (
                                                          <div className="mt-1">
                                                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                                                              dec.decision === 'ACCEPTED'
                                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            }`}>
                                                              Shop: {dec.decision === 'ACCEPTED' ? 'Accepted (Backorder Created)' : 'Declined'}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                    {resp.status === 'UNAVAILABLE' && (
                                                      <div className="flex flex-col gap-0.5 max-w-sm">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                          Unavailable
                                                        </span>
                                                        {resp.reason && (
                                                          <span className="text-xs text-zinc-600 font-medium whitespace-normal">
                                                            Reason: {resp.reason}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span className="text-xs text-zinc-400 font-medium italic">
                                                    Pending supplier response
                                                  </span>
                                                )}
                                              </td>

                                              <td className="px-4 py-3 text-base font-medium text-gray-600 text-right">{item.quantity} - {item.purchase_unit}</td>
                                              <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                  <div className="text-base font-bold text-gray-900">
                                                    Total: {item.quantity_received || 0} / {item.quantity} {item.purchase_unit}
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-base font-medium text-gray-900 text-right">₱{Number(item.unit_price).toFixed(2)}</td>
                                              <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col items-end">
                                                  <span className="text-base font-bold text-gray-900">₱{orderedTotal.toFixed(2)}</span>
                                                  {item.quantity_received > 0 && (
                                                    <span className="text-sm font-bold text-green-600 mt-1 border-t border-gray-200 pt-1">Bal: ₱{balance.toFixed(2)}</span>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>

                                            {/* Direct Table Rows for Each Received Batch (Received 1, Received 2, etc.) */}
                                            {(() => {
                                              const receiptList = (item.receipt_history && item.receipt_history.length > 0)
                                                ? item.receipt_history
                                                : (item.quantity_received > 0 && po.received_at)
                                                  ? [{ date: po.received_at, quantity: item.quantity_received }]
                                                  : [];

                                              if (receiptList.length === 0) return null;

                                              return receiptList.map((rh, idx) => {
                                                const batchValue = Number(rh.quantity) * Number(item.unit_price);
                                                return (
                                                  <tr
                                                    key={`${item.id}-rh-${idx}`}
                                                    className="bg-zinc-50/80 hover:bg-zinc-100/70 border-t border-dashed border-zinc-200 transition-colors"
                                                  >
                                                    <td className="px-4 py-2.5 pl-8" colSpan="2">
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-zinc-400 font-bold select-none">↳</span>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-white text-zinc-800 border border-zinc-200 shadow-2xs">
                                                          Received {idx + 1}
                                                        </span>
                                                      </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs md:text-sm font-semibold text-zinc-600 text-right" colSpan="2">
                                                      {formatDisplayDateTime(rh.date)}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm md:text-base font-bold text-emerald-700 text-right">
                                                      +{rh.quantity} - {item.purchase_unit}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm md:text-base font-bold text-zinc-900 text-right">
                                                      ₱{batchValue.toFixed(2)}
                                                    </td>
                                                  </tr>
                                                );
                                              });
                                            })()}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <PurchaseOrderForm 
          onClose={() => setShowModal(false)} 
          onSuccess={handleCreateSuccess} 
        />
      )}
      
      {receivingPO && (
        <ReceivePOModal 
          po={receivingPO} 
          onClose={() => setReceivingPO(null)}
          onSubmit={handleReceiveSubmit}
        />
      )}

      {cancellingPO && (
        <CancelPOModal 
          po={cancellingPO}
          onClose={() => setCancellingPO(null)}
          onConfirm={handleCancelConfirm}
          loading={actionLoading}
        />
      )}

      {reschedulingPO && (
        <ReschedulePOModal 
          po={reschedulingPO}
          onClose={() => setReschedulingPO(null)}
          onSubmit={handleRescheduleConfirm}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default PurchaseOrders;
