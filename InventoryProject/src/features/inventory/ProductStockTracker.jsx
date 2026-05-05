import React, { useState, useEffect } from 'react';
import { getAllProducts } from '../../api/productsApi';
import { formatQuantity } from '../../utils/productUtils';

import './RawMaterialTracker.css'; // Reuse same styles for consistency

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
    if (status === 'out') return 'OUT';
    if (status === 'critical') return 'CRITICAL';
    if (status === 'warning') return 'WARNING';
    return 'HEALTHY';
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
    <div className="inventory-container">
      <div className="page-header tracker-page-header">
        <div>
          <h1>Product Stock Tracker</h1>
          <p>Real-time stock levels for pastries, bottled drinks, and other direct-track items.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchProducts} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ---- Stats Row ---- */}
      <div className="tracker-stats-row">
        <div className="tracker-stat-card">
          <div className="tracker-stat-label">Tracked Products</div>
          <div className="tracker-stat-value">{stats.total}</div>
        </div>
        <div className="tracker-stat-card stat-out">
          <div className="tracker-stat-label">Out of Stock</div>
          <div className="tracker-stat-value">{stats.out}</div>
        </div>
        <div className="tracker-stat-card stat-critical">
          <div className="tracker-stat-label">Critical</div>
          <div className="tracker-stat-value">{stats.critical}</div>
        </div>
        <div className="tracker-stat-card stat-warning">
          <div className="tracker-stat-label">Warning</div>
          <div className="tracker-stat-value">{stats.warning}</div>
        </div>
        <div className="tracker-stat-card stat-healthy">
          <div className="tracker-stat-label">Healthy</div>
          <div className="tracker-stat-value">{stats.healthy}</div>
        </div>
      </div>

      {/* ---- Main Table Card ---- */}
      <div className="card">
        <div className="card-header manage-products-header">
          <h2>Product Stock Levels</h2>
          <div className="table-filters-container">
            <input
              type="text"
              placeholder="Search products..."
              className="filter-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="filter-select"
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="OUT">Out of Stock</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="WARNING">Warning Only</option>
              <option value="HEALTHY">Healthy Only</option>
            </select>
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading...</p>
          ) : filteredProducts.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Stock Qty</th>
                    <th style={{ textAlign: 'right' }}>Alert at</th>
                    <th>Stock Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const status = getStockStatus(p.stock_quantity, p.low_stock_threshold);
                    const pct = getStockPercent(p.stock_quantity, p.low_stock_threshold);

                    return (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td><small>{p.category}</small></td>
                        <td style={{ textAlign: 'right' }}>{p.stock_quantity} pcs</td>
                        <td style={{ textAlign: 'right' }}>{p.low_stock_threshold} pcs</td>
                        <td>
                          <div className="progress-track">
                            <div
                              className={`progress-fill bg-${status}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="progress-percentage">{pct}%</span>
                        </td>
                        <td>
                          <span className={`stock-badge ${status}`}>
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
            <div className="empty-state">
              <p>No products match your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductStockTracker;
