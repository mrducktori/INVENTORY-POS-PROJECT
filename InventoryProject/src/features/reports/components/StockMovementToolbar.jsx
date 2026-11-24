import React from 'react';

/**
 * Filter and action toolbar for StockMovementReport (period, search, movement/snapshot filters,
 * CSV/generate/print).
 */
const StockMovementToolbar = ({
  period,
  onPeriodChange,
  fetched,
  loading,
  search,
  onSearchChange,
  activeView,
  movementCount,
  movementTypeFilter,
  onMovementTypeChange,
  stockStatusFilter,
  onStockStatusChange,
  onExportCSV,
  onGenerateReport,
  onPrint,
}) => {
  return (
    <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Period</span>
          <select
            className="bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs sm:text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-400 cursor-pointer"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
          >
            <option value="daily">Today (Daily)</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
          </select>
        </div>

        {fetched && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-60">
              <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                className="w-full pl-9 pr-7 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                placeholder="Search item, reason, staff..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {activeView === 'movements' && (
              <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                <button
                  type="button"
                  onClick={() => onMovementTypeChange('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    movementTypeFilter === 'ALL' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  All ({movementCount})
                </button>
                <button
                  type="button"
                  onClick={() => onMovementTypeChange('IN')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    movementTypeFilter === 'IN' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Inflow
                </button>
                <button
                  type="button"
                  onClick={() => onMovementTypeChange('OUT')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    movementTypeFilter === 'OUT' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Outflow
                </button>
                <button
                  type="button"
                  onClick={() => onMovementTypeChange('WASTAGE')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    movementTypeFilter === 'WASTAGE' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Wastage
                </button>
              </div>
            )}

            {activeView === 'snapshot' && (
              <select
                className="bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs sm:text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-400 cursor-pointer"
                value={stockStatusFilter}
                onChange={(e) => onStockStatusChange(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="OUT">Out of Stock Only</option>
                <option value="LOW">Low Stock / Restock Needed</option>
                <option value="NORMAL">In Stock Only</option>
              </select>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
          onClick={onExportCSV}
          disabled={!fetched || loading}
          title="Download CSV spreadsheet"
        >
          Export CSV
        </button>
        <button
          type="button"
          className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
          onClick={onGenerateReport}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
        <button
          type="button"
          className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
          onClick={onPrint}
          disabled={!fetched || loading}
          title="Print or save as PDF"
        >
          Print
        </button>
      </div>
    </div>
  );
};

export default StockMovementToolbar;
