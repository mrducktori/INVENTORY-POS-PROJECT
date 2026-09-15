import React from 'react';

// ---------------------------------------------------------------------------
// TopSalesGrid
// Renders each sales category as a card with a ranked product list inside.
// Accepts a sorting function from the parent hook via props — no logic here.
// ---------------------------------------------------------------------------

const TopSalesGrid = ({
  loading,
  topProductsByCategory,
  sortAsc,
  onToggleSort,
  getSortedProducts,
  period,
  onPeriodChange,
}) => {
  const categoryEntries = Object.entries(topProductsByCategory || {});
  const isEmpty = categoryEntries.length === 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm col-span-1">
      <div className="flex justify-between items-center flex-wrap gap-3 mb-6 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800 m-0">Top Sales by Category</h3>
          <div className="flex bg-gray-100 rounded-md p-1">
            <button 
              onClick={() => onPeriodChange('day')}
              className={`px-3 py-1 text-xs font-medium border-none rounded cursor-pointer transition-colors ${period === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Today
            </button>
            <button 
              onClick={() => onPeriodChange('week')}
              className={`px-3 py-1 text-xs font-medium border-none rounded cursor-pointer transition-colors ${period === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Week
            </button>
          </div>
        </div>
        <button
          className="bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 cursor-pointer transition-colors hover:bg-gray-50 hover:text-gray-900"
          onClick={onToggleSort}
        >
          Sort: {sortAsc ? 'Lowest First ↑' : 'Highest First ↓'}
        </button>
      </div>

      <div className="min-h-[300px] flex flex-col items-start w-full">
        {loading ? (
          <div className="text-gray-500 italic flex justify-center items-center w-full h-full min-h-[300px]">Loading categorized products...</div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 w-full">
            {isEmpty ? (
              <div className="p-6 text-gray-500 text-center w-full">
                No sales data available.
              </div>
            ) : (
              categoryEntries.map(([category, products]) => (
                <div key={category} className="bg-gray-50/50 border border-gray-100 rounded-lg p-5 mb-6 break-inside-avoid">
                  <h4 className="m-0 mb-4 text-xs font-semibold uppercase tracking-widest border-b border-gray-200 pb-2 text-gray-900">{category}</h4>
                  <ul className="list-none p-0 m-0">
                    {getSortedProducts(products).map((product, index) => (
                      <li key={product.name} className="flex items-center gap-3 py-2 border-b border-dashed border-gray-200 text-sm last:border-b-0">
                        <span className="font-bold text-gray-400 text-xs min-w-[24px] shrink-0">#{index + 1}</span>
                        <span className="flex-1 text-gray-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{product.name}</span>
                        <span className="font-semibold text-gray-900 text-xs bg-white border border-gray-200 px-2 py-1 rounded-md shrink-0 whitespace-nowrap shadow-sm">{product.value} sold</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopSalesGrid;
