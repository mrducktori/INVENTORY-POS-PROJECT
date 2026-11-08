import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getSales } from '../../api/salesApi';
import { getSalesReceipt } from '../../api/logsApi';

// Format date to: YYYY-MM-DD hh:mm:ss A
const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    let hh = d.getHours();
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${yyyy}-${mm}-${dd} ${pad(hh)}:${min}:${ss} ${ampm}`;
  } catch {
    return dateStr;
  }
};

const SalesReceiptJournal = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Receipt Modal view for clicked row
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState(null);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch sales (compatible with both { data, total } and raw array responses)
  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const result = await getSales(
          {
            search: debouncedSearch,
          },
          pageSize,
          currentPage
        );
        const list = Array.isArray(result) ? result : (result?.data || []);
        const total = Math.max(Number(result?.total) || 0, list.length);
        setSales(list);
        setTotalCount(total);
      } catch (err) {
        console.error('Failed to load sales:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [debouncedSearch, pageSize, currentPage]);

  // Open Receipt Modal
  const handleRowClick = async (sale) => {
    setActiveReceiptSaleId(sale.id);
    setLoadingReceipt(true);
    try {
      const data = await getSalesReceipt(sale.id);
      setReceiptDetails(data);
    } catch (err) {
      console.error('Failed to fetch receipt details:', err);
      setReceiptDetails(null);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleCloseReceipt = () => {
    setActiveReceiptSaleId(null);
    setReceiptDetails(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Client-side sorting for loaded rows
  const sortedSales = useMemo(() => {
    const list = [...sales];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'customer') {
        valA = a.users?.name || '';
        valB = b.users?.name || '';
      } else if (sortField === 'total_price') {
        valA = Number(a.total_amount) || 0;
        valB = Number(b.total_amount) || 0;
      } else if (sortField === 'paid_amount') {
        valA = Number(a.amount_received || a.total_amount) || 0;
        valB = Number(b.amount_received || b.total_amount) || 0;
      } else if (sortField === 'created') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [sales, sortField, sortOrder]);

  // If the server returned an un-sliced full array, slice client-side; otherwise use server page
  const displayedSales = useMemo(() => {
    if (sortedSales.length > pageSize) {
      const start = (currentPage - 1) * pageSize;
      return sortedSales.slice(start, start + pageSize);
    }
    return sortedSales;
  }, [sortedSales, currentPage, pageSize]);

  const effectiveTotal = Math.max(totalCount, sortedSales.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const startEntry = effectiveTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, effectiveTotal);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) end = 4;
      else if (currentPage >= totalPages - 2) start = totalPages - 3;
      if (start > 2) pages.push('ellipsis-start');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-white min-h-screen overflow-y-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight m-0">
              Latest Sales
            </h1>
          </div>

          {/* Right Toolbar: Search */}
          <div className="flex items-center gap-3">
            <div className="relative w-64 md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sales Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-600 font-medium">
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap sticky left-0 bg-white z-10">
                  Order No.
                </th>
                <th
                  onClick={() => handleSort('customer')}
                  className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                  Menu item
                </th>
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                  Quantity
                </th>
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                  Status
                </th>
                <th
                  onClick={() => handleSort('total_price')}
                  className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Total Price</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('paid_amount')}
                  className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Paid Amount</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                  Type
                </th>
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                  Payment method
                </th>
                <th
                  onClick={() => handleSort('created')}
                  className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Created</span>
                    <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                // Skeleton loading rows
                [...Array(6)].map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td className="py-4 px-3 sticky left-0 bg-white"><div className="h-4 w-32 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-20 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-40 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-8 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-16 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-20 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-20 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-16 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-5 w-14 bg-zinc-200/70 rounded-full animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-36 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-36 bg-zinc-200/70 rounded-md animate-pulse" /></td>
                  </tr>
                ))
              ) : displayedSales.length > 0 ? (
                displayedSales.map((sale) => {
                  const items = sale.sale_items || [];
                  const orderNo = sale.receipt_number
                    ? `ORD-${String(sale.receipt_number).padStart(13, '0')}`
                    : `ORD-${(sale.id || '').substring(0, 13).toUpperCase()}`;
                  const totalFormatted = `₱${Number(sale.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const paidFormatted = `₱${Number(sale.amount_received || sale.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const orderType = sale.order_type || 'dine_in';
                  const paymentMethod = (sale.payment_method || 'cash').toLowerCase();

                  const displayCustomer = sale.customer_name || (sale.users?.name && sale.users.name.toLowerCase() !== 'customer' ? sale.users.name : 'Walk-in Guest');

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => handleRowClick(sale)}
                      className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Order No. */}
                      <td className="sticky left-0 bg-white group-hover:bg-zinc-50 z-10 py-3.5 px-3 font-mono font-bold text-zinc-900 whitespace-nowrap shadow-[1px_0_0_0_#f4f4f5]">
                        {orderNo}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-3 text-zinc-700 whitespace-nowrap">
                        <span className={displayCustomer === 'Walk-in Guest' ? 'text-zinc-400 italic' : 'font-medium text-zinc-800'}>
                          {displayCustomer}
                        </span>
                      </td>

                      {/* Menu item(s) */}
                      <td className="py-3.5 px-3 text-zinc-800">
                        {items.length > 0 ? (
                          <div className="space-y-1 py-0.5">
                            {items.map((it, idx) => (
                              <div key={it.id || idx} className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                  {it.quantity || 1}×
                                </span>
                                <span className="whitespace-nowrap font-medium text-zinc-900">
                                  {it.products?.name || 'Item'}
                                </span>
                                {it.cup_size && (
                                  <span className="text-[10px] text-zinc-400 font-mono">({it.cup_size})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Total items count */}
                      <td className="py-3.5 px-3 text-zinc-700 font-semibold whitespace-nowrap">
                        {items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0)} items
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          completed
                        </span>
                      </td>

                      {/* Total Price */}
                      <td className="py-3.5 px-3 text-zinc-950 font-bold font-mono whitespace-nowrap">
                        {totalFormatted}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3.5 px-3 text-zinc-700 font-mono whitespace-nowrap">
                        {paidFormatted}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-3 text-zinc-600 lowercase whitespace-nowrap">
                        {orderType}
                      </td>

                      {/* Payment method */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            paymentMethod === 'gcash'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {paymentMethod}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-3 text-zinc-600 font-mono text-xs whitespace-nowrap">
                        {formatDateTime(sale.created_at)}
                      </td>

                      {/* Updated */}
                      <td className="py-3.5 px-3 text-zinc-600 font-mono text-xs whitespace-nowrap">
                        {formatDateTime(sale.updated_at || sale.created_at)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-zinc-400">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Always-visible Pagination Bar when entries exist */}
        {!loading && effectiveTotal > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-zinc-100 text-xs md:text-sm text-zinc-600">
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
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-zinc-700"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) =>
                  page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                    <span key={`el-${idx}`} className="px-2 py-1 text-zinc-400 font-semibold">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-zinc-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Receipt Modal - Portaled to document.body and top-anchored */}
      {activeReceiptSaleId && createPortal(
        <div
          className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-start pt-8 sm:pt-12 md:pt-16 pb-12 p-4 animate-[modalBackdropFadeIn_0.2s_ease-out]"
          onClick={handleCloseReceipt}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] overflow-y-auto p-6 animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4 shrink-0">
              <span className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                Transaction Receipt
              </span>
              <button
                type="button"
                onClick={handleCloseReceipt}
                className="text-zinc-400 hover:text-zinc-800 text-lg font-bold cursor-pointer p-1 bg-transparent border-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {loadingReceipt ? (
              <div className="py-12 text-center text-zinc-400 font-medium">Loading receipt details...</div>
            ) : receiptDetails ? (
              <div className="text-zinc-800 text-sm space-y-4">
                <div className="text-center">
                  <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight m-0">COF/TEA CAFE</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5 mb-0">Main Branch • Store #001</p>
                </div>

                <div className="border-t border-b border-dashed border-zinc-200 py-2.5 text-xs text-zinc-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="font-medium text-zinc-900">{formatDateTime(receiptDetails.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Receipt No:</span>
                    <span className="font-mono font-bold text-zinc-900">{receiptDetails.receipt_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span className="font-medium text-zinc-900">{receiptDetails.users?.name || 'System'}</span>
                  </div>
                </div>

                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-semibold">
                      <th className="py-1.5 text-left">Item</th>
                      <th className="py-1.5 text-center">Qty</th>
                      <th className="py-1.5 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {receiptDetails.sale_items?.map((item) => (
                      <tr key={item.id} className="py-1.5">
                        <td className="py-1.5 font-medium text-zinc-900">
                          {item.products?.name}
                          {item.cup_size && <span className="text-[10px] text-zinc-400 ml-1 font-mono">({item.cup_size})</span>}
                        </td>
                        <td className="py-1.5 text-center text-zinc-700 font-mono font-bold">{item.quantity}</td>
                        <td className="py-1.5 text-right font-medium text-zinc-900 font-mono">
                          ₱{(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-zinc-200 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold">₱{Number(receiptDetails.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-1 border-t border-zinc-900">
                    <span>Total</span>
                    <span className="font-mono text-lg">₱{Number(receiptDetails.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 pt-1">
                    <span>Payment ({receiptDetails.payment_method || 'CASH'})</span>
                    <span className="font-mono">₱{Number(receiptDetails.amount_received || receiptDetails.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Change</span>
                    <span className="font-mono font-bold text-emerald-700">₱{Number(receiptDetails.change_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 text-center text-[11px] text-zinc-400 font-medium">
                  Thank you for visiting Cof/Tea!
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-red-500 font-medium">Failed to load receipt details.</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SalesReceiptJournal;
