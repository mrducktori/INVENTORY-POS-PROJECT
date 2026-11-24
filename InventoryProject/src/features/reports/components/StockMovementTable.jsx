import React from 'react';
import Pagination from '../../../components/shared/Pagination';

/**
 * Displays the Stock Movement Audit Log table and pagination controls.
 */
const StockMovementTable = ({
  periodLabel,
  filteredMovements,
  paginatedMovements,
  movementPage,
  movementTotalPages,
  movementItemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg sm:text-xl font-black text-gray-900 tracking-tight border-none p-0">
            Stock Movement Audit Log — {periodLabel}
          </h2>
          <p className="m-0 text-xs sm:text-sm text-gray-600 font-medium mt-0.5">
            Records of inventory additions, POS drink deductions, and wastage reports
          </p>
        </div>
        <span className="text-xs font-bold text-gray-600 bg-gray-200/80 px-3 py-1 rounded-full uppercase tracking-wide">
          {filteredMovements.length} matching entries
        </span>
      </div>

      <div className="p-0">
        {filteredMovements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                  <th className="px-6 py-4">Date &amp; Time</th>
                  <th className="px-6 py-4">Movement</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4 text-right">Quantity Change</th>
                  <th className="px-6 py-4 text-right">Remaining Stock</th>
                  <th className="px-6 py-4">Reason / Source</th>
                  <th className="px-6 py-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedMovements.map((m) => {
                  const isPos = m.qtyChange > 0;
                  const isWaste = m.movementType === 'WASTAGE';

                  return (
                    <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 font-medium">
                        {new Date(m.timestamp).toLocaleString('en-PH')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                          isPos
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isWaste
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-red-50 text-red-800 border-red-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isPos ? 'bg-emerald-600' : isWaste ? 'bg-amber-600' : 'bg-red-600'}`}></span>
                          <span>{m.directionLabel}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-800 border border-gray-300">
                          {m.itemType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-base font-black text-gray-900">{m.name}</td>
                      <td className="px-6 py-4 text-base font-black font-mono text-right">
                        <span className={isPos ? 'text-emerald-700' : 'text-red-700'}>
                          {isPos ? `+${m.absQty}` : `-${m.absQty}`} {m.unit}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-base font-bold font-mono text-gray-800 text-right">
                        {m.newStock !== null && m.newStock !== undefined ? `${m.newStock} ${m.unit}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                        {m.reason}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold">{m.recordedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <Pagination
              currentPage={movementPage}
              totalPages={movementTotalPages}
              totalItems={filteredMovements.length}
              itemsPerPage={movementItemsPerPage}
              onPageChange={onPageChange}
              onItemsPerPageChange={onItemsPerPageChange}
              itemsPerPageOptions={[10, 25, 50, 100]}
            />
          </div>
        ) : (
          <div className="p-12 text-center text-gray-600 font-bold bg-gray-50/50">
            No stock movements matched your filter criteria for {periodLabel}.
          </div>
        )}
      </div>
    </div>
  );
};

export default StockMovementTable;
