import React, { useState, useEffect } from 'react';
import { getIngredients } from '../../api/inventoryApi';
import { formatQuantity } from '../../utils/productUtils';

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

const RawMaterialTracker = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');

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
    const status = getStockStatus(ing.stock_quantity, ing.low_stock_alert);
    const matchSearch = (ing.name || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchStatus =
      stockFilter === 'ALL' ? true :
      status === stockFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const stats = {
    total: ingredients.length,
    out: ingredients.filter(i => getStockStatus(i.stock_quantity, i.low_stock_alert) === 'out').length,
    low: ingredients.filter(i => getStockStatus(i.stock_quantity, i.low_stock_alert) === 'low').length,
    healthy: ingredients.filter(i => getStockStatus(i.stock_quantity, i.low_stock_alert) === 'normal').length,
  };

  const groupedIngredients = STATUS_GROUPS.map(group => {
    const items = filteredIngredients
      .filter(ing => getStockStatus(ing.stock_quantity, ing.low_stock_alert) === group.id)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    return {
      ...group,
      items
    };
  }).filter(group => group.items.length > 0);

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Raw Material Tracker</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Monitor your ingredient stock levels in real-time.</p>
        </div>
        <button 
          className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors shadow-sm disabled:bg-gray-100 disabled:text-gray-400"
          onClick={fetchIngredients} 
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Ingredients</div>
          <div className="text-2xl font-extrabold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Out of Stock</div>
          <div className="text-2xl font-extrabold text-red-700">{stats.out}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Low Stock / Restock Needed</div>
          <div className="text-2xl font-extrabold text-amber-700">{stats.low}</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">In Stock</div>
          <div className="text-2xl font-extrabold text-green-700">{stats.healthy}</div>
        </div>
      </div>

      {/* ---- Main Table Card ---- */}
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
            <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
          ) : groupedIngredients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Current Stock</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Alert Level</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Level</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedIngredients.map(group => (
                    <React.Fragment key={group.id}>
                      <tr className={`${group.headerBg} border-y`}>
                        <td colSpan={5} className="px-6 py-2.5">
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
                        const pct = getStockPercent(ing.stock_quantity, ing.low_stock_alert);

                        return (
                          <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{ing.name}</strong></td>
                            <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">{formatQuantity(ing.stock_quantity, ing.unit)}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{formatQuantity(ing.low_stock_alert, ing.unit)}</td>
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
                          </tr>
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
        </div>
      </div>
    </div>
  );
};

export default RawMaterialTracker;
