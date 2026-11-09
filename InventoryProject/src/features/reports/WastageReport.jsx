import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getWastageReport, getWastageStats } from '../../api/reportsApi';
import { downloadCSV, printReport } from './reportUtils';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';
import Pagination from '../../components/shared/Pagination';

// ─── Reason badge colors ──────────────────────────────────────────────────────
const reasonBadgeStyle = (reason) => {
  const map = {
    'Expired':   { background: '#ffebee', color: '#c62828', border: '1px solid #c62828' },
    'Spilled':   { background: '#fff8e1', color: '#e65100', border: '1px solid #e65100' },
    'Damaged':   { background: '#fff8e1', color: '#e65100', border: '1px solid #e65100' },
    'Overcooked':{ background: '#f3e5f5', color: '#6a1b9a', border: '1px solid #6a1b9a' },
    'Other':     { background: '#f5f5f5', color: '#555', border: '1px solid #ccc' },
  };
  return map[reason] || map['Other'];
};

// ─── Main Component ───────────────────────────────────────────────────────────
const WastageReport = () => {
  const [entries, setEntries] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [reasonFilter, setReasonFilter] = useState('ALL');
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('created_at');
  const [sortDir, setSortDir]   = useState('desc');
  const [page, setPage]         = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [reasonFilter, search, sortKey, sortDir, startDate, endDate]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const [wastageData, statsData] = await Promise.all([
        getWastageReport(startDate, endDate),
        getWastageStats()
      ]);
      setEntries(wastageData || []);
      setStats(statsData || null);
      setFetched(true);
    } catch (err) {
      console.error('Wastage report error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const arrow = key => {
    const isCurrent = sortKey === key;
    return (
      <svg className={`w-3.5 h-3.5 inline ml-1 ${isCurrent ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

  // Unique reasons for filter dropdown
  const reasons = useMemo(() => {
    const set = new Set(entries.map(e => e.reason).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [entries]);

  const filtered = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    return entries
      .filter(e => {
        const matchSearch = !term ||
          String(e.ingredients?.name || e.ingredient_name || '').toLowerCase().includes(term) ||
          String(e.reason || '').toLowerCase().includes(term) ||
          String(e.users?.name || e.reported_by_name || '').toLowerCase().includes(term);
        const matchReason = reasonFilter === 'ALL' || e.reason === reasonFilter;
        return matchSearch && matchReason;
      })
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (sortKey === 'created_at') {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        }
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [entries, search, reasonFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  // Helper to get estimated cost for an entry
  const getEntryCost = (e) => {
    const explicitCost = parseFloat(e.estimated_cost);
    if (!isNaN(explicitCost) && explicitCost > 0) return explicitCost;
    const qty = parseFloat(e.quantity) || 0;
    const ing = e.ingredients || {};
    const purchaseCost = parseFloat(ing.cost_per_purchase_unit) || 0;
    const conv = parseFloat(ing.conversion_factor) || 1;
    if (purchaseCost > 0 && conv > 0) {
      return Math.round((purchaseCost / conv) * qty * 100) / 100;
    }
    const unit = String(ing.unit || e.unit || '').toUpperCase();
    const defaultUnitRate =
      unit === 'KG' || unit === 'L' ? 180 :
      unit === 'PCS' ? 2.5 :
      unit === 'G' || unit === 'ML' ? 0.22 : 1.0;
    return Math.round(qty * defaultUnitRate * 100) / 100;
  };

  // Summary aggregations
  const totalQuantity = filtered.reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
  const totalCost     = filtered.reduce((s, e) => s + getEntryCost(e), 0);

  // Group by reason for breakdown
  const byReason = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      const r = e.reason || 'Unknown';
      if (!map[r]) map[r] = { count: 0, cost: 0 };
      map[r].count++;
      map[r].cost += getEntryCost(e);
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [entries]);

  const handleExport = () => {
    const dateRange = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : 'All Time';
    const exportRows = [
      ['COF/TEA CAFE — WASTAGE & LOSS REPORT'],
      ['Store Name', 'Cof/Tea Cafe'],
      ['Reporting Range', dateRange],
      ['Date Generated', new Date().toLocaleString('en-PH')],
      ['Total Wastage Events', filtered.length],
      ['Total Quantity Wasted', totalQuantity.toFixed(2)],
      ['Total Estimated Cost Loss (PHP)', totalCost.toFixed(2)],
      [],
      ['SECTION 1: BREAKDOWN BY REASON'],
      ['Reason Category', 'Number of Events', 'Total Cost Loss (PHP)'],
      ...byReason.map(([reason, data]) => [
        reason,
        data.count,
        data.cost.toFixed(2)
      ]),
      [],
      ['SECTION 2: DETAILED WASTAGE LOG'],
      ['Date & Time', 'Ingredient Name', 'Quantity Wasted', 'Unit', 'Reason', 'Estimated Cost Loss (PHP)', 'Reported By'],
      ...filtered.map(e => [
        new Date(e.created_at).toLocaleString('en-PH'),
        e.ingredients?.name || e.ingredient_name || '—',
        parseFloat(e.quantity || 0).toFixed(2),
        e.ingredients?.unit || e.unit || '—',
        e.reason || '—',
        getEntryCost(e).toFixed(2),
        e.users?.name || e.reported_by_name || '—'
      ])
    ];
    downloadCSV(exportRows, `CofTea_Wastage_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : 'All Time';
    const tableRows = filtered.map(e => `
      <tr>
        <td style="font-size:10px;color:#4b5563;white-space:nowrap">${new Date(e.created_at).toLocaleString('en-PH')}</td>
        <td><strong>${e.ingredients?.name || e.ingredient_name || '—'}</strong></td>
        <td class="text-right" style="font-weight:700;font-family:monospace">${parseFloat(e.quantity || 0).toFixed(2)} ${e.ingredients?.unit || e.unit || ''}</td>
        <td><span class="badge badge-waste">${e.reason || '—'}</span></td>
        <td class="text-right num-neg">₱${getEntryCost(e).toFixed(2)}</td>
        <td style="font-size:10px">${e.users?.name || e.reported_by_name || '—'}</td>
      </tr>`).join('');

    const reasonRows = byReason.map(([reason, data]) =>
      `<tr>
        <td><strong>${reason}</strong></td>
        <td class="text-center" style="font-family:monospace;font-weight:700">${data.count}</td>
        <td class="text-right num-neg">₱${data.cost.toFixed(2)}</td>
      </tr>`
    ).join('');

    const html = `
      <div class="report-header">
        <div class="brand-meta-row">
          <div>
            <div class="brand-logo-text">COF/TEA CAFE</div>
            <div class="brand-subtitle">Point of Sale &amp; Inventory Management System</div>
          </div>
          <div class="report-timestamp">
            <div>Period: <strong>${dateRange}</strong></div>
            <div>Generated: <strong>${new Date().toLocaleString('en-PH')}</strong></div>
          </div>
        </div>
        <h1>Wastage &amp; Loss Report</h1>
        <p class="subtitle">Complete audit of raw material spoilage, damage, expiration, and quality control write-offs.</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box border-out">
          <div class="kpi-label">Total Cost Loss</div>
          <div class="kpi-value" style="color:#dc2626">₱${totalCost.toFixed(2)}</div>
          <div class="kpi-sub">estimated asset loss</div>
        </div>
        <div class="kpi-box border-alert">
          <div class="kpi-label">Wastage Events</div>
          <div class="kpi-value" style="color:#d97706">${filtered.length}</div>
          <div class="kpi-sub">recorded incidents</div>
        </div>
        <div class="kpi-box border-neutral">
          <div class="kpi-label">Total Volume Wasted</div>
          <div class="kpi-value">${totalQuantity.toFixed(2)}</div>
          <div class="kpi-sub">cumulative material units</div>
        </div>
      </div>

      <h2>
        <span>Breakdown by Reason</span>
        <span style="font-size:10px;color:#6b7280;font-weight:normal">${byReason.length} categories</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Reason Category</th>
            <th class="text-center">Recorded Incidents</th>
            <th class="text-right">Estimated Financial Loss</th>
          </tr>
        </thead>
        <tbody>
          ${reasonRows || '<tr><td colspan="3">No loss events recorded.</td></tr>'}
        </tbody>
      </table>

      <h2>
        <span>Detailed Wastage &amp; Loss Log (${filtered.length} records)</span>
        <span style="font-size:10px;color:#6b7280;font-weight:normal">Chronological order</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Raw Material</th>
            <th class="text-right">Qty Wasted</th>
            <th>Reason</th>
            <th class="text-right">Cost Loss</th>
            <th>Reported By</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="6">No wastage records match the selected date range and filter criteria.</td></tr>'}
        </tbody>
      </table>

      <div class="report-footer">
        <span>Confidential &bull; Cof/Tea Cafe Management Report</span>
        <span>Generated by POS &amp; Inventory System</span>
      </div>
    `;

    printReport('Wastage & Loss Report', html);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Start Date</span>
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-40"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setFetched(false); }}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">End Date</span>
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-40"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setFetched(false); }}
            />
          </div>
          {fetched && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Reason</span>
                <select 
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                  value={reasonFilter} 
                  onChange={e => setReasonFilter(e.target.value)}
                >
                  {reasons.map(r => <option key={r} value={r}>{r === 'ALL' ? 'All Reasons' : r}</option>)}
                </select>
              </div>
              <div className="relative w-full sm:w-60">
                <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  className="w-full pl-9 pr-7 py-2 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                  placeholder="Item, reason, staff..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm" 
            onClick={handleExport} 
            disabled={!fetched || loading}
          >
            Export CSV
          </button>
          <button 
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
            onClick={fetchReport} 
            disabled={loading}
          >
            {loading ? 'Loading...' : fetched ? 'Refresh Data' : 'Generate Report'}
          </button>
          <button 
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm" 
            onClick={handlePrint} 
            disabled={!fetched}
          >
            Print
          </button>
        </div>
      </div>

      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 border-dashed rounded-xl h-64">
          <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <div className="text-lg font-bold text-gray-900 mb-1">Ready to Generate</div>
          <p className="m-0 text-sm md:text-base">Optionally set a date range, then click <strong className="text-gray-900">Generate Report</strong> to view wastage data.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={6} />
        </div>
      )}

      {fetched && !loading && (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-gray-900">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Total Records</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{filtered.length}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">wastage events</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-red-500">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Estimated Cost Loss</div>
              <div className="text-2xl font-extrabold text-red-700 mb-1">₱{totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">total loss value</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-orange-500">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Total Quantity Wasted</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{totalQuantity.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">units lost</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-purple-500">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Reason Categories</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{byReason.length}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">distinct reasons</div>
            </div>
          </div>

          {/* Reason Breakdown */}
          {byReason.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Breakdown by Reason</h2>
                </div>
                <div className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Events</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Cost Loss</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider min-w-[150px]">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {byReason.map(([reason, data]) => {
                          const share = filtered.length > 0 ? (data.count / filtered.length) * 100 : 0;
                          return (
                            <tr key={reason} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span
                                  className="inline-flex px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider"
                                  style={reasonBadgeStyle(reason)}
                                >
                                  {reason}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm md:text-base font-extrabold text-gray-900 text-center">{data.count}</td>
                              <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-red-700 text-right">
                                ₱{data.cost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-600 rounded-full" style={{ width: `${share}%` }} />
                                  </div>
                                  <span className="text-sm md:text-base font-bold text-gray-600 w-10 text-right">{share.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Stats from /wastage/stats */}
              {stats && (
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden h-fit">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Overall Statistics</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col divide-y divide-gray-100">
                      {Object.entries(stats).map(([k, v]) => {
                        const labelMap = {
                          totalWastage: 'Total Wastage Volume',
                          totalEstimatedCost: 'Estimated Total Loss',
                          wastageByIngredient: 'Affected Ingredients',
                          recordCount: 'Total Records Logged',
                        };
                        const label = labelMap[k] || k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
                        let formattedVal = v;
                        if (k === 'wastageByIngredient' && v && typeof v === 'object') {
                          formattedVal = `${Object.keys(v).length} items`;
                        } else if (typeof v === 'number' && k.toLowerCase().includes('cost')) {
                          formattedVal = `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        } else if (typeof v === 'number' && k === 'totalWastage') {
                          formattedVal = Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                        return (
                          <div key={k} className="py-3 flex justify-between items-center text-sm md:text-base">
                            <span className="text-gray-500 font-medium capitalize">{label}</span>
                            <span className="font-bold text-gray-900 font-mono">{formattedVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Wastage Table */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Wastage Log ({filtered.length} records)</h2>
            </div>
            <div className="p-0">
              {filtered.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('created_at')}>Date & Time{arrow('created_at')}</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('ingredient_name')}>Ingredient{arrow('ingredient_name')}</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 text-right" onClick={() => handleSort('quantity')}>
                          Qty{arrow('quantity')}
                        </th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('reason')}>Reason{arrow('reason')}</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 text-right" onClick={() => handleSort('estimated_cost')}>
                          Loss Value{arrow('estimated_cost')}
                        </th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginated.map((e, i) => (
                        <tr key={e.id || i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm md:text-base font-medium font-mono text-gray-500">
                            {new Date(e.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-bold text-gray-900">
                            {e.ingredients?.name || e.ingredient_name || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-gray-900 text-right">
                            {parseFloat(e.quantity || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-500">
                            {e.ingredients?.unit || e.unit || '—'}
                          </td>
                          <td className="px-6 py-4">
                            {e.reason
                              ? <span className="inline-flex px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider" style={reasonBadgeStyle(e.reason)}>{e.reason}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-red-700 text-right">
                            ₱{getEntryCost(e).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-600">
                            {e.users?.name || e.reported_by_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Controls */}
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={filtered.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setPage}
                    onItemsPerPageChange={(val) => {
                      setItemsPerPage(val);
                      setPage(1);
                    }}
                    itemsPerPageOptions={[10, 25, 50, 100]}
                  />
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                  <div className="text-lg font-bold text-gray-900 mb-1">No Records Found</div>
                  <p className="m-0 text-sm md:text-base">No wastage events match your current filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WastageReport;
