import React from 'react';

/**
 * KPI summary cards for StockMovementReport (Inflow, Outflow, Wastage, Net Movement, Restock
 * Attention).
 */
const StockMovementSummaryCards = ({ summary }) => {
  const {
    totalStockIn,
    totalStockOut,
    totalWastage,
    netMovement,
    criticalCount,
    inflowCount,
    outflowCount,
    wastageCount,
  } = summary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stock Inflow (+)</div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
          +{totalStockIn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-zinc-400 mt-1">{inflowCount} receipts</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stock Outflow (-)</div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
          -{totalStockOut.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-zinc-400 mt-1">{outflowCount} deductions</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Wastage / Loss (-)</div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
          -{totalWastage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-zinc-400 mt-1">{wastageCount} write-offs</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Net Movement</div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
          {netMovement >= 0 ? `+${netMovement.toFixed(2)}` : netMovement.toFixed(2)}
        </div>
        <div className="text-xs text-zinc-400 mt-1">volume delta</div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Restock Attention</div>
        <div className="text-2xl font-bold text-red-600 tabular-nums mt-1 font-mono">
          {criticalCount}
        </div>
        <div className="text-xs text-zinc-400 mt-1">items need restock</div>
      </div>
    </div>
  );
};

export default StockMovementSummaryCards;
