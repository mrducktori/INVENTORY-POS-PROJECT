import React, { useState, useEffect } from 'react';
import { getSales } from '../../api/salesApi';
import { getSalesReceipt } from '../../api/logsApi';

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

  return (
    <React.Fragment>
      <tr onClick={toggleExpand} className="hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100">
        <td className="px-6 py-4 text-center w-16">
          <span className={`inline-block transition-transform duration-200 text-gray-400 ${expanded ? 'rotate-90 text-gray-900' : ''}`}>▶</span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md tracking-wider">
            #{sale.receipt_number || sale.id.substring(0, 8).toUpperCase()}
          </span>
        </td>
        <td className="px-6 py-4 text-sm font-medium text-gray-600">{new Date(sale.created_at).toLocaleString()}</td>
        <td className="px-6 py-4">
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {sale.users?.name || 'System'}
          </span>
        </td>
        <td className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">
          {sale.sale_items?.length || 0} units
        </td>
        <td className="px-6 py-4 text-right text-sm font-black italic text-gray-900">
          ₱{parseFloat(sale.total_amount).toFixed(2)}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="6" className="p-0 border-b border-gray-200 bg-gray-50/80 shadow-inner">
            <div className="p-6 md:p-8 animate-[popIn_0.2s_ease-out]">
              {loading ? (
                <div className="p-8 text-center text-gray-500 font-medium">
                  <div>Retrieving digital record...</div>
                </div>
              ) : receiptDetails ? (
                <div className="max-w-md mx-auto bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden font-mono text-sm">
                  <div className="text-center p-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="m-0 text-lg font-black text-gray-900 tracking-tight">COF/TEA System</h3>
                    <p className="m-0 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Digital Audit Copy</p>
                    <div className="mt-4">
                       <p className="m-0 font-black text-gray-900 text-[11px] tracking-wider">
                         #{receiptDetails.receipt_number || sale.id.substring(0,8).toUpperCase()}
                       </p>
                       <p className="m-0 text-[9px] font-bold text-gray-400 mt-1">
                         {new Date(receiptDetails.created_at).toLocaleString()}
                       </p>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex flex-col gap-3">
                      {receiptDetails.sale_items?.map(item => (
                        <div key={item.id} className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{item.quantity}x {item.products?.name}</span>
                            {(item.cup_size || item.add_ons?.length > 0) && (
                            <span className="text-[11px] text-gray-500 font-medium mt-0.5">
                              {item.cup_size && <span>[{item.cup_size}] </span>}
                              {parseAddons(item.add_ons).length > 0 && (
                                <span>+{parseAddons(item.add_ons).map(addonName).join(', ')}</span>
                              )}
                            </span>
                            )}
                          </div>
                          <span className="font-bold text-gray-900">₱{(item.quantity * item.unit_price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t-2 border-dashed border-gray-200 my-4" />
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-gray-600 font-medium">
                        <span>Base Amount</span>
                        <span>₱{(receiptDetails.total_amount - (receiptDetails.tax_amount || 0) + (receiptDetails.discount_amount || 0)).toFixed(2)}</span>
                      </div>
                      {(receiptDetails.discount_amount > 0) && (
                        <div className="flex justify-between text-red-600 font-bold">
                          <span>Markdowns</span>
                          <span>-₱{parseFloat(receiptDetails.discount_amount).toFixed(2)}</span>
                        </div>
                      )}
                      {(receiptDetails.tax_amount > 0) && (
                        <div className="flex justify-between text-gray-600 font-medium">
                          <span>Service Tax</span>
                          <span>₱{parseFloat(receiptDetails.tax_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black text-gray-900 mt-2 pt-2 border-t border-gray-100">
                        <span>Final Total</span>
                        <span>₱{parseFloat(receiptDetails.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] italic text-gray-400 font-medium mt-4">
                        <span>Method</span>
                        <span className="uppercase">{receiptDetails.payment_method}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-900 text-white text-center py-2 text-[10px] font-bold uppercase tracking-widest">
                    EndOfTransmission
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
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: ''
  });
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchSales();
  }, [filters.start_date, filters.end_date, pageSize, currentPage]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const result = await getSales(filters, pageSize, currentPage);
      setSales(result.data || []);
      setTotalCount(result.total || 0);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Receipt Journal</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Click any transaction row to expand and view its full receipt.</p>
        </div>
        <div className="flex gap-4 items-end">
  <div>
    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Date Range</label>
    <div className="flex gap-2">
      <input
        type="date"
        name="start_date"
        value={filters.start_date}
        onChange={e => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
      />
      <input
        type="date"
        name="end_date"
        value={filters.end_date}
        onChange={e => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
      />
    </div>
  </div>
</div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 w-16"></th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Ref</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Operator</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500 font-medium bg-gray-50/50">
                    <div>Consulting Ledger...</div>
                  </td>
                </tr>
              ) : sales.length > 0 ? (
                sales.map(sale => <ExpandableReceiptRow key={sale.id} sale={sale} />)
              ) : (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400 bg-gray-50/50">
                    <svg className="w-12 h-12 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <div className="text-sm font-medium">No transactions recorded</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
{!loading && totalCount > 0 && (
  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600 font-medium">
        Showing <span className="font-bold text-gray-900">{(currentPage-1)*pageSize + 1}–{Math.min(currentPage*pageSize, totalCount)}</span> of <span className="font-bold text-gray-900">{totalCount}</span> receipts
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Per page</span>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer"
        >
          {[50,100,200].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => setCurrentPage(1)}
        disabled={currentPage <= 1}
        className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >First</button>
      <button
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage <= 1}
        className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >Previous</button>
      <span className="px-3 py-1.5 text-sm font-bold text-gray-900">{currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
      <button
        onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), p + 1))}
        disabled={currentPage >= Math.max(1, Math.ceil(totalCount / pageSize))}
        className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >Next</button>
      <button
        onClick={() => setCurrentPage(Math.max(1, Math.ceil(totalCount / pageSize)))}
        disabled={currentPage >= Math.max(1, Math.ceil(totalCount / pageSize))}
        className="px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
