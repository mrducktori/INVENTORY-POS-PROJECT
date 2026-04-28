import React, { useState, useEffect } from 'react';
import { getLowStockAlerts } from '../../api/inventoryApi';

import './LowStockAlerts.css';

const LowStockAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    fetchLowStockAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLowStockAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLowStockAlerts = async () => {
    try {
      setLoading(true);
      const data = await getLowStockAlerts();
      setAlerts(data || []);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverity = (current, alert_level) => {
    if (current === 0) return 'critical';
    if (current <= alert_level * 0.5) return 'critical';
    if (current <= alert_level) return 'warning';
    return 'low';
  };

  const filteredAlerts = alerts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );



  const getCriticalCount = () => alerts.filter(a => getSeverity(a.stock_quantity, a.low_stock_alert) === 'critical').length;
  const getWarningCount = () => alerts.filter(a => getSeverity(a.stock_quantity, a.low_stock_alert) === 'warning').length;

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Low Stock Alerts</h1>
        <p>Items running low on inventory</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Low Stock Items</div>
          <div className="value">{alerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Critical Alert</div>
          <div className="value text-critical">
            {getCriticalCount()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Warning Level</div>
          <div className="value text-warning">
            {getWarningCount()}
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alert alert-warning">
          {alerts.length} item(s) are below low stock threshold
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Low Stock Items</h2>
        </div>
        <div className="card-body">
          <div className="table-filters" style={{ marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="Search items..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : filteredAlerts.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Unit</th>
                    <th>Current Stock</th>
                    <th>Alert Level</th>
                    <th>Shortage</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map(alert => {

                    const shortage = alert.low_stock_alert - alert.stock_quantity;
                    const severity = getSeverity(alert.stock_quantity, alert.low_stock_alert);

                    return (
                      <tr key={alert.id}>
                        <td><strong>{alert.name}</strong></td>
                        <td>{alert.unit}</td>
                        <td>{alert.stock_quantity}</td>
                        <td>{alert.low_stock_alert}</td>
                        <td className="text-critical-bold">
                          -{shortage.toFixed(2)}
                        </td>
                        <td>
                          <span className={`status ${severity}`}>
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
            <div className="empty-state">
              <p>All ingredients are at healthy stock levels!</p>
            </div>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card alerts-actions-card">
          <div className="card-header">
            <h2>Recommended Actions</h2>
          </div>
          <div className="card-body">
            <ul className="alerts-recommendations-list">
              {getCriticalCount() > 0 && (
                <li className="text-critical-bold">
                  ORDER IMMEDIATELY: {getCriticalCount()} item(s) at critical level
                </li>
              )}
              {getWarningCount() > 0 && (
                <li className="text-warning-bold">
                  PLAN ORDER: {getWarningCount()} item(s) approaching critical level
                </li>
              )}
              {alerts.length > 2 && (
                <li className="text-info">
                  Consider increasing order frequency
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default LowStockAlerts;
