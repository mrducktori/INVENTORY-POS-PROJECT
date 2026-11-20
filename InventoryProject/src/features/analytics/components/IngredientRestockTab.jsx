import React from 'react';
import { TableSkeleton } from '../../../components/shared/SkeletonLoader';
import { InfoTip } from '../../../components/shared/InfoTip';
import { formatCurrency } from '../utils/forecastUtils';
import { SortIcon, IngredientStatusBadge } from './ForecastBadges';

const IngredientRestockTab = ({
  ingredientData,
  loadingIngredients,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  statusFilter,
  setStatusFilter,
  filteredIngredients,
  paginatedIngredients,
  selectedIngredientIds,
  lockedSupplier,
  doesItemMatchSupplier,
  ingPage,
  setIngPage,
  pageSize,
  ingSortField,
  ingSortDirection,
  onIngSort,
  onToggleSelectAll,
  onToggleItemSelect,
  onClearSelection,
  onResetFilters,
  onOpenBatchPO,
  onOrderAllCritical,
  onOpenSingleItemPO,
  onOpenGuide,
  onRefresh,
}) => {
  const totalPages = Math.ceil(filteredIngredients.length / pageSize);
  const selectableFilteredIngredients = lockedSupplier?.id && doesItemMatchSupplier
    ? filteredIngredients.filter((item) => doesItemMatchSupplier(item, lockedSupplier.id))
    : filteredIngredients;
  const isAllSelectableChecked =
    selectableFilteredIngredients.length > 0 &&
    selectableFilteredIngredients.every((item) => selectedIngredientIds.includes(item.id));

  return (
    <div className="space-y-5">
      {/* 4 Minimalist Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Immediate Reorder (≤ 3d)</span>
          <div className="text-2xl sm:text-3xl font-bold text-red-600 mt-1 tabular-nums">
            {loadingIngredients ? '—' : ingredientData.summary.criticalCount}
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Low Supply (4–7d)</span>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 tabular-nums">
            {loadingIngredients ? '—' : ingredientData.summary.lowStockCount}
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Healthy Stock (&gt; 7d)</span>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 tabular-nums">
            {loadingIngredients ? '—' : ingredientData.summary.healthyCount}
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Est. Restock Budget</span>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 font-mono tabular-nums">
            {loadingIngredients ? '—' : formatCurrency(ingredientData.summary.totalRestockCapitalRequired)}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Structured Multi-Tier Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          {/* Row 1: Search Box on Left, Action Buttons on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
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
                placeholder="Search material or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {selectedIngredientIds.length > 0 ? (
                <div className="flex items-center gap-2">
                  {lockedSupplier?.name && (
                    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700">
                      <span>Supplier:</span>
                      <strong className="text-zinc-900">{lockedSupplier.name}</strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="px-2.5 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={onOpenBatchPO}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    Create PO ({selectedIngredientIds.length} selected)
                  </button>
                </div>
              ) : (
                ingredientData.summary.criticalCount > 0 && (
                  <button
                    type="button"
                    onClick={onOrderAllCritical}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    Reorder All Critical ({ingredientData.summary.criticalCount})
                  </button>
                )
              )}

              <button
                type="button"
                onClick={onOpenGuide}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Restock Guide</span>
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={loadingIngredients}
                className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Refresh ingredient forecast"
              >
                <svg className={`w-4 h-4 ${loadingIngredients ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Row 2: Category Filter Pills with clean horizontal scroll and executive pill styling */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                All Types
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Status Filter Pills with dynamic counts */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
              {[
                { id: 'ALL', label: 'All', count: ingredientData.ingredients.length },
                { id: 'CRITICAL', label: 'Critical', count: ingredientData.summary.criticalCount },
                { id: 'LOW_STOCK', label: 'Low', count: ingredientData.summary.lowStockCount },
                { id: 'HEALTHY', label: 'Healthy', count: ingredientData.summary.healthyCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loadingIngredients ? (
          <div className="p-6">
            <TableSkeleton rows={6} cols={7} />
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-zinc-500 m-0">No ingredients match your current filters.</p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold select-none">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelectableChecked}
                        onChange={onToggleSelectAll}
                        title={
                          lockedSupplier?.name
                            ? `Select all items from ${lockedSupplier.name}`
                            : 'Select all items for the first supplier in this list'
                        }
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 sticky left-0 z-10 bg-zinc-50 shadow-[1px_0_0_0_#e4e4e7] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onIngSort('name')}
                        className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                      >
                        <span>Ingredient</span>
                        <SortIcon active={ingSortField === 'name'} direction={ingSortDirection} />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onIngSort('stock_quantity')}
                        className="group inline-flex items-center justify-end gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm ml-auto"
                      >
                        <span>On Hand</span>
                        <SortIcon active={ingSortField === 'stock_quantity'} direction={ingSortDirection} />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('avg_daily_burn_rate')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Daily Usage</span>
                          <SortIcon active={ingSortField === 'avg_daily_burn_rate'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Average daily consumption based on recipes sold over the last 90 days (3 months), weighted toward recent 14-day and 30-day velocity." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('days_remaining')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Est. Time Left</span>
                          <SortIcon active={ingSortField === 'days_remaining'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Estimated days until current stock runs out at your current daily usage rate." />
                      </div>
                    </th>
                    <th className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('suggested_purchase_qty')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Suggested Order</span>
                          <SortIcon active={ingSortField === 'suggested_purchase_qty'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Recommended purchase quantity in supplier units to maintain a 14-day supply buffer." />
                      </div>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onIngSort('supplier_name')}
                        className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                      >
                        <span>Supplier</span>
                        <SortIcon active={ingSortField === 'supplier_name'} direction={ingSortDirection} />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedIngredients.map((item) => {
                    const isSelected = selectedIngredientIds.includes(item.id);
                    const isSupplierLockedOut = Boolean(
                      lockedSupplier?.id &&
                      !isSelected &&
                      doesItemMatchSupplier &&
                      !doesItemMatchSupplier(item, lockedSupplier.id)
                    );
                    const needsOrder =
                      item.urgency_status === 'CRITICAL' ||
                      item.urgency_status === 'OUT_OF_STOCK' ||
                      item.urgency_status === 'LOW_STOCK';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-zinc-50'
                            : isSupplierLockedOut
                              ? 'opacity-50'
                              : 'hover:bg-zinc-50/60'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isSupplierLockedOut}
                            onChange={() => onToggleItemSelect(item.id)}
                            title={
                              isSupplierLockedOut
                                ? `Locked to ${lockedSupplier.name} — one supplier per Purchase Order`
                                : `Select ${item.name}`
                            }
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Ingredient Name & Category */}
                        <td className="py-3.5 px-4 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5] whitespace-nowrap">
                          <div className="font-semibold text-zinc-900">{item.name}</div>
                          <div className="text-xs text-zinc-400">{item.category}</div>
                        </td>

                        {/* On Hand */}
                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">
                            {Number(item.stock_quantity).toLocaleString()}
                          </span>{' '}
                          <span className="text-zinc-500 text-xs">{item.unit}</span>
                        </td>

                        {/* Daily Usage */}
                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap text-zinc-700">
                          {item.avg_daily_burn_rate > 0 ? (
                            <>
                              <span className="font-medium text-zinc-900">{item.avg_daily_burn_rate}</span>{' '}
                              <span className="text-xs text-zinc-400">{item.unit}/d</span>
                            </>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        {/* Est. Time Left */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <IngredientStatusBadge days={item.days_remaining} urgency={item.urgency_status} />
                        </td>

                        {/* Suggested Order */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.suggested_purchase_qty > 0 ? (
                            <div>
                              <span className="font-semibold text-zinc-900">
                                {item.suggested_purchase_qty} {item.purchase_unit}
                              </span>
                              {item.estimated_restock_cost > 0 && (
                                <span className="text-xs text-zinc-500 font-mono ml-1.5">
                                  ({formatCurrency(item.estimated_restock_cost)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">Sufficient</span>
                          )}
                        </td>

                        {/* Supplier */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-zinc-700 font-medium">
                            {item.supplier_name || 'Unassigned'}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenSingleItemPO(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              needsOrder
                                ? 'bg-zinc-900 hover:bg-black text-white'
                                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            Order
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredIngredients.length > pageSize && (
              <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <div>
                  Showing <span className="font-semibold text-zinc-900">{(ingPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-zinc-900">
                    {Math.min(ingPage * pageSize, filteredIngredients.length)}
                  </span>{' '}
                  of <span className="font-semibold text-zinc-900">{filteredIngredients.length}</span> ingredients
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIngPage((p) => Math.max(1, p - 1))}
                    disabled={ingPage <= 1}
                    className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-semibold text-zinc-800">
                    {ingPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIngPage((p) => Math.min(totalPages, p + 1))}
                    disabled={ingPage >= totalPages}
                    className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default IngredientRestockTab;
