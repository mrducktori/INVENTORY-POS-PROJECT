import React, { useState, useEffect, useMemo } from 'react';
import { getIngredients } from '../../api/inventoryApi';
import { formatQuantity } from '../../utils/productUtils';
import { getManilaDateOnly } from '../../utils/dateUtils';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import Pagination from '../../components/shared/Pagination';
import { getCurrentUser } from '../../api/authApi';
import { canStocktake } from '../../utils/permissions';
import RawMaterialStocktakeSection from './components/RawMaterialStocktakeSection';
import ExpiryLevelBadge from './components/ExpiryLevelBadge';

const BATCH_SOURCE_LABELS = {
  PURCHASE_ORDER: 'Purchase order',
  DIRECT_RECEIVE: 'Received directly',
  INITIAL_STOCK: 'Opening stock (no prior record)',
  STOCKTAKE_ADJUSTMENT: 'Stock count adjustment',
  VOID_RESTOCK: 'Returned from voided sale',
};

const STATUS_GROUPS = [
  {
    id: 'out',
    label: 'Out of Stock',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    headerBg: 'bg-red-50/70 border-red-200',
    icon: (
      <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  {
    id: 'low',
    label: 'Low Stock / Restock Needed',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    headerBg: 'bg-amber-50/70 border-amber-200',
    icon: (
      <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'normal',
    label: 'In Stock',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-gray-100/70 border-gray-200',
    icon: (
      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
];

const getUsableStock = (ing) => {
  if (ing && ing.usable_stock !== undefined && ing.usable_stock !== null) {
    return Number(ing.usable_stock) || 0;
  }
  return Number(ing?.stock_quantity) || 0;
};

const getNearestExpiryMeta = (ing, todayManila) => {
  if (!ing?.nearest_expiry_date) {
    return {
      label: 'No Expiry',
      cls: 'bg-zinc-100 text-zinc-600 border-zinc-200',
      sub: null
    };
  }
  const expStr = String(ing.nearest_expiry_date).slice(0, 10);
  const diffDays = Math.round(
    (new Date(`${expStr}T00:00:00Z`) - new Date(`${todayManila}T00:00:00Z`)) / 86400000
  );
  if (diffDays < 0) {
    return { label: 'Expired', cls: 'bg-red-50 text-red-700 border-red-200', sub: expStr };
  }
  if (diffDays === 0) {
    return { label: 'Expires today', cls: 'bg-amber-50 text-amber-800 border-amber-200', sub: expStr };
  }
  if (diffDays <= 7) {
    return { label: `Expiring in ${diffDays}d`, cls: 'bg-amber-50 text-amber-800 border-amber-200', sub: expStr };
  }
  return { label: `${diffDays}d left`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', sub: expStr };
};

const RawMaterialTracker = ({ subTab = null, onSubTabChange = null }) => {
  const [localMode, setLocalMode] = useState('LIVE_STOCK'); // 'LIVE_STOCK' | 'STOCKTAKE'
  const isControlled = typeof onSubTabChange === 'function';
  const stocktakeAllowed = canStocktake(getCurrentUser());
  const rawMode = isControlled ? (subTab === 'STOCKTAKE' ? 'STOCKTAKE' : 'LIVE_STOCK') : localMode;
  const mode = stocktakeAllowed ? rawMode : 'LIVE_STOCK';
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [expandedIngredientId, setExpandedIngredientId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const todayManila = getManilaDateOnly();

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stockFilter]);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients((data || []).filter(i => !i.is_archived));
    } catch (err) {
      console.error('Error loading ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (current, alert_level) => {
    const qty = Number(current) || 0;
    const alert = Number(alert_level) || 0;
    if (qty <= 0) return 'out';
    if (alert > 0 && qty <= alert * 1.5) return 'low';
    return 'normal';
  };

  const getStatusLabel = (status) => {
    if (status === 'out') return 'Out of Stock';
    if (status === 'low') return 'Low Stock / Restock Needed';
    return 'In Stock';
  };

  const getStockPercent = (current, alert_level) => {
    const alert = Number(alert_level) || 0;
    if (!alert || alert <= 0) return 100;
    const currentNum = Number(current) || 0;
    return Math.min(Math.round((currentNum / (alert * 2)) * 100), 100);
  };

  const filteredIngredients = ingredients.filter(ing => {
    const status = getStockStatus(getUsableStock(ing), ing.low_stock_alert);
    const term = (searchTerm || '').trim().toLowerCase();
    const matchSearch = !term ||
      (ing.name || '').toLowerCase().includes(term) ||
      (ing.category || '').toLowerCase().includes(term);
    const matchStatus =
      stockFilter === 'ALL' ? true :
      status === stockFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const stats = {
    total: ingredients.length,
    out: ingredients.filter(i => getStockStatus(getUsableStock(i), i.low_stock_alert) === 'out').length,
    low: ingredients.filter(i => getStockStatus(getUsableStock(i), i.low_stock_alert) === 'low').length,
    healthy: ingredients.filter(i => getStockStatus(getUsableStock(i), i.low_stock_alert) === 'normal').length,
  };

  const sortedFiltered = useMemo(() => {
    const priority = { out: 0, low: 1, normal: 2 };
    return [...filteredIngredients].sort((a, b) => {
      const statusA = getStockStatus(getUsableStock(a), a.low_stock_alert);
      const statusB = getStockStatus(getUsableStock(b), b.low_stock_alert);
      if (priority[statusA] !== priority[statusB]) {
        return priority[statusA] - priority[statusB];
      }
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }, [filteredIngredients]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / itemsPerPage));
  const paginatedIngredients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedFiltered.slice(start, start + itemsPerPage);
  }, [sortedFiltered, currentPage, itemsPerPage]);

  const groupedIngredients = useMemo(() => {
    return STATUS_GROUPS.map(group => {
      const items = paginatedIngredients.filter(
        i => getStockStatus(getUsableStock(i), i.low_stock_alert) === group.id
      );
      return {
        ...group,
        items
      };
    }).filter(group => group.items.length > 0);
  }, [paginatedIngredients]);

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Raw Material Tracker</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Monitor usable ingredient stock, FEFO batches, and stock counts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-white p-1 rounded-xl border border-gray-200 shadow-xs gap-1">
            <button
              type="button"
              onClick={() => {
                setLocalMode('LIVE_STOCK');
                onSubTabChange?.(null);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === 'LIVE_STOCK' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Live Stock & Batches
            </button>
            {stocktakeAllowed && (
            <button
                type="button"
                onClick={() => {
                  setLocalMode('STOCKTAKE');
                  onSubTabChange?.('STOCKTAKE');
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  mode === 'STOCKTAKE' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Stock Count
              </button>
            )}
          </div>
          <button 
            className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors shadow-xs disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
            onClick={fetchIngredients} 
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {mode === 'STOCKTAKE' ? (
        <RawMaterialStocktakeSection
          ingredients={ingredients}
          onRefreshIngredients={fetchIngredients}
        />
      ) : (
        <>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Ingredients</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Out of Stock</div>
          <div className="text-2xl font-bold text-red-700">{stats.out}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Low Stock / Restock Needed</div>
          <div className="text-2xl font-bold text-amber-700">{stats.low}</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">In Stock</div>
          <div className="text-2xl font-bold text-green-700">{stats.healthy}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Ingredient Stock Levels</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search ingredients..."
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="w-full sm:w-56 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="OUT">Out of Stock Only</option>
              <option value="LOW">Low Stock / Restock Needed Only</option>
              <option value="NORMAL">In Stock Only</option>
            </select>
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-4 md:p-6">
              <TableSkeleton rows={8} cols={5} />
            </div>
          ) : groupedIngredients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 shadow-[1px_0_0_0_#e5e7eb]">Ingredient</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Usable Stock</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Alert Level</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nearest Expiry</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Level</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Batches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedIngredients.map(group => (
                    <React.Fragment key={group.id}>
                      <tr className={`${group.headerBg} border-y`}>
                        <td colSpan={7} className="px-6 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {group.icon}
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                                {group.label}
                              </span>
                            </div>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${group.badgeClass}`}>
                              {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.items.map(ing => {
                        const status = group.id;
                        const usableStock = getUsableStock(ing);
                        const expiredStock = Number(ing.expired_stock) || 0;
                        const pct = getStockPercent(usableStock, ing.low_stock_alert);
                        const expiryMeta = getNearestExpiryMeta(ing, todayManila);
                        const batches = Array.isArray(ing.batches) ? ing.batches : [];
                        const isExpanded = expandedIngredientId === ing.id;
                        const firstUsableIdx = batches.findIndex((b) => !b.is_expired);

                        return (
                          <React.Fragment key={ing.id}>
                            <tr className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-4 sticky left-0 z-10 bg-white group-hover:bg-gray-50 transition-colors shadow-[1px_0_0_0_#f3f4f6]">
                                <strong className="text-sm font-bold text-gray-900 block">{ing.name}</strong>
                                <span className="text-[11px] text-gray-500 font-medium">{ing.category || 'GENERAL'}</span>
                              </td>
                              <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">
                                <div>{formatQuantity(usableStock, ing.unit)}</div>
                                {expiredStock > 0 && (
                                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                    Expired: {formatQuantity(expiredStock, ing.unit)}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{formatQuantity(ing.low_stock_alert, ing.unit)}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${expiryMeta.cls}`}>
                                  {expiryMeta.label}
                                </span>
                                {expiryMeta.sub && (
                                  <div className="text-[11px] text-gray-500 font-medium mt-0.5">{expiryMeta.sub}</div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        status === 'out' ? 'bg-red-600' :
                                        status === 'low' ? 'bg-amber-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-gray-600 w-8">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  status === 'out' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  status === 'low' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
                                }`}>
                                  {getStatusLabel(status)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setExpandedIngredientId(isExpanded ? null : ing.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                    isExpanded
                                      ? 'bg-gray-900 text-white border-gray-900'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                  }`}
                                >
                                  <span>Batches ({batches.length})</span>
                                  <svg
                                    className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-zinc-50/90">
                                <td colSpan={7} className="px-6 py-4">
                                  <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden">
                                    <div className="px-4 py-2.5 bg-zinc-100/70 border-b border-zinc-200 flex items-center justify-between">
                                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                                        FEFO Batch Queue — {ing.name}
                                      </span>
                                      <span className="text-[11px] font-medium text-zinc-500">
                                        Earliest non-expired batch is deducted first during POS sales
                                      </span>
                                    </div>
                                    {batches.length === 0 ? (
                                      <div className="p-4 text-xs text-gray-500 font-medium">
                                        No active batches recorded for this material.
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                          <thead>
                                            <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                                              <th className="px-4 py-2">Batch Code</th>
                                              <th className="px-4 py-2">Source</th>
                                              <th className="px-4 py-2">Received</th>
                                              <th className="px-4 py-2">Expiry Date</th>
                                              <th className="px-4 py-2 text-right">Remaining Qty</th>
                                              <th className="px-4 py-2">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-100">
                                            {batches.map((b, bIdx) => {
                                              const isFefoFirst = bIdx === firstUsableIdx;
                                              const expStatus = b.expiry_status || (b.is_expired ? 'EXPIRED' : b.expiry_date ? 'FRESH' : 'NO_EXPIRY');
                                              return (
                                                <tr key={b.id || b.batch_code || bIdx} className={b.is_expired ? 'bg-red-50/30' : ''}>
                                                  <td className="px-4 py-2.5 font-mono font-bold text-zinc-900">
                                                    {b.batch_code}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-zinc-600 font-medium">
                                                    {BATCH_SOURCE_LABELS[b.source] || b.source || 'Batch'}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-zinc-600">
                                                    {b.received_at ? String(b.received_at).slice(0, 10) : '—'}
                                                  </td>
                                                  <td className="px-4 py-2.5 font-semibold text-zinc-800">
                                                    {b.expiry_date || 'No expiry'}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-right font-bold text-zinc-900 tabular-nums">
                                                    {formatQuantity(b.quantity_remaining, ing.unit)}
                                                  </td>
                                                  <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1.5">
                                                      {isFefoFirst && (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white">
                                                          FEFO #1
                                                        </span>
                                                      )}
                                                      {b.expiry_level && b.expiry_level !== 'NONE' && b.expiry_level !== 'OK' ? (
                                                        <ExpiryLevelBadge
                                                          level={b.expiry_level}
                                                          title={b.days_until_expiry != null ? `${b.days_until_expiry} day(s) left` : undefined}
                                                        />
                                                      ) : expStatus === 'EXPIRED' ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                                          Expired
                                                        </span>
                                                      ) : expStatus === 'EXPIRING_SOON' ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                                                          Expiring Soon{b.days_until_expiry != null ? ` (${b.days_until_expiry}d)` : ''}
                                                        </span>
                                                      ) : !isFefoFirst ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                          {b.expiry_date ? 'Fresh' : 'No Expiry'}
                                                        </span>
                                                      ) : null}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <p className="m-0 text-sm font-medium">No ingredients match your search.</p>
            </div>
          )}

          {!loading && sortedFiltered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedFiltered.length}
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

export default RawMaterialTracker;
