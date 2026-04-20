import React, { useState, useEffect } from 'react';
import { getIngredients } from '../api/inventoryApi';
import '../styles/Inventory.css';
import '../styles/RawMaterialTracker.css';

const RawMaterialTracker = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'LOW' | 'NORMAL'


  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      // Filter out archived items
      setIngredients((data || []).filter(i => !i.is_archived));
    } catch (err) {
      console.error('Error loading ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (current, alert_level) => {
    if (current === 0) return 'critical';
    if (current <= alert_level * 0.5) return 'critical';
    if (current <= alert_level) return 'low';
    return 'normal';
  };

  const filteredIngredients = ingredients.filter(ing => {
    const status = getStockStatus(ing.stock_quantity, ing.low_stock_alert);
    const matchSearch = (ing.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = stockFilter === 'ALL' || status.toUpperCase() === stockFilter;
    return matchSearch && matchStatus;
  });


  const stats = {
    total: ingredients.length,
    low: ingredients.filter(i => i.stock_quantity <= i.low_stock_alert).length,
    normal: ingredients.filter(i => i.stock_quantity > i.low_stock_alert).length,
    totalValue: ingredients.reduce((sum, i) => sum + i.stock_quantity, 0)
  };


  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Raw Material Tracker</h1>
        <p>Monitor your inventory levels in real-time</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Ingredients</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Low Stock Items</div>
          <div className={`value ${stats.low > 0 ? 'text-red' : 'text-green'}`}>
            {stats.low}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Normal Stock</div>
          <div className="value text-green">
            {stats.normal}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Total Stock Value</div>
          <div className="value">{stats.totalValue.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Ingredient Inventory Levels</h2>
        </div>
        <div className="card-body">
          <div className="table-filters" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search ingredients..."
              style={{ flex: 2, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="ALL">All Stock Status</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="LOW">Low Stock Only</option>
              <option value="NORMAL">Normal Only</option>
            </select>
          </div>


          {loading ? (
            <p>Loading...</p>
          ) : filteredIngredients.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ingredient Name</th>
                    <th>Unit</th>
                    <th>Current Stock</th>
                    <th>Low Stock Alert</th>
                    <th>Stock %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map(ing => {
                    const status = getStockStatus(ing.stock_quantity, ing.low_stock_alert);
                    const percentage = Math.round((ing.stock_quantity / (ing.low_stock_alert * 2)) * 100);

                    return (
                      <tr key={ing.id}>
                        <td><strong>{ing.name}</strong></td>
                        <td>{ing.unit}</td>
                        <td>{ing.stock_quantity}</td>
                        <td>{ing.low_stock_alert}</td>
                        <td>
                          <div className="progress-track">
                            <div 
                              className={`progress-fill bg-${status}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }} 
                            />
                          </div>
                          <span className="progress-percentage">
                            {Math.min(percentage, 100)}%
                          </span>
                        </td>
                        <td>
                          <span className={`status ${status}`}>
                            {status === 'critical' ? 'CRITICAL' : status === 'low' ? 'LOW' : 'NORMAL'}
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
              <p>No ingredients found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawMaterialTracker;
