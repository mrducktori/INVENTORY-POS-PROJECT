import React from 'react';
import SalesReceiptModal from '../../components/SalesReceiptModal.jsx';
import { useSalesReceiptJournal } from './hooks/useSalesReceiptJournal.js';
import ReceiptJournalToolbar from './components/ReceiptJournalToolbar.jsx';
import ReceiptJournalTable from './components/ReceiptJournalTable.jsx';
import ReceiptGuideModal from './components/ReceiptGuideModal.jsx';

const SalesReceiptJournal = () => {
  const {
    sales,
    totalServerCount,
    loading,
    searchInput,
    setSearchInput,
    pageSize,
    fetchLimit,
    currentPage,
    setCurrentPage,
    datePreset,
    startDate,
    endDate,
    selectedType,
    statusScope,
    activeReceiptSaleId,
    setActiveReceiptSaleId,
    showGuide,
    setShowGuide,
    counts,
    fetchOptions,
    metrics,
    filteredSales,
    displayedSales,
    effectiveTotal,
    totalPages,
    startEntry,
    endEntry,
    pageNumbers,
    fetchSales,
    applyDatePreset,
    handleStartDateChange,
    handleEndDateChange,
    handleFetchLimitChange,
    handleTypeChange,
    handleStatusScopeChange,
    handlePageSizeChange,
    handleResetFilters,
    handleSort,
    handleExportCSV,
  } = useSalesReceiptJournal();

  return (
    <div className="p-4 md:p-8 flex-1 bg-white min-h-screen overflow-y-auto w-full space-y-6">
      {/* Page Title & Operational Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight m-0">
            Receipt Journal
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            Digital transaction audit trail, order breakdowns, and tendered payment records.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Total Receipts
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1">
            {totalServerCount > 0 ? totalServerCount.toLocaleString() : sales.length.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {totalServerCount > sales.length
              ? `Loaded ${sales.length.toLocaleString()} of ${totalServerCount.toLocaleString()} matching`
              : `All ${sales.length.toLocaleString()} matching loaded`}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Journal Revenue
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums font-mono mt-1">
            ₱{metrics.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {totalServerCount > sales.length
              ? `Volume for ${sales.length.toLocaleString()} loaded receipts`
              : `Cumulative completed volume`}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Average Ticket
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums font-mono mt-1">
            ₱{metrics.avgTicket.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Per customer transaction
          </div>
        </div>
      </div>

      {/* Main Journal Container (Reference Layout) */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 md:p-6 space-y-4">
        <ReceiptJournalToolbar
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onClearSearch={() => setSearchInput('')}
          filteredCount={filteredSales.length}
          onExportCSV={handleExportCSV}
          onOpenGuide={() => setShowGuide(true)}
          onRefresh={fetchSales}
          loading={loading}
          datePreset={datePreset}
          startDate={startDate}
          endDate={endDate}
          onApplyDatePreset={applyDatePreset}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          fetchLimit={fetchLimit}
          fetchOptions={fetchOptions}
          onFetchLimitChange={handleFetchLimitChange}
          selectedType={selectedType}
          onTypeChange={handleTypeChange}
          statusScope={statusScope}
          counts={counts}
          onStatusScopeChange={handleStatusScopeChange}
        />

        <ReceiptJournalTable
          loading={loading}
          filteredCount={filteredSales.length}
          displayedSales={displayedSales}
          effectiveTotal={effectiveTotal}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          startEntry={startEntry}
          endEntry={endEntry}
          pageNumbers={pageNumbers}
          onResetFilters={handleResetFilters}
          onSort={handleSort}
          onSelectReceipt={setActiveReceiptSaleId}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Digital Receipt Modal Component */}
      {activeReceiptSaleId && (
        <SalesReceiptModal
          saleId={activeReceiptSaleId}
          onClose={() => setActiveReceiptSaleId(null)}
        />
      )}

      {/* Receipt & Audit Reference Guide Modal */}
      <ReceiptGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </div>
  );
};

export default SalesReceiptJournal;
