import React from 'react';
import { TableSkeleton } from '../../../components/shared/SkeletonLoader';
import { InfoTip } from '../../../components/shared/InfoTip';
import { getManilaDateOnly } from '../../../utils/dateUtils';
import { formatQty, suggestedPurchase } from '../utils/forecastUtils';
import { SortIcon, IngredientAlertBadge, UsageBadge, ExpiryLevelBadge } from './ForecastBadges';

const getDaysUntilDate = (dateStr, todayStr) => {
  if (!dateStr) return null;
  const t0 = new Date(`${todayStr}T00:00:00Z`).getTime();
  const t1 = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return Math.round((t1 - t0) / 86400000);
};

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
  selectableIngredients,
  selectedPoCount,
  getChosenSupplier,
  onChooseSupplier,
  submittingPO,
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
  const todayManila = getManilaDateOnly();
  const totalPages = Math.ceil(filteredIngredients.length / pageSize);
  const isAllSelectableChecked =
    selectableIngredients.length > 0 &&
    selectableIngredients.every((item) => selectedIngredientIds.includes(item.id));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Order now', ingredientData.summary.criticalCount, 'text-red-600'],
          ['Running low (manual limit)', ingredientData.summary.lowStockCount, 'text-amber-600'],
          ['Enough stock', ingredientData.summary.healthyCount, 'text-zinc-900'],
          ['May expire before use', ingredientData.summary.expiringCount, 'text-amber-700'],
        ].map(([label, val, color]) => (
          <div key={label} className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500">{label}</span>
            <div className={`text-2xl sm:text-2xl font-bold mt-1 tabular-nums ${color}`}>
              {loadingIngredients ? '—' : val}
            </div>
          </div>
        ))}
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
                placeholder="Search ingredient..."
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
                    disabled={submittingPO}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
                  >
                    {selectedPoCount > 1 ? `Create ${selectedPoCount} POs` : 'Create PO'} ({selectedIngredientIds.length} selected)
                  </button>
                </div>
              ) : (
                ingredientData.summary.criticalCount > 0 && (
                  <button
                    type="button"
                    onClick={onOrderAllCritical}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    Order everything that is low ({ingredientData.summary.criticalCount})
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
                <span>How this works</span>
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={loadingIngredients}
                className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Reload"
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
            <div className="flex flex-wrap items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
              {[
                { id: 'ALL', label: 'All', count: ingredientData.ingredients.length },
                { id: 'ORDER', label: 'Order now', count: ingredientData.summary.criticalCount },
                { id: 'WATCH', label: 'Running low', count: ingredientData.summary.lowStockCount },
                { id: 'OK', label: 'Enough stock', count: ingredientData.summary.healthyCount },
                { id: 'CANNOT_MAKE', label: "Can't make", count: ingredientData.summary.cannotMakeCount },
                { id: 'EXPIRING', label: 'Expiring', count: ingredientData.summary.expiringLevelCount },
                { id: 'UNUSED', label: 'Not used', count: ingredientData.summary.unusedCount },
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
            <TableSkeleton rows={6} cols={8} />
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
                        title="Select all items that have a supplier"
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
                    <th className="py-3 px-4 whitespace-nowrap">Supplier</th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('usable_stock')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Usable stock</span>
                          <SortIcon active={ingSortField === 'usable_stock'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Stock that has not expired." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('daily_usage')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Daily usage</span>
                          <SortIcon active={ingSortField === 'daily_usage'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Expected use per day, taken from the sales forecast and your recipes." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('days_of_cover')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Days of cover</span>
                          <SortIcon active={ingSortField === 'days_of_cover'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="How many days the usable stock will last at the expected daily usage." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('reorder_point')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Reorder point</span>
                          <SortIcon active={ingSortField === 'reorder_point'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="= daily usage × (supplier lead time + 2 safety days). When usable stock falls to this level, it is time to order." />
                      </div>
                    </th>
                    <th className="py-3 px-4 ">
                      <div className="inline-flex items-center  gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIngSort('suggested_order_qty')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Suggested order</span>
                          <SortIcon active={ingSortField === 'suggested_order_qty'} direction={ingSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Enough to cover the lead time, the safety days and a restocking cycle, minus what you have." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedIngredients.map((item) => {
                    const isSelected = selectedIngredientIds.includes(item.id);
                    const suppliers = item.available_suppliers || [];
                    const chosen = getChosenSupplier(item);
                    const unused = item.usage_status === 'NOT_IN_ANY_RECIPE';
                    const noSupplier = !chosen;
                    const orderBlocked = noSupplier || unused;
                    const blockedTitle = unused ? 'Not used by any product' : 'No supplier set. Add this item to a supplier catalog first.';
                    const needsOrder = ['OUT_OF_STOCK', 'CANNOT_MAKE', 'REORDER_NOW'].includes(item.alert);
                    const firstBlocked = item.alert === 'CANNOT_MAKE' ? (item.blocked_products || [])[0] : null;
                    const moreBlocked = (item.blocked_products || []).length - 1;
                    const usable = Number(item.usable_stock) || 0;
                    const expired = Number(item.expired_stock) || 0;
                    const expiringQty = Number(item.expiring_before_use_qty) || 0;
                    const nearestDays = getDaysUntilDate(item.nearest_expiry_date, todayManila);
                    const usage = Number(item.daily_usage) || 0;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors group ${
                          isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50/60'
                        } ${unused ? 'opacity-60' : ''}`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={orderBlocked}
                            onChange={() => onToggleItemSelect(item.id)}
                            title={orderBlocked ? blockedTitle : `Select ${item.name}`}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>

                        <td className="py-3.5 px-4 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5] whitespace-nowrap">
                          <div className="font-semibold text-zinc-900">{item.name}</div>
                          <div className="text-xs text-zinc-400">{item.category}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <UsageBadge usageStatus={item.usage_status} />
                            <ExpiryLevelBadge level={item.expiry_level} qtyByLevel={item.expiring_qty_by_level} unit={item.unit} />
                          </div>
                          {firstBlocked && (
                            <div className="text-[11px] font-medium text-red-700">
                              Needs {formatQty(firstBlocked.needs)} {item.unit} for {firstBlocked.name}
                              {moreBlocked > 0 ? ` +${moreBlocked} more` : ''}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {noSupplier ? (
                            <span className="text-xs text-amber-700/80">No supplier set</span>
                          ) : (
                            <select
                              value={chosen.supplier_id}
                              onChange={(e) => onChooseSupplier(item.id, e.target.value)}
                              aria-label={`Supplier for ${item.name}`}
                              className="max-w-52 py-1 px-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer"
                            >
                              {suppliers.map((s) => (
                                <option key={s.supplier_id} value={s.supplier_id}>
                                  {`${s.supplier_name} · ${s.lead_time_days}d · ₱${Number(s.default_price) || 0}/${s.default_purchase_unit || item.unit}`}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">{formatQty(usable)}</span>{' '}
                          <span className="text-zinc-500 text-xs">{item.unit}</span>
                          {expired > 0 && (
                            <div className="text-[10px] font-bold text-red-700">
                              + {formatQty(expired)} {item.unit} expired (not counted)
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap text-zinc-700">
                          {usage > 0 ? (
                            <>
                              <span className="font-medium text-zinc-900">{formatQty(usage)}</span>{' '}
                              <span className="text-xs text-zinc-400">{item.unit}/day</span>
                            </>
                          ) : (
                            <span className="text-zinc-400 text-xs">No recent use</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono text-zinc-900">
                            {item.days_of_cover == null ? '—' : `${formatQty(item.days_of_cover)} days`}
                          </div>
                          <IngredientAlertBadge alert={item.alert} daysOfCover={item.days_of_cover} blockedProducts={item.blocked_products} />
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap text-zinc-700">
                          {usage > 0 ? (
                            <>
                              {formatQty(item.reorder_point)} <span className="text-xs text-zinc-400">{item.unit}</span>
                              <div className="font-sans text-[10px] text-zinc-400">
                                {item.lead_time_days}d supplier lead time + {item.safety_days}d safety
                              </div>
                            </>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {Number(item.suggested_order_qty) > 0 ? (
                            (() => {
                              const buy = suggestedPurchase(item, chosen);
                              if (buy.needsSetup) {
                                return (
                                  <span
                                    title={`Pack size for "${buy.unit}" is not set. Edit this supplier and enter how many ${item.unit} are in one ${buy.unit}.`}
                                    className="inline-flex px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[11px] font-bold text-red-700"
                                  >
                                    Set pack size
                                  </span>
                                );
                              }
                              return (
                                <>
                                  <div className="font-semibold text-zinc-900">
                                    {formatQty(buy.qty)} × {buy.unit}
                                  </div>
                                  {buy.conversionFactor !== 1 && (
                                    <div className="text-[11px] text-zinc-500">
                                      = {formatQty(buy.totalStock)} {item.unit} total
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-zinc-400">Not needed</span>
                          )}
                          {expiringQty > 0 && (
                            <div className="mt-1">
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                                {formatQty(expiringQty)} {item.unit} expires before use
                                {nearestDays !== null && nearestDays >= 0 ? ` (in ${nearestDays}d)` : ''}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenSingleItemPO(item)}
                            disabled={orderBlocked || submittingPO || (!noSupplier && suggestedPurchase(item, chosen).needsSetup)}
                            title={orderBlocked ? blockedTitle : `Create a PO for ${item.name}`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              needsOrder ? 'bg-zinc-900 hover:bg-black text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
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
