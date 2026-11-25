import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getInventoryStatusReport } from '../../api/reportsApi';
import { downloadCSV, printReport } from './utils/reportUtils';
import { escapeHtml } from '../../utils/escapeHtml';
import { getManilaDateOnly } from '../../utils/dateUtils';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';
import Pagination from '../../components/shared/Pagination';

const getUsableStock = (ing) => {
  if (ing && ing.usable_stock !== undefined && ing.usable_stock !== null) {
    return Number(ing.usable_stock) || 0;
  }
  return Number(ing?.stock_quantity) || 0;
};

const getStatus = (qty, alert) => {
  if (qty <= 0) return 'out';
  if (qty <= alert) return 'critical';
  if (qty <= alert * 1.5) return 'warning';
  return 'healthy';
};

const getStatusLabel = (s) =>
  ({ out: 'Out of Stock', critical: 'Restock Needed', warning: 'Low Stock', healthy: 'In Stock' }[s] || s);

const getStockPct = (qty, alert) => {
  if (!alert || alert === 0) return 100;
  return Math.min(Math.round((qty / (alert * 2)) * 100), 100);
};

const formatExpiryMeta = (expiryDate, todayManila) => {
  if (!expiryDate) return { label: 'No Expiry', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  const expStr = String(expiryDate).slice(0, 10);
  const diffDays = Math.round(
    (new Date(`${expStr}T00:00:00Z`) - new Date(`${todayManila}T00:00:00Z`)) / 86400000
  );
  if (diffDays < 0) return { label: `Expired (${expStr})`, cls: 'bg-red-50 text-red-700 border-red-200' };
  if (diffDays === 0) return { label: `Today (${expStr})`, cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  if (diffDays <= 7) return { label: `${diffDays}d (${expStr})`, cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: expStr, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

const HealthBar = ({ stats }) => {
  const total = stats.total || 1;
  return (
    <div className="flex h-3 rounded-md overflow-hidden mt-2 gap-0.5 bg-zinc-100">
      {stats.healthy > 0 && (
        <div style={{ flex: stats.healthy / total }} className="bg-emerald-600 transition-all" title={`In Stock: ${stats.healthy}`} />
      )}
      {stats.warning > 0 && (
        <div style={{ flex: stats.warning / total }} className="bg-amber-500 transition-all" title={`Low Stock: ${stats.warning}`} />
      )}
      {stats.critical > 0 && (
        <div style={{ flex: stats.critical / total }} className="bg-red-600 transition-all" title={`Critical: ${stats.critical}`} />
      )}
      {stats.out > 0 && (
        <div style={{ flex: stats.out / total }} className="bg-zinc-900 transition-all" title={`Out: ${stats.out}`} />
      )}
    </div>
  );
};

const InventoryStatusReport = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const todayManila = getManilaDateOnly();

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, sortKey, sortDir]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInventoryStatusReport();
      setIngredients((data || []).filter((i) => !i.is_archived));
      setFetched(true);
    } catch (err) {
      console.error('Inventory report error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const stats = useMemo(
    () => ({
      total: ingredients.length,
      healthy: ingredients.filter((i) => getStatus(getUsableStock(i), i.low_stock_alert) === 'healthy').length,
      warning: ingredients.filter((i) => getStatus(getUsableStock(i), i.low_stock_alert) === 'warning').length,
      critical: ingredients.filter((i) => getStatus(getUsableStock(i), i.low_stock_alert) === 'critical').length,
      out: ingredients.filter((i) => getStatus(getUsableStock(i), i.low_stock_alert) === 'out').length,
      withExpired: ingredients.filter((i) => (Number(i.expired_stock) || 0) > 0).length,
    }),
    [ingredients]
  );

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const arrow = (key) => {
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

  const filtered = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    return ingredients
      .filter((i) => {
        const s = getStatus(getUsableStock(i), i.low_stock_alert);
        const matchSearch =
          !term ||
          (i.name || '').toLowerCase().includes(term) ||
          (i.category || '').toLowerCase().includes(term);
        const matchStatus = statusFilter === 'ALL' || s === statusFilter.toLowerCase();
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        let av = sortKey === 'usable_stock' ? getUsableStock(a) : a[sortKey];
        let bv = sortKey === 'usable_stock' ? getUsableStock(b) : b[sortKey];
        if (sortKey === 'nearest_expiry_date') {
          av = a.nearest_expiry_date || '9999-12-31';
          bv = b.nearest_expiry_date || '9999-12-31';
        }
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [ingredients, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  const priorityList = useMemo(() => {
    return ingredients.filter((i) => {
      const s = getStatus(getUsableStock(i), i.low_stock_alert);
      return s === 'critical' || s === 'out';
    });
  }, [ingredients]);

  const handleExport = () => {
    const date = new Date().toLocaleDateString('en-PH');
    const time = new Date().toLocaleTimeString('en-PH');

    const rows = [
      ['COF/TEA CAFE — INVENTORY STATUS REPORT'],
      ['Store Name', 'Cof/Tea Cafe'],
      ['Date Generated', `${date} ${time}`],
      ['Total Tracked Ingredients', stats.total],
      ['In Stock (Healthy)', stats.healthy],
      ['Low Stock (Restock Warning)', stats.warning],
      ['Critical (Immediate Action)', stats.critical],
      ['Out of Usable Stock', stats.out],
      ['Items With Expired Batches', stats.withExpired],
      [],
      ['SECTION 1: INVENTORY DETAIL'],
      ['Raw Material Name', 'Category', 'Usable Stock', 'Expired Stock', 'Alert Level', 'Unit', 'Nearest Expiry', 'Stock Status'],
      ...filtered.map((i) => {
        const usable = getUsableStock(i);
        const expired = Number(i.expired_stock) || 0;
        return [
          i.name,
          i.category || 'General',
          usable,
          expired,
          parseFloat(i.low_stock_alert || 0),
          i.unit,
          i.nearest_expiry_date ? String(i.nearest_expiry_date).slice(0, 10) : 'No Expiry',
          getStatusLabel(getStatus(usable, i.low_stock_alert))
        ];
      })
    ];

    downloadCSV(rows, `CofTea_Inventory_Status_${getManilaDateOnly()}.csv`);
  };

  const handlePrint = () => {
    const urgentRows = priorityList
      .map((i, idx) => {
        const usable = getUsableStock(i);
        const expired = Number(i.expired_stock) || 0;
        const statusKey = getStatus(usable, i.low_stock_alert);
        const badgeClass = statusKey === 'out' ? 'badge-danger' : 'badge-warning';
        return `<tr>
        <td class="text-center" style="font-family:monospace;font-weight:700">${idx + 1}</td>
        <td><strong>${escapeHtml(i.name)}</strong></td>
        <td>${escapeHtml(i.category || 'General')}</td>
        <td class="text-right num-neg">${escapeHtml(usable)} ${escapeHtml(i.unit)}</td>
        <td class="text-right" style="font-family:monospace;color:${expired > 0 ? '#dc2626' : '#6b7280'}">${expired > 0 ? `${escapeHtml(expired)} ${escapeHtml(i.unit)}` : '—'}</td>
        <td class="text-right" style="font-family:monospace;color:#6b7280">${escapeHtml(i.low_stock_alert)} ${escapeHtml(i.unit)}</td>
        <td class="text-right"><span class="badge ${badgeClass}">${getStatusLabel(statusKey)}</span></td>
      </tr>`;
      })
      .join('');

    const allRows = filtered
      .map((i) => {
        const usable = getUsableStock(i);
        const expired = Number(i.expired_stock) || 0;
        const statusKey = getStatus(usable, i.low_stock_alert);
        const badgeClass = statusKey === 'healthy' ? 'badge-in' : statusKey === 'out' ? 'badge-danger' : 'badge-warning';
        return `<tr>
        <td><strong>${escapeHtml(i.name)}</strong></td>
        <td style="color:#6b7280">${escapeHtml(i.category || 'General')}</td>
        <td class="text-right" style="font-family:monospace;font-weight:700">${escapeHtml(usable)}</td>
        <td class="text-right" style="font-family:monospace;color:${expired > 0 ? '#dc2626' : '#6b7280'}">${expired > 0 ? escapeHtml(expired) : '0'}</td>
        <td class="text-right" style="font-family:monospace;color:#6b7280">${escapeHtml(i.low_stock_alert)}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td>${escapeHtml(i.nearest_expiry_date ? String(i.nearest_expiry_date).slice(0, 10) : 'No Expiry')}</td>
        <td class="text-right"><span class="badge ${badgeClass}">${getStatusLabel(statusKey)}</span></td>
      </tr>`;
      })
      .join('');

    const html = `
      <div class="report-header">
        <div class="brand-meta-row">
          <div>
            <div class="brand-logo-text">COF/TEA CAFE</div>
            <div class="brand-subtitle">Point of Sale &amp; Inventory Management System</div>
          </div>
          <div class="report-timestamp">
            <div>Generated: <strong>${new Date().toLocaleString('en-PH')}</strong></div>
          </div>
        </div>
        <h1>Inventory Status Report</h1>
        <p class="subtitle">Real-time usable stock levels, expired batch separation, and restock thresholds.</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box border-neutral">
          <div class="kpi-label">Total Tracked</div>
          <div class="kpi-value">${stats.total}</div>
          <div class="kpi-sub">all materials</div>
        </div>
        <div class="kpi-box border-in">
          <div class="kpi-label">In Stock</div>
          <div class="kpi-value" style="color:#16a34a">${stats.healthy}</div>
          <div class="kpi-sub">usable stock healthy</div>
        </div>
        <div class="kpi-box border-alert">
          <div class="kpi-label">Low Stock</div>
          <div class="kpi-value" style="color:#d97706">${stats.warning}</div>
          <div class="kpi-sub">below warning line</div>
        </div>
        <div class="kpi-box border-out">
          <div class="kpi-label">Restock Attention</div>
          <div class="kpi-value" style="color:#dc2626">${stats.critical + stats.out}</div>
          <div class="kpi-sub">critical or empty (${stats.out} out)</div>
        </div>
      </div>

      ${
        priorityList.length > 0
          ? `
        <h2>
          <span>Critical Restock Attention (${priorityList.length} items)</span>
          <span style="font-size:10px;color:#dc2626;font-weight:normal">Immediate reorder recommended</span>
        </h2>
        <table>
          <thead>
            <tr>
              <th class="text-center" style="width:30px">#</th>
              <th>Raw Material</th>
              <th>Category</th>
              <th class="text-right">Usable Stock</th>
              <th class="text-right">Expired</th>
              <th class="text-right">Alert Threshold</th>
              <th class="text-right">Urgency Status</th>
            </tr>
          </thead>
          <tbody>${urgentRows}</tbody>
        </table>`
          : ''
      }

      <h2>
        <span>Comprehensive Inventory Registry (${filtered.length} items)</span>
        <span style="font-size:10px;color:#6b7280;font-weight:normal">All monitored raw materials</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Raw Material</th>
            <th>Category</th>
            <th class="text-right">Usable Stock</th>
            <th class="text-right">Expired</th>
            <th class="text-right">Alert Level</th>
            <th>Unit</th>
            <th>Nearest Expiry</th>
            <th class="text-right">Stock Status</th>
          </tr>
        </thead>
        <tbody>${allRows}</tbody>
      </table>

      <div class="report-footer">
        <span>Confidential &bull; Cof/Tea Cafe Management Report</span>
        <span>Generated by POS &amp; Inventory System</span>
      </div>
    `;

    printReport('Inventory Status Report', html);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
              placeholder="Filter materials or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</span>
            <select
              className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs sm:text-sm font-semibold bg-white text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-2xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="HEALTHY">In Stock Only</option>
              <option value="WARNING">Low Stock Only</option>
              <option value="CRITICAL">Restock Needed Only</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>
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
            disabled={loading}
          >
            {loading ? 'Compiling...' : fetched ? 'Refresh Data' : 'Generate Report'}
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

      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-zinc-500 bg-white border border-zinc-200/80 border-dashed rounded-2xl h-64 text-center">
          <svg className="w-12 h-12 mb-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div className="text-base font-bold text-zinc-900 mb-1">Ready to Generate</div>
          <p className="m-0 text-xs sm:text-sm text-zinc-500">
            Click <strong className="text-zinc-900 font-semibold">Generate Report</strong> to snapshot current warehouse inventory.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={6} />
        </div>
      )}

      {fetched && !loading && (
        <div className="flex flex-col gap-6 fade-in">
          <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
              <div className="p-4 sm:p-5">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Materials</div>
                <div className="text-2xl font-bold text-zinc-900 tabular-nums font-mono">{stats.total}</div>
                <div className="text-xs text-zinc-400 mt-1">active items tracked</div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">In Stock (Usable)</div>
                <div className="text-2xl font-bold text-emerald-700 tabular-nums font-mono">{stats.healthy}</div>
                <div className="text-xs text-zinc-400 mt-1">above safe reserve</div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Low / Critical</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-amber-600 tabular-nums font-mono">{stats.warning + stats.critical}</div>
                  <div className="text-xs text-zinc-400">({stats.warning} low, {stats.critical} critical)</div>
                </div>
                <div className="text-xs text-zinc-400 mt-1">requires reorder</div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Out of Usable Stock</div>
                <div className="text-2xl font-bold text-red-600 tabular-nums font-mono">{stats.out}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {stats.withExpired > 0 ? `${stats.withExpired} item(s) have expired stock` : 'immediate action needed'}
                </div>
              </div>
            </div>

            {stats.total > 0 && (
              <div className="p-4 bg-zinc-50/50 border-t border-zinc-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Usable Health Distribution</span>
                </div>
                <HealthBar stats={stats} />
              </div>
            )}
          </div>

          {priorityList.length > 0 && (
            <div className="bg-white border border-red-200 shadow-2xs rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
                <h2 className="m-0 text-sm sm:text-base font-bold text-red-800 tracking-tight flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Priority Restock Attention Required ({priorityList.length} items)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-red-50/30 border-b border-red-100 text-red-700 uppercase text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-4">Ingredient</th>
                      <th className="py-3 px-4">Usable Stock</th>
                      <th className="py-3 px-4">Alert Level</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4 min-w-[140px]">Capacity</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100/60">
                    {priorityList.map((ing) => {
                      const usable = getUsableStock(ing);
                      const expired = Number(ing.expired_stock) || 0;
                      const s = getStatus(usable, ing.low_stock_alert);
                      const pct = getStockPct(usable, ing.low_stock_alert);
                      return (
                        <tr key={ing.id} className="hover:bg-red-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-zinc-900">{ing.name}</td>
                          <td className="py-3.5 px-4 font-bold font-mono text-zinc-900">
                            <div>{usable}</div>
                            {expired > 0 && (
                              <span className="text-[10px] font-bold text-red-600">
                                +{expired} expired
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-zinc-500">{ing.low_stock_alert}</td>
                          <td className="py-3.5 px-4 text-zinc-500 font-mono text-xs">{ing.unit}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: s === 'out' || s === 'critical' ? '#dc2626' : '#ea580c'
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-zinc-600 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                                s === 'out' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
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
          )}

          <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="m-0 text-base font-bold text-zinc-900 tracking-tight">Full Material Status ({filtered.length} items)</h2>
            </div>
            <div className="overflow-x-auto">
              {filtered.length > 0 ? (
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 uppercase text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none" onClick={() => handleSort('name')}>
                        Ingredient {arrow('name')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none" onClick={() => handleSort('usable_stock')}>
                        Usable Stock {arrow('usable_stock')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none" onClick={() => handleSort('low_stock_alert')}>
                        Alert Level {arrow('low_stock_alert')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-zinc-900 select-none" onClick={() => handleSort('nearest_expiry_date')}>
                        Nearest Expiry {arrow('nearest_expiry_date')}
                      </th>
                      <th className="py-3 px-4 min-w-[140px]">Capacity</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {paginated.map((ing) => {
                      const usable = getUsableStock(ing);
                      const expired = Number(ing.expired_stock) || 0;
                      const s = getStatus(usable, ing.low_stock_alert);
                      const pct = getStockPct(usable, ing.low_stock_alert);
                      const expMeta = formatExpiryMeta(ing.nearest_expiry_date, todayManila);
                      return (
                        <tr key={ing.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-zinc-900">{ing.name}</td>
                          <td className="py-3.5 px-4 font-bold font-mono text-zinc-900">
                            <div>
                              {usable} <span className="text-zinc-500 text-xs font-normal">{ing.unit}</span>
                            </div>
                            {expired > 0 && (
                              <span className="inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                Expired: {expired} {ing.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-zinc-500">
                            {ing.low_stock_alert} <span className="text-xs">{ing.unit}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${expMeta.cls}`}>
                              {expMeta.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: s === 'out' || s === 'critical' ? '#dc2626' : s === 'warning' ? '#ea580c' : '#10b981'
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-zinc-600 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                                s === 'out'
                                  ? 'bg-zinc-900 text-white border-zinc-900'
                                  : s === 'critical'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : s === 'warning'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {getStatusLabel(s)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-zinc-400 font-medium">No materials match your filters.</div>
              )}
            </div>

            {filtered.length > 0 && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryStatusReport;