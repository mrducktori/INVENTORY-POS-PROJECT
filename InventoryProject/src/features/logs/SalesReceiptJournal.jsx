import React, { useState, useEffect, useMemo } from 'react';
import { getSales } from '../../api/salesApi';
import { getSalesReceipt } from '../../api/logsApi';
import ColumnVisibilityDropdown from '../../components/shared/ColumnVisibilityDropdown';

// Available columns matching reference (Image 9)
const AVAILABLE_COLUMNS = [
  { id: 'order_no', label: 'Order No.' },
  { id: 'customer', label: 'Customer' },
  { id: 'menu_item', label: 'Menu item' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'status', label: 'Status' },
  { id: 'total_price', label: 'Total Price' },
  { id: 'paid_amount', label: 'Paid Amount' },
  { id: 'type', label: 'Type' },
  { id: 'payment_method', label: 'Payment method' },
  { id: 'created', label: 'Created' },
  { id: 'updated', label: 'Updated' },
];

const DEFAULT_VISIBLE = {
  order_no: true,
  customer: true,
  menu_item: true,
  quantity: true,
  status: true,
  total_price: true,
  paid_amount: true,
  type: true,
  payment_method: true,
  created: true,
  updated: true,
};

// Format date to: YYYY-MM-DD hh:mm:ss A (matching reference: 2026-10-26 10:41:40 PM)
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
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Receipt Modal view for clicked row
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState(null);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Column Visibility state persisted in localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('coftea_sales_table_columns');
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch {
      return DEFAULT_VISIBLE;
    }
  });

  const handleColumnVisibilityChange = (newColumns) => {
    setVisibleColumns(newColumns);
    try {
      localStorage.setItem('coftea_sales_table_columns', JSON.stringify(newColumns));
    } catch (e) {
      console.warn('Failed to save table columns to localStorage', e);
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch sales
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
        setSales(result.data || []);
        setTotalCount(result.total || 0);
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
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
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

  return (
    <div className="p-4 md:p-8 flex-1 bg-white min-h-screen overflow-y-auto w-full">
      {/* Top Header Card matching reference design */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight m-0">
              Latest Sales
            </h1>
          </div>

          {/* Right Toolbar: Search + Column Toggle */}
          <div className="flex items-center gap-3">
            {/* Search Input matching reference screenshot */}
            <div className="relative w-64 md:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                 aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              )}
            </div>

            {/* Column Visibility Dropdown Button */}
            <ColumnVisibilityDropdown
              columns={AVAILABLE_COLUMNS}
              visibleColumns={visibleColumns}
              onChange={handleColumnVisibilityChange}
              defaultVisible={DEFAULT_VISIBLE}
            />
          </div>
        </div>

        {/* Sales Table matching Reference Images 7 & 8 */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-600 font-medium">
                {visibleColumns.order_no !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Order No.
                  </th>
                )}
                {visibleColumns.customer !== false && (
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
                )}
                {visibleColumns.menu_item !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Menu item
                  </th>
                )}
                {visibleColumns.quantity !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Quantity
                  </th>
                )}
                {visibleColumns.status !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Status
                  </th>
                )}
                {visibleColumns.total_price !== false && (
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
                )}
                {visibleColumns.paid_amount !== false && (
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
                )}
                {visibleColumns.type !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Type
                  </th>
                )}
                {visibleColumns.payment_method !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Payment method
                  </th>
                )}
                {visibleColumns.created !== false && (
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
                )}
                {visibleColumns.updated !== false && (
                  <th className="py-3 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                    Updated
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                // Skeleton loading rows
                [...Array(6)].map((_, i) => (
                  <tr key={`skel-${i}`}>
                    {visibleColumns.order_no !== false && <td className="py-4 px-3"><div className="h-4 w-32 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.customer !== false && <td className="py-4 px-3"><div className="h-4 w-20 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.menu_item !== false && <td className="py-4 px-3"><div className="h-4 w-40 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.quantity !== false && <td className="py-4 px-3"><div className="h-4 w-8 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.status !== false && <td className="py-4 px-3"><div className="h-4 w-16 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.total_price !== false && <td className="py-4 px-3"><div className="h-4 w-20 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.paid_amount !== false && <td className="py-4 px-3"><div className="h-4 w-20 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.type !== false && <td className="py-4 px-3"><div className="h-4 w-16 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.payment_method !== false && <td className="py-4 px-3"><div className="h-5 w-14 bg-zinc-200/70 rounded-full animate-pulse" /></td>}
                    {visibleColumns.created !== false && <td className="py-4 px-3"><div className="h-4 w-36 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                    {visibleColumns.updated !== false && <td className="py-4 px-3"><div className="h-4 w-36 bg-zinc-200/70 rounded-md animate-pulse" /></td>}
                  </tr>
                ))
              ) : sortedSales.length > 0 ? (
                sortedSales.map((sale) => {
                  const items = sale.sale_items || [];
                  const orderNo = sale.receipt_number
                    ? `ORD-${String(sale.receipt_number).padStart(13, '0')}`
                    : `ORD-${(sale.id || '').substring(0, 13).toUpperCase()}`;
                  const customerName = sale.users?.name || 'customer';
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
                      {/* Order No. (Sticky pinned anchor) */}
                      {visibleColumns.order_no !== false && (
                        <td className="sticky left-0 bg-white group-hover:bg-zinc-50 z-10 py-3.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap shadow-[1px_0_0_0_#f4f4f5]">
                          {orderNo}
                        </td>
                      )}

                      {/* Customer */}
                      {visibleColumns.customer !== false && (
                        <td className="py-3.5 px-3 text-zinc-700 whitespace-nowrap">
                          <span className={displayCustomer === 'Walk-in Guest' ? 'text-zinc-400 italic' : 'font-medium text-zinc-800'}>
                            {displayCustomer}
                          </span>
                        </td>
                      )}

                      {/* Menu item(s) - paired with quantity pills using native min-w-5 */}
                      {visibleColumns.menu_item !== false && (
                        <td className="py-3.5 px-3 text-zinc-800">
                          {items.length > 0 ? (
                            <div className="space-y-1.5 py-0.5">
                              {items.map((it, idx) => (
                                <div key={it.id || idx} className="flex items-center gap-2">
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
                      )}

                      {/* Total items count */}
                      {visibleColumns.quantity !== false && (
                        <td className="py-3.5 px-3 text-zinc-700 font-semibold whitespace-nowrap">
                          {items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0)} items
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.status !== false && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            completed
                          </span>
                        </td>
                      )}

                      {/* Total Price */}
                      {visibleColumns.total_price !== false && (
                        <td className="py-3.5 px-3 text-zinc-950 font-bold font-mono whitespace-nowrap">
                          {totalFormatted}
                        </td>
                      )}

                      {/* Paid Amount */}
                      {visibleColumns.paid_amount !== false && (
                        <td className="py-3.5 px-3 text-zinc-700 font-mono whitespace-nowrap">
                          {paidFormatted}
                        </td>
                      )}

                      {/* Type (dine_in / takeaway / online) */}
                      {visibleColumns.type !== false && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-700">
                            {orderType}
                          </span>
                        </td>
                      )}

                      {/* Payment method badge */}
                      {visibleColumns.payment_method !== false && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-zinc-200 text-zinc-700 bg-zinc-50">
                            {paymentMethod}
                          </span>
                        </td>
                      )}

                      {/* Created timestamp */}
                      {visibleColumns.created !== false && (
                        <td className="py-3.5 px-3 text-zinc-500 font-mono text-xs whitespace-nowrap">
                          {formatDateTime(sale.created_at)}
                        </td>
                      )}

                      {/* Updated timestamp */}
                      {visibleColumns.updated !== false && (
                        <td className="py-3.5 px-3 text-zinc-500 font-mono text-xs whitespace-nowrap">
                          {formatDateTime(sale.updated_at || sale.created_at)}
                        </td>
                      )}

                      {/* Action: View Receipt button */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(sale);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={AVAILABLE_COLUMNS.length + 1}
                    className="py-12 text-center text-zinc-400 bg-zinc-50/50"
                  >
                    No sales records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!loading && totalCount > 0 && (
          <div className="pt-4 mt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
            <div>
              Showing <span className="font-semibold text-zinc-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-zinc-900">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
              <span className="font-semibold text-zinc-900">{totalCount}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-zinc-800">
                {currentPage} of {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), p + 1))
                }
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Digital Receipt Modal on row click */}
      {activeReceiptSaleId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
          onClick={handleCloseReceipt}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md max-h-[90vh] overflow-y-auto p-6 animate-[modalPopIn_0.2s_cubic-bezier(0.16,1,0.3,1)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <span className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                Transaction Receipt
              </span>
              <button
                type="button"
                onClick={handleCloseReceipt}
                className="text-zinc-400 hover:text-zinc-800 text-lg font-bold cursor-pointer"
               aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {loadingReceipt ? (
              <div className="py-12 text-center text-zinc-400">Loading receipt details...</div>
            ) : receiptDetails ? (
              <div className="text-zinc-800 text-sm space-y-4">
                <div className="text-center">
                  <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight">COF/TEA CAFE</h3>
                  <p className="text-xs text-zinc-500 font-medium">Main Branch • Store #001</p>
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

                <table className="w-full text-xs">
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
                        <td className="py-1.5 font-medium text-zinc-900">{item.products?.name}</td>
                        <td className="py-1.5 text-center text-zinc-700">{item.quantity}</td>
                        <td className="py-1.5 text-right font-medium text-zinc-900">
                          ₱{(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-zinc-200 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>₱{Number(receiptDetails.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-1 border-t border-zinc-900">
                    <span>Total</span>
                    <span>₱{Number(receiptDetails.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 pt-1">
                    <span>Payment ({receiptDetails.payment_method || 'CASH'})</span>
                    <span>₱{Number(receiptDetails.amount_received || receiptDetails.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Change</span>
                    <span>₱{Number(receiptDetails.change_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 text-center text-[11px] text-zinc-400">
                  Thank you for visiting Cof/Tea!
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-red-500">Failed to load receipt details.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReceiptJournal;
