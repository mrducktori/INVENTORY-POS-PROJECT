import React from 'react';
import { CATEGORY_PILLS, DATE_PRESETS } from '../hooks/useSalesReceiptJournal.js';

/**
 * Toolbar and filter controls for SalesReceiptJournal (search, export/guide/refresh actions,
 * date presets/custom range, fetch limit, category pills, and status scope pills).
 */
const ReceiptJournalToolbar = ({
  searchInput,
  onSearchChange,
  onClearSearch,
  filteredCount,
  onExportCSV,
  onOpenGuide,
  onRefresh,
  loading,
  datePreset,
  startDate,
  endDate,
  onApplyDatePreset,
  onStartDateChange,
  onEndDateChange,
  fetchLimit,
  fetchOptions,
  onFetchLimitChange,
  categoryPills = CATEGORY_PILLS,
  selectedType,
  onTypeChange,
  statusScope,
  counts,
  onStatusScopeChange,
}) => {
  const statusScopes = [
    { id: 'ALL', label: 'All', count: counts.all },
    { id: 'TODAY', label: 'Today', count: counts.today },
    { id: 'CASH', label: 'Cash', count: counts.cash },
    { id: 'GCASH', label: 'GCash', count: counts.gcash },
    { id: 'DISCOUNTED', label: 'Discounted', count: counts.discounted },
  ];

  return (
    <>
      {/* Row 1: Search Input on Left, Action Buttons on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative w-full sm:w-80">
          <svg
            className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search receipt #, staff, item..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Right Action Buttons matching reference */}
        <div className="flex items-center gap-2 shrink-0">
          {filteredCount > 0 && (
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              title="Download receipts as CSV spreadsheet"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export CSV ({filteredCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Receipt Guide</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            title="Refresh journal records"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Row 1.5: Date Range & Server Request Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1 border-y border-zinc-100">
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyDatePreset(preset.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border ${
                datePreset === preset.id
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-800 focus:outline-none focus:border-zinc-400"
            />
            <span className="text-xs text-zinc-400">to</span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-800 focus:outline-none focus:border-zinc-400"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => onApplyDatePreset('RECENT')}
                className="px-2 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Fetch:</span>
          <select
            aria-label="Fetch receipt limit"
            value={fetchOptions.some((o) => String(o.value) === String(fetchLimit)) ? fetchLimit : 'all'}
            onChange={(e) => onFetchLimitChange(e.target.value)}
            className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer"
          >
            {fetchOptions.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Category / Type Filter Pills (exact match to reference) */}
      <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        {categoryPills.map((pill) => {
          const isActive = selectedType === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onTypeChange(pill.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Row 3: Status / Scope Filter Pills (exact match to reference) */}
      <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
        {statusScopes.map((scope) => {
          const isActive = statusScope === scope.id;
          return (
            <button
              key={scope.id}
              type="button"
              onClick={() => onStatusScopeChange(scope.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {scope.label} ({scope.count})
            </button>
          );
        })}
      </div>
    </>
  );
};

export default ReceiptJournalToolbar;
