import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getLowStockAlerts, getExpiryAlerts } from '../../api/inventoryApi';
import { reportWastage } from '../../api/wastageApi';
import { getCurrentUser } from '../../api/authApi';
import { formatQuantity, formatNum } from '../../utils/productUtils';
import { getManilaDateOnly } from '../../utils/dateUtils';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import Pagination from '../../components/shared/Pagination';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { SortIcon } from '../analytics/components/ForecastBadges';

const getUsableStock = (alert) => {
  if (alert && alert.usable_stock !== undefined && alert.usable_stock !== null) {
    return Number(alert.usable_stock) || 0;
  }
  return Number(alert?.stock_quantity) || 0;
};

const getAlertLevel = (a) => Math.round((Number(a?.low_stock_threshold ?? a?.low_stock_alert) || 0) * 100) / 100;

const SEVERITY_RANK = { critical: 0, warning: 1, low: 2 };

const formatExpiryBadge = (expiryDate, todayManila) => {
  if (!expiryDate) return { label: 'No Expiry', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  const expStr = String(expiryDate).slice(0, 10);
  const diffDays = Math.round(
    (new Date(`${expStr}T00:00:00Z`) - new Date(`${todayManila}T00:00:00Z`)) / 86400000
  );
  // Same stages and colours as the Expiration tab, so one batch never reads two different ways.
  if (diffDays <= 14) {
    const stage = stageOf(diffDays);
    return { label: `${stageLabel(stage, diffDays)} (${expStr})`, cls: EXPIRY_STAGES[stage].cls };
  }
  return { label: `${expStr} (${diffDays}d)`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

// Expiry stages shown on the Expiration tab, most urgent first.
const EXPIRY_STAGES = {
  DISPOSE: { chip: 'Expired 8d+', cls: 'bg-red-600 text-white border-red-700', action: 'Dispose now' },
  EXPIRED: { chip: 'Expired 1-7d', cls: 'bg-red-50 text-red-700 border-red-200', action: 'Write off' },
  CRITICAL: { chip: 'Use today (0-2d)', cls: 'bg-orange-50 text-orange-800 border-orange-300', action: 'Use first (FEFO)' },
  WARNING: { chip: 'Use first (3-6d)', cls: 'bg-amber-50 text-amber-800 border-amber-200', action: 'Use first (FEFO)' },
  WATCH: { chip: 'Watch (7-14d)', cls: 'bg-sky-50 text-sky-800 border-sky-200', action: 'Monitor' },
};
const STAGE_KEYS = Object.keys(EXPIRY_STAGES);

const stageOf = (days) => {
  if (days < 0) return days < -7 ? 'DISPOSE' : 'EXPIRED';
  if (days <= 2) return 'CRITICAL';
  if (days <= 6) return 'WARNING';
  return 'WATCH';
};

const stageLabel = (stage, days) => {
  if (stage === 'DISPOSE' || stage === 'EXPIRED') return `EXPIRED ${Math.abs(days)}D AGO`;
  if (days === 0) return 'EXPIRES TODAY';
  return `${stage === 'WATCH' ? 'WATCH' : 'USE FIRST'} · ${days}D LEFT`;
};

const LowStockAlerts = () => {
  const [activeTab, setActiveTab] = useState('LOW_STOCK'); // 'LOW_STOCK' | 'EXPIRATION'
  const [alerts, setAlerts] = useState([]);
  const [expiryData, setExpiryData] = useState({ expiredBatches: [], expiringSoonBatches: [], watchBatches: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState({ key: 'severity', dir: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [writeOffTarget, setWriteOffTarget] = useState(null);
  const [writingOff, setWritingOff] = useState(false);
  const [stageFilter, setStageFilter] = useState('ALL'); // 'ALL' or a key of EXPIRY_STAGES
  const [notice, setNotice] = useState({ type: '', text: '' });
  const todayManila = getManilaDateOnly();

  const fetchAlerts = useCallback(async () => {
    try {
      const [lowStock, expiry] = await Promise.all([
        getLowStockAlerts(),
        getExpiryAlerts().catch(() => ({ expiredBatches: [], expiringSoonBatches: [] }))
      ]);
      setAlerts(lowStock || []);
      setExpiryData({
        expiredBatches: Array.isArray(expiry?.expiredBatches) ? expiry.expiredBatches : [],
        expiringSoonBatches: Array.isArray(expiry?.expiringSoonBatches) ? expiry.expiringSoonBatches : [],
        watchBatches: Array.isArray(expiry?.watchBatches) ? expiry.watchBatches : []
      });
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleConfirmWriteOff = async () => {
    if (!writeOffTarget) return;
    const qty = Number(writeOffTarget.quantity_remaining) || 0;
    if (qty <= 0) {
      setWriteOffTarget(null);
      return;
    }

    try {
      setWritingOff(true);
      const currentUser = getCurrentUser();
      await reportWastage({
        ingredient_id: writeOffTarget.ingredient_id,
        batch_id: writeOffTarget.id,
        quantity: qty,
        reason: 'Expiry',
        reported_by: currentUser?.id
      });
      setNotice({
        type: 'success',
        text: `Disposed expired batch ${writeOffTarget.batch_code} (${formatQuantity(qty, writeOffTarget.unit)} of ${writeOffTarget.ingredient_name}) and logged to Wastage.`
      });
      setWriteOffTarget(null);
      await fetchAlerts();
      setTimeout(() => setNotice({ type: '', text: '' }), 5000);
    } catch (err) {
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to write off expired batch.'
      });
      setWriteOffTarget(null);
    } finally {
      setWritingOff(false);
    }
  };

  const getSeverity = (current, alert_level) => {
    if (current <= 0) return 'critical';
    if (current <= alert_level * 0.5) return 'critical';
    if (current <= alert_level) return 'warning';
    return 'low';
  };

  const filteredAlerts = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    const rows = alerts.filter((a) => (a.name || '').toLowerCase().includes(q));
    const sev = (a) => SEVERITY_RANK[a?.alert === 'CANNOT_MAKE' ? 'critical' : getSeverity(getUsableStock(a), getAlertLevel(a))];
    const value = {
      name: (a) => (a.name || '').toLowerCase(),
      usable: getUsableStock,
      level: getAlertLevel,
      expiry: (a) => a.nearest_expiry_date || '9999-12-31',
      shortage: (a) => Math.max(0, getAlertLevel(a) - getUsableStock(a)),
      severity: sev
    }[sort.key];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir || (a.name || '').localeCompare(b.name || '');
    });
  }, [alerts, searchTerm, sort]);

  const toggleSort = (key) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const searchedExpiryBatches = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    return [...(expiryData.expiredBatches || []), ...(expiryData.expiringSoonBatches || []), ...(expiryData.watchBatches || [])]
      .map((b) => ({ ...b, _stage: stageOf(Number(b.days_until_expiry)) }))
      .filter(
        (b) =>
          !q ||
          (b.ingredient_name || '').toLowerCase().includes(q) ||
          (b.batch_code || '').toLowerCase().includes(q)
      );
  }, [expiryData, searchTerm]);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGE_KEYS.map((k) => [k, 0]));
    searchedExpiryBatches.forEach((b) => { counts[b._stage] += 1; });
    return counts;
  }, [searchedExpiryBatches]);

  const combinedExpiryBatches = useMemo(
    () => (stageFilter === 'ALL' ? searchedExpiryBatches : searchedExpiryBatches.filter((b) => b._stage === stageFilter)),
    [searchedExpiryBatches, stageFilter]
  );

  const activeRows = activeTab === 'LOW_STOCK' ? filteredAlerts : combinedExpiryBatches;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeRows.slice(start, start + itemsPerPage);
  }, [activeRows, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, stageFilter]);

  const alertSeverity = (a) => (a?.alert === 'CANNOT_MAKE' ? 'critical' : getSeverity(getUsableStock(a), getAlertLevel(a)));
  const getCriticalCount = () => alerts.filter((a) => alertSeverity(a) === 'critical').length;
  const getWarningCount = () => alerts.filter((a) => alertSeverity(a) === 'warning').length;
  const expiredCount = expiryData.expiredBatches?.length || 0;
  const expiringSoonCount = expiryData.expiringSoonBatches?.length || 0;

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Low-Stock &amp; Expiration Alerts</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Monitor low usable inventory and expiring or expired batches.</p>
        </div>
        <div className="inline-flex bg-white p-1 rounded-xl border border-gray-200 shadow-xs gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('LOW_STOCK')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'LOW_STOCK' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>Low Usable Stock</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeTab === 'LOW_STOCK' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {alerts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EXPIRATION')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'EXPIRATION' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>Expiration Alerts</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeTab === 'EXPIRATION'
                  ? 'bg-white/20 text-white'
                  : expiredCount + expiringSoonCount > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {expiredCount + expiringSoonCount}
            </span>
          </button>
        </div>
      </div>

      {notice.text && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`p-4 mb-6 rounded-xl text-sm font-bold flex items-center justify-between border shadow-xs ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice({ type: '', text: '' })}
            className="text-xs font-bold uppercase opacity-75 hover:opacity-100 cursor-pointer bg-transparent border-none ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'LOW_STOCK' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Low Usable Stock</div>
              <div className="text-2xl font-bold text-gray-900">{alerts.length}</div>
            </div>
            <div className="bg-white border border-red-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2">Critical Alert</div>
              <div className="text-2xl font-bold text-red-700">{getCriticalCount()}</div>
            </div>
            <div className="bg-white border border-orange-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider mb-2">Warning Level</div>
              <div className="text-2xl font-bold text-orange-700">{getWarningCount()}</div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="p-4 mb-8 bg-orange-50 text-orange-800 border border-orange-200 rounded-xl text-sm font-bold flex items-center shadow-sm">
              {alerts.length} item(s) have usable non-expired stock at or below threshold
            </div>
          )}

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Low Usable Stock Items</h2>
              <div className="flex w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="p-0">
              {loading ? (
                <TableSkeleton rows={6} cols={5} />
              ) : paginatedRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 shadow-[1px_0_0_0_#e5e7eb]">
                          <button type="button" onClick={() => toggleSort('name')} className="group inline-flex items-center gap-1 uppercase font-bold tracking-wider cursor-pointer bg-transparent border-none p-0">
                            Ingredient<SortIcon active={sort.key === 'name'} direction={sort.dir} />
                          </button>
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                          <button type="button" onClick={() => toggleSort('usable')} className="group inline-flex items-center gap-1 uppercase font-bold tracking-wider cursor-pointer justify-end bg-transparent border-none p-0">
                            Usable Stock<SortIcon active={sort.key === 'usable'} direction={sort.dir} />
                          </button>
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                          <button type="button" onClick={() => toggleSort('level')} className="group inline-flex items-center gap-1 uppercase font-bold tracking-wider cursor-pointer justify-end bg-transparent border-none p-0">
                            Alert Level<SortIcon active={sort.key === 'level'} direction={sort.dir} />
                          </button>
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <button type="button" onClick={() => toggleSort('expiry')} className="group inline-flex items-center gap-1 uppercase font-bold tracking-wider cursor-pointer bg-transparent border-none p-0">
                            Nearest Expiry<SortIcon active={sort.key === 'expiry'} direction={sort.dir} />
                          </button>
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                          <button type="button" onClick={() => toggleSort('shortage')} className="group inline-flex items-center gap-1 uppercase font-bold tracking-wider cursor-pointer justify-end bg-transparent border-none p-0">
                            Shortage<SortIcon active={sort.key === 'shortage'} direction={sort.dir} />
                          </button>
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <button type="button" onClick={() => toggleSort('severity')} className="group inline-flex items-center gap-1 uppercase font-bold tracking-wider cursor-pointer bg-transparent border-none p-0">
                            Severity<SortIcon active={sort.key === 'severity'} direction={sort.dir} />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRows.map((alert) => {
                        const usable = getUsableStock(alert);
                        const expired = Number(alert.expired_stock) || 0;
                        const level = getAlertLevel(alert);
                        const shortage = Math.max(0, level - usable);
                        const severity = alertSeverity(alert);
                        const blocked = Array.isArray(alert.blocked_products) ? alert.blocked_products : [];
                        const first = blocked[0];
                        const expBadge = formatExpiryBadge(alert.nearest_expiry_date, todayManila);

                        return (
                          <tr key={alert.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-6 py-4 sticky left-0 z-10 bg-white group-hover:bg-gray-50 transition-colors shadow-[1px_0_0_0_#f3f4f6]">
                              <strong className="text-sm font-bold text-gray-900">{alert.name}</strong>
                              {alert.alert === 'CANNOT_MAKE' && (
                                <div className="text-[11px] font-bold text-red-600 mt-0.5">
                                  {first
                                    ? `Can't make: needs ${formatQuantity(first.needs, alert.unit)} for ${first.name}${blocked.length > 1 ? ` +${blocked.length - 1} more` : ''}`
                                    : "Can't make a full serving"}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 font-medium">{alert.unit}</td>
                            <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">
                              <div>{formatNum(usable)}</div>
                              {expired > 0 && (
                                <div className="text-[11px] font-semibold text-red-600 mt-0.5">
                                  Excludes {formatQuantity(expired, alert.unit)} expired
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{level}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${expBadge.cls}`}>
                                {expBadge.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">
                              {shortage > 0 ? `-${Math.round(shortage * 100) / 100}` : '—'}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  severity === 'critical'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : severity === 'warning'
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                }`}
                              >
                                {severity === 'critical' ? 'CRITICAL' : severity === 'warning' ? 'WARNING' : 'LOW'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-green-600 bg-green-50/50">
                  <svg className="w-12 h-12 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="m-0 text-sm font-bold">All ingredients are at healthy usable stock levels!</p>
                </div>
              )}

              {!loading && filteredAlerts.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredAlerts.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                  }}
                  itemsPerPageOptions={[10, 20, 50]}
                />
              )}
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Recommended Actions</h2>
              </div>
              <div className="p-6">
                <ul className="m-0 p-0 list-none space-y-3">
                  {getCriticalCount() > 0 && (
                    <li className="text-sm font-bold text-red-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-600"></span> ORDER IMMEDIATELY: {getCriticalCount()} item(s) at critical usable stock level
                    </li>
                  )}
                  {getWarningCount() > 0 && (
                    <li className="text-sm font-bold text-orange-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-600"></span> PLAN ORDER: {getWarningCount()} item(s) approaching critical level
                    </li>
                  )}
                  {alerts.length > 2 && (
                    <li className="text-sm font-medium text-blue-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span> Consider increasing order frequency
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-red-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2">Expired Batches</div>
              <div className="text-2xl font-bold text-red-700">{expiredCount}</div>
            </div>
            <div className="bg-white border border-amber-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-2">Expiring Within 7 Days</div>
              <div className="text-2xl font-bold text-amber-700">{expiringSoonCount}</div>
            </div>
            <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Flagged Batches</div>
              <div className="text-2xl font-bold text-gray-900">{expiredCount + expiringSoonCount}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Expired &amp; Expiring Batches</h2>
              <div className="flex w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search ingredient or batch code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-1.5">
              {['ALL', ...STAGE_KEYS].map((k) => {
                const count = k === 'ALL' ? searchedExpiryBatches.length : stageCounts[k];
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={stageFilter === k}
                    onClick={() => setStageFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      stageFilter === k ? 'bg-zinc-900 text-white shadow-2xs' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                    }`}
                  >
                    {k === 'ALL' ? 'All' : EXPIRY_STAGES[k].chip} ({count})
                  </button>
                );
              })}
            </div>

            <div className="p-0">
              {loading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : paginatedRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Code</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Remaining Qty</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry Date</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRows.map((batch, idx) => {
                        const stage = batch._stage;
                        const isExpired = stage === 'DISPOSE' || stage === 'EXPIRED';
                        const days = Number(batch.days_until_expiry);
                        return (
                          <tr key={batch.id || batch.batch_code || idx} className={`transition-colors ${isExpired ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-gray-50/50'}`}>
                            <td className="px-6 py-4 font-mono text-sm font-bold text-gray-900">{batch.batch_code}</td>
                            <td className="px-6 py-4">
                              <strong className="text-sm font-bold text-gray-900">{batch.ingredient_name}</strong>
                              {batch.category && <div className="text-[11px] text-gray-500 font-medium">{batch.category}</div>}
                            </td>
                            <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right tabular-nums">
                              {formatQuantity(batch.quantity_remaining, batch.unit)}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-700">{batch.expiry_date || '—'}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${EXPIRY_STAGES[stage].cls}`}>
                                {stageLabel(stage, days)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {isExpired ? (
                                <button
                                  type="button"
                                  onClick={() => setWriteOffTarget(batch)}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                                >
                                  {stage === 'DISPOSE' ? 'Dispose now' : 'Write Off'}
                                </button>
                              ) : (
                                <span className={`text-xs font-semibold ${stage === 'WATCH' ? 'text-sky-700' : 'text-amber-700'}`}>{EXPIRY_STAGES[stage].action}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-green-600 bg-green-50/50">
                  <svg className="w-12 h-12 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="m-0 text-sm font-bold">No expired or expiring-soon batches found!</p>
                </div>
              )}

              {!loading && combinedExpiryBatches.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={combinedExpiryBatches.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                  }}
                  itemsPerPageOptions={[10, 20, 50]}
                />
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={Boolean(writeOffTarget)}
        title="Write Off Expired Batch?"
        message={
          writeOffTarget
            ? `Dispose of ${formatQuantity(writeOffTarget.quantity_remaining, writeOffTarget.unit)} of "${writeOffTarget.ingredient_name}" (Batch ${writeOffTarget.batch_code}) and log it as Expiry wastage?`
            : ''
        }
        confirmText="Yes, Write Off"
        cancelText="Cancel"
        confirmColor="danger"
        isLoading={writingOff}
        onConfirm={handleConfirmWriteOff}
        onCancel={() => setWriteOffTarget(null)}
      />
    </div>
  );
};

export default LowStockAlerts;