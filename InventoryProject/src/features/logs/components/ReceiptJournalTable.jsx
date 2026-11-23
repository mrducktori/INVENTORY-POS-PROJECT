import React from 'react';
import { formatDateTime } from '../hooks/useSalesReceiptJournal.js';

/**
 * Displays the receipt journal loading skeleton, empty filter state, sortable transaction table, and pagination bar.
 */
const ReceiptJournalTable = ({
  loading,
  filteredCount,
  displayedSales,
  effectiveTotal,
  currentPage,
  totalPages,
  pageSize,
  startEntry,
  endEntry,
  pageNumbers,
  onResetFilters,
  onSort,
  onSelectReceipt,
  onPageChange,
  onPageSizeChange,
}) => {
  return (
    <>
      {/* Table Content */}
      {loading ? (
        <div className="space-y-2 py-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-100/70 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredCount === 0 ? (
        <div className="py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h4 className="text-sm font-bold text-zinc-800 m-0">No receipts match your current filters</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Try choosing another type or reset filters to display all transactions.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-3 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold">
                <th className="py-3 px-3 sticky left-0 bg-zinc-50/50 z-10 whitespace-nowrap">
                  Receipt No.
                </th>
                <th
                  onClick={() => onSort('created')}
                  className="py-3 px-3 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Date &amp; Time</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th
                  onClick={() => onSort('customer')}
                  className="py-3 px-3 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Cashier / Staff</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  Items Breakdown
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">
                  Qty
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  Method
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  Discount
                </th>
                <th
                  onClick={() => onSort('total_price')}
                  className="py-3 px-3 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">
                  Status
                </th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {displayedSales.map((sale) => {
                const items = sale.sale_items || [];
                const receiptNo = sale.receipt_number || `RCP-${String(sale.id).slice(0, 8).toUpperCase()}`;
                const totalFormatted = `₱${Number(sale.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const method = String(sale.payment_method || 'CASH').toUpperCase();
                const staffName = sale.users?.name || sale.users?.username || 'Staff';
                const totalItemsQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
                const discountAmount = Number(sale.discount_amount || 0);
                const discountDetails = sale.discount_details || null;
                const splitPayments = Array.isArray(sale.payments) ? sale.payments : [];
                const saleStatus = String(
                  sale.void_info?.action_type === 'REFUND'
                    ? 'REFUNDED'
                    : sale.void_info
                    ? 'VOIDED'
                    : sale.status || 'COMPLETED'
                ).toUpperCase();
                const isVoidedOrRefunded =
                  saleStatus === 'VOIDED' || saleStatus === 'REFUNDED' || saleStatus === 'RETURNED';

                const notesDiscountMatch =
                  typeof sale.notes === 'string' ? sale.notes.match(/Discount:\s*([^|\n]+)/i) : null;
                const discountLabel =
                  discountDetails?.discount_label ||
                  discountDetails?.label ||
                  (notesDiscountMatch?.[1] ? notesDiscountMatch[1].trim() : null) ||
                  (discountAmount > 0 ? 'Applied' : null);

                return (
                  <tr
                    key={sale.id}
                    onClick={() => onSelectReceipt(sale.id)}
                    className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Receipt No */}
                    <td className="sticky left-0 bg-white group-hover:bg-zinc-50 z-10 py-3.5 px-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {receiptNo}
                    </td>

                    {/* Date & Time */}
                    <td className="py-3.5 px-3 text-zinc-600 font-mono text-xs whitespace-nowrap">
                      {formatDateTime(sale.created_at)}
                    </td>

                    {/* Cashier / Staff */}
                    <td className="py-3.5 px-3 font-medium text-zinc-800 whitespace-nowrap">
                      {staffName}
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-3 text-zinc-800 max-w-xs">
                      {items.length > 0 ? (
                        <div className="space-y-1">
                          {items.slice(0, 2).map((it, idx) => (
                            <div key={it.id || idx} className="flex items-center gap-1.5 truncate">
                              <span className="inline-flex items-center justify-center min-w-4 px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                {it.quantity || 1}×
                              </span>
                              <span className="truncate font-medium text-zinc-900">
                                {it.products?.name || 'Item'}
                              </span>
                              {it.cup_size && (
                                <span className="text-[10px] text-zinc-400 font-mono">({it.cup_size})</span>
                              )}
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div className="text-[11px] text-zinc-400 font-medium">
                              +{items.length - 2} more item{items.length - 2 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Total Qty */}
                    <td className="py-3.5 px-3 text-center text-zinc-700 font-mono font-semibold whitespace-nowrap">
                      {totalItemsQty}
                    </td>

                    {/* Payment Method */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          method === 'GCASH' || method === 'MAYA' || method === 'QRPH'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : method === 'SPLIT'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                        }`}
                      >
                        {method}
                      </span>
                      {splitPayments.length > 0 && (
                        <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                          {splitPayments
                            .map((p) => `${String(p.method || '').toUpperCase()} ₱${Number(p.amount || 0).toFixed(0)}`)
                            .join(' + ')}
                        </div>
                      )}
                    </td>

                    {/* Discount Badge */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {discountLabel ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {discountLabel} (-₱{discountAmount.toFixed(2)})
                          </span>
                          {(discountDetails?.discount_id_number || discountDetails?.promo_code) && (
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {discountDetails.promo_code
                                ? `Code: ${discountDetails.promo_code}`
                                : `ID: ${discountDetails.discount_id_number}`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Total */}
                    <td className={`py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap ${isVoidedOrRefunded ? 'text-zinc-400 line-through' : 'text-zinc-950'}`}>
                      {totalFormatted}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isVoidedOrRefunded
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {saleStatus === 'COMPLETED' ? 'Completed' : saleStatus}
                      </span>
                      {isVoidedOrRefunded && sale.void_info?.reason && (
                        <div
                          className="text-[10px] text-red-600 mt-0.5 max-w-[140px] truncate mx-auto"
                          title={sale.void_info.reason}
                        >
                          {sale.void_info.reason}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReceipt(sale.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && effectiveTotal > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-100 text-xs md:text-sm text-zinc-600">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="font-semibold text-zinc-900">{startEntry}</strong> to{' '}
              <strong className="font-semibold text-zinc-900">{endEntry}</strong> of{' '}
              <strong className="font-semibold text-zinc-900">{effectiveTotal}</strong> entries
            </span>

            <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-3">
              <span className="text-zinc-500 text-xs">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(e.target.value)}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer"
              >
                {[10, 25, 50].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-zinc-700"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((page, idx) =>
                page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                  <span key={`el-${idx}`} className="px-2 py-1 text-zinc-400 font-semibold">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => onPageChange(page)}
                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      currentPage === page
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-700 hover:bg-zinc-100 border border-transparent hover:border-zinc-200'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-zinc-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceiptJournalTable;
