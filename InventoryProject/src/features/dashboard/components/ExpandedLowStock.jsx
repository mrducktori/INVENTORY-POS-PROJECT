import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';

const ExpandedLowStock = ({ loading, lowStockDetails, onCollapse }) => {
  const hasAlerts = lowStockDetails?.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xs animate-[fadeIn_0.2s_ease-in-out] overflow-hidden">
      <div className="flex justify-between items-center px-6 md:px-8 py-5 bg-zinc-50 border-b border-gray-200">
        <div>
          <h3 className="m-0 text-lg font-bold text-zinc-900">
            Low Stock Inventory Alerts
          </h3>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {hasAlerts ? `${lowStockDetails.length} items below minimum threshold` : 'All items safely stocked'}
          </p>
        </div>

        <button
          type="button"
          className="bg-white border border-zinc-200 text-zinc-900 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer transition-colors hover:bg-zinc-100 shadow-xs"
          onClick={onCollapse}
        >
          Close List
        </button>
      </div>

      <div className="p-6 md:p-8">
        {loading ? (
          <div className="py-8 flex justify-center text-sm text-zinc-500">
            Verifying stock levels...
          </div>
        ) : (
          <div className="w-full">
            <ul className="list-none p-0 m-0 divide-y divide-gray-100">
              {hasAlerts ? (
                lowStockDetails.map((item) => (
                  <li key={item.name} className="flex justify-between items-center py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="font-bold text-base text-zinc-900">{item.name}</span>
                    </div>
                    <span className="text-rose-800 tabular-nums font-bold bg-rose-100 px-3 py-1 rounded-md text-sm">
                      {formatQuantity(item.stock, item.unit)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-center text-zinc-600 py-10 font-semibold text-base">
                  All café inventory ingredients are currently above minimum threshold.
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
