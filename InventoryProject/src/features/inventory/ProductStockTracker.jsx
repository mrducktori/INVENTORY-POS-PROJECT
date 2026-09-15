import React, { useState, useEffect } from 'react';
import { getAllProducts } from '../../api/productsApi';



const ProductStockTracker = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      // Only show products that have direct stock tracking enabled and are not archived
      setProducts((data || []).filter(p => p.track_stock && !p.is_archived));
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (current, threshold) => {
    if (current <= 0) return 'out';
    if (current <= threshold) return 'critical';
    if (current <= threshold * 1.5) return 'warning';
    return 'normal';
  };

  const getStatusLabel = (status) => {
    if (status === 'out') return 'Out of Stock';
    if (status === 'critical') return 'Restock Needed';
    if (status === 'warning') return 'Low Stock';
    return 'In Stock';
  };

  const getStockPercent = (current, threshold) => {
    if (!threshold || threshold === 0) return 100;
    return Math.min(Math.round((current / (threshold * 2)) * 100), 100);
  };

  const filteredProducts = products.filter(p => {
    const status = getStockStatus(p.stock_quantity, p.low_stock_threshold);
    const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      stockFilter === 'ALL' ? true :
      stockFilter === 'HEALTHY' ? status === 'normal' :
      status.toUpperCase() === stockFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: products.length,
    out: products.filter(p => p.stock_quantity <= 0).length,
    critical: products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length,
    warning: products.filter(p => p.stock_quantity > p.low_stock_threshold && p.stock_quantity <= p.low_stock_threshold * 1.5).length,
    healthy: products.filter(p => p.stock_quantity > p.low_stock_threshold * 1.5).length,
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Product Stock Tracker</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Real-time stock levels for pastries, bottled drinks, and other direct-track items.</p>
        </div>
        <button 
          className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors shadow-sm disabled:bg-gray-100 disabled:text-gray-400"
          onClick={fetchProducts} 
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tracked Products</div>
          <div className="text-2xl font-extrabold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Out of Stock</div>
          <div className="text-2xl font-extrabold text-red-700">{stats.out}</div>
        </div>
        <div className="bg-red-50 border border-red-100 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Restock Needed</div>
          <div className="text-2xl font-extrabold text-red-600">{stats.critical}</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Low Stock</div>
          <div className="text-2xl font-extrabold text-amber-600">{stats.warning}</div>
        </div>
        <div className="bg-green-50 border border-green-100 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
          <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">In Stock</div>
          <div className="text-2xl font-extrabold text-green-600">{stats.healthy}</div>
        </div>
      </div>

      {/* ---- Main Table Card ---- */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Product Stock Levels</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search products..."
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="OUT">Out of Stock Only</option>
              <option value="CRITICAL">Restock Needed Only</option>
              <option value="WARNING">Low Stock Only</option>
              <option value="HEALTHY">In Stock Only</option>
            </select>
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
          ) : filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Stock Qty</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Alert at</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Level</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(p => {
                    const status = getStockStatus(p.stock_quantity, p.low_stock_threshold);
                    const pct = getStockPercent(p.stock_quantity, p.low_stock_threshold);

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{p.name}</strong></td>
                        <td className="px-6 py-4"><span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{p.category}</span></td>
                        <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">{p.stock_quantity} pcs</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{p.low_stock_threshold} pcs</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  status === 'out' ? 'bg-red-600' :
                                  status === 'critical' ? 'bg-red-500' :
                                  status === 'warning' ? 'bg-orange-500' : 'bg-green-500'
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
                            status === 'critical' ? 'bg-red-50 text-red-600 border border-red-100' :
                            status === 'warning' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {getStatusLabel(status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <p className="m-0 text-sm font-medium">No products match your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductStockTracker;
