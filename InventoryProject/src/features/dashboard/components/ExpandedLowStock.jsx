import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';

// ---------------------------------------------------------------------------
// ExpandedLowStock
// Full-width panel that appears below the bi-grid when the user clicks the
// compact LowStockAlerts card. Same expand pattern as ExpandedTrendChart.
// ---------------------------------------------------------------------------

const ExpandedLowStock = ({ loading, lowStockDetails, onCollapse }) => {
  const hasAlerts = lowStockDetails?.length > 0;

  return (
    <div className="bg-white border border-gray-200 border-t-4 border-t-red-500 rounded-xl mt-8 shadow-sm col-span-1 lg:col-span-2 animate-[fadeIn_0.2s_ease-in-out] overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4 bg-gray-50/50 border-b border-gray-100">
        <h3 className="m-0 text-sm font-semibold text-gray-800 uppercase tracking-wider">Low Stock Items</h3>
        <button
          className="bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 uppercase cursor-pointer transition-colors hover:bg-gray-50 hover:text-gray-900"
          onClick={onCollapse}
        >
          ✖ Collapse
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-gray-500 italic flex justify-center py-5">Checking inventory...</div>
        ) : (
          <div className="w-full">
            <ul className="list-none p-0 m-0 text-left">
              {hasAlerts ? (
                lowStockDetails.map((item) => (
                  <li key={item.name} className="flex justify-between items-center py-3 border-b border-gray-100 text-sm last:border-b-0">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded-md">
                      {formatQuantity(item.stock, item.unit)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-center text-gray-500 py-10 font-medium text-sm">
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
