import React from 'react';

/**
 * Numbered pagination with ellipsis and an optional items-per-page dropdown.
 */
const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 20, 50],
  className = ''
}) => {
  if (totalItems === 0 || totalPages <= 1 && !onItemsPerPageChange) {
    if (totalItems === 0) return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) pages.push('ellipsis-start');

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={`px-6 py-4 bg-white border-t border-gray-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm ${className}`}>
      <div className="flex items-center gap-3 text-gray-600 font-medium text-xs sm:text-sm">
        <span>
          Showing <strong className="text-gray-900 font-bold">{startItem}</strong> to{' '}
          <strong className="text-gray-900 font-bold">{endItem}</strong> of{' '}
          <strong className="text-gray-900 font-bold">{totalItems}</strong> items
        </span>

        {onItemsPerPageChange && (
          <div className="hidden sm:flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
            <span className="text-gray-500 text-xs">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:outline-none focus:border-gray-900 cursor-pointer"
            >
              {itemsPerPageOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Previous page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, idx) => {
              if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 font-bold">
                    ...
                  </span>
                );
              }

              const isActive = currentPage === page;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  className={`min-w-8 h-8 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Next page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
