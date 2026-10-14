import React, { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier } from '../../api/purchasingApi';
import { getIngredients } from '../../api/inventoryApi';
import ConfirmModal from '../../components/shared/ConfirmModal';

const ManageSuppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    contact_number: '',
    email: '',
    address: '',
    ingredient_ids: []
  });
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', contact_person: '', contact_number: '', email: '', address: '', ingredient_ids: [] });
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      contact_number: supplier.contact_number || '',
      email: supplier.email || '',
      address: supplier.address || '',
      ingredient_ids: supplier.supplier_ingredients?.map(si => si.ingredient_id) || []
    });
    setShowModal(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [suppData, ingData] = await Promise.all([
        getSuppliers(),
        getIngredients()
      ]);
      setSuppliers(suppData || []);
      setIngredients(ingData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckboxChange = (id) => {
    setFormData(prev => {
      const isSelected = prev.ingredient_ids.includes(id);
      if (isSelected) {
        return { ...prev, ingredient_ids: prev.ingredient_ids.filter(i => i !== id) };
      } else {
        return { ...prev, ingredient_ids: [...prev.ingredient_ids, id] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: editingId ? 'Confirm Update' : 'Confirm Add',
      message: `Are you sure you want to ${editingId ? 'update' : 'add'} the supplier "${formData.name.trim()}"?`,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          if (editingId) {
            await updateSupplier(editingId, formData);
          } else {
            await createSupplier(formData);
          }
          setShowModal(false);
          setFormData({ name: '', contact_person: '', contact_number: '', email: '', address: '', ingredient_ids: [] });
          setEditingId(null);
          fetchData();
        } catch (err) {
          console.error(err);
          setError(editingId ? 'Failed to update supplier.' : 'Failed to create supplier.');
          setTimeout(() => setError(''), 3000);
        }
      }
    });
  };

  const filteredSuppliers = suppliers.filter(supp => {
    const term = searchTerm.toLowerCase();
    return (
      (supp.name || '').toLowerCase().includes(term) ||
      (supp.contact_person || '').toLowerCase().includes(term) ||
      (supp.contact_number || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Manage Suppliers</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Add and edit suppliers and their mapped ingredients.</p>
        </div>
        <button 
          className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm"
          onClick={openAddModal}
        >
          + Add Supplier
        </button>
      </div>

      <div className="mb-6 max-w-md">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </span>
          <input 
            type="text" 
            placeholder="Search suppliers by name or contact..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm md:text-base font-bold">{error}</div>}

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        {loading ? (
          <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Contact Person</th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Contact Number</th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Ingredients Offered</th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-sm md:text-base font-medium text-gray-400 italic">No suppliers found.</td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supp) => (
                    <tr key={supp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm md:text-base font-bold text-gray-900">{supp.name}</td>
                      <td className="px-6 py-4 text-sm md:text-base text-gray-600">{supp.contact_person || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm md:text-base text-gray-600">{supp.contact_number || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm md:text-base text-gray-600">
                        {supp.supplier_ingredients?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {supp.supplier_ingredients.map(si => (
                              <span key={si.ingredient_id} className="px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded-full text-xs md:text-sm font-bold tracking-wider">
                                {si.ingredients?.name}
                              </span>
                            ))}
                          </div>
                        ) : 'None'}
                      </td>
                      <td className="px-6 py-4 text-sm md:text-base text-right">
                        <button 
                          className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
                          onClick={() => openEditModal(supp)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h2 className="m-0 text-lg font-semibold tracking-wide">{editingId ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Supplier Name</label>
                    <input 
                      type="text" 
                      required 
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Contact Person</label>
                    <input 
                      type="text" 
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                      value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} 
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Contact Number</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. 09123456789"
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                      value={formData.contact_number} 
                      onChange={e => setFormData({...formData, contact_number: e.target.value.replace(/[^0-9+]/g, '')})} 
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Email</label>
                    <input 
                      type="email" 
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Address</label>
                  <textarea 
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm resize-none"
                    rows="2"
                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} 
                  />
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider block mb-3">Ingredients Offered (Checklist)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ingredients.map(ing => (
                      <label key={ing.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-gray-900 focus:ring-gray-900 rounded border-gray-300"
                          checked={formData.ingredient_ids.includes(ing.id)}
                          onChange={() => handleCheckboxChange(ing.id)}
                        />
                        <span className="text-sm md:text-base font-medium text-gray-800">{ing.name} <span className="text-sm md:text-base text-gray-500">({ing.unit})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button type="button" className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white border-none rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm">
                  {editingId ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
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

export default ManageSuppliers;
