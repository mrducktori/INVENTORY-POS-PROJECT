import React from 'react';
import { formatQuantity } from '../../../utils/productUtils';

const LowStockAlerts = ({ loading, lowStockDetails, onExpand }) => {
  const alerts = lowStockDetails?.slice(0, 5) || [];
  const hasMore = (lowStockDetails?.length || 0) > 5;

  return (
    <div
      className="bg-white border border-[#e0e0e0] border-t-4 border-t-black rounded shadow-[0_2px_4px_rgba(0,0,0,0.05)] col-span-1 lg:col-span-2 p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:border-black hover:border-t-black"
      onClick={onExpand}
    >
      <div className="mb-5 border-b border-[#f0f0f0] pb-2.5">
        <h3 className="text-sm font-bold uppercase tracking-[0.5px] text-black m-0">Low Stock</h3>
      </div>

      <div className="flex items-center justify-center min-h-[120px] p-4">
        {loading ? (
          <div className="text-[#666] italic">Checking...</div>
        ) : (
          <div className="w-full">
            <ul className="list-none p-0 my-[15px] mx-0 text-left">
              {alerts.length > 0 ? (
                alerts.map((item) => (
                  <li key={item.name} className="flex justify-between items-center py-2.5 border-b border-[#f9f9f9] text-[13px] last:border-b-0">
                    <span className="font-bold">{item.name}</span>
                    <span className="text-[#c62828] font-bold">{formatQuantity(item.stock, item.unit)}</span>
                  </li>
                ))
              ) : (
                <li className="text-center text-[#999] py-8 text-xs uppercase font-semibold">
                  Stock levels healthy.
                </li>
              )}
            </ul>
            {hasMore && (
              <div className="text-center text-black font-bold text-[11px] uppercase mt-3">
                + {lowStockDetails.length - 5} more items...
              </div>
            )}
            {alerts.length > 0 && <div className="text-center text-[10px] text-[#888] mt-1 uppercase tracking-[0.5px]">Click to expand all</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlerts;
