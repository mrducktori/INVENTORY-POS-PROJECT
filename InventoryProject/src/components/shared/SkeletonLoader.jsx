import React from 'react';

/**
 * TableSkeleton — Renders an executive-grade table skeleton with shimmering pulse rows.
 * @param {number} rows - Number of skeleton rows to render (default 6)
 * @param {number} cols - Number of columns to simulate (default 5)
 */
export const TableSkeleton = ({ rows = 6 }) => {
  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-xs animate-pulse">
      {/* Table Header Placeholder */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="h-4 bg-zinc-200 rounded w-1/4" />
        <div className="h-4 bg-zinc-200 rounded w-1/6 hidden sm:block" />
        <div className="h-4 bg-zinc-200 rounded w-1/6" />
        <div className="h-4 bg-zinc-200 rounded w-1/6 hidden md:block" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-1/3">
              <div className="w-10 h-10 rounded-lg bg-zinc-200 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-zinc-200 rounded w-4/5" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
              </div>
            </div>

            <div className="h-4 bg-zinc-200 rounded w-1/6 hidden sm:block" />
            <div className="h-4 bg-zinc-200 rounded w-1/6" />
            <div className="h-6 bg-zinc-200 rounded-full w-20 hidden md:block" />
            <div className="h-8 bg-zinc-200 rounded-lg w-16" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * CardGridSkeleton — Renders product/catalog grid card skeletons.
 * @param {number} count - Number of cards (default 8)
 */
export const CardGridSkeleton = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col justify-between shadow-xs">
          <div>
            {/* Image Placeholder */}
            <div className="w-full aspect-square rounded-xl bg-zinc-200 mb-3" />
            
            {/* Title & Tag */}
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-zinc-200 rounded w-3/4" />
              <div className="h-3 bg-zinc-100 rounded w-1/2" />
            </div>
          </div>

          {/* Price & Action */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between mt-auto">
            <div className="h-5 bg-zinc-200 rounded w-16" />
            <div className="h-8 bg-zinc-200 rounded-lg w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * StatCardsSkeleton — Renders KPI summary stat card skeletons.
 * @param {number} count - Number of KPI cards (default 4)
 */
export const StatCardsSkeleton = ({ count = 4 }) => {
  const gridColsClass =
    count === 5
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
      : count === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridColsClass} gap-4 animate-pulse`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white border border-zinc-200 p-5 rounded-xl shadow-xs flex flex-col justify-center text-center space-y-2">
          <div className="h-3 bg-zinc-200 rounded w-2/3 mx-auto" />
          <div className="h-8 bg-zinc-200 rounded w-1/3 mx-auto" />
        </div>
      ))}
    </div>
  );
};

/**
 * FullModuleSkeleton — Renders a full module view with header, filter bar, and table.
 */
export const FullModuleSkeleton = ({ showCards = true }) => {
  return (
    <div className="p-4 md:p-8 flex-1 bg-zinc-50 overflow-y-auto w-full space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="h-7 bg-zinc-200 rounded w-48" />
          <div className="h-4 bg-zinc-100 rounded w-72" />
        </div>
        <div className="h-10 bg-zinc-200 rounded-xl w-32" />
      </div>

      {/* Optional Stat Cards */}
      {showCards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-zinc-200 p-5 rounded-xl h-24" />
          <div className="bg-white border border-zinc-200 p-5 rounded-xl h-24" />
          <div className="bg-white border border-zinc-200 p-5 rounded-xl h-24" />
          <div className="bg-white border border-zinc-200 p-5 rounded-xl h-24" />
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 flex flex-col sm:flex-row justify-between gap-4">
        <div className="h-10 bg-zinc-100 rounded-lg w-full sm:w-64" />
        <div className="h-10 bg-zinc-100 rounded-lg w-full sm:w-48" />
      </div>

      {/* Table */}
      <TableSkeleton rows={7} cols={5} />
    </div>
  );
};

export default {
  TableSkeleton,
  CardGridSkeleton,
  StatCardsSkeleton,
  FullModuleSkeleton
};
