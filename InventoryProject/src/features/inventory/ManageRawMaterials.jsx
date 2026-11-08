import React, { useState, useMemo } from 'react';
import { useManageRawMaterials } from './hooks/useManageRawMaterials';
import ConfirmModal from '../../components/shared/ConfirmModal';
import Pagination from '../../components/shared/Pagination';
import { formatQuantity } from '../../utils/productUtils';

const ManageRawMaterials = () => {
  const {
    viewMode, setViewMode,
    ingredients, loading, message, setMessage,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange,
    selectedIngredient, setSelectedIngredient,
    editName, setEditName,
    editUnit, setEditUnit,
    editAlert, setEditAlert,
    editQuantity,
    editPurchaseUnit, setEditPurchaseUnit,
    editConversionFactor, setEditConversionFactor,
    editCost, setEditCost,
    categoryFilter, setCategoryFilter,
    RAW_MATERIAL_CATEGORIES,
    editCategory, setEditCategory,
    UNIT_CHOICES,
    handleAddIngredient,
    handleArchiveToggle,
    handleUpdateIngredient,
    handleSetModify
  } = useManageRawMaterials();

  // Pagination for Materials List Table
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Pagination for Modify Grid View
  const [modifyCurrentPage, setModifyCurrentPage] = useState(1);
  const [modifyItemsPerPage, setModifyItemsPerPage] = useState(12);

  const archivedRawMaterialsList = useMemo(() => {
    return ingredients.filter(i => i.is_archived);
  }, [ingredients]);

  const filteredList = useMemo(() => {
    return ingredients.filter(i => {
      const matchSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !i.is_archived : i.is_archived;
      const matchCategory = categoryFilter === 'ALL' ? true : i.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [ingredients, searchTerm, statusFilter, categoryFilter]);

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  const handleCategoryChange = (val) => {
    setCategoryFilter(val);
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  // Paginated data for Materials List Table
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  // Paginated data for Modify Grid View
  const activeModifyList = useMemo(() => {
    return filteredList.filter(i => !i.is_archived);
  }, [filteredList]);

  const modifyTotalPages = Math.ceil(activeModifyList.length / modifyItemsPerPage) || 1;
  const paginatedModifyList = useMemo(() => {
    const start = (modifyCurrentPage - 1) * modifyItemsPerPage;
    return activeModifyList.slice(start, start + modifyItemsPerPage);
  }, [activeModifyList, modifyCurrentPage, modifyItemsPerPage]);

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      {/* ---- Page Header ---- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Manage Raw Materials</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Add ingredients, update stock levels, and configure low-stock alerts.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              viewMode === 'ADD' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Material
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              viewMode === 'MODIFY' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
        </div>
      </div>

      {/* ---- Alert Banner ---- */}
      {message && (
        <div className={`p-4 mb-6 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm ${
          message.includes('success') || message.includes('created') || message.includes('updated') 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{message}</span>
          <button 
            type="button" 
            onClick={() => setMessage('')} 
            className="text-xs font-bold uppercase opacity-75 hover:opacity-100 cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---- ADD VIEW (Side-by-Side: Form on Left, Table on Right) ---- */}
      {viewMode === 'ADD' && (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Add Material Card */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-1 max-w-xl w-full">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Add New Raw Material</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddIngredient} className="flex flex-col gap-4">
                {/* Ingredient Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ingredient Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. COFFEE BEANS"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors uppercase"
                    required
                  />
                </div>

                {/* 2-Column Grid: Category & Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category || ''}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                    >
                      <option value="">Select Category</option>
                      {RAW_MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                    >
                      <option value="" disabled>Select Unit</option>
                      {UNIT_CHOICES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* 2-Column Grid: Alert Level & Initial Stock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Low Stock Alert <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      name="low_stock_alert"
                      value={formData.low_stock_alert}
                      onChange={handleInputChange}
                      placeholder="e.g. 50"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      value="0"
                      disabled
                      className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-semibold text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 mt-1">
                  <button 
                    type="submit" 
                    className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all cursor-pointer"
                  >
                    Add Material
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* List beside form */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-[2] w-full">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight shrink-0">Materials List</h2>
                <span className="text-xs font-semibold text-gray-500">({filteredList.length})</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <input
                  type="text"
                  placeholder="Search materials..."
                  className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => handleSearchChange(e.target.value)}
                />
                <select
                  className="w-full sm:w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                  value={statusFilter}
                  onChange={e => handleStatusChange(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="ARCHIVED">Archived Only</option>
                </select>
                <select
                  className="w-full sm:w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                  value={categoryFilter}
                  onChange={e => handleCategoryChange(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  {RAW_MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
              ) : filteredList.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Material Name</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Stock</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Alert Level</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Status</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">State</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedList.map(i => (
                          <tr key={i.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{i.name}</strong></td>
                            <td className="px-6 py-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {i.category || 'GENERAL'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatQuantity(i.stock_quantity, i.unit)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{formatQuantity(i.low_stock_alert, i.unit)}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                i.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                                i.stock_quantity <= i.low_stock_alert ? 'bg-red-50 text-red-600 border border-red-100' :
                                i.stock_quantity <= i.low_stock_alert * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                              }`}>
                                {i.stock_quantity <= 0 ? 'Depleted' :
                                 i.stock_quantity <= i.low_stock_alert ? 'Running Out' :
                                 i.stock_quantity <= i.low_stock_alert * 1.5 ? 'Running Low' : 'Well Stocked'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${i.is_archived ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                {i.is_archived ? 'ARCHIVED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                  onClick={() => handleSetModify(i)}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={isProcessing}
                                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 ${i.is_archived ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                                  onClick={() => handleArchiveToggle(i.id, i.is_archived)}
                                >
                                  {processingId === i.id && (
                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  )}
                                  {processingId === i.id ? 'Please wait...' : i.is_archived ? 'Restore' : 'Archive'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredList.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(newSize) => {
                      setItemsPerPage(newSize);
                      setCurrentPage(1);
                    }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  <p className="m-0 text-sm font-medium">No materials found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Archived Raw Materials Section matching Image 2 */}
      {archivedRawMaterialsList.length > 0 && (
        <div className="mt-8 mb-6 bg-zinc-950 text-white rounded-2xl p-6 border border-zinc-800 shadow-xl w-full">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight m-0">Archived Raw Materials</h3>
              <p className="text-xs text-zinc-400 m-0 mt-0.5">Archived raw materials are hidden from active inventory and purchase orders until restored.</p>
            </div>
            <button
              type="button"
              onClick={fetchIngredients}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {archivedRawMaterialsList.map(i => (
              <div key={i.id} className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0 border border-zinc-700">
                    {i.unit || 'RM'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-zinc-100 truncate">{i.name}</div>
                    <div className="text-xs text-zinc-400">{i.category || 'General'} • {i.stock_quantity || 0} {i.unit}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleArchiveToggle(i.id, true)}
                  disabled={processingId === i.id}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {processingId === i.id ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- MODIFY VIEW (card grid) ---- */}
      {viewMode === 'MODIFY' && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Select Material to Modify</h2>
              <span className="text-xs font-semibold text-gray-500">({activeModifyList.length})</span>
            </div>
            <div className="flex w-full md:w-auto">
              <input
                type="text"
                placeholder="Search materials..."
                className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
            ) : activeModifyList.length > 0 ? (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                  {paginatedModifyList.map(i => (
                    <div
                      key={i.id}
                      className="relative bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-1"
                    >
                      <div className="flex-1 p-5 pb-4 flex flex-col items-start">
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {i.category || 'GENERAL'}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            i.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                            i.stock_quantity <= i.low_stock_alert ? 'bg-red-50 text-red-600 border border-red-100' :
                            i.stock_quantity <= i.low_stock_alert * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {i.stock_quantity <= 0 ? 'OUT' :
                             i.stock_quantity <= i.low_stock_alert ? 'CRITICAL' :
                             i.stock_quantity <= i.low_stock_alert * 1.5 ? 'WARNING' : 'HEALTHY'}
                          </span>
                        </div>
                        <h3 className="m-0 text-base font-bold text-gray-900 leading-tight mb-2">{i.name}</h3>
                      </div>
                      <div className="flex border-t border-gray-100 bg-gray-50/50 items-center justify-between px-5 py-3 mt-auto">
                        <span className="text-sm font-extrabold text-gray-900">
                          {formatQuantity(i.stock_quantity, i.unit)}
                        </span>
                        <button 
                          className="text-xs font-bold text-gray-800 hover:text-black bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors uppercase tracking-wider cursor-pointer" 
                          onClick={() => handleSetModify(i)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="mt-6 border-t border-gray-100 pt-2">
                  <Pagination
                    currentPage={modifyCurrentPage}
                    totalPages={modifyTotalPages}
                    totalItems={activeModifyList.length}
                    itemsPerPage={modifyItemsPerPage}
                    onPageChange={setModifyCurrentPage}
                    onItemsPerPageChange={(newSize) => {
                      setModifyItemsPerPage(newSize);
                      setModifyCurrentPage(1);
                    }}
                    itemsPerPageOptions={[12, 24, 48]}
                  />
                </div>
              </>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <p className="m-0 text-sm font-medium">No active materials found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- EDIT MODAL ---- */}
      {selectedIngredient && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" 
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedIngredient(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[popIn_0.2s_ease-out] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Edit: {selectedIngredient.name}</h2>
              <button 
                type="button"
                className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" 
                onClick={() => setSelectedIngredient(null)}
               aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6">
              <form id="edit-material-form" onSubmit={handleUpdateIngredient} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Ingredient Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Category</label>
                    <select
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                    >
                      <option value="">No Category</option>
                      {RAW_MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Base Unit</label>
                    <select
                      value={editUnit}
                      onChange={e => setEditUnit(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                    >
                      <option value="" disabled>Select Unit</option>
                      {UNIT_CHOICES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col gap-1.5 flex-[1.5]">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      Current Stock <span className="text-xs font-medium text-gray-500 normal-case">(read-only)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editQuantity}
                      readOnly
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm md:text-base font-semibold text-gray-600 cursor-not-allowed"
                    />
                    <p className="m-0 text-xs md:text-sm text-gray-600 mt-1">
                      To update stock, use the <strong className="text-gray-900">Update Stock</strong> module.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Low Alert Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAlert}
                      onChange={e => setEditAlert(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* PO Defaults Section */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Purchase Order Defaults
                  </h4>
                  <p className="text-xs md:text-sm text-gray-600 mb-4 font-medium">These values auto-fill when creating a PO for this ingredient, regardless of supplier.</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Purchase Unit</label>
                      <input
                        type="text"
                        placeholder="e.g. Bag, Box, Sack"
                        value={editPurchaseUnit}
                        onChange={e => setEditPurchaseUnit(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Conversion Factor</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="e.g. 500"
                        value={editConversionFactor}
                        onChange={e => setEditConversionFactor(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                      />
                      <p className="m-0 text-xs font-semibold text-gray-600 mt-0.5">1 {editPurchaseUnit || 'Unit'} = {editConversionFactor || 1} {editUnit || 'units'}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Cost / {editPurchaseUnit || 'Unit'}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="₱0.00"
                        value={editCost}
                        onChange={e => setEditCost(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button 
                type="button"
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer" 
                onClick={() => setSelectedIngredient(null)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="edit-material-form" 
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- CONFIRM MODAL ---- */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        confirmColor={confirmConfig.confirmColor}
        cancelText={confirmConfig.cancelText}
        isLoading={isProcessing}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ManageRawMaterials;
