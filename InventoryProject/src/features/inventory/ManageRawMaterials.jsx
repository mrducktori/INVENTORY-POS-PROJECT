import React from 'react';
import { useManageRawMaterials } from './hooks/useManageRawMaterials';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { formatQuantity } from '../../utils/productUtils';


const ManageRawMaterials = () => {
  const {
    viewMode, setViewMode,
    ingredients, loading, message, setMessage,
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
    UNIT_CHOICES,
    handleAddIngredient,
    handleArchiveToggle,
    handleUpdateIngredient,
    handleSetModify
  } = useManageRawMaterials();

  const filteredList = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !i.is_archived : i.is_archived;
    return matchSearch && matchStatus;
  });

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
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === 'ADD' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Material
          </button>
          <button
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === 'MODIFY' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
        </div>
      </div>

      {/* ---- Alert Banner ---- */}
      {message && (
        <div className={`p-4 mb-6 rounded-xl text-sm font-semibold flex items-center shadow-sm ${message.includes('success') || message.includes('updated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      {/* ---- ADD VIEW ---- */}
      {viewMode === 'ADD' && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-1 max-w-xl">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Add New Raw Material</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddIngredient} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Ingredient Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. COFFEE BEANS"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    required
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit</label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                    >
                      <option value="" disabled>Select Unit</option>
                      {UNIT_CHOICES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Initial Stock</label>
                    <input
                      type="number"
                      value="0"
                      disabled
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Low Stock Alert</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="low_stock_alert"
                      value={formData.low_stock_alert}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                      required
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100 mt-2">
                  <button type="submit" className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5">Add Material</button>
                </div>
              </form>
            </div>
          </div>

          {/* List below form */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-[2]">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight shrink-0">Materials List</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <input
                  type="text"
                  placeholder="Search materials..."
                  className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                  className="w-full sm:w-40 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
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
                <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
              ) : filteredList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Material Name</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Stock</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Alert Level</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">State</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredList.map(i => (
                        <tr key={i.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{i.name}</strong></td>
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
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-50 transition-colors"
                                onClick={() => handleSetModify(i)}
                              >
                                Edit
                              </button>
                              <button
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors ${i.is_archived ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                                onClick={() => handleArchiveToggle(i.id, i.is_archived)}
                              >
                                {i.is_archived ? 'Restore' : 'Archive'}
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
                  <p className="m-0 text-sm font-medium">No materials found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- MODIFY VIEW (card grid, same as ManageProducts) ---- */}
      {viewMode === 'MODIFY' && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Select Material to Modify</h2>
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
            ) : filteredList.filter(i => !i.is_archived).length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                {filteredList.filter(i => !i.is_archived).map(i => (
                  <div
                    key={i.id}
                    className="relative bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-1 cursor-pointer"
                    onClick={() => handleSetModify(i)}
                  >
                    <div className="flex-1 p-5 pb-4 flex flex-col items-start">
                      <h3 className="m-0 text-base font-bold text-gray-900 leading-tight mb-2">{i.name}</h3>
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
                    <div className="flex border-t border-gray-100 bg-gray-50/50 items-center justify-between px-5 py-3 mt-auto">
                      <span className="text-sm font-extrabold text-gray-900">
                        {formatQuantity(i.stock_quantity, i.unit)}
                      </span>
                      <button className="text-xs font-bold text-gray-800 hover:text-black bg-gray-100 hover:bg-gray-150 px-3 py-1.5 rounded transition-colors uppercase tracking-wider">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <p className="m-0 text-sm font-medium">No active materials found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Edit Modal ---- */}
      {selectedIngredient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedIngredient(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[popIn_0.2s_ease-out] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="m-0 text-base font-semibold tracking-wide">Edit: {selectedIngredient.name}</h2>
              <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" onClick={() => setSelectedIngredient(null)}>✕</button>
            </div>
            <div className="p-6">
              <form id="edit-material-form" onSubmit={handleUpdateIngredient} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Ingredient Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Base Unit</label>
                  <select
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                  >
                    <option value="" disabled>Select Unit</option>
                    {UNIT_CHOICES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col gap-1.5 flex-[1.5]">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                      Current Stock <span className="text-[10px] font-normal text-gray-400 normal-case">(read-only)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editQuantity}
                      readOnly
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                    />
                    <p className="m-0 text-xs text-gray-500 mt-1">
                      To update stock, use the <strong className="text-gray-700">Update Stock</strong> module.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Low Alert Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAlert}
                      onChange={e => setEditAlert(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors" onClick={() => setSelectedIngredient(null)}>Cancel</button>
              <button type="submit" form="edit-material-form" className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />


    </div>
  );
};

export default ManageRawMaterials;
