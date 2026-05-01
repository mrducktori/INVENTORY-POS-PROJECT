import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';

// ---------------------------------------------------------------------------
// LowStockAlerts
// Displays the actionable low-stock inventory list. Uses a red top-border
// to visually signal urgency. No logic — purely presentational.
// ---------------------------------------------------------------------------

const LowStockAlerts = ({ loading, lowStockDetails }) => {
  const hasAlerts = lowStockDetails?.length > 0;

  return (
    <div
      className="chart-card large"
      style={{ gridColumn: 'span 1', borderTop: '4px solid #c62828' }}
    >
      <div className="chart-header">
        <h3>⚠️ Low Stock Alerts</h3>
      </div>

      <div
        className="chart-body"
        style={{ height: 'auto', minHeight: '300px', alignItems: 'flex-start' }}
      >
        {loading ? (
          <div className="loading">Checking inventory...</div>
        ) : (
          <div style={{ width: '100%' }}>
            <ul className="low-stock-list">
              {hasAlerts ? (
                lowStockDetails.map((item) => (
                  <li key={item.name}>
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">
                      {formatQuantity(item.stock, item.unit)}
                    </span>
                  </li>
                ))
              ) : (
                <li
                  style={{
                    textAlign: 'center',
                    color: '#666',
                    borderBottom: 'none',
                    padding: '20px 0',
                  }}
                >
                  All items are safely stocked.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlerts;
