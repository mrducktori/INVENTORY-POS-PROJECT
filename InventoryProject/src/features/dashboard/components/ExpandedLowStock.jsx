import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';
import './ExpandedLowStock.css';

// ---------------------------------------------------------------------------
// ExpandedLowStock
// Full-width panel that appears below the bi-grid when the user clicks the
// compact LowStockAlerts card. Same expand pattern as ExpandedTrendChart.
// ---------------------------------------------------------------------------

const ExpandedLowStock = ({ loading, lowStockDetails, onCollapse }) => {
  const hasAlerts = lowStockDetails?.length > 0;

  return (
    <div className="chart-card large animate-pop-in expanded-low-stock-card">
      <div className="chart-header expanded-low-stock-header">
        <h3 className="expanded-low-stock-title">Low Stock Items</h3>
        <button
          className="filter-btn collapse-btn"
          onClick={onCollapse}
        >
          ✖ Collapse
        </button>
      </div>

      <div className="chart-body expanded-low-stock-body">
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
                <li className="all-stocked-message">
                  ✓ All items are safely stocked.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpandedLowStock;
