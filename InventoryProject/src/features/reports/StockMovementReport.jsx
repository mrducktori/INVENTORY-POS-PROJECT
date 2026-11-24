import React from 'react';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';
import { useStockMovementReport } from './hooks/useStockMovementReport';
import StockMovementToolbar from './components/StockMovementToolbar';
import StockMovementSummaryCards from './components/StockMovementSummaryCards';
import StockMovementTable from './components/StockMovementTable';
import StockSnapshotTable from './components/StockSnapshotTable';

const StockMovementReport = () => {
  const {
    period,
    handlePeriodChange,
    movements,
    loading,
    fetched,
    search,
    setSearch,
    stockStatusFilter,
    setStockStatusFilter,
    movementTypeFilter,
    setMovementTypeFilter,
    activeView,
    setActiveView,
    movementPage,
    setMovementPage,
    movementItemsPerPage,
    handleMovementItemsPerPageChange,
    fetchReport,
    filteredMovements,
    movementTotalPages,
    paginatedMovements,
    filteredSnapshot,
    groupedSnapshot,
    summary,
    periodLabel,
    handleExportCSV,
    handlePrint,
  } = useStockMovementReport();

  return (
    <div className="flex flex-col gap-6">
      <StockMovementToolbar
        period={period}
        onPeriodChange={handlePeriodChange}
        fetched={fetched}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        activeView={activeView}
        movementCount={movements.length}
        movementTypeFilter={movementTypeFilter}
        onMovementTypeChange={setMovementTypeFilter}
        stockStatusFilter={stockStatusFilter}
        onStockStatusChange={setStockStatusFilter}
        onExportCSV={handleExportCSV}
        onGenerateReport={fetchReport}
        onPrint={handlePrint}
      />

      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-zinc-500 bg-white border border-zinc-200/80 border-dashed rounded-2xl h-64 text-center">
          <svg className="w-12 h-12 mb-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div className="text-base font-bold text-zinc-900 mb-1">Period Selection Changed</div>
          <p className="m-0 text-xs sm:text-sm text-zinc-500 max-w-sm">
            Selected period: <strong className="text-zinc-900 font-semibold">{periodLabel}</strong>. Click <strong className="text-zinc-900 font-semibold">Generate Report</strong> to inspect stock inflow, outflow, and wastage.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={5} />
          <TableSkeleton rows={8} cols={5} />
        </div>
      )}

      {fetched && !loading && (
        <div className="flex flex-col gap-6 fade-in">
          <StockMovementSummaryCards summary={summary} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'movements' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
              }`}
              onClick={() => setActiveView('movements')}
            >
              Stock Movement Log ({filteredMovements.length})
            </button>
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'snapshot' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
              }`}
              onClick={() => setActiveView('snapshot')}
            >
              Current Inventory Snapshot ({filteredSnapshot.length})
            </button>
          </div>

          {activeView === 'movements' ? (
            <StockMovementTable
              periodLabel={periodLabel}
              filteredMovements={filteredMovements}
              paginatedMovements={paginatedMovements}
              movementPage={movementPage}
              movementTotalPages={movementTotalPages}
              movementItemsPerPage={movementItemsPerPage}
              onPageChange={setMovementPage}
              onItemsPerPageChange={handleMovementItemsPerPageChange}
            />
          ) : (
            <StockSnapshotTable
              filteredSnapshotCount={filteredSnapshot.length}
              groupedSnapshot={groupedSnapshot}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default StockMovementReport;
