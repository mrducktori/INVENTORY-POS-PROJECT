import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getSalesReportByPeriod } from '../../api/logsApi';
import { getSales } from '../../api/salesApi';
import { downloadCSV } from '../reports/utils/reportUtils';
import { getManilaDateOnly } from '../../utils/dateUtils';
import Pagination from '../../components/shared/Pagination';

const SalesSummaryReport = () => {
  const currentManilaYear = Number(getManilaDateOnly().slice(0, 4)) || new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, idx) => currentManilaYear - idx),
    [currentManilaYear]
  );

  const [period, setPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly', 'yearly', 'custom'
  const [selectedYear, setSelectedYear] = useState(currentManilaYear);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSales, setStaffSales] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditItemsPerPage, setAuditItemsPerPage] = useState(10);
  const inlineAuditRef = useRef(null);

  useEffect(() => {
    setAuditPage(1);
  }, [auditSearch, selectedStaff]);

  const fetchSummary = useCallback(async () => {
    if (period === 'custom' && (!customStart || !customEnd)) return;
    try {
      setLoading(true);
      const data = await getSalesReportByPeriod(
        customStart,
        customEnd,
        period,
        period === 'yearly' ? selectedYear : null
      );
      setSummary(data);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedYear, customStart, customEnd]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const fetchStaffDetails = async (staff) => {
    if (selectedStaff && String(selectedStaff.id) === String(staff.id)) {
      setSelectedStaff(null);
      return;
    }
    setSelectedStaff(staff);
    setAuditSearch('');
    setDetailsLoading(true);
    try {
      const filters = {
        staff_id: staff.id,
        period,
        ...(period === 'yearly' ? { year: selectedYear } : {}),
        ...(period === 'custom' && customStart && customEnd
          ? { start_date: customStart, end_date: customEnd }
          : {})
      };
      const res = await getSales(filters, 200, 1);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setStaffSales(list);
      requestAnimationFrame(() => {
        inlineAuditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err) {
      console.error('Failed to load staff details:', err);
      setStaffSales([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleExport = () => {
    if (!summary || !summary.staff_data) return;

    const breakdownRows = Array.isArray(summary.period_breakdown) && summary.period_breakdown.length > 0
      ? [
          [],
          ['PERIOD BREAKDOWN'],
          ['Period', 'Net Revenue (PHP)', 'Transactions', 'Items Sold'],
          ...summary.period_breakdown.map((b) => [
            b.label,
            Number(b.revenue || 0).toFixed(2),
            b.transactions || 0,
            b.items_sold || 0
          ])
        ]
      : [];

    const exportRows = [
      ['COF/TEA CAFE — SALES SUMMARY REPORT'],
      ['Store Name', 'Cof/Tea Cafe'],
      ['Period', period === 'yearly' ? `YEARLY (${selectedYear})` : period.toUpperCase()],
      ['Date Generated', new Date().toLocaleString('en-PH')],
      ['Net Revenue (PHP)', Number(summary.total_sales || 0).toFixed(2)],
      ['Total Discounts (PHP)', Number(summary.total_discounts || 0).toFixed(2)],
      ['Voided Transactions', summary.voided_count || 0],
      ['Voided Amount (PHP)', Number(summary.voided_amount || 0).toFixed(2)],
      ['Total Transactions', summary.total_transactions || 0],
      ['Total Items Sold', summary.total_items_sold || 0],
      ...breakdownRows,
      [],
      ['STAFF PERFORMANCE BREAKDOWN'],
      ['Staff Name', 'Total Sales (PHP)', 'Transactions', 'Average Ticket (PHP)'],
      ...summary.staff_data.map(p => {
        const avg = p.transactions > 0 ? p.total_sales / p.transactions : 0;
        return [
          p.name,
          Number(p.total_sales || 0).toFixed(2),
          p.transactions || 0,
          avg.toFixed(2)
        ];
      })
    ];

    downloadCSV(exportRows, `CofTea_Sales_Summary_${period}_${new Date().toISOString().split('T')[0]}.csv`);
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

  const auditTotalPages = Math.max(1, Math.ceil(filteredStaffSales.length / auditItemsPerPage));
  const paginatedStaffSales = useMemo(() => {
    const start = (auditPage - 1) * auditItemsPerPage;
    return filteredStaffSales.slice(start, start + auditItemsPerPage);
  }, [filteredStaffSales, auditPage, auditItemsPerPage]);

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Sales Summary Report</h1>
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

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8 flex flex-wrap items-center gap-4">
        <label className="text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider">Analysis Period</label>
        <select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setSelectedStaff(null);
          }}
          className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base font-bold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
        >
          <option value="daily">Daily / Today</option>
          <option value="weekly">Weekly (Last 7 Days)</option>
          <option value="monthly">Monthly (This Month)</option>
          <option value="yearly">Yearly (Annual)</option>
          <option value="custom">Custom Date Range</option>
        </select>

        {period === 'yearly' && (
          <select
            aria-label="Report Year"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setSelectedStaff(null);
            }}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 shadow-sm cursor-pointer"
          >
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        )}

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setSelectedStaff(null);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <span className="text-gray-400 font-bold">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setSelectedStaff(null);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 font-medium bg-white rounded-xl shadow-sm border border-gray-200">
          <div>Compiling Report Data...</div>
        </div>
      ) : summary ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white border-l-4 border-blue-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-5">
              <p className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Net Revenue</p>
              <p className="m-0 text-2xl font-bold text-gray-900 tracking-tight font-mono">₱{(summary.total_sales || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border-l-4 border-green-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-5">
              <p className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Volume</p>
              <p className="m-0 text-2xl font-bold text-gray-900 tracking-tight font-mono">{summary.total_transactions || 0}</p>
            </div>
            <div className="bg-white border-l-4 border-amber-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-5">
              <p className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Items Dispatched</p>
              <p className="m-0 text-2xl font-bold text-gray-900 tracking-tight font-mono">{summary.total_items_sold || 0}</p>
            </div>
            <div className="bg-white border-l-4 border-purple-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-5">
              <p className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Average Ticket</p>
              <p className="m-0 text-2xl font-bold text-gray-900 tracking-tight font-mono">
                ₱{summary.total_transactions > 0
                  ? ((summary.total_sales || 0) / summary.total_transactions).toFixed(2)
                  : '0.00'}
              </p>
            </div>
            <div className="bg-white border-l-4 border-emerald-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-5">
              <p className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Total Discounts</p>
              <p className="m-0 text-2xl font-bold text-emerald-700 tracking-tight font-mono">₱{Number(summary.total_discounts || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border-l-4 border-red-500 border-y border-r border-gray-200 rounded-xl shadow-sm p-5">
              <p className="m-0 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Voided Txns</p>
              <p className="m-0 text-xl font-black text-red-700 tracking-tight font-mono">
                {summary.voided_count || 0}{' '}
                <span className="text-xs font-bold text-red-500">(₱{Number(summary.voided_amount || 0).toFixed(2)})</span>
              </p>
            </div>
          </div>

          {Array.isArray(summary.period_breakdown) && summary.period_breakdown.length > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <h2 className="m-0 text-base md:text-lg font-black text-gray-900">
                  {period === 'yearly' ? `Monthly Breakdown (${selectedYear})` : 'Period Breakdown'}
                </h2>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {summary.period_breakdown.length} intervals
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-gray-500 uppercase text-xs font-bold tracking-wider">
                      <th className="px-6 py-3">Period</th>
                      <th className="px-6 py-3 text-center">Transactions</th>
                      <th className="px-6 py-3 text-center">Items Sold</th>
                      <th className="px-6 py-3 text-right">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.period_breakdown.map((bucket) => (
                      <tr key={bucket.date_key || bucket.label} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-bold text-gray-900">{bucket.label}</td>
                        <td className="px-6 py-3 text-center font-mono text-gray-700">{bucket.transactions || 0}</td>
                        <td className="px-6 py-3 text-center font-mono text-gray-700">{bucket.items_sold || 0}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-gray-900">
                          ₱{Number(bucket.revenue || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                        .map(staff => {
                          const isSelected = selectedStaff && String(selectedStaff.id) === String(staff.id);
                          return (
                            <tr
                              key={staff.id}
                              onClick={() => fetchStaffDetails(staff)}
                              className={`transition-colors cursor-pointer ${
                                isSelected ? 'bg-gray-900/5' : 'hover:bg-gray-50'
                              }`}
                            >
                            <td className="px-6 py-5"><span className="inline-flex px-3 py-1 rounded-full text-sm md:text-base font-bold bg-gray-100 text-gray-800 border border-gray-200">{staff.name}</span></td>
                            <td className="px-6 py-5"><span className="text-sm md:text-base font-black text-green-700 bg-green-50 px-2 py-1 rounded">₱{staff.total_sales.toFixed(2)}</span></td>
                            <td className="px-6 py-5 text-center font-black text-gray-900">{staff.transactions}</td>
                            <td className="px-6 py-5 text-center text-sm md:text-base font-mono text-gray-500 font-bold">₱{(staff.transactions > 0 ? staff.total_sales / staff.transactions : 0).toFixed(2)}</td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3 w-full max-w-[200px]">
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gray-500 rounded-full" 
                                    style={{ width: `${summary.total_sales > 0 ? (staff.total_sales / summary.total_sales) * 100 : 0}%` }} 
                                  />
                                </div>
                                <span className="text-sm md:text-base font-bold text-gray-500 whitespace-nowrap min-w-[40px] text-right">
                                  {(summary.total_sales > 0 ? (staff.total_sales / summary.total_sales) * 100 : 0).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
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

      {/* Inline Non-Blocking Staff Sales Audit Section */}
      {selectedStaff && (
        <div
          ref={inlineAuditRef}
          className="mt-8 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
            <div>
              <h2 className="m-0 text-lg font-black text-gray-900">Inline Sales Audit: {selectedStaff.name}</h2>
              <p className="m-0 text-xs text-gray-500 mt-0.5">
                Showing recorded transactions for {selectedStaff.name} in the selected period.
              </p>
            </div>
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
                    aria-label="Clear"
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                onClick={() => setSelectedStaff(null)}
              >
                Collapse Audit
              </button>
            </div>
          </div>

          <div className="p-0">
            {detailsLoading ? (
              <div className="p-12 text-center text-gray-500 font-medium">
                <div>Loading audit history...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-white border-b border-gray-200">
                      <th className="px-6 py-3 text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider">Reference</th>
                      <th className="px-6 py-3 text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider text-center">Time</th>
                      <th className="px-6 py-3 text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider">Manifest</th>
                      <th className="px-6 py-3 text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
                      <th className="px-6 py-3 text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider text-center">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedStaffSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-gray-500 text-xs">
                          #{sale.receipt_number || sale.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 text-center text-xs font-bold text-gray-500">
                          {new Date(sale.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 min-w-[200px]">
                          <div className="flex flex-col gap-1.5">
                            {sale.sale_items?.map((it, idx) => (
                              <div key={idx} className={`flex items-center gap-2.5 py-1 ${idx < (sale.sale_items.length - 1) ? 'border-b border-gray-100' : ''}`}>
                                <span className="text-[11px] font-black text-gray-900 bg-gray-200 px-1.5 py-0.5 rounded min-w-[24px] text-center">
                                  {it.quantity}
                                </span>
                                <span className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wider">
                                  {it.products?.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-gray-900 font-mono">₱{parseFloat(sale.total_amount).toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                            {sale.payment_method}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredStaffSales.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-12 text-center text-gray-400 bg-gray-50/50">
                          <div className="text-sm font-medium">No records found</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {filteredStaffSales.length > 0 && (
                  <Pagination
                    currentPage={auditPage}
                    totalPages={auditTotalPages}
                    totalItems={filteredStaffSales.length}
                    itemsPerPage={auditItemsPerPage}
                    onPageChange={setAuditPage}
                    onItemsPerPageChange={(val) => {
                      setAuditItemsPerPage(val);
                      setAuditPage(1);
                    }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesSummaryReport;
