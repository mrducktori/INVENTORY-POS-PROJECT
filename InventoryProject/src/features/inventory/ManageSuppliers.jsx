import React, { useState, useEffect, useMemo } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/purchasingApi';
import { getIngredients } from '../../api/inventoryApi';
import ConfirmModal from '../../components/shared/ConfirmModal';
import SupplierFormModal from './components/SupplierFormModal';
import SupplierCatalogModal from './components/SupplierCatalogModal';
import SupplierPriceComparison from './components/SupplierPriceComparison';

const ManageSuppliers = () => {
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'prices'
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingCatalogSupplier, setViewingCatalogSupplier] = useState(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [suppData, ingData] = await Promise.all([
        getSuppliers(),
        getIngredients()
      ]);
      setSuppliers(suppData || []);
      setIngredients((ingData || []).filter((i) => !i.is_archived));
    } catch (err) {
      console.error(err);
      setError('Failed to load suppliers and ingredients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const flashMessage = (type, text) => {
    if (type === 'success') {
      setSuccessMsg(text);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setError(text);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormModalOpen(true);
  };

  // Save Supplier (Create or Update)
  const handleSaveSupplier = async (payload) => {
    setFormModalOpen(false);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload);
        flashMessage('success', `Supplier "${payload.name}" updated successfully.`);
      } else {
        await createSupplier(payload);
        flashMessage('success', `Supplier "${payload.name}" created successfully.`);
      }
      fetchData();
    } catch (err) {
      console.error(err);
      flashMessage('error', err.message || 'Failed to save supplier.');
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = (supplier) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Supplier',
      message: `Are you sure you want to remove "${supplier.name}"? This will unlink their catalog mappings. Past purchase orders will be retained.`,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteSupplier(supplier.id);
          flashMessage('success', `Supplier "${supplier.name}" removed successfully.`);
          fetchData();
        } catch (err) {
          console.error(err);
          flashMessage('error', err.message || 'Failed to delete supplier.');
        }
      }
    });
  };

  // Filtered suppliers for directory
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.contact_person || '').toLowerCase().includes(term) ||
        (s.contact_number || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.address || '').toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">
            Manage Suppliers & Pricing
          </h1>
          <p className="m-0 mt-1 text-sm text-zinc-500 font-medium">
            Maintain supplier contacts, agreed unit costs, and compare pricing across vendors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="inline-flex bg-zinc-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'suppliers'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Suppliers Directory ({suppliers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prices')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'prices'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Price Differences ({ingredients.length})
            </button>
          </div>

          {activeTab === 'suppliers' && (
            <button
              type="button"
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              onClick={handleOpenAdd}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-5 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-bold animate-in fade-in">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-5 p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-sm font-bold animate-in fade-in">
          {error}
        </div>
      )}

      {/* TAB 1: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search suppliers by name, contact, email..."
                className="w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="text-xs font-semibold text-zinc-500 tabular-nums">
              Showing {filteredSuppliers.length} of {suppliers.length} active suppliers
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-sm text-zinc-400">Loading supplier directory...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-400">
                No suppliers found. Click "Add Supplier" above to register one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Supplier Name</th>
                      <th className="px-6 py-3.5">Contact Details</th>
                      <th className="px-6 py-3.5">Location / Address</th>
                      <th className="px-6 py-3.5 text-center">Items Offered</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-sm">
                    {filteredSuppliers.map((supp) => {
                      const itemsCount = supp.supplier_ingredients?.length || 0;
                      return (
                        <tr key={supp.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-zinc-900 text-base">{supp.name}</div>
                            {supp.email && (
                              <div className="text-xs text-zinc-500 font-medium">{supp.email}</div>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-medium text-zinc-800">
                              {supp.contact_person || 'N/A'}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {supp.contact_number || 'No phone recorded'}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-xs text-zinc-600 max-w-xs truncate">
                            {supp.address || 'Metro Manila, Philippines'}
                          </td>

                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => setViewingCatalogSupplier(supp)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 transition-colors cursor-pointer"
                              title="Click to view pricing catalog"
                            >
                              <span>{itemsCount} materials</span>
                              <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 transition-colors cursor-pointer"
                                onClick={() => handleOpenEdit(supp)}
                              >
                                Edit & Prices
                              </button>
                              <button
                                type="button"
                                className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-colors cursor-pointer"
                                onClick={() => handleDeleteSupplier(supp)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRICE DIFFERENCES & COMPARISON MATRIX */}
      {activeTab === 'prices' && (
        <SupplierPriceComparison
          suppliers={suppliers}
          ingredients={ingredients}
          onEditSupplier={handleOpenEdit}
        />
      )}

      {/* Modals */}
      {formModalOpen && (
        <SupplierFormModal
          isOpen={formModalOpen}
          editingSupplier={editingSupplier}
          ingredients={ingredients}
          onClose={() => setFormModalOpen(false)}
          onSave={handleSaveSupplier}
        />
      )}

      {viewingCatalogSupplier && (
        <SupplierCatalogModal
          supplier={viewingCatalogSupplier}
          onClose={() => setViewingCatalogSupplier(null)}
          onEdit={handleOpenEdit}
        />
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ManageSuppliers;
