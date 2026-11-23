import React from 'react';

const CategoryListSidebar = ({
  categoryList,
  selectedCategory,
  onSelectCategory,
  newCategoryName,
  onNewCategoryNameChange,
  newCategoryStation = 'BARISTA',
  onNewCategoryStationChange,
  onAddCategory,
  loading
}) => {
  return (
    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
      <form
        onSubmit={onAddCategory}
        className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-2.5"
      >
        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          New Category
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={40}
            className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs md:text-sm font-semibold uppercase placeholder:normal-case focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
            placeholder="e.g., RICE MEALS"
            value={newCategoryName}
            onChange={(e) => onNewCategoryNameChange(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newCategoryName.trim()}
            className="px-3.5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            Add
          </button>
        </div>
        {onNewCategoryStationChange && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              KDS Prep Station
            </span>
            <div className="grid grid-cols-2 p-0.5 bg-gray-200/70 rounded-lg gap-0.5">
              {[
                { id: 'BARISTA', label: 'Barista' },
                { id: 'KITCHEN', label: 'Kitchen' }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onNewCategoryStationChange(st.id)}
                  disabled={loading}
                  className={`py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer border-none ${
                    newCategoryStation === st.id
                      ? 'bg-gray-900 text-white shadow-2xs'
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Categories
          </span>
          <span className="text-xs font-bold text-gray-500 font-mono">
            {categoryList.length}
          </span>
        </div>

        <div className="divide-y divide-gray-100 max-h-60 lg:max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {categoryList.length > 0 ? (
            categoryList.map((item) => {
              const isSelected = item.category === selectedCategory;
              const count = item.product_count ?? 0;
              const station = String(item.prep_station || 'BARISTA').toUpperCase();
              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => onSelectCategory(item.category)}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors border-none cursor-pointer ${
                    isSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <span className="text-xs md:text-sm font-bold truncate">
                      {item.category}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                        isSelected
                          ? 'bg-white/15 text-gray-100'
                          : station === 'KITCHEN'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      {station === 'KITCHEN' ? 'Kitchen' : 'Barista'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    title={`${count} product(s)`}
                  >
                    {count}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center text-xs text-gray-500">
              No categories found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryListSidebar;
