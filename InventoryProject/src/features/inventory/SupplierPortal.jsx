import React, { useState, useEffect } from 'react';
import { getSupplierOwnOrders, updateSupplierOrderStatus, submitSupplierItemResponses } from '../../api/purchasingApi';
import { supabase } from '../../config/supabaseClient';
import { formatDisplayDate } from '../../utils/dateUtils';
import SupplierReviewPOModal from './components/SupplierReviewPOModal';

const SupplierPortal = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [tabFilter, setTabFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PROPOSALS' | 'ACTIVE' | 'COMPLETED'
  const [postponeModal, setPostponeModal] = useState({ show: false, orderId: null, date: '' });
  const [reviewModal, setReviewModal] = useState({ show: false, order: null });

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
    try {
      await updateSupplierOrderStatus(id, newStatus);
      fetchOrders();
    } catch (err) {
      setError('Failed to update status: ' + err.message);
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
    try {
      await submitSupplierItemResponses(poId, itemsPayload);
      setReviewModal({ show: false, order: null });
      fetchOrders();
    } catch (err) {
      throw err;
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Counts
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const proposalsCount = orders.filter(o => o.has_proposals || o.status === 'Proposal Pending' || o.status === 'Partially Accepted').length;
  const activeCount = orders.filter(o => ['Accepted', 'To Be Delivered', 'Delivering', 'Partial'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'Received').length;

  // Filtered orders
  const filteredOrders = orders.filter(po => {
    if (tabFilter === 'PENDING') return po.status === 'Pending';
    if (tabFilter === 'PROPOSALS') return po.has_proposals || po.status === 'Proposal Pending' || po.status === 'Partially Accepted';
    if (tabFilter === 'ACTIVE') return ['Accepted', 'To Be Delivered', 'Delivering', 'Partial'].includes(po.status);
    if (tabFilter === 'COMPLETED') return po.status === 'Received';
    return true;
  });

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Supplier Portal</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Manage incoming purchase orders from the store.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl text-sm font-bold bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'PROPOSALS' ? 'text-amber-100' : 'text-amber-700'}`}>Proposals & Rescheduled</span>
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
        {/* Navigation Tabs Bar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60 flex items-center justify-between flex-wrap gap-3">
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
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map(po => (
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
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">{formatDisplayDate(po.expected_date)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">₱{Number(po.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${po.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                            po.status === 'Proposal Pending' ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold' :
                            po.status === 'Partially Accepted' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                            po.status === 'Accepted' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            po.status === 'To Be Delivered' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            po.status === 'Delivering' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            po.status === 'Declined' ? 'bg-red-50 text-red-700 border border-red-200' :
                            po.status === 'Received' ? 'bg-green-50 text-green-700 border border-green-200' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                          {po.status}
                        </span>
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
                            <button 
                              onClick={() => handleStatusChange(po.id, 'Delivering')} 
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Mark Delivering
                            </button>
                            <button 
                              onClick={() => handleStatusChange(po.id, 'Postponed')} 
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Postpone
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
                        <td colSpan="5" className="p-0">
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
                                                    ✓ Confirmed Available
                                                  </span>
                                                )}
                                                {resp.status === 'PROPOSED_DATE' && (
                                                  <div className="flex flex-col gap-0.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                      ⏳ Proposed: {formatDisplayDate(resp.proposed_date)}
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
                                                      ✕ Unavailable
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
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 h-full">
            <p className="m-0 text-sm font-medium">No purchase orders found in this category.</p>
          </div>
        )}
      </div>

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
