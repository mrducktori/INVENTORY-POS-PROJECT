import React, { useState, useEffect } from 'react';
import { CATEGORIES } from '../../../../utils/constants';
import { getCategorySettings, updateCategorySettings } from '../../../../api/categorySettingsApi';
import SearchableIngredientSelect from '../../../../components/shared/SearchableIngredientSelect';

const CategorySettingsModal = ({ onClose, allIngredients }) => {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [settings, setSettings] = useState({}); // { 'MILK TEA': { sizes: [], add_ons: [] } }
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form State for current category
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);
  
  const [newSize, setNewSize] = useState({ name: '', price_add: '', ingredient_id: '' });
  const [newAddOn, setNewAddOn] = useState({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings[selectedCategory]) {
      setEditSizes(settings[selectedCategory].sizes || []);
      setEditAddOns(settings[selectedCategory].add_ons || []);
    } else {
      setEditSizes([]);
      setEditAddOns([]);
    }
  }, [selectedCategory, settings]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getCategorySettings();
      const settingsMap = {};
      data.forEach(item => {
        settingsMap[item.category] = { sizes: item.sizes, add_ons: item.add_ons };
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateCategorySettings(selectedCategory, { sizes: editSizes, add_ons: editAddOns });
      setMessage('Category settings saved!');
      setTimeout(() => setMessage(''), 3000);
      fetchSettings(); // refresh
    } catch (err) {
      if (err.message.includes('already exists')) {
        setMessage('WARNING: ' + err.message);
      } else {
        setMessage('Error saving: ' + err.message);
      }
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSize = () => {
    if (!newSize.name) return;
    setEditSizes(prev => [...prev, { ...newSize, price_add: parseFloat(newSize.price_add) || 0 }]);
    setNewSize({ name: '', price_add: '', ingredient_id: '' });
  };

  const handleRemoveSize = (index) => {
    setEditSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAddOn = () => {
    if (!newAddOn.name) return;
    setEditAddOns(prev => [...prev, { 
      ...newAddOn, 
      price: parseFloat(newAddOn.price) || 0,
      quantity: parseFloat(newAddOn.quantity) || 0
    }]);
    setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Add-on Defaults</h2>
            <p className="m-0 text-xs text-gray-300 font-medium mt-0.5">Category-wide standard sizes and add-ons configuration</p>
          </div>
          <button className="text-gray-200 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" onClick={onClose} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {message && <div className={`p-4 mb-6 rounded-xl text-base font-bold flex items-center shadow-sm ${message.includes('saved') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{message}</div>}
          
          <div className="flex flex-col gap-1.5 mb-2">
            <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Select Category to Configure</label>
            <select className="w-full sm:w-72 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <p className="text-sm md:text-base text-gray-600 mb-6 font-medium">
            Any sizes or add-ons defined here will automatically apply to ALL products inside the <strong className="text-gray-900">{selectedCategory}</strong> category.
          </p>

          <div className="flex flex-col lg:flex-row gap-6 bg-gray-50 p-5 rounded-xl border border-gray-100">
            {/* SIZES CONFIGURATION */}
            <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="m-0 text-base md:text-lg font-black text-gray-900 mb-4 tracking-tight">Default Sizes</h3>
              {editSizes.length > 0 ? (
                <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/70 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Size Name</th>
                        <th className="px-3 py-2.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Price Add (₱)</th>
                        <th className="px-3 py-2.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Cup Mat.</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editSizes.map((sz, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-sm md:text-base font-bold text-gray-900">{sz.name}</td>
                          <td className="px-3 py-2.5 text-sm md:text-base font-bold text-gray-800">+{sz.price_add}</td>
                          <td className="px-3 py-2.5 text-sm md:text-base text-gray-700 font-medium whitespace-normal break-words">{allIngredients.find(ing => ing.id === sz.ingredient_id)?.name || '-'}</td>
                          <td className="px-3 py-2.5 text-right"><button type="button" className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer text-lg font-bold" onClick={() => handleRemoveSize(i)} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm md:text-base text-gray-500 italic mb-4">No default sizes.</p>
              )}
              
              <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium focus:outline-none focus:border-gray-900" placeholder="Size Name (e.g., 16 oz)" value={newSize.name} onChange={e => setNewSize({...newSize, name: e.target.value})} />
                <input type="number" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium focus:outline-none focus:border-gray-900" placeholder="Price Increase (₱)" value={newSize.price_add} onChange={e => setNewSize({...newSize, price_add: e.target.value})} min="0" />
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cup Material (Optional)</label>
                  <SearchableIngredientSelect
                    ingredients={allIngredients}
                    value={newSize.ingredient_id}
                    onChange={(id) => setNewSize({ ...newSize, ingredient_id: id })}
                    placeholder="Search cup material (e.g. 16 oz cups)..."
                  />
                </div>

                <button type="button" className="w-full py-2.5 bg-white border border-gray-300 text-gray-800 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors mt-1 cursor-pointer" onClick={handleAddSize}>Add Default Size</button>
              </div>
            </div>

            {/* ADD-ONS CONFIGURATION */}
            <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="m-0 text-base md:text-lg font-black text-gray-900 mb-4 tracking-tight">Default Add-ons</h3>
              {editAddOns.length > 0 ? (
                <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/70 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Add-on</th>
                        <th className="px-3 py-2.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Price (₱)</th>
                        <th className="px-3 py-2.5 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Mat. Used</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editAddOns.map((ao, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-sm md:text-base font-bold text-gray-900">{ao.name}</td>
                          <td className="px-3 py-2.5 text-sm md:text-base font-bold text-gray-800">+{ao.price}</td>
                          <td className="px-3 py-2.5 text-sm md:text-base text-gray-700 font-medium whitespace-normal break-words">{ao.quantity}{ao.unit} {allIngredients.find(ing => ing.id === ao.ingredient_id)?.name || '-'}</td>
                          <td className="px-3 py-2.5 text-right"><button type="button" className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer text-lg font-bold" onClick={() => handleRemoveAddOn(i)} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm md:text-base text-gray-500 italic mb-4">No default add-ons.</p>
              )}

              <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium focus:outline-none focus:border-gray-900" placeholder="Add-on Name (e.g., Pearl)" value={newAddOn.name} onChange={e => setNewAddOn({...newAddOn, name: e.target.value})} />
                <input type="number" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium focus:outline-none focus:border-gray-900" placeholder="Price (₱)" value={newAddOn.price} onChange={e => setNewAddOn({...newAddOn, price: e.target.value})} min="0" />
                
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
                    <input type="number" className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm md:text-base font-medium focus:outline-none focus:border-gray-900" placeholder="Qty Used" value={newAddOn.quantity} onChange={e => setNewAddOn({...newAddOn, quantity: e.target.value})} min="0" />
                    <span className="flex items-center justify-center px-4 py-2.5 bg-gray-200 rounded-lg text-sm font-bold text-gray-800">{newAddOn.unit}</span>
                  </div>
                )}
                <button type="button" className="w-full py-2.5 bg-white border border-gray-300 text-gray-800 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors mt-1 cursor-pointer" onClick={handleAddAddOn}>Add Default Add-on</button>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button className="px-7 py-3 bg-gray-900 text-white rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:bg-gray-400 disabled:hover:translate-y-0 cursor-pointer" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings for ' + selectedCategory}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategorySettingsModal;
