import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';

const LowStockAlerts = ({ loading, lowStockDetails, onExpand }) => {
  const alerts = lowStockDetails?.slice(0, 5) || [];
  const hasMore = (lowStockDetails?.length || 0) > 5;

  return (
    <div
      className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-xs cursor-pointer transition-all duration-200 hover:border-zinc-400 hover:shadow-md"
      onClick={onExpand}
    >
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-base font-bold text-zinc-900 m-0">
          Low Stock Overview
        </h3>
        <span className="text-sm text-zinc-500 font-medium">Click to inspect</span>
      </div>

      <div className="flex items-center justify-center min-h-[120px]">
        {loading ? (
          <div className="text-sm text-zinc-400">Checking inventory...</div>
        ) : (
          <div className="w-full">
            <ul className="list-none p-0 m-0 space-y-3">
              {alerts.length > 0 ? (
                alerts.map((item) => (
                  <li key={item.name} className="flex justify-between items-center py-2 text-sm">
                    <span className="font-bold text-zinc-900">{item.name}</span>
                    <span className="text-rose-800 tabular-nums font-bold bg-rose-100 px-3 py-1 rounded-md text-sm">
                      {formatQuantity(item.stock, item.unit)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-center text-zinc-600 py-6 text-sm font-medium">
                  ✓ Stock levels healthy.
                </li>
              )}
            </ul>
            {hasMore && (
              <div className="text-center text-zinc-700 font-bold text-sm uppercase mt-3">
                + {lowStockDetails.length - 5} more items...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlerts;
