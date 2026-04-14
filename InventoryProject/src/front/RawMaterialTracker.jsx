import React, { useState, useEffect } from 'react';
import { getIngredients } from '../api/inventoryApi';
import '../styles/Inventory.css';

const RawMaterialTracker = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients(data || []);
    } catch (err) {
      console.error('Error loading ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredIngredients = ingredients.filter(ing =>
    ing.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (current, alert_level) => {
    if (current < alert_level * 0.5) return 'critical';
    if (current < alert_level) return 'low';
    return 'normal';
  };

  const stats = {
    total: ingredients.length,
    low: ingredients.filter(i => i.stock_quantity < i.low_stock_alert).length,
    normal: ingredients.filter(i => i.stock_quantity >= i.low_stock_alert).length,
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
          <div className="value" style={{ color: stats.low > 0 ? '#e74c3c' : '#27ae60' }}>
            {stats.low}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Normal Stock</div>
          <div className="value" style={{ color: '#27ae60' }}>
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
          <input
            type="text"
            placeholder="Search ingredients..."
            className="form-group"
            style={{ marginBottom: '20px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

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
                          <div style={{
                            background: '#f0f0f0',
                            borderRadius: '4px',
                            height: '20px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              background: status === 'critical' ? '#e74c3c' : status === 'low' ? '#f39c12' : '#27ae60',
                              height: '100%',
                              width: `${Math.min(percentage, 100)}%`,
                              transition: 'width 0.3s'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', color: '#999' }}>
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
