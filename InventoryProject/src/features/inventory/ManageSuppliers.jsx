import React, { useState, useEffect, useMemo } from 'react';
import { getSuppliers, createSupplier, updateSupplier, archiveSupplier, restoreSupplier, acknowledgeSupplierPriceUpdates } from '../../api/purchasingApi';
import { getIngredients } from '../../api/inventoryApi';
import ConfirmModal from '../../components/shared/ConfirmModal';
import Pagination from '../../components/shared/Pagination';
import SupplierFormModal from './components/suppliers/SupplierFormModal';
import SupplierCatalogModal from './components/suppliers/SupplierCatalogModal';
import SupplierPriceComparison from './components/suppliers/SupplierPriceComparison';

const ManageSuppliers = () => {
  const getInitialTab = () => {
    if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
      const sub = window.location.hash.split('/')[1];
      if (sub === 'suppliers' || sub === 'prices') return sub;
    }
    try {
      const saved = localStorage.getItem('coftea_suppliers_tab');
      if (saved === 'suppliers' || saved === 'prices') return saved;
    } catch { /* ignore storage/history errors */ }
    return 'suppliers';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab); // 'suppliers' | 'prices'

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('coftea_suppliers_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#ManageSuppliers/${tab}`);
      }
    } catch { /* ignore storage/history errors */ }
  };

  useEffect(() => {
    try {
      localStorage.setItem('coftea_suppliers_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#ManageSuppliers/${activeTab}`);
      }
    } catch { /* ignore storage/history errors */ }
  }, [activeTab]);
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Archive Supplier (soft delete)
  const handleDeleteSupplier = (supplier) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Archive Supplier',
      message: `Are you sure you want to archive "${supplier.name}"? Past purchase orders will be retained.`,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          await archiveSupplier(supplier.id);
          flashMessage('success', `Supplier "${supplier.name}" archived successfully.`);
          fetchData();
        } catch (err) {
          console.error(err);
          flashMessage('error', err.message || 'Failed to archive supplier.');
        }
      }
    });
  };

  // Restore Supplier
  const handleRestoreSupplier = async (supplier) => {
    try {
      await restoreSupplier(supplier.id);
      flashMessage('success', `Supplier "${supplier.name}" restored successfully.`);
      fetchData();
    } catch (err) {
      console.error(err);
      flashMessage('error', err.message || 'Failed to restore supplier.');
    }
  };

  const applyPriceUpdateAck = (supplier, ingredientId = null) => {
    if (!supplier?.recent_price_updates) return supplier;
    if (!ingredientId) {
      return { ...supplier, recent_price_updates: null };
    }
    const nextItems = { ...(supplier.recent_price_updates.items || {}) };
    delete nextItems[ingredientId];
    const remainingCount = Object.keys(nextItems).length;
    return {
      ...supplier,
      recent_price_updates: remainingCount > 0
        ? { ...supplier.recent_price_updates, changes_count: remainingCount, items: nextItems }
        : null
    };
  };

  const handleAcknowledgePriceUpdates = async (supplierId, ingredientId = null) => {
    setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? applyPriceUpdateAck(s, ingredientId) : s)));
    setViewingCatalogSupplier((prev) => (prev?.id === supplierId ? applyPriceUpdateAck(prev, ingredientId) : prev));
    try {
      await acknowledgeSupplierPriceUpdates(supplierId, ingredientId);
    } catch (err) {
      console.error(err);
      flashMessage('error', err.message || 'Failed to mark price updates as read.');
      fetchData();
    }
  };

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Active and archived suppliers
  const activeSuppliers = useMemo(() => {
    return suppliers.filter((s) => !s.is_archived);
  }, [suppliers]);

  const archivedSuppliers = useMemo(() => {
    return suppliers.filter((s) => s.is_archived);
  }, [suppliers]);

  // Filtered suppliers for directory
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return activeSuppliers;
    return activeSuppliers.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.contact_person || '').toLowerCase().includes(term) ||
        (s.contact_number || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.address || '').toLowerCase().includes(term)
    );
  }, [activeSuppliers, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / itemsPerPage));
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

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
              onClick={() => handleTabChange('suppliers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'suppliers'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Suppliers Directory ({activeSuppliers.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('prices')}
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
              Showing {filteredSuppliers.length} of {activeSuppliers.length} active suppliers
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-sm text-zinc-400">Loading supplier directory...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-400">
                {searchTerm ? 'No suppliers match your search.' : 'No suppliers found. Click "Add Supplier" above to register one.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5 sticky left-0 z-10 bg-zinc-50 shadow-[1px_0_0_0_#e4e4e7]">Supplier Name</th>
                      <th className="px-6 py-3.5">Contact Details</th>
                      <th className="px-6 py-3.5">Location / Address</th>
                      <th className="px-6 py-3.5 text-center">Items Offered</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-sm">
                    {paginatedSuppliers.map((supp) => {
                      const itemsCount = supp.supplier_ingredients?.length || 0;
                      return (
                        <tr key={supp.id} className="hover:bg-zinc-50/60 transition-colors group">
                          <td className="px-6 py-4 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5]">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900 text-base">{supp.name}</span>
                              {supp.recent_price_updates?.changes_count > 0 && (
                                <span className="inline-flex items-center rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCatalogSupplier(supp)}
                                    className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 hover:bg-amber-100/80 transition-colors cursor-pointer"
                                    title={`View ${supp.recent_price_updates.changes_count} price update(s) from ${supp.name}`}
                                  >
                                    <svg className="w-3 h-3 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Prices Updated ({supp.recent_price_updates.changes_count})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcknowledgePriceUpdates(supp.id);
                                    }}
                                    className="inline-flex items-center gap-0.5 pl-1.5 pr-2 py-0.5 border-l border-amber-300/80 text-amber-700 hover:bg-amber-200/70 hover:text-amber-950 transition-colors cursor-pointer"
                                    title="Mark all price updates for this supplier as read"
                                    aria-label={`Mark price updates for ${supp.name} as read`}
                                  >
                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    <span>Mark read</span>
                                  </button>
                                </span>
                              )}
                            </div>
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
                                Archive
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

            {/* Pagination Controls */}
            {filteredSuppliers.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredSuppliers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(val) => {
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                itemsPerPageOptions={[10, 20, 50]}
              />
            )}
          </div>

          {/* Dedicated Archived Suppliers Section */}
          {archivedSuppliers.length > 0 && (
            <div className="mt-8 mb-4 bg-zinc-950 text-white rounded-2xl p-6 border border-zinc-800 shadow-xl w-full">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight m-0">Archived Suppliers</h3>
                  <p className="text-xs text-zinc-400 m-0 mt-0.5">Archived suppliers are hidden from purchase orders and active catalog views until restored.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchData}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {archivedSuppliers.map((s) => (
                  <div key={s.id} className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-zinc-700 transition-colors">
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-200 text-sm truncate">{s.name}</div>
                      <div className="text-xs text-zinc-500 truncate">{s.contact_person || s.email || 'Archived'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreSupplier(s)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRICE DIFFERENCES & COMPARISON MATRIX */}
      {activeTab === 'prices' && (
        <SupplierPriceComparison
          suppliers={activeSuppliers}
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
          onAcknowledgePriceUpdates={(ingredientId = null) =>
            handleAcknowledgePriceUpdates(viewingCatalogSupplier.id, ingredientId)
          }
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
