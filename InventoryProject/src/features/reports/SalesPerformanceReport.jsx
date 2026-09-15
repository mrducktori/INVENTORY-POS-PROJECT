import React, { useState, useCallback, useMemo } from 'react';
import {
  getSalesPerformanceReport
} from '../../api/reportsApi';
import { downloadCSV, printReport } from './reportUtils';

// ─── Mini Bar chart (SVG sparkline) ──────────────────────────────────────────
const TrendBars = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="rpt-trend-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '180px', padding: '40px 20px 20px' }}>
      {data.map((d, i) => {
        const height = (d.value / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 60px', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, fontFamily: 'monospace' }}>₱{d.value.toLocaleString()}</span>
            <div
              style={{ 
                width: '30px', 
                height: `${Math.max(4, height)}%`, 
                background: '#000', 
                borderRadius: '2px 2px 0 0',
                transition: 'height 0.5s ease'
              }}
              title={`${d.label}: ₱${d.value.toFixed(2)}`}
            />
            <span style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', maxWidth: '60px', overflow: 'hidden' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SalesPerformanceReport = () => {
  const [period, setPeriod]   = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [sortKey, setSortKey] = useState('total_sales');
  const [sortDir, setSortDir] = useState('desc');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const summaryData = await getSalesPerformanceReport(period, customStart, customEnd);
      setSummary(summaryData);
      setFetched(true);
    } catch (err) {
      console.error('Sales report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  const sortedStaff = useMemo(() => {
    if (!summary?.staff_data) return [];
    return [...summary.staff_data].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [summary, sortKey, sortDir]);

  const sortedProducts = useMemo(() => {
    if (!summary?.product_data) return [];
    return summary.product_data; // already sorted by qty_sold desc from backend
  }, [summary]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  // Build trend data from staff performance (approximate visualization)
  const trendData = sortedStaff.slice(0, 10).map(s => ({
    label: (s.name || '').split(' ')[0],
    value: s.total_sales || 0
  }));

  const totalSales = summary?.total_sales || 0;
  const totalTx    = summary?.total_transactions || 0;
  const avgTicket  = totalTx > 0 ? totalSales / totalTx : 0;
  const totalItems = summary?.total_items_sold || 0;


  const handleExport = () => {
    if (!summary) return;
    const date = new Date().toLocaleDateString('en-PH');
    const time = new Date().toLocaleTimeString('en-PH');
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : `${customStart} to ${customEnd}`;

    const rows = [
      [`SALES REPORT — ${periodLabel.toUpperCase()}`],
      [`Date Generated: ${date} ${time}`],
      [],
      ['SUMMARY'],
      ['Total Revenue (PHP)', `₱${totalSales.toFixed(2)}`],
      ['Total Number of Orders', totalTx],
      ['Average Order Value (PHP)', `₱${avgTicket.toFixed(2)}`],
      ['Total Items Sold', totalItems],
      [],
      ['STAFF PERFORMANCE'],
      ['Staff Name', 'Total Sales (PHP)', 'Number of Orders', 'Average per Order (PHP)', 'Share of Total Sales'],
      ...sortedStaff.map(s => [
        s.name,
        `₱${(s.total_sales || 0).toFixed(2)}`,
        s.transactions,
        `₱${((s.total_sales || 0) / (s.transactions || 1)).toFixed(2)}`,
        `${((s.total_sales / (totalSales || 1)) * 100).toFixed(1)}%`
      ]),
    ];
    downloadCSV(rows, `Sales_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : `${customStart} to ${customEnd}`;
    const staffRows = sortedStaff.map((s, i) => {
      const avg = s.transactions > 0 ? s.total_sales / s.transactions : 0;
      const share = totalSales > 0 ? (s.total_sales / totalSales) * 100 : 0;
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>₱${(s.total_sales || 0).toFixed(2)}</td>
        <td style="text-align:center">${s.transactions}</td>
        <td>₱${avg.toFixed(2)}</td>
        <td>${share.toFixed(1)}%</td>
      </tr>`;
    }).join('');

    const html = `
      <h1>Sales Report — ${periodLabel}</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Total Revenue</div><div class="kpi-value">₱${totalSales.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Orders</div><div class="kpi-value">${totalTx}</div></div>
        <div class="kpi-box"><div class="kpi-label">Avg Order Value</div><div class="kpi-value">₱${avgTicket.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Items Sold</div><div class="kpi-value">${totalItems}</div></div>
      </div>
      <h2>Staff Performance</h2>
      <table>
        <thead><tr><th>#</th><th>Staff Name</th><th>Total Sales</th><th>Orders</th><th>Avg Per Order</th><th>Share</th></tr></thead>
        <tbody>${staffRows || '<tr><td colspan="6">No staff data for this period.</td></tr>'}</tbody>
      </table>
    `;
    printReport(`Sales Report — ${periodLabel}`, html);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Period</span>
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
              value={period}
              onChange={e => { setPeriod(e.target.value); setFetched(false); }}
            >
              <option value="daily">Today (Daily)</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="custom">Custom Date</option>
            </select>
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <input 
                type="date" 
                className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" 
                value={customStart} 
                onChange={e => { setCustomStart(e.target.value); setFetched(false); }} 
              />
              <span className="text-xs font-bold text-gray-400">TO</span>
              <input 
                type="date" 
                className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" 
                value={customEnd} 
                onChange={e => { setCustomEnd(e.target.value); setFetched(false); }} 
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm" 
            onClick={handleExport} 
            disabled={!fetched || loading}
          >
            Export CSV
          </button>
          <button 
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
            onClick={fetchReport} 
            disabled={loading || (period === 'custom' && (!customStart || !customEnd))}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button 
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm" 
            onClick={handlePrint} 
            disabled={!fetched}
          >
            Print
          </button>
        </div>
      </div>

      {/* Prompt when not yet fetched */}
      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 border-dashed rounded-xl h-64">
          <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <div className="text-lg font-bold text-gray-900 mb-1">Ready to Generate</div>
          <p className="m-0 text-sm">Select a period and click <strong className="text-gray-900">Generate Report</strong> to load data.</p>
        </div>
      )}

      {loading && (
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 rounded-xl h-64 animate-pulse">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
          <p className="m-0 font-medium">Compiling sales data...</p>
        </div>
      )}

      {fetched && !loading && summary && (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-blue-500">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Gross Revenue</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs font-medium text-gray-400 lowercase">{period} total</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-green-500">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Transactions</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{totalTx.toLocaleString()}</div>
              <div className="text-xs font-medium text-gray-400">sales recorded</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-gray-900">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Average Ticket</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">₱{avgTicket.toFixed(2)}</div>
              <div className="text-xs font-medium text-gray-400">per transaction</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-purple-500">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items Sold</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{totalItems.toLocaleString()}</div>
              <div className="text-xs font-medium text-gray-400">units dispatched</div>
            </div>
          </div>

          {/* Revenue by Staff (Trend Bars) */}
          {trendData.length > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden pt-4 pb-2">
              <div className="px-6 flex justify-between items-baseline mb-4">
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Revenue by Operator</h2>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {period} view
                </span>
              </div>
              <div className="overflow-x-auto pb-4">
                <TrendBars data={trendData} />
              </div>
            </div>
          )}

          {/* Staff Performance Table */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Personnel Performance Breakdown</h2>
            </div>
            <div className="p-0">
              {sortedStaff.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('name')}>Operator{sortArrow('name')}</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('total_sales')}>Total Sales{sortArrow('total_sales')}</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 text-center" onClick={() => handleSort('transactions')}>
                          Transactions{sortArrow('transactions')}
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Avg Per Sale</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[180px]">Market Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedStaff.map((staff, i) => {
                        const share = totalSales > 0 ? (staff.total_sales / totalSales) * 100 : 0;
                        const avg   = staff.transactions > 0 ? staff.total_sales / staff.transactions : 0;
                        return (
                          <tr key={staff.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                i === 1 ? 'bg-gray-200 text-gray-700' :
                                i === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider">{staff.name}</td>
                            <td className="px-6 py-4 text-sm font-bold font-mono text-gray-900">
                              ₱{(staff.total_sales || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-center">{staff.transactions}</td>
                            <td className="px-6 py-4 text-sm font-medium font-mono text-gray-500 text-center">
                              ₱{avg.toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-gray-900 rounded-full" style={{ width: `${share}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-600 w-12 text-right">{share.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 font-medium bg-gray-50/50">No staff activity for this period.</div>
              )}
            </div>
          </div>

          {/* Top Products Sold Table */}
          {sortedProducts.length > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-baseline">
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Top Products Sold</h2>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {period === 'custom' ? `${customStart} to ${customEnd}` : period}
                </span>
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Units Sold</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedProducts.map((p, i) => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-yellow-100 text-yellow-700' :
                              i === 1 ? 'bg-gray-200 text-gray-700' :
                              i === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{p.name}</td>
                          <td className="px-6 py-4 text-xs font-medium text-gray-500">{p.category}</td>
                          <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-center">{p.qty_sold}</td>
                          <td className="px-6 py-4 text-sm font-bold font-mono text-green-700">
                            ₱{p.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {fetched && !loading && !summary && (
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 rounded-xl">
          <div className="text-lg font-bold text-gray-900 mb-1">No Data</div>
          <p className="m-0 text-sm">No sales data found for the selected period.</p>
        </div>
      )}
    </div>
  );
};

export default SalesPerformanceReport;
