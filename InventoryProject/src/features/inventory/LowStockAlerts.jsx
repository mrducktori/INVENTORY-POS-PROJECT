import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getLowStockAlerts, getExpiryAlerts } from '../../api/inventoryApi';
import { formatQuantity } from '../../utils/productUtils';
import { getManilaDateOnly } from '../../utils/dateUtils';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import Pagination from '../../components/shared/Pagination';

const getUsableStock = (alert) => {
  if (alert && alert.usable_stock !== undefined && alert.usable_stock !== null) {
    return Number(alert.usable_stock) || 0;
  }
  return Number(alert?.stock_quantity) || 0;
};

const formatExpiryBadge = (expiryDate, todayManila) => {
  if (!expiryDate) return { label: 'No Expiry', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  const expStr = String(expiryDate).slice(0, 10);
  const diffDays = Math.round(
    (new Date(`${expStr}T00:00:00Z`) - new Date(`${todayManila}T00:00:00Z`)) / 86400000
  );
  if (diffDays < 0) return { label: `Expired (${expStr})`, cls: 'bg-red-50 text-red-700 border-red-200' };
  if (diffDays === 0) return { label: `Expires today (${expStr})`, cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  if (diffDays <= 7) return { label: `Expiring in ${diffDays}d (${expStr})`, cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: `${expStr} (${diffDays}d)`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

const LowStockAlerts = () => {
  const [activeTab, setActiveTab] = useState('LOW_STOCK'); // 'LOW_STOCK' | 'EXPIRATION'
  const [alerts, setAlerts] = useState([]);
  const [expiryData, setExpiryData] = useState({ expiredBatches: [], expiringSoonBatches: [] });
  const [loading, setLoading] = useState(true); // first load only; polls refresh silently
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
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
        expiringSoonBatches: Array.isArray(expiry?.expiringSoonBatches) ? expiry.expiringSoonBatches : []
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

  const getSeverity = (current, alert_level) => {
    if (current <= 0) return 'critical';
    if (current <= alert_level * 0.5) return 'critical';
    if (current <= alert_level) return 'warning';
    return 'low';
  };

  const filteredAlerts = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    return alerts.filter(a => (a.name || '').toLowerCase().includes(q));
  }, [alerts, searchTerm]);

  const combinedExpiryBatches = useMemo(() => {
    const expired = (expiryData.expiredBatches || []).map(b => ({ ...b, _group: 'EXPIRED' }));
    const expiring = (expiryData.expiringSoonBatches || []).map(b => ({ ...b, _group: 'EXPIRING_SOON' }));
    const q = (searchTerm || '').trim().toLowerCase();
    return [...expired, ...expiring].filter(b =>
      !q ||
      (b.ingredient_name || '').toLowerCase().includes(q) ||
      (b.batch_code || '').toLowerCase().includes(q)
    );
  }, [expiryData, searchTerm]);

  const activeRows = activeTab === 'LOW_STOCK' ? filteredAlerts : combinedExpiryBatches;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeRows.slice(start, start + itemsPerPage);
  }, [activeRows, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  const getCriticalCount = () => alerts.filter(a => getSeverity(getUsableStock(a), a.low_stock_alert) === 'critical').length;
  const getWarningCount = () => alerts.filter(a => getSeverity(getUsableStock(a), a.low_stock_alert) === 'warning').length;
  const expiredCount = expiryData.expiredBatches?.length || 0;
  const expiringSoonCount = expiryData.expiringSoonBatches?.length || 0;

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Low-Stock & Expiration Alerts</h1>
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              activeTab === 'LOW_STOCK' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              activeTab === 'EXPIRATION'
                ? 'bg-white/20 text-white'
                : (expiredCount + expiringSoonCount) > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
            }`}>
              {expiredCount + expiringSoonCount}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'LOW_STOCK' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Low Usable Stock</div>
              <div className="text-3xl font-extrabold text-gray-900">{alerts.length}</div>
            </div>
            <div className="bg-white border border-red-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2">Critical Alert</div>
              <div className="text-3xl font-extrabold text-red-700">{getCriticalCount()}</div>
            </div>
            <div className="bg-white border border-orange-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider mb-2">Warning Level</div>
              <div className="text-3xl font-extrabold text-orange-700">{getWarningCount()}</div>
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
                  onChange={e => setSearchTerm(e.target.value)}
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
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 shadow-[1px_0_0_0_#e5e7eb]">Ingredient</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Usable Stock</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Alert Level</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nearest Expiry</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Shortage</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRows.map(alert => {
                        const usable = getUsableStock(alert);
                        const expired = Number(alert.expired_stock) || 0;
                        const shortage = Math.max(0, (Number(alert.low_stock_alert) || 0) - usable);
                        const severity = getSeverity(usable, alert.low_stock_alert);
                        const expBadge = formatExpiryBadge(alert.nearest_expiry_date, todayManila);

                        return (
                          <tr key={alert.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-6 py-4 sticky left-0 z-10 bg-white group-hover:bg-gray-50 transition-colors shadow-[1px_0_0_0_#f3f4f6]">
                              <strong className="text-sm font-bold text-gray-900">{alert.name}</strong>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 font-medium">{alert.unit}</td>
                            <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">
                              <div>{usable}</div>
                              {expired > 0 && (
                                <div className="text-[11px] font-semibold text-red-600 mt-0.5">
                                  Excludes {formatQuantity(expired, alert.unit)} expired
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{alert.low_stock_alert}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${expBadge.cls}`}>
                                {expBadge.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">
                              -{shortage.toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                severity === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                                severity === 'warning' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              }`}>
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
                  <svg className="w-12 h-12 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
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
              <div className="text-3xl font-extrabold text-red-700">{expiredCount}</div>
            </div>
            <div className="bg-white border border-amber-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-2">Expiring Within 7 Days</div>
              <div className="text-3xl font-extrabold text-amber-700">{expiringSoonCount}</div>
            </div>
            <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Flagged Batches</div>
              <div className="text-3xl font-extrabold text-gray-900">{expiredCount + expiringSoonCount}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Expired & Expiring-Soon Batches</h2>
              <div className="flex w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search ingredient or batch code..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
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
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Code</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Remaining Qty</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry Date</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRows.map((batch, idx) => {
                        const isExpired = batch._group === 'EXPIRED' || batch.expiry_status === 'EXPIRED';
                        const days = batch.days_until_expiry;
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
                              {isExpired ? (
                                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                  EXPIRED
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                                  {days === 0 ? 'EXPIRING TODAY' : `EXPIRING IN ${days}D`}
                                </span>
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
                  <svg className="w-12 h-12 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
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
    </div>
  );
};

export default LowStockAlerts;
