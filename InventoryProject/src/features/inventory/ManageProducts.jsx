import React, { useState, useRef } from 'react';
import { useManageProducts } from './hooks/useManageProducts';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { CATEGORIES, CATEGORIES_WITH_ALL } from '../../utils/constants';
import { getCurrentUser } from '../../utils/authUtils';
import CategorySettingsModal from './components/CategorySettingsModal';
import SearchableIngredientSelect from '../../components/shared/SearchableIngredientSelect';

const ManageProducts = () => {
  const user = getCurrentUser();
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [editRecipeQty, setEditRecipeQty] = useState('');
  const [editRecipeUnit, setEditRecipeUnit] = useState('');
  const quantityInputRef = useRef(null);

  const {
    viewMode, setViewMode,
    products, loading, uploading, message, setMessage,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange, handleImageUpload,
    selectedProduct, setSelectedProduct,
    recipe, allIngredients,
    newSize, setNewSize,
    newAddOn, setNewAddOn,
    newRecipeItem, setNewRecipeItem,
    editPrice, setEditPrice,
    editName, setEditName,
    editCategory, setEditCategory,
    editImageUrl, setEditImageUrl,
    editTrackStock, setEditTrackStock,
    editStockQty,
    editThreshold, setEditThreshold,
    editSizes,
    editAddOns,
    handleAddSize, handleRemoveSize,
    handleAddAddOn, handleRemoveAddOn,
    handleReceiveProductStock,
    handleAddProduct,
    handleArchiveToggle,
    handleSetRecipe,
    handleUpdateProduct,
    handleDeleteRecipeItem,
    handleAddRecipeItem,
    handleUpdateRecipeItem
  } = useManageProducts();

  if (user?.role === 'Staff') {
    return <div className="p-6 flex-1 bg-gray-50"><h2 className="text-xl font-bold text-red-600">Access Denied</h2></div>;
  }

  const filteredProductsList = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !p.is_archived : p.is_archived;
    const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Product Management</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Create and manage products, categories, and ingredient recipes.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
          <button 
            className={`px-4 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${viewMode === 'ADD' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`} 
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Product
          </button>
          <button 
            className={`px-4 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${viewMode === 'MODIFY' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`} 
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
          <button 
            className="px-4 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all ml-auto md:ml-0 border border-gray-200 bg-white cursor-pointer"
            onClick={() => setShowCategorySettings(true)}
          >
            Add-on Defaults
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-xl text-base font-bold flex items-center shadow-sm ${message.includes('success') || message.includes('updated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{message}</div>
      )}

      {viewMode === 'ADD' && (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-1 max-w-xl">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 ">
              <h2 className="m-0 text-lg md:text-xl font-bold text-gray-900 tracking-tight">Add New Product</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddProduct} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Name</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Category</label>
                    <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer" name="category" value={formData.category} onChange={handleInputChange} required>
                      <option value="">Select Category</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Price (₱)</label>
                    <input type="number" step="any" min="0" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" name="price" value={formData.price} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Image</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, false)}
                      disabled={uploading}
                      className="text-sm md:text-base text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-gray-300 file:text-xs md:file:text-sm file:font-bold file:bg-gray-100 file:text-gray-800 hover:file:bg-gray-200 cursor-pointer"
                    />
                    {uploading && <span className="text-sm text-blue-600 font-bold animate-pulse">Uploading...</span>}
                  </div>
                  {formData.image_url && !uploading && (
                    <div className="mt-2">
                      <img src={formData.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm border border-gray-200" />
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl mt-2">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input type="checkbox" className="sr-only peer" name="track_stock" checked={formData.track_stock} onChange={handleInputChange} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                  </label>
                  <div className="flex flex-col">
                    <span className="text-sm md:text-base font-bold text-gray-900">Direct Stock Tracking</span>
                    <span className="text-xs md:text-sm text-gray-600 mt-1 font-medium">Enable for resellable items like pastries, drinks, etc. rather than recipe-based assembly.</span>
                  </div>
                </div>

                {formData.track_stock && (
                  <div className="flex flex-col sm:flex-row gap-5 p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Initial Stock Level</label>
                      <input type="number" value="0" disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm md:text-base text-gray-500 cursor-not-allowed" />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Low Stock Alert at</label>
                      <input type="number" className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" name="low_stock_threshold" value={formData.low_stock_threshold} onChange={handleInputChange} min="0" required />
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-gray-100 mt-2">
                  <button type="submit" className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">Add Product</button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-[2]">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <h2 className="m-0 text-lg md:text-xl font-bold text-gray-900 tracking-tight shrink-0">Product List</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <input
                  type="text"
                  placeholder="Search name..."
                  className="w-full sm:w-48 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                  className="w-full sm:w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  {CATEGORIES_WITH_ALL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="w-full sm:w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="ARCHIVED">Archived Only</option>
                </select>
              </div>
            </div>
            <div className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-500 font-medium text-base">Loading products...</div>
              ) : filteredProductsList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/70 border-b border-gray-200">
                         <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Name</th>
                         <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Category</th>
                         <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Price</th>
                         <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Stock</th>
                         <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Status</th>
                         <th className="px-4 py-3.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProductsList.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3.5 border-b border-gray-100">
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
                                onClick={() => handleSetRecipe(p)}
                              >
                                Edit
                              </button>
                              <button
                                disabled={isProcessing}
                                className={`px-3.5 py-1.5 text-xs md:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 ${p.is_archived ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                                onClick={() => handleArchiveToggle(p.id, p.is_archived)}
                              >
                                {processingId === p.id && (
                                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                )}
                                {processingId === p.id ? 'Please wait...' : p.is_archived ? 'Restore' : 'Archive'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  <p className="m-0 text-base font-medium">No products available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'MODIFY' && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="m-0 text-lg md:text-xl font-bold text-gray-900 tracking-tight">Select Product to Modify</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full sm:w-48 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select
                className="w-full sm:w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                {CATEGORIES_WITH_ALL.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="p-6">
            {filteredProductsList.filter(p => !p.is_archived).length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
                {filteredProductsList.filter(p => !p.is_archived).map(p => (
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
                      <button className="text-xs md:text-sm font-bold text-gray-900 hover:text-black bg-white border border-gray-300 hover:bg-gray-100 px-3.5 py-1.5 rounded-lg transition-colors uppercase tracking-wider cursor-pointer" onClick={() => handleSetRecipe(p)}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <p className="m-0 text-base font-medium">No products found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-[popIn_0.2s_ease-out] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Modify Product: {selectedProduct.name}</h2>
              <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              <form onSubmit={handleUpdateProduct} className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Name</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text md:text-sm font-bold text-gray-700 uppercase tracking-wider">Category</label>
                    <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer" value={editCategory} onChange={e => setEditCategory(e.target.value)} required>
                      <option value="">Select Category</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                    <div className="flex flex-col gap-1.5 sm:w-1/4">
                      <label className="text md:text-sm font-bold text-gray-700 uppercase tracking-wider">
                        Price (₱) {!selectedProduct.is_archived && <span className="text text-red-500 font-semibold lowercase">(locked)</span>}
                      </label>
                      <input 
                        type="number" 
                        step="any" 
                        min="0" 
                        className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors ${!selectedProduct.is_archived ? 'opacity-60 cursor-not-allowed' : ''}`}
                        value={editPrice} 
                        onChange={e => setEditPrice(e.target.value)} 
                        disabled={!selectedProduct.is_archived}
                        required 
                      />
                    </div>
                 </div>

                 <div className="flex flex-col gap-1.5 mt-2">
                   <label className="text font-semibold text-gray-600 uppercase tracking-wider">Product Image</label>
                   <div className="flex items-center gap-4">
                     <input 
                       type="file" 
                       accept="image/*"
                       onChange={(e) => handleImageUpload(e, true)}
                       disabled={uploading}
                       className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                     />
                     {uploading && <span className="text text-blue-600 font-bold animate-pulse">Uploading...</span>}
                   </div>
                   {editImageUrl && !uploading && (
                     <div className="mt-2">
                       <img src={editImageUrl} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm border border-gray-200" />
                     </div>
                   )}
                 </div>

                 <div className="flex items-start gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl mt-2">
                   <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                     <input type="checkbox" className="sr-only peer" checked={editTrackStock} onChange={e => setEditTrackStock(e.target.checked)} />
                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                   </label>
                   <div className="flex flex-col">
                     <span className="text-sm font-bold text-gray-900">Direct Stock Tracking</span>
                     <span className="text text-gray-500 mt-1">Deducts directly from product stock instead of ingredients</span>
                   </div>
                 </div>

                 {editTrackStock && (
                   <div className="flex flex-col sm:flex-row gap-5 p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                     <div className="flex flex-col gap-1.5 flex-1">
                       <label className="text font-semibold text-gray-600 uppercase tracking-wider">Current Stock <span className="text-[10px] font-normal text-gray-400 normal-case">(read-only)</span></label>
                       <input 
                         type="number" 
                         value={editStockQty} 
                         readOnly 
                         className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                       />
                       <span className="text text-gray-500 mt-1">
                         Update via <strong className="text-gray-700">Update Stock</strong> module.
                       </span>
                     </div>
                     <div className="flex flex-col gap-1.5 flex-1">
                       <label className="text font-semibold text-gray-600 uppercase tracking-wider">Low Stock Alert at</label>
                       <input type="number" className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} min="0" required />
                     </div>
                   </div>
                 )}
                 <div className="flex justify-end">
                  <button type="submit" className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5">Save Changes</button>
                 </div>
               </form>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6 text-sm text-blue-800 leading-relaxed">
                  <strong className="text-blue-900">Tip:</strong> You don't need to add anything here if you already set <strong>Add-on Defaults</strong>. 
                  Sizes and Add-ons added below will <em>override or add to</em> the category settings just for this specific product. 
                  Leave them empty to simply inherit the defaults!
                </div>
                
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  {/* SIZES CONFIGURATION */}
                  <div className="flex-1 w-full bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="m-0 text-base font-bold text-gray-900 mb-4 tracking-tight">Sizes Configuration</h3>
                    {editSizes.length > 0 ? (
                      <div className="overflow-x-auto mb-4 border border-gray-100 rounded-lg">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-3 py-2.5 text font-bold text-gray-700 uppercase tracking-wider">Size Name</th>
                              <th className="px-3 py-2.5 text font-bold text-gray-700 uppercase tracking-wider">Price Add (₱)</th>
                              <th className="px-3 py-2.5 text font-bold text-gray-700 uppercase tracking-wider">Cup Mat.</th>
                              <th className="px-3 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {editSizes.map((sz, i) => (
                              <tr key={i} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2.5 text-sm md:text-base font-bold text-gray-900">{sz.name}</td>
                                <td className="px-3 py-2.5 text-sm md:text-base font-semibold text-gray-700">+{sz.price_add}</td>
                                <td className="px-3 py-2.5 text md:text-sm text-gray-600">{allIngredients.find(ing => ing.id === sz.ingredient_id)?.name || '-'}</td>
                                <td className="px-3 py-2.5 text-right"><button type="button" className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer text-base font-bold" onClick={() => handleRemoveSize(i)}>✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic mb-4">No sizes configured.</p>
                    )}
                    
                    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-gray-500" placeholder="Size Name (e.g., 16 oz)" value={newSize.name} onChange={e => setNewSize({...newSize, name: e.target.value})} />
                      <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-gray-500" placeholder="Price Increase (₱)" value={newSize.price_add} onChange={e => setNewSize({...newSize, price_add: e.target.value})} min="0" />
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cup Material (Optional)</label>
                        <SearchableIngredientSelect
                          ingredients={allIngredients}
                          value={newSize.ingredient_id}
                          onChange={(id) => setNewSize({...newSize, ingredient_id: id})}
                          placeholder="Search cup material (e.g. 16 oz cups)..."
                        />
                      </div>

                      <button type="button" className="w-full py-2.5 bg-white border border-gray-300 text-gray-800 text md:text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors mt-1 cursor-pointer" onClick={handleAddSize}>Add Size</button>
                    </div>
                  </div>

                  {/* ADD-ONS CONFIGURATION */}
                  <div className="flex-1 w-full bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="m-0 text-base font-bold text-gray-900 mb-4 tracking-tight">Add-ons Configuration</h3>
                    {editAddOns.length > 0 ? (
                      <div className="overflow-x-auto mb-4 border border-gray-100 rounded-lg">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-3 py-2.5 text font-bold text-gray-700 uppercase tracking-wider">Add-on</th>
                              <th className="px-3 py-2.5 text font-bold text-gray-700 uppercase tracking-wider">Price (₱)</th>
                              <th className="px-3 py-2.5 text font-bold text-gray-700 uppercase tracking-wider">Mat. Used</th>
                              <th className="px-3 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {editAddOns.map((ao, i) => (
                              <tr key={i} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2.5 text-sm md:text-base font-bold text-gray-900">{ao.name}</td>
                                <td className="px-3 py-2.5 text-sm md:text-base font-semibold text-gray-700">+{ao.price}</td>
                                <td className="px-3 py-2.5 text md:text-sm text-gray-600">{ao.quantity}{ao.unit} {allIngredients.find(ing => ing.id === ao.ingredient_id)?.name || '-'}</td>
                                <td className="px-3 py-2.5 text-right"><button type="button" className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer text-base font-bold" onClick={() => handleRemoveAddOn(i)}>✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic mb-4">No add-ons configured.</p>
                    )}

                    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-gray-500" placeholder="Add-on Name (e.g., Pearl)" value={newAddOn.name} onChange={e => setNewAddOn({...newAddOn, name: e.target.value})} />
                      <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-gray-500" placeholder="Price (₱)" value={newAddOn.price} onChange={e => setNewAddOn({...newAddOn, price: e.target.value})} min="0" />
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Inventory Material Used (Optional)</label>
                        <SearchableIngredientSelect
                          ingredients={allIngredients}
                          value={newAddOn.ingredient_id}
                          onChange={(id, ing) => {
                            setNewAddOn({
                              ...newAddOn,
                              ingredient_id: id,
                              unit: (ing?.unit || '').toUpperCase()
                            });
                          }}
                          placeholder="Search material used (e.g. Tapioca, Syrup)..."
                        />
                      </div>

                      {newAddOn.ingredient_id && (
                        <div className="flex gap-2 items-center">
                          <input type="number" className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-gray-500" placeholder="Qty Used" value={newAddOn.quantity} onChange={e => setNewAddOn({...newAddOn, quantity: e.target.value})} min="0" />
                          <span className="flex items-center justify-center px-4 py-2 bg-gray-200 rounded-md text font-bold text-gray-700">{newAddOn.unit}</span>
                        </div>
                      )}
                      <button type="button" className="w-full py-2.5 bg-white border border-gray-300 text-gray-800 text md:text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors mt-1 cursor-pointer" onClick={handleAddAddOn}>Add Add-on</button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="m-0 text-xl font-extrabold text-gray-900 tracking-tight">Recipe Configuration</h3>
                    <p className="m-0 text-xs text-gray-500 font-medium mt-0.5">Ingredients automatically deducted from raw materials during POS checkout</p>
                  </div>
                  {recipe.length > 0 && (
                    <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200 self-start sm:self-auto">
                      {recipe.length} {recipe.length === 1 ? 'ingredient' : 'ingredients'} configured
                    </span>
                  )}
                </div>
                
                {recipe.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-xs mb-6">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-100/70 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Ingredient</th>
                          <th className="px-4 py-3 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Qty Needed</th>
                          <th className="px-4 py-3 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recipe.map(r => {
                          const unitToUse = r.recipe_unit || r.ingredients?.unit;
                          const isEditing = editingRecipeId === r.id;

                          return (
                            <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-sm md:text-base font-bold text-gray-900">
                                <div>{r.ingredients?.name || r.ingredient_name}</div>
                                {r.ingredients?.current_stock !== undefined && (
                                  <span className="text-xs font-normal text-gray-500">
                                    Stock: {r.ingredients.current_stock} {r.ingredients.unit}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.001"
                                      value={editRecipeQty}
                                      onChange={(e) => setEditRecipeQty(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const qty = parseFloat(editRecipeQty);
                                          if (!isNaN(qty) && qty > 0) {
                                            handleUpdateRecipeItem(r.id, qty, editRecipeUnit);
                                            setEditingRecipeId(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingRecipeId(null);
                                        }
                                      }}
                                      className="w-24 px-2.5 py-1.5 text-sm font-bold border border-gray-900 rounded-md bg-white focus:outline-none ring-1 ring-gray-900"
                                      autoFocus
                                    />
                                    <span className="text-xs font-bold text-gray-700 px-2 py-1 bg-gray-100 rounded border border-gray-200">
                                      {editRecipeUnit}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const qty = parseFloat(editRecipeQty);
                                        if (!isNaN(qty) && qty > 0) {
                                          handleUpdateRecipeItem(r.id, qty, editRecipeUnit);
                                          setEditingRecipeId(null);
                                        }
                                      }}
                                      className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-300 transition-colors cursor-pointer"
                                      title="Save quantity"
                                    >
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingRecipeId(null)}
                                      className="p-1.5 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 text-sm font-bold bg-amber-50 text-amber-900 border border-amber-200/60 rounded-lg">
                                      {r.quantity_used} {unitToUse}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRecipeId(r.id);
                                        setEditRecipeQty(String(r.quantity_used));
                                        setEditRecipeUnit(unitToUse || '');
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                      title="Edit quantity"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors inline-flex items-center justify-center text-sm font-bold cursor-pointer"
                                  onClick={() => handleDeleteRecipeItem(r.id)}
                                  title="Remove from recipe"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center text-gray-500 bg-gray-50 border border-gray-200 border-dashed rounded-xl mb-6">
                    <p className="m-0 text-sm md:text-base font-medium">No recipe configured yet. Add ingredients below to track ingredient usage.</p>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h4 className="m-0 text-xs md:text-sm font-bold text-gray-900 uppercase tracking-wider">Add Ingredient to Recipe</h4>
                    <span className="text-xs text-gray-500">Pick an ingredient, enter qty, then hit Enter</span>
                  </div>

                  {/* Quick-Add Suggestions based on category */}
                  {(() => {
                    const cat = (selectedProduct?.category || '').toUpperCase();
                    let keywords = ['CUPS', 'FRUCTOSE', 'MILK', 'SYRUP'];
                    if (cat.includes('COFFEE')) keywords = ['ESPRESSO', 'MILK', 'FRUCTOSE', 'CUPS', 'CARAMEL'];
                    else if (cat.includes('MILK TEA')) keywords = ['TEA', 'CREAMER', 'FRUCTOSE', 'PEARL', 'CUPS'];
                    else if (cat.includes('FRAPPE')) keywords = ['FRAPPE', 'MILK', 'FRUCTOSE', 'WHIP', 'CUPS'];
                    else if (cat.includes('NON-COFFEE')) keywords = ['MILK', 'FRUCTOSE', 'MATCHA', 'CHOCOLATE', 'CUPS'];
                    else if (cat.includes('PASTRY')) keywords = ['FLOUR', 'BUTTER', 'SUGAR', 'EGG'];

                    const suggestions = allIngredients.filter(ing => {
                      if (recipe.some(r => r.ingredient_id === ing.id)) return false;
                      const name = (ing.name || '').toUpperCase();
                      return keywords.some(kw => name.includes(kw));
                    }).slice(0, 5);

                    if (suggestions.length === 0) return null;

                    return (
                      <div className="flex items-center gap-1.5 flex-wrap mb-4 pb-3 border-b border-gray-200/70">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Quick Select:</span>
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              const baseUnit = (s.unit || '').toUpperCase();
                              let preferredUnit = baseUnit;
                              if (baseUnit === 'L') preferredUnit = 'ML';
                              if (baseUnit === 'KG') preferredUnit = 'G';
                              setNewRecipeItem({
                                ...newRecipeItem,
                                ingredient_id: s.id,
                                input_unit: preferredUnit
                              });
                              setTimeout(() => {
                                quantityInputRef.current?.focus();
                                quantityInputRef.current?.select?.();
                              }, 50);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 text-xs font-semibold rounded-lg border border-gray-300 transition-colors cursor-pointer shadow-2xs hover:border-gray-400"
                          >
                            + {s.name} ({s.unit})
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  <form onSubmit={handleAddRecipeItem} className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex flex-col gap-1.5 flex-[2] w-full">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Select Ingredient</label>
                      <SearchableIngredientSelect
                        ingredients={allIngredients}
                        value={newRecipeItem.ingredient_id}
                        filterExcludedIds={recipe.map(r => r.ingredient_id)}
                        autoFocusNextRef={quantityInputRef}
                        onChange={(id, ing) => {
                          const baseUnit = (ing?.unit || '').toUpperCase();
                          let preferredUnit = baseUnit;
                          if (baseUnit === 'L') preferredUnit = 'ML';
                          if (baseUnit === 'KG') preferredUnit = 'G';
                          setNewRecipeItem({
                            ...newRecipeItem,
                            ingredient_id: id,
                            input_unit: preferredUnit
                          });
                        }}
                        placeholder="Search recipe ingredient (e.g. Syrup, Tea, Cups)..."
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 w-full sm:w-auto">
                      <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Quantity</label>
                      <div className="flex gap-2">
                        <input 
                          ref={quantityInputRef}
                          type="number" 
                          step="any" 
                          min="0.001" 
                          placeholder="Qty" 
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                          value={newRecipeItem.quantity}
                          onChange={e => setNewRecipeItem({ ...newRecipeItem, quantity: e.target.value })}
                          required 
                        />
                        {(() => {
                          const selectedIng = allIngredients.find(i => i.id === newRecipeItem.ingredient_id);
                          const baseUnit = (selectedIng?.unit || '').toUpperCase();
                          
                          if (baseUnit === 'L') {
                            return (
                              <select 
                                className="w-20 px-2 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none cursor-pointer"
                                value={newRecipeItem.input_unit || 'ML'} 
                                onChange={e => setNewRecipeItem({ ...newRecipeItem, input_unit: e.target.value })}
                              >
                                <option value="ML">ML</option>
                                <option value="L">L</option>
                              </select>
                            );
                          } else if (baseUnit === 'KG') {
                            return (
                              <select 
                                className="w-20 px-2 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none cursor-pointer"
                                value={newRecipeItem.input_unit || 'G'} 
                                onChange={e => setNewRecipeItem({ ...newRecipeItem, input_unit: e.target.value })}
                              >
                                <option value="G">G</option>
                                <option value="KG">KG</option>
                              </select>
                            );
                          } else if (baseUnit) {
                            return <span className="flex items-center justify-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 uppercase shrink-0">{baseUnit}</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold hover:bg-black transition-colors shadow-sm h-[40px] w-full sm:w-auto cursor-pointer shrink-0"
                    >
                      Add to Recipe
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
              <button className="px-6 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCategorySettings && (
        <CategorySettingsModal 
          allIngredients={allIngredients} 
          onClose={() => setShowCategorySettings(false)} 
        />
      )}

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

export default ManageProducts;
