import React, { useState } from 'react';
import { CardGridSkeleton } from '../../../components/shared/SkeletonLoader';

// ---------------------------------------------------------------------------
// TopSalesGrid
// Displays sales volume categorized by drink / food group,
// complete with category tabs, true compact/open accordion toggles,
// adaptive grid widths, and enlarged item badges.
// ---------------------------------------------------------------------------

const TopSalesGrid = ({
  loading,
  topProductsByCategory,
  sortAsc,
  onToggleSort,
  getSortedProducts,
  period,
  onPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  const categoryEntries = Object.entries(topProductsByCategory || {});
  const isEmpty = categoryEntries.length === 0;

  // Tab selection: 'ALL' or specific category name
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL');

  // Compaction state per category (true = compacted/collapsed, false = open)
  const [compactedMap, setCompactedMap] = useState({});

  const toggleCategoryCompact = (category) => {
    setCompactedMap(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const areAllCompacted = categoryEntries.length > 0 && categoryEntries.every(([cat]) => !!compactedMap[cat]);

  const toggleAllCompacted = () => {
    const nextState = !areAllCompacted;
    const updated = {};
    categoryEntries.forEach(([cat]) => {
      updated[cat] = nextState;
    });
    setCompactedMap(updated);
  };

  const displayedCategories = activeCategoryTab === 'ALL'
    ? categoryEntries
    : categoryEntries.filter(([cat]) => cat === activeCategoryTab);

  // Dynamic grid columns so 3 categories fill all 3 columns evenly without an empty gap
  const getGridColsClass = () => {
    if (activeCategoryTab !== 'ALL') return 'grid-cols-1';
    const count = displayedCategories.length;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl p-6 md:p-8 shadow-xs">
      {/* Header & Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-5 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-xl font-extrabold text-zinc-900 m-0">
            Top Sales by Category
          </h3>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            Categorized sales rankings with tab filters and compactable views.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Compact / Open All toggle */}
          {categoryEntries.length > 0 && (
            <button
              type="button"
              onClick={toggleAllCompacted}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs md:text-sm font-bold text-zinc-700 cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
              title={areAllCompacted ? 'Expand all categories' : 'Collapse all categories'}
            >
              <span>{areAllCompacted ? '▼' : '▲'}</span>
              <span>{areAllCompacted ? 'Open All' : 'Compact All'}</span>
            </button>
          )}

          {/* Segmented Period Switcher */}
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button 
              type="button"
              onClick={() => {
                onPeriodChange('day');
                if (onStartDateChange) onStartDateChange('');
                if (onEndDateChange) onEndDateChange('');
              }}
              className={`px-3.5 py-1.5 text-xs md:text-sm font-bold rounded-lg cursor-pointer transition-all ${
                period === 'day' && !startDate && !endDate
                  ? 'bg-white text-zinc-900 shadow-xs' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Today
            </button>
            <button 
              type="button"
              onClick={() => {
                onPeriodChange('week');
                if (onStartDateChange) onStartDateChange('');
                if (onEndDateChange) onEndDateChange('');
              }}
              className={`px-3.5 py-1.5 text-xs md:text-sm font-bold rounded-lg cursor-pointer transition-all ${
                period === 'week' && !startDate && !endDate
                  ? 'bg-white text-zinc-900 shadow-xs' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Past 7 Days
            </button>
            <button 
              type="button"
              onClick={() => onPeriodChange('custom')}
              className={`px-3.5 py-1.5 text-xs md:text-sm font-bold rounded-lg cursor-pointer transition-all ${
                period === 'custom' || startDate || endDate
                  ? 'bg-white text-zinc-900 shadow-xs' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Custom
            </button>
          </div>

          {(period === 'custom' || startDate || endDate) && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 p-1.5 rounded-xl text-xs">
              <input
                type="date"
                value={startDate || ''}
                onChange={(e) => onStartDateChange && onStartDateChange(e.target.value)}
                className="px-2 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                title="Start Date"
              />
              <span className="text-zinc-400 font-bold">to</span>
              <input
                type="date"
                value={endDate || ''}
                onChange={(e) => onEndDateChange && onEndDateChange(e.target.value)}
                className="px-2 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                title="End Date"
              />
            </div>
          )}

          {/* Sort order toggle */}
          <button
            type="button"
            className="px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs md:text-sm font-bold text-zinc-700 cursor-pointer transition-colors"
            onClick={onToggleSort}
          >
            {sortAsc ? 'Lowest First ↑' : 'Highest First ↓'}
          </button>
        </div>
      </div>

      {/* Category Tabs Bar */}
      {!isEmpty && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 border-b border-zinc-100 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryTab('ALL')}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryTab === 'ALL'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            All Categories ({categoryEntries.length})
          </button>

          {categoryEntries.map(([category, products]) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategoryTab(category)}
              className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                activeCategoryTab === category
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              {category} ({products.length})
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="w-full">
        {loading ? (
          <div className="py-4">
            <CardGridSkeleton count={6} />
          </div>
        ) : isEmpty ? (
          <div className="py-16 px-6 rounded-xl bg-zinc-50 border border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
            <h4 className="text-base font-bold text-zinc-800 m-0 mb-1">
              No Sales Recorded for This Window
            </h4>
            <p className="text-sm text-zinc-500 max-w-md m-0">
              Orders rung up at the register will automatically compile and rank here.
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 items-start ${getGridColsClass()}`}>
            {displayedCategories.map(([category, products]) => {
              const isCompacted = !!compactedMap[category];
              const sorted = getSortedProducts(products);
              const maxUnits = Math.max(...sorted.map((p) => p.value || 1), 1);
              const totalCategorySold = sorted.reduce((sum, p) => sum + (p.value || 0), 0);

              return (
                <div 
                  key={category} 
                  className={`bg-zinc-50/80 border border-zinc-200/90 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xs hover:border-zinc-300 transition-all ${
                    isCompacted ? 'bg-zinc-50/40' : ''
                  }`}
                >
                  {/* Category Header with Compacting & Enlarged Items Indicator */}
                  <div 
                    onClick={() => toggleCategoryCompact(category)}
                    className={`flex items-center justify-between cursor-pointer select-none group transition-all ${
                      isCompacted ? 'pb-0 mb-0' : 'pb-4 mb-4 border-b border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base md:text-lg font-black uppercase tracking-wide text-zinc-900 group-hover:text-black">
                        {category}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryCompact(category);
                        }}
                        className={`text-xs font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1 ${
                          isCompacted 
                            ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-black' 
                            : 'bg-zinc-200/80 text-zinc-700 border-zinc-300 hover:bg-zinc-300'
                        }`}
                      >
                        <span>{isCompacted ? '▼' : '▲'}</span>
                        <span>{isCompacted ? 'Open' : 'Compact'}</span>
                      </button>
                    </div>

                    {/* ENLARGED, HIGH-VISIBILITY ITEMS INDICATOR */}
                    <span className="text-sm md:text-m font-black px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white tracking-wide shadow-2xs">
                      {products.length} {products.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>

                  {/* Body: Compact Summary vs Full List */}
                  {isCompacted ? (
                    /* COMPACTED / COLLAPSED STATE */
                    <div 
                      onClick={() => toggleCategoryCompact(category)}
                      className="mt-3 py-2.5 px-3.5 rounded-xl bg-zinc-100/90 hover:bg-zinc-200/80 transition-colors cursor-pointer flex items-center justify-between text-xs md:text-sm"
                    >
                      <span className="font-semibold text-zinc-600">
                        Total Units: <strong className="text-zinc-900 font-black">{totalCategorySold} sold</strong>
                      </span>
                      <span className="font-bold text-zinc-800 flex items-center gap-1">
                        Click to view items <span>▼</span>
                      </span>
                    </div>
                  ) : (
                    /* EXPANDED / OPEN STATE: List of Products */
                    <ul className="list-none p-0 m-0 space-y-4">
                      {sorted.map((product, index) => {
                        const sharePercent = Math.max(Math.round(((product.value || 0) / maxUnits) * 100), 6);

                        return (
                          <li 
                            key={product.name} 
                            className="flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                  index === 0 
                                    ? 'bg-zinc-900 text-white' 
                                    : index === 1 
                                    ? 'bg-zinc-300 text-zinc-900' 
                                    : 'bg-zinc-200/80 text-zinc-600'
                                }`}>
                                  {index + 1}
                                </span>
                                <span className="font-bold text-sm md:text-base text-zinc-800 truncate" title={product.name}>
                                  {product.name}
                                </span>
                              </div>
                              <span className="tabular-nums shrink-0 text-right whitespace-nowrap">
                                <span className="text-base md:text-lg font-black text-zinc-900 mr-1.5">{product.value}</span>
                                <span className="text-sm md:text-base font-extrabold text-zinc-700">sold</span>
                              </span>
                            </div>

                            {/* Relative share bar */}
                            <div className="w-full bg-zinc-200/70 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  index === 0 ? 'bg-zinc-800' : 'bg-zinc-500'
                                }`}
                                style={{ width: `${sharePercent}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopSalesGrid;
