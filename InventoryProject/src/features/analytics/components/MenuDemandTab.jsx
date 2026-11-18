import React from 'react';
import { TableSkeleton } from '../../../components/shared/SkeletonLoader';
import { InfoTip } from '../../../components/shared/InfoTip';
import { SortIcon, ProductTrendBadge } from './ForecastBadges';

const MenuDemandTab = ({
  loadingProducts,
  productSummary,
  productSearch,
  setProductSearch,
  productCategory,
  setProductCategory,
  productCategories,
  filteredProducts,
  paginatedProducts,
  prodPage,
  setProdPage,
  pageSize,
  prodSortField,
  prodSortDirection,
  onProdSort,
  onOpenMonthlyModal,
  onOpenGuide,
  onRefresh,
}) => {
  const totalPages = Math.ceil(filteredProducts.length / pageSize);

  return (
    <div className="space-y-5">
      {/* 3 Clean Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Projected 7-Day Volume</span>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 tabular-nums">
            {loadingProducts ? '—' : `${productSummary.total7DayUnits.toLocaleString()} orders`}
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Highest Demand Item</span>
          <div className="text-lg sm:text-xl font-bold text-zinc-900 mt-1 truncate">
            {loadingProducts
              ? '—'
              : productSummary.topProduct
              ? `${productSummary.topProduct.name} (${productSummary.topProduct.predictedNext7Days} est.)`
              : 'No sales data'}
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Trending Up This Week</span>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 tabular-nums">
            {loadingProducts ? '—' : `${productSummary.trendingUpCount} items`}
          </div>
        </div>
      </div>

      {/* Product Demand Table Card */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Structured Multi-Tier Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          {/* Row 1: Search on Left, Action Buttons on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                placeholder="Search menu item..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
                <span>Menu Forecast Guide</span>
              </button>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loadingProducts}
                className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Refresh menu forecasts"
              >
                <svg className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Row 2: Category Filter Pills */}
          {productCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setProductCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  productCategory === 'ALL'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                All Categories
              </button>
              {productCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setProductCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    productCategory === cat
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadingProducts ? (
          <div className="p-6">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-14 text-center text-sm text-zinc-500">
            No menu items found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold select-none">
                    <th className="py-3 px-4 sticky left-0 z-10 bg-zinc-50 shadow-[1px_0_0_0_#e4e4e7] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onProdSort('name')}
                        className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                      >
                        <span>Menu Item</span>
                        <SortIcon active={prodSortField === 'name'} direction={prodSortDirection} />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onProdSort('category')}
                        className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                      >
                        <span>Category</span>
                        <SortIcon active={prodSortField === 'category'} direction={prodSortDirection} />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onProdSort('avgDailySales')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Daily Average</span>
                          <SortIcon active={prodSortField === 'avgDailySales'} direction={prodSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Average cups or orders sold per day over the recent 30 to 90 days." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onProdSort('predictedNext7Days')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Next 7 Days</span>
                          <SortIcon active={prodSortField === 'predictedNext7Days'} direction={prodSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Projected orders for the upcoming 7 days blending recent 14d/30d counter velocity and a 90-day baseline with 4-year (2023–2026) monthly seasonality, Monday/Friday peak school days, weekends, and holidays." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onProdSort('predictedNext30Days')}
                        className="group inline-flex items-center justify-end gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm ml-auto"
                      >
                        <span className="flex flex-col items-end leading-tight" title="Rolling from today">Next 30 Days<span className="text-[10px] font-normal text-zinc-400">Rolling from today</span></span>
                        <SortIcon active={prodSortField === 'predictedNext30Days'} direction={prodSortDirection} />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onProdSort('seasonalIndex')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Seasonality (4-Yr)</span>
                          <SortIcon active={prodSortField === 'seasonalIndex'} direction={prodSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Multi-year seasonal index (2023–2026) comparing this calendar month's historical demand against the annual average (above 1.0x = peak season)." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onProdSort('growthRate')}
                          className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                        >
                          <span>Sales Trend</span>
                          <SortIcon active={prodSortField === 'growthRate'} direction={prodSortDirection} />
                        </button>
                        <InfoTip position="bottom" text="Blends recent 14-day vs. 16-day momentum with multi-year Year-over-Year (YoY) growth trajectory." />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Monthly View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedProducts.map((item) => {
                    const est30Days =
                      item.predictedNext30Days || Math.round((Number(item.predictedNext7Days) || 0) * 4.3);
                    const sIdx = parseFloat(item.seasonalIndex) || 1.0;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors group">
                        <td className="py-3.5 px-4 font-semibold text-zinc-900 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5] whitespace-nowrap">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-zinc-700">
                          {item.avgDailySales} <span className="text-xs text-zinc-400">/ day</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">
                          {item.predictedNext7Days} <span className="text-xs font-normal text-zinc-500">orders</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-zinc-700">
                          ~{est30Days} <span className="text-xs text-zinc-400">orders</span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold border ${
                              sIdx >= 1.12
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : sIdx <= 0.9
                                ? 'bg-zinc-50 text-zinc-500 border-zinc-200'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}
                          >
                            {sIdx.toFixed(2)}x
                            <span className="font-sans text-[10px] font-medium opacity-80">
                              {sIdx >= 1.12 ? 'Peak' : sIdx <= 0.9 ? 'Low' : 'Norm'}
                            </span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <ProductTrendBadge growthRate={item.growthRate} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenMonthlyModal(item)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            By Month
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredProducts.length > pageSize && (
              <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <div>
                  Showing <span className="font-semibold text-zinc-900">{(prodPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-zinc-900">
                    {Math.min(prodPage * pageSize, filteredProducts.length)}
                  </span>{' '}
                  of <span className="font-semibold text-zinc-900">{filteredProducts.length}</span> products
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProdPage((p) => Math.max(1, p - 1))}
                    disabled={prodPage <= 1}
                    className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-semibold text-zinc-800">
                    {prodPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProdPage((p) => Math.min(totalPages, p + 1))}
                    disabled={prodPage >= totalPages}
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

export default MenuDemandTab;
