import React, { useState, useCallback, useMemo } from 'react';
import { getWastageReport, getWastageStats } from '../../api/reportsApi';
import { downloadCSV, printReport } from './reportUtils';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';

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
  const arrow = key => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  // Unique reasons for filter dropdown
  const reasons = useMemo(() => {
    const set = new Set(entries.map(e => e.reason).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter(e => {
        const matchSearch = !search ||
          (e.ingredients?.name || e.ingredient_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (e.reason || '').toLowerCase().includes(search.toLowerCase()) ||
          (e.users?.name || e.reported_by_name || '').toLowerCase().includes(search.toLowerCase());
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

  // Summary aggregations
  const totalQuantity = filtered.reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
  const totalCost     = filtered.reduce((s, e) => s + (parseFloat(e.estimated_cost) || 0), 0);

  // Group by reason for breakdown
  const byReason = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      const r = e.reason || 'Unknown';
      if (!map[r]) map[r] = { count: 0, cost: 0 };
      map[r].count++;
      map[r].cost += parseFloat(e.estimated_cost) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [entries]);

  const handleExport = () => {
    const dateRange = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : 'All Time';
    const exportRows = [
      ['WASTAGE & LOSS REPORT'],
      [`Date Range: ${dateRange}`],
      [`Date Generated: ${new Date().toLocaleDateString('en-PH')}`],
      [],
      ['SUMMARY'],
      ['Total Wastage Events', filtered.length],
      ['Total Quantity Wasted', totalQuantity.toFixed(2)],
      ['Total Estimated Cost Loss (PHP)', `₱${totalCost.toFixed(2)}`],
      [],
      ['WASTAGE LOG'],
      ['Date & Time', 'Ingredient Name', 'Quantity Wasted', 'Unit', 'Reason', 'Estimated Cost Loss (PHP)', 'Reported By'],
      ...filtered.map(e => [
        new Date(e.created_at).toLocaleString('en-PH'),
        e.ingredients?.name || e.ingredient_name || '—',
        parseFloat(e.quantity || 0).toFixed(2),
        e.ingredients?.unit || e.unit || '—',
        e.reason || '—',
        `₱${parseFloat(e.estimated_cost || 0).toFixed(2)}`,
        e.users?.name || e.reported_by_name || '—'
      ])
    ];
    downloadCSV(exportRows, `Wastage_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : 'All Time';
    const tableRows = filtered.map(e => `
      <tr>
        <td style="font-size:11px;color:#777">${new Date(e.created_at).toLocaleString('en-PH')}</td>
        <td><strong>${e.ingredients?.name || e.ingredient_name || '—'}</strong></td>
        <td style="text-align:right">${parseFloat(e.quantity || 0).toFixed(2)} ${e.ingredients?.unit || e.unit || ''}</td>
        <td>${e.reason || '—'}</td>
        <td style="text-align:right;color:#c62828;font-weight:bold">₱${parseFloat(e.estimated_cost || 0).toFixed(2)}</td>
        <td>${e.users?.name || e.reported_by_name || '—'}</td>
      </tr>`).join('');
    const reasonRows = byReason.map(([reason, data]) =>
      `<tr><td>${reason}</td><td style="text-align:center">${data.count}</td><td style="text-align:right">₱${data.cost.toFixed(2)}</td></tr>`
    ).join('');
    const html = `
      <h1>Wastage & Loss Report</h1>
      <p class="subtitle">Period: ${dateRange} &nbsp;&bull;&nbsp; Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Total Events</div><div class="kpi-value">${filtered.length}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Cost Loss</div><div class="kpi-value">₱${totalCost.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Qty Wasted</div><div class="kpi-value">${totalQuantity.toFixed(2)}</div></div>
      </div>
      <h2>Breakdown by Reason</h2>
      <table><thead><tr><th>Reason</th><th>Events</th><th>Cost Loss</th></tr></thead>
      <tbody>${reasonRows}</tbody></table>
      <h2>Wastage Log (${filtered.length} records)</h2>
      <table>
        <thead><tr><th>Date & Time</th><th>Ingredient</th><th style="text-align:right">Qty</th><th>Reason</th><th style="text-align:right">Cost Loss</th><th>Reported By</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
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
              <div className="flex items-center gap-3">
                <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Search</span>
                <input
                  type="text"
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-48"
                  placeholder="Item, reason, staff..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
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
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 rounded-xl h-64 animate-pulse">
      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={6} />
        </div>
      )}
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
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{totalQuantity.toFixed(2)}</div>
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
                                ₱{data.cost.toFixed(2)}
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
                      {Object.entries(stats).map(([k, v]) => (
                        <div key={k} className="py-3 flex justify-between items-center text-sm md:text-base">
                          <span className="text-gray-500 font-medium capitalize">{k.replace(/_/g, ' ')}</span>
                          <span className="font-bold text-gray-900 font-mono">
                            {k === 'wastageByIngredient' 
                              ? Object.keys(v).length + ' items' 
                              : (typeof v === 'number' && k.toLowerCase().includes('cost'))
                                ? `₱${parseFloat(v).toFixed(2)}`
                                : v}
                          </span>
                        </div>
                      ))}
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
                      {filtered.map((e, i) => (
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
                            ₱{parseFloat(e.estimated_cost || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-600">
                            {e.users?.name || e.reported_by_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
