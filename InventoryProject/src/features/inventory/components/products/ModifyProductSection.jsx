import React from 'react';
import { CATEGORIES_WITH_ALL } from '../../../../utils/constants';
import Pagination from '../../../../components/shared/Pagination';
import { CardGridSkeleton } from '../../../../components/shared/SkeletonLoader';

const ModifyProductSection = ({
  loading,
  products,
  totalItems,
  searchTerm,
  categoryFilter,
  onSearchChange,
  onCategoryFilterChange,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onEdit
}) => {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="m-0 text-lg md:text-xl font-bold text-gray-900 tracking-tight">Select Product to Modify</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search products..."
            className="w-full sm:w-48 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          <select
            className="w-full sm:w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
            value={categoryFilter}
            onChange={e => onCategoryFilterChange(e.target.value)}
          >
            {CATEGORIES_WITH_ALL.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <CardGridSkeleton count={8} />
        ) : totalItems > 0 ? (
          <div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6 mb-6">
              {products.map(p => (
                <div
                  key={p.id}
                  className="relative bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-1"
                >
                  <div className="flex-1 p-5 pb-4 flex flex-col">
                    <h3 className="m-0 text-base md:text-lg font-bold text-gray-900 leading-tight mb-1">{p.name}</h3>
                    <span className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider">{p.category}</span>
                  </div>
                  <div className="flex border-t border-gray-100 bg-gray-50/50 items-center justify-between px-5 py-3 mt-auto">
                    <span className="text-base font-black text-gray-900">₱{parseFloat(p.price).toFixed(2)}</span>
                    <button className="text-xs md:text-sm font-bold text-gray-900 hover:text-black bg-white border border-gray-300 hover:bg-gray-100 px-3.5 py-1.5 rounded-lg transition-colors uppercase tracking-wider cursor-pointer" onClick={() => onEdit(p)}>Edit</button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
            />
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <p className="m-0 text-base font-medium">No products found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModifyProductSection;
