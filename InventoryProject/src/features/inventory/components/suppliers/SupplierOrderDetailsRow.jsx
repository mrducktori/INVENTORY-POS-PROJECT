import React from 'react';
import { formatDisplayDate } from '../../../../utils/dateUtils';

const SupplierOrderDetailsRow = ({ po, onOpenReviewModal }) => {
  return (
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
                  onClick={() => onOpenReviewModal(po)}
                  className="text-xs font-bold text-zinc-900 hover:underline cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">Review / Change Availability <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
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

          {(po.status === 'Cancelled' || po.status === 'CANCELLED') && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="m-0 text-xs font-bold text-rose-800 uppercase tracking-wider">Cancellation Reason Recorded</h4>
                <p className="m-0 text-sm font-medium text-rose-900 mt-0.5">
                  {po.cancellation_reason || 'This purchase order was cancelled by the café.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

export default SupplierOrderDetailsRow;
