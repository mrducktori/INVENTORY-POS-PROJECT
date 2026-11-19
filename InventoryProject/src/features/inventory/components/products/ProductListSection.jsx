import React from 'react';
import { CATEGORIES } from '../../../../utils/constants';
import Pagination from '../../../../components/shared/Pagination';
import { TableSkeleton } from '../../../../components/shared/SkeletonLoader';

const SortIcon = ({ active, direction, ascTitle, descTitle }) => {
  if (!active) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return direction === 'asc' ? (
    <span className="p-0.5 bg-gray-900 text-white rounded" title={ascTitle}>
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
    </span>
  ) : (
    <span className="p-0.5 bg-gray-900 text-white rounded" title={descTitle}>
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </span>
  );
};

const ProductListSection = ({
  loading,
  products,
  categories,
  totalItems,
  searchTerm,
  categoryFilter,
  statusFilter,
  onSearchChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onNameSort,
  onPriceSort,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  isProcessing,
  processingId,
  onEdit,
  onArchiveToggle,
  onPermanentDelete
}) => {
  const categoryOptions = [
    'ALL',
    ...(Array.isArray(categories) && categories.length > 0
      ? categories
      : CATEGORIES.filter((c) => c !== 'OTHERS'))
  ];

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-[2]">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <h2 className="m-0 text-lg md:text-xl font-bold text-gray-900 tracking-tight shrink-0">Product List</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <input
            type="text"
            placeholder="Search name..."
            className="w-full sm:w-48 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          <select
            className="w-full sm:w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
            value={categoryFilter}
            onChange={e => onCategoryFilterChange(e.target.value)}
          >
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="w-full sm:w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="ARCHIVED">Archived Only</option>
          </select>
        </div>
      </div>
      <div className="p-0">
        {loading ? (
          <div className="p-4 md:p-6">
            <TableSkeleton rows={itemsPerPage} cols={6} />
          </div>
        ) : totalItems > 0 ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200">
                    <th
                      className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none group sticky left-0 z-10 bg-gray-100 shadow-[1px_0_0_0_#e5e7eb]"
                      onClick={onNameSort}
                      title="Click to sort alphabetically (A-Z, Z-A)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Product Name</span>
                        <SortIcon active={sortField === 'name'} direction={sortDirection} ascTitle="A to Z" descTitle="Z to A" />
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Category</th>
                    <th
                      className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none group"
                      onClick={onPriceSort}
                      title="Click to sort by price (Low to High, High to Low, Default)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Price</span>
                        <SortIcon active={sortField === 'price'} direction={sortDirection} ascTitle="Price: Low to High" descTitle="Price: High to Low" />
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-4 py-3.5 border-b border-gray-100 sticky left-0 z-10 bg-white group-hover:bg-gray-50 transition-colors shadow-[1px_0_0_0_#f3f4f6]">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-lg shadow-sm border border-gray-200 shrink-0 hidden sm:block" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg hidden sm:flex items-center justify-center text-gray-400 border border-gray-200 shrink-0">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <strong className={`text-sm md:text-base font-extrabold truncate ${p.is_archived ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{p.name}</strong>
                            <span className="text-xs font-bold text-gray-500 uppercase sm:hidden">{p.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell"><span className="text-xs md:text-sm font-bold text-gray-600 uppercase tracking-wider truncate block max-w-[120px]">{p.category}</span></td>
                      <td className="px-4 py-3.5 text-sm md:text-base font-extrabold text-gray-900 whitespace-nowrap">₱{parseFloat(p.price).toFixed(2)}</td>
                      <td className="px-4 py-3.5 align-middle">
                        {p.track_stock ? (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex w-max px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                              p.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                              p.stock_quantity <= p.low_stock_threshold ? 'bg-red-50 text-red-600 border border-red-100' :
                              p.stock_quantity <= p.low_stock_threshold * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                            }`}>
                              {p.stock_quantity} in stock
                            </span>
                            <span className="text-xs font-semibold text-gray-500">Restock via Supplier PO</span>
                          </div>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-800 border border-gray-200 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap">Recipe based</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-middle hidden md:table-cell">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap ${p.is_archived ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                          {p.is_archived ? 'ARCHIVED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right align-middle">
                        <div className="flex gap-2 justify-end">
                          <button
                            disabled={isProcessing}
                            className="px-3.5 py-1.5 bg-white border border-gray-300 text-gray-800 text-xs md:text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            onClick={() => onEdit(p)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={isProcessing}
                            className={`px-3.5 py-1.5 text-xs md:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 ${p.is_archived ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                            onClick={() => onArchiveToggle(p.id, p.is_archived)}
                          >
                            {processingId === p.id && (
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            )}
                            {processingId === p.id ? 'Please wait...' : p.is_archived ? 'Restore' : 'Archive'}
                          </button>
                          {p.is_archived && (
                            <button
                              disabled={isProcessing || (p.days_since_archived ?? 0) < 30}
                              className={`px-3.5 py-1.5 text-xs md:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                                (p.days_since_archived ?? 0) >= 30
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                              }`}
                              title={
                                (p.days_since_archived ?? 0) >= 30
                                  ? 'Permanently delete this product'
                                  : `Can be deleted after 30 days (${Math.max(1, 30 - (p.days_since_archived || 0))} days remaining)`
                              }
                              onClick={() => onPermanentDelete(p.id)}
                            >
                              {(p.days_since_archived ?? 0) >= 30
                                ? 'Delete'
                                : `Delete (${Math.max(1, 30 - (p.days_since_archived || 0))}d)`}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
              onItemsPerPageChange={onItemsPerPageChange}
            />
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            <p className="m-0 text-base font-medium">No products available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductListSection;
