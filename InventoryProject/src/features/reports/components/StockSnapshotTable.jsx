import React from 'react';

const StatusGroupIcon = ({ statusId }) => {
  if (statusId === 'out') {
    return (
      <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  if (statusId === 'low') {
    return (
      <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

/**
 * Displays the priority-grouped Current Inventory Snapshot table.
 */
const StockSnapshotTable = ({ filteredSnapshotCount, groupedSnapshot }) => {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-lg sm:text-xl font-black text-gray-900 tracking-tight border-none p-0">
            Current Inventory Snapshot ({filteredSnapshotCount} items)
          </h2>
          <p className="m-0 text-xs sm:text-sm text-gray-600 font-medium mt-0.5">
            Priority Grouped: Out of Stock &rarr; Low Stock / Restock Needed &rarr; In Stock
          </p>
        </div>
      </div>

      <div className="p-0">
        {groupedSnapshot.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4 text-right">Current Stock</th>
                  <th className="px-6 py-4 text-right">Low Alert Level</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4 text-right">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedSnapshot.map((group) => (
                  <React.Fragment key={group.id}>
                    <tr className={`${group.headerBg} border-y`}>
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <StatusGroupIcon statusId={group.id} />
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900">
                              {group.label}
                            </span>
                          </div>
                          <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-xs ${group.badgeClass}`}>
                            {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((row) => (
                      <tr key={`${row.type}-${row.id}`} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-800 border border-gray-300">
                            {row.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-base font-black text-gray-900">{row.name}</td>
                        <td className="px-6 py-4 text-base font-black font-mono text-gray-900 text-right">
                          {row.currentStock}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold font-mono text-gray-600 text-right">
                          {row.lowAlert}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-700">{row.unit}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${group.badgeClass}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-600 font-bold bg-gray-50/50">
            No items match your filter criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default StockSnapshotTable;
