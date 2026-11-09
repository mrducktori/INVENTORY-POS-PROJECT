import React, { useState, useCallback, useMemo } from 'react';
import { getSalesPerformanceReport } from '../../api/reportsApi';
import { downloadCSV, printReport } from './reportUtils';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';

// ─── Mini Bar chart (SVG sparkline) ──────────────────────────────────────────
const TrendBars = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="rpt-trend-chart flex items-end gap-5 h-44 px-5 py-4">
      {data.map((d, i) => {
        const height = (d.value / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center flex-none w-14 h-full justify-end gap-2">
            <span className="text-[10px] font-bold font-mono text-zinc-800">₱{d.value.toLocaleString()}</span>
            <div
              className="w-7 bg-zinc-900 rounded-t-sm transition-all duration-500"
              style={{ height: `${Math.max(4, height)}%` }}
              title={`${d.label}: ₱${d.value.toFixed(2)}`}
            />
            <span className="text-[10px] text-zinc-500 font-semibold uppercase text-center max-w-[60px] truncate">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SalesPerformanceReport = () => {
  const [period, setPeriod] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [sortKey, setSortKey] = useState('total_sales');
  const [sortDir, setSortDir] = useState('desc');
  const [staffSearch, setStaffSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

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
    let list = [...summary.staff_data];
    if (staffSearch.trim()) {
      const q = staffSearch.trim().toLowerCase();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [summary, sortKey, sortDir, staffSearch]);

  const sortedProducts = useMemo(() => {
    if (!summary?.product_data) return [];
    let list = [...summary.product_data];
    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    }
    return list;
  }, [summary, productSearch]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const renderSortIcon = (key) => {
    const isCurrent = sortKey === key;
    return (
      <svg className={`w-3.5 h-3.5 inline ml-1 ${isCurrent ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        {isCurrent && sortDir === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        ) : isCurrent && sortDir === 'desc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        )}
      </svg>
    );
  };

  // Build trend data from staff performance
  const trendData = sortedStaff.slice(0, 10).map(s => ({
    label: (s.name || '').split(' ')[0],
    value: s.total_sales || 0
  }));

  const totalSales = summary?.total_sales || 0;
  const totalTx = summary?.total_transactions || 0;
  const avgTicket = totalTx > 0 ? totalSales / totalTx : 0;
  const totalItems = summary?.total_items_sold || 0;

  const handleExport = () => {
    if (!summary) return;
    const date = new Date().toLocaleDateString('en-PH');
    const time = new Date().toLocaleTimeString('en-PH');
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : `${customStart} to ${customEnd}`;

    const rows = [
      ['COF/TEA CAFE — SALES PERFORMANCE REPORT'],
      ['Store Name', 'Cof/Tea Cafe'],
      ['Reporting Period', periodLabel],
      ['Date Generated', `${date} ${time}`],
      ['Total Revenue (PHP)', totalSales.toFixed(2)],
      ['Total Transactions', totalTx],
      ['Average Order Value (PHP)', avgTicket.toFixed(2)],
      ['Total Items Sold', totalItems],
      [],
      ['SECTION 1: STAFF SALES BREAKDOWN'],
      ['Staff Name', 'Total Sales (PHP)', 'Number of Orders', 'Average Ticket (PHP)', 'Sales Share (%)'],
      ...sortedStaff.map(s => {
        const avg = s.transactions > 0 ? s.total_sales / s.transactions : 0;
        const share = totalSales > 0 ? (s.total_sales / totalSales) * 100 : 0;
        return [
          s.name,
          (s.total_sales || 0).toFixed(2),
          s.transactions,
          avg.toFixed(2),
          `${share.toFixed(1)}%`
        ];
      }),
    ];
    downloadCSV(rows, `CofTea_Sales_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : `${customStart} to ${customEnd}`;
    const staffRows = sortedStaff.map((s, i) => {
      const avg = s.transactions > 0 ? s.total_sales / s.transactions : 0;
      const share = totalSales > 0 ? (s.total_sales / totalSales) * 100 : 0;
      return `<tr>
        <td class="text-center" style="font-family:monospace;font-weight:700">${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td class="text-right num-pos">₱${(s.total_sales || 0).toFixed(2)}</td>
        <td class="text-center" style="font-family:monospace">${s.transactions}</td>
        <td class="text-right" style="font-family:monospace">₱${avg.toFixed(2)}</td>
        <td class="text-right" style="font-weight:700">${share.toFixed(1)}%</td>
      </tr>`;
    }).join('');

    const html = `
      <div class="report-header">
        <div class="brand-meta-row">
          <div>
            <div class="brand-logo-text">COF/TEA CAFE</div>
            <div class="brand-subtitle">Point of Sale &amp; Inventory Management System</div>
          </div>
          <div class="report-timestamp">
            <div>Period: <strong>${periodLabel}</strong></div>
            <div>Generated: <strong>${new Date().toLocaleString('en-PH')}</strong></div>
          </div>
        </div>
        <h1>Sales Performance Report</h1>
        <p class="subtitle">Official revenue summary, cashier productivity, order volume, and ticket averages.</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box border-in">
          <div class="kpi-label">Total Revenue</div>
          <div class="kpi-value" style="color:#16a34a">₱${totalSales.toFixed(2)}</div>
          <div class="kpi-sub">gross completed sales</div>
        </div>
        <div class="kpi-box border-neutral">
          <div class="kpi-label">Transactions</div>
          <div class="kpi-value">${totalTx}</div>
          <div class="kpi-sub">completed orders</div>
        </div>
        <div class="kpi-box border-brand">
          <div class="kpi-label">Average Order</div>
          <div class="kpi-value">₱${avgTicket.toFixed(2)}</div>
          <div class="kpi-sub">average ticket value</div>
        </div>
        <div class="kpi-box border-alert">
          <div class="kpi-label">Items Sold</div>
          <div class="kpi-value" style="color:#d97706">${totalItems}</div>
          <div class="kpi-sub">total units served</div>
        </div>
      </div>

      <h2>
        <span>Staff Sales Performance (${sortedStaff.length} cashiers)</span>
        <span style="font-size:10px;color:#6b7280;font-weight:normal">Ranked by revenue</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width:30px">#</th>
            <th>Staff Name</th>
            <th class="text-right">Total Revenue</th>
            <th class="text-center">Orders</th>
            <th class="text-right">Avg Per Order</th>
            <th class="text-right">Revenue Share</th>
          </tr>
        </thead>
        <tbody>
          ${staffRows || '<tr><td colspan="6">No staff transactions recorded for this period.</td></tr>'}
        </tbody>
      </table>

      <div class="report-footer">
        <span>Confidential &bull; Cof/Tea Cafe Management Report</span>
        <span>Generated by POS &amp; Inventory System</span>
      </div>
    `;
    printReport(`Sales Report — ${periodLabel}`, html);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls Card */}
      <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Period</span>
            <select
              className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs sm:text-sm font-semibold bg-white text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-2xs"
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
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs">
              <input 
                type="date" 
                className="bg-transparent border-none text-xs font-medium text-zinc-800 focus:outline-none p-0 cursor-pointer" 
                value={customStart} 
                onChange={e => { setCustomStart(e.target.value); setFetched(false); }} 
              />
              <span className="text-zinc-300 font-semibold">—</span>
              <input 
                type="date" 
                className="bg-transparent border-none text-xs font-medium text-zinc-800 focus:outline-none p-0 cursor-pointer" 
                value={customEnd} 
                onChange={e => { setCustomEnd(e.target.value); setFetched(false); }} 
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs" 
            onClick={handleExport} 
            disabled={!fetched || loading}
          >
            Export CSV
          </button>
          <button 
            type="button"
            className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer" 
            onClick={fetchReport} 
            disabled={loading || (period === 'custom' && (!customStart || !customEnd))}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button 
            type="button"
            className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs" 
            onClick={handlePrint} 
            disabled={!fetched}
          >
            Print
          </button>
        </div>
      </div>

      {/* Prompt when not yet fetched */}
      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-zinc-500 bg-white border border-zinc-200/80 border-dashed rounded-2xl h-64 text-center">
          <svg className="w-12 h-12 mb-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div className="text-base font-bold text-zinc-900 mb-1">Ready to Generate</div>
          <p className="m-0 text-xs sm:text-sm text-zinc-500">Select a period and click <strong className="text-zinc-900 font-semibold">Generate Report</strong> to compile analytics.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={4} />
        </div>
      )}

      {fetched && !loading && summary && (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Gross Revenue</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-zinc-400 mt-1 capitalize">{period} completed sales</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Transactions</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">{totalTx.toLocaleString()}</div>
              <div className="text-xs text-zinc-400 mt-1">orders recorded</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Average Ticket</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">₱{avgTicket.toFixed(2)}</div>
              <div className="text-xs text-zinc-400 mt-1">per order average</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Items Dispatched</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">{totalItems.toLocaleString()}</div>
              <div className="text-xs text-zinc-400 mt-1">total units sold</div>
            </div>
          </div>

          {/* Revenue by Staff (Trend Bars) */}
          {trendData.length > 0 && (
            <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl overflow-hidden pt-4 pb-2">
              <div className="px-6 flex justify-between items-baseline mb-2">
                <h2 className="m-0 text-base font-bold text-zinc-900 tracking-tight">Revenue by Operator</h2>
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {period} breakdown
                </span>
              </div>
              <div className="overflow-x-auto pb-2">
                <TrendBars data={trendData} />
              </div>
            </div>
          )}

          {/* Staff Performance Table */}
          <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="m-0 text-base font-bold text-zinc-900 tracking-tight">Personnel Performance Breakdown</h2>
              
              {/* Staff Search */}
              <div className="relative w-full sm:w-64">
                <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search operator..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                />
                {staffSearch && (
                  <button
                    type="button"
                    onClick={() => setStaffSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              {sortedStaff.length > 0 ? (
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 uppercase text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none" onClick={() => handleSort('name')}>
                        Operator {renderSortIcon('name')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none" onClick={() => handleSort('total_sales')}>
                        Total Sales {renderSortIcon('total_sales')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none text-center" onClick={() => handleSort('transactions')}>
                        Transactions {renderSortIcon('transactions')}
                      </th>
                      <th className="py-3 px-4 text-center">Avg Per Sale</th>
                      <th className="py-3 px-4 min-w-[160px]">Market Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedStaff.map((staff, i) => {
                      const share = totalSales > 0 ? (staff.total_sales / totalSales) * 100 : 0;
                      const avg = staff.transactions > 0 ? staff.total_sales / staff.transactions : 0;
                      return (
                        <tr key={staff.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-zinc-900 text-white' : i === 1 ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-100 text-zinc-600'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-zinc-900">{staff.name}</td>
                          <td className="py-3.5 px-4 font-bold font-mono text-zinc-900">
                            ₱{(staff.total_sales || 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-900 text-center font-mono">{staff.transactions}</td>
                          <td className="py-3.5 px-4 font-medium font-mono text-zinc-600 text-center">
                            ₱{avg.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${share}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-zinc-600 w-10 text-right">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-zinc-400 font-medium">No staff activity matching filter.</div>
              )}
            </div>
          </div>

          {/* Top Products Sold Table */}
          {sortedProducts.length > 0 && (
            <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="m-0 text-base font-bold text-zinc-900 tracking-tight">Top Products Sold</h2>
                
                {/* Product Search */}
                <div className="relative w-full sm:w-64">
                  <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search menu item or category..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 uppercase text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Menu Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Units Sold</th>
                      <th className="py-3 px-4">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedProducts.map((p, i) => (
                      <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            i === 0 ? 'bg-zinc-900 text-white' : i === 1 ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-900">{p.name}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold font-mono text-zinc-900 text-center">{p.qty_sold}</td>
                        <td className="py-3.5 px-4 font-bold font-mono text-zinc-900">
                          ₱{p.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {fetched && !loading && !summary && (
        <div className="p-12 flex flex-col items-center justify-center text-zinc-500 bg-white border border-zinc-200 rounded-2xl text-center">
          <div className="text-base font-bold text-zinc-900 mb-1">No Data Available</div>
          <p className="m-0 text-xs sm:text-sm text-zinc-500">No sales transactions were recorded for the selected date window.</p>
        </div>
      )}
    </div>
  );
};

export default SalesPerformanceReport;
