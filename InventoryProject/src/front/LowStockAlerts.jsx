import React, { useState, useEffect } from 'react';
import { getLowStockAlerts } from '../api/inventoryApi';
import '../styles/Inventory.css';

const LowStockAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

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
    if (current < alert_level * 0.25) return 'critical';
    if (current < alert_level * 0.5) return 'warning';
    return 'low';
  };

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
          <div className="value" style={{ color: '#e74c3c' }}>
            {getCriticalCount()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Warning Level</div>
          <div className="value" style={{ color: '#f39c12' }}>
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
          {loading ? (
            <p>Loading...</p>
          ) : alerts.length > 0 ? (
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
                  {alerts.map(alert => {
                    const shortage = alert.low_stock_alert - alert.stock_quantity;
                    const severity = getSeverity(alert.stock_quantity, alert.low_stock_alert);

                    return (
                      <tr key={alert.id}>
                        <td><strong>{alert.name}</strong></td>
                        <td>{alert.unit}</td>
                        <td>{alert.stock_quantity}</td>
                        <td>{alert.low_stock_alert}</td>
                        <td style={{ color: '#e74c3c', fontWeight: '600' }}>
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
        <div className="card" style={{ marginTop: '25px' }}>
          <div className="card-header">
            <h2>Recommended Actions</h2>
          </div>
          <div className="card-body">
            <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              {getCriticalCount() > 0 && (
                <li style={{ color: '#e74c3c', fontWeight: '600' }}>
                  ORDER IMMEDIATELY: {getCriticalCount()} item(s) at critical level
                </li>
              )}
              {getWarningCount() > 0 && (
                <li style={{ color: '#f39c12', fontWeight: '600' }}>
                  PLAN ORDER: {getWarningCount()} item(s) approaching critical level
                </li>
              )}
              {alerts.length > 2 && (
                <li style={{ color: '#667eea' }}>
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
