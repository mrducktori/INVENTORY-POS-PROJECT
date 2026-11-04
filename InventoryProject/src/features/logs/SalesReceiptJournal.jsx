import React, { useState, useEffect } from 'react';
import { getSales } from '../../api/salesApi';
import { getSalesReceipt } from '../../api/logsApi';
import { getManilaDateOnly } from '../../utils/dateUtils';

// add_ons entries may be full objects OR JSON strings — handle both
const addonName = (a) => {
  if (!a) return '';
  if (typeof a === 'object') return a.name ?? '';
  try { return JSON.parse(a)?.name ?? a; } catch { return a; }
};

// Ensure add_ons is an array before mapping
const parseAddons = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [raw];
  }
};

const ExpandableReceiptRow = ({ sale }) => {
  const [expanded, setExpanded] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !receiptDetails) {
      setLoading(true);
      try {
        const data = await getSalesReceipt(sale.id);
        setReceiptDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  const totalUnits = (sale.sale_items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const itemsPreview = (sale.sale_items || [])
    .map(item => `${item.quantity}x ${item.products?.name || 'Item'}`)
    .join(', ');

  return (
    <React.Fragment>
      <tr onClick={toggleExpand} className="hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100">
        <td className="px-6 py-4 text-center w-14">
          <svg 
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 mx-auto ${expanded ? 'rotate-90 text-gray-900' : ''}`}
            fill="none" 
            stroke="currentColor" 
            strokeWidth={2.5} 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md tracking-wider font-mono">
              #{sale.receipt_number || sale.id.substring(0, 8).toUpperCase()}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-sm font-medium text-gray-600">
          {new Date(sale.created_at).toLocaleString()}
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">
            {sale.users?.name || 'System'}
          </span>
        </td>
        <td className="px-6 py-4 max-w-xs">
          <div className="text-xs font-bold text-gray-900 truncate" title={itemsPreview}>
            {itemsPreview || `${sale.sale_items?.length || 0} items`}
          </div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {totalUnits || sale.sale_items?.length || 0} unit{(totalUnits || sale.sale_items?.length || 0) === 1 ? '' : 's'}
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
            {sale.payment_method || 'CASH'}
          </span>
        </td>
        <td className="px-6 py-4 text-right text-sm md:text-base font-black text-gray-900">
          ₱{parseFloat(sale.total_amount).toFixed(2)}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="7" className="p-0 border-b border-gray-200 bg-gray-50/80 shadow-inner">
            <div className="p-6 md:p-8 animate-[popIn_0.2s_ease-out]">
              {loading ? (
                <div className="p-8 text-center text-gray-500 font-medium">
                  <div>Retrieving digital record...</div>
                </div>
              ) : receiptDetails ? (
                <div className="max-w-md mx-auto bg-white border border-gray-200 shadow-md rounded-2xl overflow-hidden text-sm md:text-base text-gray-800">
                  <div className="p-6 md:p-8">
                    {/* --- HEADER ZONE --- */}
                    <div className="text-center mb-5">
                      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 m-0">COF/TEA CAFE</h1>
                      <div className="text-gray-500 text-sm font-semibold mt-1">
                        <p className="m-0">Store #001 • Main Branch</p>
                      </div>
                    </div>

                    {/* --- BODY ZONE --- */}
                    <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-3.5 mb-5 text-sm md:text-base text-gray-800 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{new Date(receiptDetails.created_at).toLocaleDateString()} {new Date(receiptDetails.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span className="font-bold">Staff: {sale.users?.name || "System"}</span>
                      </div>
                      <div className="flex justify-between font-mono font-bold text-gray-900">
                        <span>Receipt #: {receiptDetails.receipt_number || "N/A"}</span>
                      </div>
                    </div>
                    
                    <table className="w-full text-left border-collapse mb-5">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="py-2.5 font-bold text-gray-900 text-xs md:text-sm uppercase tracking-wider">Item</th>
                          <th className="py-2.5 font-bold text-gray-900 text-center text-xs md:text-sm uppercase tracking-wider">Qty</th>
                          <th className="py-2.5 font-bold text-gray-900 text-right text-xs md:text-sm uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm md:text-base divide-y divide-gray-100">
                        {receiptDetails.sale_items?.map(item => (
                          <React.Fragment key={item.id}>
                            <tr className="align-top">
                              <td className="py-2.5">
                                <div className="font-extrabold text-gray-900 text-sm md:text-base">{item.products?.name}</div>
                                <div className="text-xs md:text-sm text-gray-600 mt-0.5">
                                  {item.cup_size && <span className="font-bold text-gray-800">Size: {item.cup_size} </span>}
                                  <span className="italic">(@ ₱{parseFloat(item.unit_price).toFixed(2)})</span>
                                </div>
                                {parseAddons(item.add_ons).length > 0 && (
                                  <div className="text-xs md:text-sm text-indigo-700 font-bold mt-1">
                                    + {parseAddons(item.add_ons).map(addon => {
                                      const name = addonName(addon);
                                      const qty = typeof addon === 'object' && addon.customer_qty ? addon.customer_qty : 1;
                                      return `${qty}x ${name}`;
                                    }).join(', ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-center font-bold text-gray-900">{item.quantity}</td>
                              <td className="py-2.5 text-right font-black text-gray-900">₱{(item.quantity * item.unit_price).toFixed(2)}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>

                    {/* --- MONEY BLOCK ZONE --- */}
                    <div className="border-t-2 border-gray-300 pt-3.5 mb-5">
                      <div className="flex flex-col items-end space-y-1.5 text-sm md:text-base">
                        <div className="w-full flex justify-between text-gray-700 font-medium">
                          <span>Subtotal:</span>
                          <span className="font-semibold">₱{(receiptDetails.total_amount - (receiptDetails.tax_amount || 0) + (receiptDetails.discount_amount || 0)).toFixed(2)}</span>
                        </div>
                        
                        {receiptDetails.discount_amount > 0 && (
                          <div className="w-full flex justify-between text-emerald-700 font-bold">
                            <span>Discount:</span>
                            <span>-₱{parseFloat(receiptDetails.discount_amount).toFixed(2)}</span>
                          </div>
                        )}
                        
                        {receiptDetails.tax_amount > 0 && (
                          <div className="w-full flex justify-between text-gray-700 font-medium">
                            <span>Tax (VAT):</span>
                            <span>₱{parseFloat(receiptDetails.tax_amount).toFixed(2)}</span>
                          </div>
                        )}
                        
                        <div className="w-full flex justify-between items-end mt-2 pt-2 border-t-2 border-gray-900">
                          <span className="text-lg md:text-xl font-black text-gray-900">TOTAL</span>
                          <span className="text-xl md:text-2xl font-black text-gray-900">₱{parseFloat(receiptDetails.total_amount).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3.5 border-t-2 border-dashed border-gray-300 text-sm text-gray-700 space-y-1.5">
                        <div className="flex justify-between font-bold">
                          <span>TENDER ({receiptDetails.payment_method || 'CASH'})</span>
                          <span className="font-black">₱{parseFloat(receiptDetails.amount_received || receiptDetails.total_amount).toFixed(2)}</span>
                        </div>
                        {receiptDetails.transaction_reference && (
                          <div className="flex justify-between text-gray-600">
                            <span className="font-semibold">CARD/REF #</span>
                            <span className="font-mono font-bold text-gray-900">{receiptDetails.transaction_reference}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-emerald-800">
                          <span>CHANGE</span>
                          <span className="font-black text-base">₱{parseFloat(receiptDetails.change_amount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* --- FOOTER ZONE --- */}
                    <div className="border-t border-gray-900 mt-6 pt-4 text-center text-xs md:text-sm text-gray-500 space-y-2">
                      <div className="font-mono text-xs tracking-wider text-gray-500 font-semibold">
                        TXN: {receiptDetails.id?.substring(0, 8).toUpperCase()}-{receiptDetails.receipt_number}
                      </div>
                      
                      <div className="font-semibold text-gray-700">
                        <p>Follow us on our socials!</p>
                        <p className="mt-0.5">@cofteacafe</p>
                      </div>
                      
                      <div className="text-[11px] text-gray-600 font-medium leading-tight mt-4">
                        <p>Thank you for your business!</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-red-600 font-medium">Data retrieval failed</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

const SalesReceiptJournal = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    payment_method: 'ALL'
  });
  const [datePreset, setDatePreset] = useState('ALL');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search input by 250ms so typing is smooth
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const result = await getSales(
          {
            start_date: filters.start_date,
            end_date: filters.end_date,
            payment_method: filters.payment_method,
            search: debouncedSearch
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
  }, [filters.start_date, filters.end_date, filters.payment_method, debouncedSearch, pageSize, currentPage]);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    setCurrentPage(1);
    const todayStr = getManilaDateOnly();
    if (preset === 'ALL') {
      setFilters(prev => ({ ...prev, start_date: '', end_date: '' }));
    } else if (preset === 'TODAY') {
      setFilters(prev => ({ ...prev, start_date: todayStr, end_date: todayStr }));
    } else if (preset === '7D') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const startStr = d.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, start_date: startStr, end_date: todayStr }));
    } else if (preset === 'MONTH') {
      const startStr = todayStr.substring(0, 8) + '01';
      setFilters(prev => ({ ...prev, start_date: startStr, end_date: todayStr }));
    }
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setDatePreset('ALL');
    setFilters({ start_date: '', end_date: '', payment_method: 'ALL' });
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
    filters.start_date ||
    filters.end_date ||
    filters.payment_method !== 'ALL'
  );

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Receipt Journal</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">
            Search receipts by number, product, cashier, or payment reference. Click any row to view its full receipt.
          </p>
        </div>
      </div>

      {/* --- Search & Filter Toolbar --- */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
          {/* Multi-field Search Input */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Search Receipts
            </label>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search Receipt # (e.g. 0042), Product (e.g. Matcha), Cashier, or Ref #..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Payment Method Filter */}
          <div className="w-full sm:w-44">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <select
              value={filters.payment_method}
              onChange={e => {
                setFilters(prev => ({ ...prev, payment_method: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          {/* Custom Date Range */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={e => {
                  setDatePreset('CUSTOM');
                  setFilters(prev => ({ ...prev, start_date: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={e => {
                  setDatePreset('CUSTOM');
                  setFilters(prev => ({ ...prev, end_date: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Presets & Reset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Quick Period:</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: '7D', label: 'Last 7 Days' },
              { id: 'MONTH', label: 'This Month' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* --- Receipts Table --- */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 w-14"></th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Ref</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Operator</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Order Summary</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500 font-medium bg-gray-50/50">
                    <div>Consulting Ledger...</div>
                  </td>
                </tr>
              ) : sales.length > 0 ? (
                sales.map(sale => <ExpandableReceiptRow key={sale.id} sale={sale} />)
              ) : (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-gray-400 bg-gray-50/50">
                    <svg className="w-12 h-12 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <div className="text-sm md:text-base font-medium">No matching transactions found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!loading && totalCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 font-medium">
                  Showing <span className="font-bold text-gray-900">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-bold text-gray-900">{totalCount}</span> receipts
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Per page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                  >
                    {[20, 50, 100, 200].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >First</button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >Previous</button>
                <span className="px-3 py-1.5 text-sm font-bold text-gray-900">{currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), p + 1))}
                  disabled={currentPage >= Math.max(1, Math.ceil(totalCount / pageSize))}
                  className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >Next</button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, Math.ceil(totalCount / pageSize)))}
                  disabled={currentPage >= Math.max(1, Math.ceil(totalCount / pageSize))}
                  className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >Last</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesReceiptJournal;
