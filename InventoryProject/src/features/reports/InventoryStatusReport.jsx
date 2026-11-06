import React, { useState, useCallback, useMemo } from 'react';
import { getInventoryStatusReport } from '../../api/reportsApi';

import { downloadCSV, printReport } from './reportUtils';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getStatus = (qty, alert) => {
  if (qty <= 0) return 'out';
  if (qty <= alert) return 'critical';
  if (qty <= alert * 1.5) return 'warning';
  return 'healthy';
};

const getStatusLabel = s => ({ out: 'Out of Stock', critical: 'Restock Needed', warning: 'Low Stock', healthy: 'In Stock' }[s] || s);
const getBadgeClass = s => `rpt-badge rpt-badge-${s}`;

const getStockPct = (qty, alert) => {
  if (!alert || alert === 0) return 100;
  return Math.min(Math.round((qty / (alert * 2)) * 100), 100);
};

const barColor = s => ({ out: 'red', critical: 'red', warning: 'orange', healthy: 'green' }[s] || '');

// ─── Summary donut-style segmented bar ───────────────────────────────────────
const HealthBar = ({ stats }) => {
  const total = stats.total || 1;
  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', marginTop: 8, gap: 1 }}>
      {stats.healthy > 0 && (
        <div style={{ flex: stats.healthy / total, background: '#2e7d32' }} title={`Healthy: ${stats.healthy}`} />
      )}
      {stats.warning > 0 && (
        <div style={{ flex: stats.warning / total, background: '#e65100' }} title={`Warning: ${stats.warning}`} />
      )}
      {stats.critical > 0 && (
        <div style={{ flex: stats.critical / total, background: '#c62828' }} title={`Critical: ${stats.critical}`} />
      )}
      {stats.out > 0 && (
        <div style={{ flex: stats.out / total, background: '#000' }} title={`Out: ${stats.out}`} />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const InventoryStatusReport = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortKey, setSortKey]         = useState('name');
  const [sortDir, setSortDir]         = useState('asc');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInventoryStatusReport();
      setIngredients((data || []).filter(i => !i.is_archived));
      setFetched(true);
    } catch (err) {
      console.error('Inventory report error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => ({
    total:    ingredients.length,
    healthy:  ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'healthy').length,
    warning:  ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'warning').length,
    critical: ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'critical').length,
    out:      ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'out').length,
  }), [ingredients]);

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const arrow = key => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  const filtered = useMemo(() => {
    return ingredients
      .filter(i => {
        const s = getStatus(i.stock_quantity, i.low_stock_alert);
        const matchSearch = (i.name || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || s.toUpperCase() === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [ingredients, search, statusFilter, sortKey, sortDir]);

  // Priority list — only critical/warning/out, sorted by urgency
  const priorityList = useMemo(() => {
    return ingredients
      .filter(i => {
        const s = getStatus(i.stock_quantity, i.low_stock_alert);
        return s === 'out' || s === 'critical' || s === 'warning';
      })
      .sort((a, b) => {
        const order = { out: 0, critical: 1, warning: 2 };
        return (order[getStatus(a.stock_quantity, a.low_stock_alert)] || 9)
             - (order[getStatus(b.stock_quantity, b.low_stock_alert)] || 9);
      });
  }, [ingredients]);

  const handleExport = () => {
    const date = new Date().toLocaleDateString('en-PH');
    const rows = [
      ['INVENTORY STATUS REPORT'],
      [`Date Generated: ${date}`],
      [],
      ['SUMMARY'],
      ['Total Ingredients Tracked', stats.total],
      ['In Stock', stats.healthy],
      ['Low Stock', stats.warning],
      ['Restock Needed', stats.critical],
      ['Out of Stock', stats.out],
      [],
      ['FULL INGREDIENT LIST'],
      ['Ingredient Name', 'Current Stock', 'Unit', 'Low Stock Alert Level', 'Stock Status'],
      ...ingredients.map(i => {
        const s = getStatus(i.stock_quantity, i.low_stock_alert);
        return [
          i.name,
          i.stock_quantity,
          i.unit,
          i.low_stock_alert,
          getStatusLabel(s)
        ];
      })
    ];
    downloadCSV(rows, `Inventory_Status_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const urgentRows = priorityList.map(i => {
      const s = getStatus(i.stock_quantity, i.low_stock_alert);
      return `<tr><td><strong>${i.name}</strong></td><td>${i.stock_quantity} ${i.unit}</td><td>${i.low_stock_alert} ${i.unit}</td><td><span class="badge badge-${s}">${getStatusLabel(s)}</span></td></tr>`;
    }).join('');
    const allRows = ingredients.map(i => {
      const s = getStatus(i.stock_quantity, i.low_stock_alert);
      return `<tr><td>${i.name}</td><td>${i.stock_quantity} ${i.unit}</td><td>${i.low_stock_alert} ${i.unit}</td><td><span class="badge badge-${s}">${getStatusLabel(s)}</span></td></tr>`;
    }).join('');
    const html = `
      <h1>Inventory Status Report</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Total Tracked</div><div class="kpi-value">${stats.total}</div></div>
        <div class="kpi-box"><div class="kpi-label">In Stock</div><div class="kpi-value">${stats.healthy}</div></div>
        <div class="kpi-box"><div class="kpi-label">Low / Restock Needed</div><div class="kpi-value">${stats.warning + stats.critical}</div></div>
        <div class="kpi-box"><div class="kpi-label">Out of Stock</div><div class="kpi-value">${stats.out}</div></div>
      </div>
      ${priorityList.length > 0 ? `
        <h2>Needs Attention (${priorityList.length} items)</h2>
        <table><thead><tr><th>Ingredient</th><th>Current Stock</th><th>Alert Level</th><th>Status</th></tr></thead>
        <tbody>${urgentRows}</tbody></table>` : ''}
      <h2>Full Inventory List</h2>
      <table><thead><tr><th>Ingredient</th><th>Current Stock</th><th>Alert Level</th><th>Status</th></tr></thead>
      <tbody>${allRows}</tbody></table>
    `;
    printReport('Inventory Status Report', html);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Search</span>
            <input
              type="text"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-48 lg:w-64"
              placeholder="Filter ingredients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Status Filter</span>
            <select 
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="HEALTHY">In Stock Only</option>
              <option value="WARNING">Low Stock Only</option>
              <option value="CRITICAL">Restock Needed Only</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>
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
          <p className="m-0 text-sm md:text-base">Click <strong className="text-gray-900">Generate Report</strong> to load current inventory data.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={5} />
        </div>
      )}

      {fetched && !loading && (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
          {/* KPI Cards & Health Bar Combined */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="p-5 border-t-4 border-t-gray-900">
                <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Total Ingredients</div>
                <div className="text-2xl font-extrabold text-gray-900 mb-1">{stats.total}</div>
                <div className="text-sm md:text-base font-medium text-gray-400">active items tracked</div>
              </div>
              <div className="p-5 border-t-4 border-t-green-500">
                <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">In Stock</div>
                <div className="text-2xl font-extrabold text-green-700 mb-1">{stats.healthy}</div>
                <div className="text-sm md:text-base font-medium text-gray-400">above safe threshold</div>
              </div>
              <div className="p-5 border-t-4 border-t-orange-500">
                <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Low / Restock</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="text-2xl font-extrabold text-orange-600">{stats.warning + stats.critical}</div>
                  <div className="text-xs font-bold text-gray-400">({stats.warning} low, {stats.critical} urgent)</div>
                </div>
                <div className="text-sm md:text-base font-medium text-gray-400">need attention</div>
              </div>
              <div className="p-5 border-t-4 border-t-red-600">
                <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Out of Stock</div>
                <div className="text-2xl font-extrabold text-red-700 mb-1">{stats.out}</div>
                <div className="text-sm md:text-base font-medium text-gray-400">immediate restock needed</div>
              </div>
            </div>
            
            {stats.total > 0 && (
              <div className="p-5 bg-gray-50/50 border-t border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Health Distribution</span>
                </div>
                <HealthBar stats={stats} />
              </div>
            )}
          </div>

          {/* Priority Attention List */}
          {priorityList.length > 0 && (
            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-red-200">
              <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <h2 className="m-0 text-lg font-bold text-red-800 tracking-tight flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  Priority Attention Required ({priorityList.length} items)
                </h2>
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Current Stock</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Alert Level</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Level</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {priorityList.map(ing => {
                        const s = getStatus(ing.stock_quantity, ing.low_stock_alert);
                        const pct = getStockPct(ing.stock_quantity, ing.low_stock_alert);
                        return (
                          <tr key={ing.id} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-6 py-4 text-sm md:text-base font-bold text-gray-900">{ing.name}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-gray-900">{ing.stock_quantity}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-medium font-mono text-gray-400">{ing.low_stock_alert}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-500">{ing.unit}</td>
                            <td className="px-6 py-4 min-w-[120px]">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ 
                                    width: `${pct}%`,
                                    backgroundColor: s === 'out' || s === 'critical' ? '#dc2626' : '#ea580c'
                                  }} />
                                </div>
                                <span className="text-sm md:text-base font-bold text-gray-600 w-10 text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider border ${ s === 'out' ? 'bg-black text-white border-black' : s === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200' }`}>
                                {getStatusLabel(s)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Full Inventory Table */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Full Inventory Table ({filtered.length} items)</h2>
            </div>
            <div className="p-0">
              {filtered.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('name')}>Ingredient{arrow('name')}</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('stock_quantity')}>Current Stock{arrow('stock_quantity')}</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => handleSort('low_stock_alert')}>Alert Level{arrow('low_stock_alert')}</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider min-w-[140px]">Level</th>
                        <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 text-right" onClick={() => handleSort('stock_quantity')}>Status{arrow('stock_quantity')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map(ing => {
                        const s   = getStatus(ing.stock_quantity, ing.low_stock_alert);
                        const pct = getStockPct(ing.stock_quantity, ing.low_stock_alert);
                        return (
                          <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm md:text-base font-bold text-gray-900">{ing.name}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-gray-900">{ing.stock_quantity}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-medium font-mono text-gray-400">{ing.low_stock_alert}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-500">{ing.unit}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ 
                                    width: `${pct}%`,
                                    backgroundColor: s === 'out' || s === 'critical' ? '#dc2626' : s === 'warning' ? '#ea580c' : '#15803d'
                                  }} />
                                </div>
                                <span className="text-sm md:text-base font-bold text-gray-600 w-10 text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider border ${ s === 'out' ? 'bg-black text-white border-black' : s === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : s === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200' }`}>
                                {getStatusLabel(s)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 font-medium bg-gray-50/50">No ingredients match your filters.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryStatusReport;
