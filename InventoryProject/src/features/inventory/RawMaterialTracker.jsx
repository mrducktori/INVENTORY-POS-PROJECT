import React, { useState, useEffect } from 'react';
import { getIngredients } from '../../api/inventoryApi';
import { formatQuantity } from '../../utils/productUtils';

import './RawMaterialTracker.css';

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
    if (current <= 0) return 'out';
    if (current <= alert_level) return 'critical';
    if (current <= alert_level * 1.5) return 'warning';
    return 'normal';
  };

  const getStatusLabel = (status) => {
    if (status === 'out') return 'OUT';
    if (status === 'critical') return 'CRITICAL';
    if (status === 'warning') return 'WARNING';
    return 'HEALTHY';
  };

  const getStockPercent = (current, alert_level) => {
    if (!alert_level || alert_level === 0) return 100;
    return Math.min(Math.round((current / (alert_level * 2)) * 100), 100);
  };

  const filteredIngredients = ingredients.filter(ing => {
    const status = getStockStatus(ing.stock_quantity, ing.low_stock_alert);
    const matchSearch = (ing.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      stockFilter === 'ALL' ? true :
      stockFilter === 'HEALTHY' ? status === 'normal' :
      status.toUpperCase() === stockFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: ingredients.length,
    out: ingredients.filter(i => i.stock_quantity <= 0).length,
    critical: ingredients.filter(i => i.stock_quantity > 0 && i.stock_quantity <= i.low_stock_alert).length,
    warning: ingredients.filter(i => i.stock_quantity > i.low_stock_alert && i.stock_quantity <= i.low_stock_alert * 1.5).length,
    healthy: ingredients.filter(i => i.stock_quantity > i.low_stock_alert * 1.5).length,
  };

  return (
    <div className="inventory-container">
      <div className="page-header tracker-page-header">
        <div>
          <h1>Raw Material Tracker</h1>
          <p>Monitor your ingredient stock levels in real-time.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchIngredients} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ---- Stats Row ---- */}
      <div className="tracker-stats-row">
        <div className="tracker-stat-card">
          <div className="tracker-stat-label">Total Ingredients</div>
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
          <h2>Ingredient Stock Levels</h2>
          <div className="table-filters-container">
            <input
              type="text"
              placeholder="Search ingredients..."
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
          ) : filteredIngredients.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Current Stock</th>
                    <th>Alert Level</th>
                    <th>Stock Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map(ing => {
                    const status = getStockStatus(ing.stock_quantity, ing.low_stock_alert);
                    const pct = getStockPercent(ing.stock_quantity, ing.low_stock_alert);

                    return (
                      <tr key={ing.id}>
                        <td><strong>{ing.name}</strong></td>
                        <td>{formatQuantity(ing.stock_quantity, ing.unit)}</td>
                        <td>{formatQuantity(ing.low_stock_alert, ing.unit)}</td>
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
              <p>No ingredients match your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawMaterialTracker;
