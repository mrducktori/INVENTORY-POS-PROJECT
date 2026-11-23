import React from 'react';
import { TableSkeleton } from '../../../components/shared/SkeletonLoader';
import { SortIcon, AiAdjustBadge } from './ForecastBadges';

const unitWord = (p) => (p.track_stock === false ? 'orders' : 'cups/orders');

const formatTrend = (pct) => {
  if (pct == null) return null;
  const rounded = Math.round(pct);
  return rounded === 0 ? 'Steady' : `${rounded > 0 ? '↑' : '↓'} ${Math.abs(rounded)}%`;
};

const TrendCell = ({ pct }) => {
  const label = formatTrend(pct);
  if (!label) return <span className="text-zinc-400 text-xs">Not enough data</span>;
  const rounded = Math.round(pct);
  const color = rounded > 0 ? 'text-emerald-700' : rounded < 0 ? 'text-rose-700' : 'text-zinc-600';
  return (
    <div>
      <span className={`font-semibold ${color}`}>{label}</span>
      {rounded !== 0 && <div className="text-[10px] text-zinc-400">vs previous 4 weeks</div>}
    </div>
  );
};

const AccuracyCell = ({ p }) =>
  p.accuracyPct == null ? (
    <span className="text-zinc-400 text-xs">Not enough data</span>
  ) : (
    <div>
      <span className="font-semibold text-zinc-900">{Math.round(p.accuracyPct)}%</span>{' '}
      <span className="text-xs text-zinc-500">last 4 weeks</span>
      <div className="text-[10px] text-zinc-400">{p.confidence} confidence</div>
    </div>
  );

const SortHeader = ({ label, field, sortField, sortDirection, onSort, right }) => (
  <button
    type="button"
    onClick={() => onSort(field)}
    className={`group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm ${right ? 'ml-auto' : ''}`}
  >
    <span>{label}</span>
    <SortIcon active={sortField === field} direction={sortDirection} />
  </button>
);

const MenuDemandTab = ({
  loadingProducts,
  forecast,
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
  onOpenDetail,
  onOpenGuide,
  onRefresh,
  canRefresh,
  refreshing,
  onRefreshForecast,
}) => {
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const updated = forecast?.generatedAt
    ? new Date(forecast.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const top = productSummary.topProduct;

  return (
    <div className="space-y-5">
      {forecast && (
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl px-4 py-3 text-sm text-zinc-600">
          <div className="font-semibold text-zinc-800">
            Based on sales up to {forecast.asOf}
            {updated ? ` · updated ${updated}` : ''}
          </div>
          {forecast.method && (
            <div className="mt-1 text-xs sm:text-sm">
              <span className="font-semibold text-zinc-700">How this works: </span>
              {forecast.method}{' '}
              <button type="button" onClick={onOpenGuide} className="underline text-zinc-700 hover:text-zinc-900 cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm">
                More details
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Expected sales, next 7 days</span>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 tabular-nums">
            {loadingProducts ? '—' : `${Math.round(productSummary.total7DayUnits).toLocaleString()} cups/orders`}
          </div>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Best seller expected</span>
          <div className="text-lg sm:text-xl font-bold text-zinc-900 mt-1 truncate">
            {loadingProducts ? '—' : top && top.next7 > 0 ? `${top.name} (about ${Math.round(top.next7)})` : 'No sales data'}
          </div>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">Selling more than before</span>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 tabular-nums">
            {loadingProducts ? '—' : `${productSummary.trendingUpCount} items`}
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search menu item..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canRefresh && (
                <button
                  type="button"
                  onClick={onRefreshForecast}
                  disabled={refreshing}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  title="Recalculate the forecast from the latest sales"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh now'}
                </button>
              )}
              <button
                type="button"
                onClick={onRefresh}
                disabled={loadingProducts}
                className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Reload"
              >
                <svg className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {productCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {['ALL', ...productCategories].map((cat) => (
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
                  {cat === 'ALL' ? 'All Categories' : cat}
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
          <div className="py-14 text-center text-sm text-zinc-500">No menu items found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold select-none">
                    <th className="py-3 px-4 sticky left-0 z-10 bg-zinc-50 shadow-[1px_0_0_0_#e4e4e7] whitespace-nowrap">
                      <SortHeader label="Menu Item" field="name" sortField={prodSortField} sortDirection={prodSortDirection} onSort={onProdSort} />
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      <SortHeader label="Next 7 days" field="next7" sortField={prodSortField} sortDirection={prodSortDirection} onSort={onProdSort} right />
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">Busiest day</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <SortHeader label="Trend" field="trendPct" sortField={prodSortField} sortDirection={prodSortDirection} onSort={onProdSort} />
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <SortHeader label="Forecast accuracy" field="accuracyPct" sortField={prodSortField} sortDirection={prodSortDirection} onSort={onProdSort} />
                    </th>
                    <th className="py-3 px-4">Why</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedProducts.map((item) => (
                    <tr key={item.product_id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="py-3.5 px-4 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5] whitespace-nowrap">
                        <div className="font-semibold text-zinc-900">{item.name}</div>
                        <div className="text-xs text-zinc-400">{item.category}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        {item.status === 'OK' || item.next7 > 0 ? (
                          <>
                            <span className="font-bold text-zinc-900">{Math.round(item.next7)}</span>{' '}
                            <span className="text-xs text-zinc-500">{unitWord(item)}</span>
                            <AiAdjustBadge factor={item.aiFactor} reason={item.aiReason} />
                          </>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-zinc-700">{item.peakDay || '—'}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap"><TrendCell pct={item.trendPct} /></td>
                      <td className="py-3.5 px-4 whitespace-nowrap"><AccuracyCell p={item} /></td>
                      <td className="py-3.5 px-4 text-zinc-600 min-w-[240px] max-w-xs">{item.insight}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(item)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          See charts
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProducts.length > pageSize && (
              <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <div>
                  Showing <span className="font-semibold text-zinc-900">{(prodPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-zinc-900">{Math.min(prodPage * pageSize, filteredProducts.length)}</span>{' '}
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
                  <span className="px-2 font-semibold text-zinc-800">{prodPage} / {totalPages}</span>
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
