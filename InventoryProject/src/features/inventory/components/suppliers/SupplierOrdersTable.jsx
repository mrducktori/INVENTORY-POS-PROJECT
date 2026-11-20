import React from 'react';
import { formatDisplayDate } from '../../../../utils/dateUtils';
import { isPOOverdue, getPODaysOverdue } from '../../hooks/useSupplierPortal';
import SupplierOrderDetailsRow from './SupplierOrderDetailsRow';
import Pagination from '../../../../components/shared/Pagination';

const STATUS_BADGE_CLASSES = {
  Pending: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'Proposal Pending': 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold',
  'Partially Accepted': 'bg-sky-50 text-sky-700 border border-sky-200',
  Accepted: 'bg-blue-50 text-blue-700 border border-blue-200',
  'To Be Delivered': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  Delivering: 'bg-purple-50 text-purple-700 border border-purple-200',
  Declined: 'bg-red-50 text-red-700 border border-red-200',
  DECLINED: 'bg-red-50 text-red-700 border border-red-200',
  Cancelled: 'bg-rose-50 text-rose-700 border border-rose-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border border-rose-200',
  Received: 'bg-green-50 text-green-700 border border-green-200'
};

const SupplierOrdersTable = ({
  loading,
  orders,
  filteredOrders,
  paginatedOrders,
  tabFilter,
  setTabFilter,
  searchQuery,
  setSearchQuery,
  overdueCount,
  pendingCount,
  proposalsCount,
  activeCount,
  completedCount,
  expandedId,
  toggleExpand,
  orderPage,
  setOrderPage,
  orderItemsPerPage,
  setOrderItemsPerPage,
  orderTotalPages,
  onStatusChange,
  onOpenReviewModal
}) => {
  return (
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
              aria-label="Clear"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
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
              {paginatedOrders.map(po => {
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
                          <svg
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${
                              expandedId === po.id ? 'rotate-90 text-zinc-900' : 'group-hover:text-zinc-700'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
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
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE_CLASSES[po.status] || 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {po.status}
                          </span>
                        )}
                        {(po.status === 'Declined' || po.status === 'DECLINED') && po.decline_reason && (
                          <div className="mt-1 text-xs text-red-600 font-medium max-w-xs truncate" title={po.decline_reason}>
                            Reason: {po.decline_reason}
                          </div>
                        )}
                        {(po.status === 'Cancelled' || po.status === 'CANCELLED') && po.cancellation_reason && (
                          <div className="mt-1 text-xs text-rose-600 font-medium max-w-xs truncate" title={po.cancellation_reason}>
                            Reason: {po.cancellation_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        {po.status === 'Pending' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onStatusChange(po.id, 'Declined')}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => onOpenReviewModal(po)}
                              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                            >
                              <span className="inline-flex items-center gap-1.5">Review & Accept Items <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
                            </button>
                          </div>
                        )}
                        {po.status === 'Proposal Pending' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onOpenReviewModal(po)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Edit Proposals
                            </button>
                            <button
                              onClick={() => onStatusChange(po.id, 'To Be Delivered')}
                              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Deliver Ready Items
                            </button>
                          </div>
                        )}
                        {po.status === 'Accepted' && (
                          <button
                            onClick={() => onStatusChange(po.id, 'To Be Delivered')}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Mark To Be Delivered
                          </button>
                        )}
                        {po.status === 'To Be Delivered' && (
                          <div className="flex justify-end gap-2">
                            {!isOverdue && (
                              <button
                                onClick={() => onStatusChange(po.id, 'Delivering')}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Mark Delivering
                              </button>
                            )}
                            <button
                              onClick={() => onStatusChange(po.id, 'Postponed')}
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
                            onClick={() => onStatusChange(po.id, 'Postponed')}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Postpone
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === po.id && (
                      <SupplierOrderDetailsRow po={po} onOpenReviewModal={onOpenReviewModal} />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {filteredOrders.length > 0 && (
            <Pagination
              currentPage={orderPage}
              totalPages={orderTotalPages}
              totalItems={filteredOrders.length}
              itemsPerPage={orderItemsPerPage}
              onPageChange={setOrderPage}
              onItemsPerPageChange={(val) => {
                setOrderItemsPerPage(val);
                setOrderPage(1);
              }}
              itemsPerPageOptions={[10, 20, 50]}
            />
          )}
        </div>
      ) : (
        <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 h-full">
          <p className="m-0 text-sm font-medium">No purchase orders found matching your filters.</p>
        </div>
      )}
    </div>
  );
};

export default SupplierOrdersTable;
