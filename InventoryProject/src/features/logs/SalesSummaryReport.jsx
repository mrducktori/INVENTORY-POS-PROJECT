import React, { useState, useEffect } from 'react';
import { getSalesReportByPeriod } from '../../api/logsApi';

const SalesSummaryReport = () => {
  const [period, setPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSales, setStaffSales] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [period]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await getSalesReportByPeriod(null, null, period);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffDetails = async (staff) => {
    setSelectedStaff(staff);
    setAuditSearch('');
    setDetailsLoading(true);
    try {
      const { getSales } = await import('../../api/salesApi');
      const res = await getSales({ staff_id: staff.id, period }, 200, 1);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setStaffSales(list);
    } catch (err) {
      console.error('Failed to load staff details:', err);
      setStaffSales([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleExport = () => {
    if (!summary || !summary.staff_data) return;

    let csv = `Sales Summary Report (${period.toUpperCase()})\n`;
    csv += `Total Sales,₱${(summary.total_sales || 0).toFixed(2)}\n`;
    csv += `Total Transactions,${summary.total_transactions || 0}\n`;
    csv += `Total Items Sold,${summary.total_items_sold || 0}\n\n`;
    csv += `Staff Breakdown\n`;
    csv += `Staff Name,Sales,Transactions,Avg Sale\n`;

    summary.staff_data.forEach(p => {
      csv += `"${p.name}",₱${p.total_sales.toFixed(2)},${p.transactions},₱${(p.total_sales / p.transactions).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Sales_Summary_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredStaffSales = staffSales.filter(sale => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.trim().toLowerCase();
    const ref = String(sale.receipt_number || sale.id || '').toLowerCase();
    const method = String(sale.payment_method || '').toLowerCase();
    const total = String(sale.total_amount || '');
    const itemsMatch = (sale.sale_items || []).some(it =>
      String(it.products?.name || '').toLowerCase().includes(q)
    );
    return ref.includes(q) || method.includes(q) || total.includes(q) || itemsMatch;
  });

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Sales Summary Report</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Analyze revenue and performance. Click on a staff member to view detailed logs.</p>
        </div>
        <button 
          className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          onClick={handleExport} 
          disabled={loading || !summary}
        >
          Export Analytics (CSV)
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8 flex flex-col md:flex-row items-center gap-4">
        <label className="text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider">Analysis Period</label>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base font-bold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
        >
          <option value="daily">Daily / Today</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 font-medium bg-white rounded-xl shadow-sm border border-gray-200">
          <div>Compiling Report Data...</div>
        </div>
      ) : summary ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-l-4 border-blue-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-6">
              <p className="m-0 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Gross Revenue</p>
              <p className="m-0 text-3xl font-black text-gray-900 tracking-tight">₱{(summary.total_sales || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border-l-4 border-green-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-6">
              <p className="m-0 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Volume</p>
              <p className="m-0 text-3xl font-black text-gray-900 tracking-tight">{summary.total_transactions || 0}</p>
            </div>
            <div className="bg-white border-l-4 border-amber-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-6">
              <p className="m-0 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Items Dispatched</p>
              <p className="m-0 text-3xl font-black text-gray-900 tracking-tight">{summary.total_items_sold || 0}</p>
            </div>
            <div className="bg-white border-l-4 border-purple-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-6">
              <p className="m-0 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Average Ticket</p>
              <p className="m-0 text-3xl font-black text-gray-900 tracking-tight">
                ₱{summary.total_transactions > 0 
                  ? ((summary.total_sales || 0) / summary.total_transactions).toFixed(2) 
                  : '0.00'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-black text-gray-900">Personnel Performance Breakdown</h2>
              <div className="relative w-full sm:w-64">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search operator..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {staffSearch && (
                  <button
                    type="button"
                    onClick={() => setStaffSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                   aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                )}
              </div>
            </div>
            <div>
              {summary.staff_data && summary.staff_data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-white border-b border-gray-200">
                        <th className="px-6 py-4 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Operator</th>
                        <th className="px-6 py-4 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Total Sales</th>
                        <th className="px-6 py-4 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Transactions</th>
                        <th className="px-6 py-4 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Avg Trans</th>
                        <th className="px-6 py-4 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider w-1/4">Market Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.staff_data
                        .filter(staff => !staffSearch.trim() || (staff.name || '').toLowerCase().includes(staffSearch.trim().toLowerCase()))
                        .map(staff => (
                          <tr 
                            key={staff.id} 
                            onClick={() => fetchStaffDetails(staff)}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-5"><span className="inline-flex px-3 py-1 rounded-full text-sm md:text-base font-bold bg-gray-100 text-gray-800 border border-gray-200">{staff.name}</span></td>
                            <td className="px-6 py-5"><span className="text-sm md:text-base font-black text-green-700 bg-green-50 px-2 py-1 rounded">₱{staff.total_sales.toFixed(2)}</span></td>
                            <td className="px-6 py-5 text-center font-black text-gray-900">{staff.transactions}</td>
                            <td className="px-6 py-5 text-center text-sm md:text-base font-mono text-gray-500 font-bold">₱{(staff.total_sales / staff.transactions).toFixed(2)}</td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3 w-full max-w-[200px]">
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gray-500 rounded-full" 
                                    style={{ width: `${(staff.total_sales / summary.total_sales) * 100}%` }} 
                                  />
                                </div>
                                <span className="text-sm md:text-base font-bold text-gray-500 whitespace-nowrap min-w-[40px] text-right">
                                  {((staff.total_sales / summary.total_sales) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 bg-gray-50/50">
                  <div className="text-sm md:text-base font-medium">No personnel activity recorded</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-red-500 font-medium bg-red-50 rounded-xl shadow-sm border border-red-100">
          <div>Data compilation failed</div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 p-4 bg-gray-900/60 backdrop-blur-sm animate-[modalBackdropFadeIn_0.2s_ease-out]" onClick={() => setSelectedStaff(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
              <h2 className="m-0 text-xl font-black text-gray-900">Sales Audit: {selectedStaff.name}</h2>
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search receipt #, item, method..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full pl-9 pr-7 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {auditSearch && (
                    <button
                      type="button"
                      onClick={() => setAuditSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
                     aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  )}
                </div>
                <button className="text-gray-400 hover:text-gray-900 bg-transparent border-none text-xl cursor-pointer p-2 transition-colors" onClick={() => setSelectedStaff(null)} aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-0">
              {detailsLoading ? (
                <div className="p-12 text-center text-gray-500 font-medium">
                  <div>Loading audit history...</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-white border-b border-gray-200">
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Reference</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Time</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Manifest</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStaffSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-gray-400 text-[11px]">
                            #{sale.receipt_number || sale.id.substring(0,8).toUpperCase()}
                          </td>
                          <td className="px-6 py-4 text-center text-[11px] font-bold text-gray-500">
                            {new Date(sale.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-4 min-w-[200px]">
                            <div className="flex flex-col gap-1.5">
                              {sale.sale_items?.map((it, idx) => (
                                <div key={idx} className={`flex items-center gap-2.5 py-1 ${idx < (sale.sale_items.length - 1) ? 'border-b border-gray-100' : ''}`}>
                                  <span className="text-[11px] font-black text-gray-900 bg-gray-200 px-1.5 py-0.5 rounded min-w-[24px] text-center">
                                    {it.quantity}
                                  </span>
                                  <span className="text-sm md:text-base font-bold text-gray-800 uppercase tracking-wider">
                                    {it.products?.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm md:text-base font-black text-gray-900">₱{parseFloat(sale.total_amount).toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex px-2 py-1 rounded-md text-xs md:text-sm font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                              {sale.payment_method}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredStaffSales.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-gray-400 bg-gray-50/50">
                            <div className="text-sm md:text-base font-medium">No records found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end">
              <button 
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors cursor-pointer" 
                onClick={() => setSelectedStaff(null)}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesSummaryReport;
