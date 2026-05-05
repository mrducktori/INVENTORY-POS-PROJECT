import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';
import './LowStockAlerts.css';

const LowStockAlerts = ({ loading, lowStockDetails, onExpand }) => {
  const alerts = lowStockDetails?.slice(0, 5) || [];
  const hasMore = (lowStockDetails?.length || 0) > 5;

  return (
    <div
      className="chart-card large clickable low-stock-card"
      onClick={onExpand}
    >
      <div className="chart-header">
        <h3> Low Stock</h3>
      </div>

      <div className="chart-body low-stock-body">
        {loading ? (
          <div className="loading">Checking...</div>
        ) : (
          <div style={{ width: '100%' }}>
            <ul className="low-stock-list">
              {alerts.length > 0 ? (
                alerts.map((item) => (
                  <li key={item.name} className="low-stock-item">
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">{formatQuantity(item.stock, item.unit)}</span>
                  </li>
                ))
              ) : (
                <li className="low-stock-empty">
                  Stock levels healthy.
                </li>
              )}
            </ul>
            {hasMore && (
              <div className="more-items-hint">
                + {lowStockDetails.length - 5} more items...
              </div>
            )}
            {alerts.length > 0 && <div className="expand-hint click-hint">Click to expand all</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlerts;
