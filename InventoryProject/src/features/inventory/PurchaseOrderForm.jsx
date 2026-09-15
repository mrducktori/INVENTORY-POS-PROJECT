import React, { useState, useEffect } from 'react';
import { getSuppliers, createPurchaseOrder } from '../../api/purchasingApi';
import { getIngredients } from '../../api/inventoryApi';

const PurchaseOrderForm = ({ onClose, onSuccess }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_date: '',
    items: [{ ingredient_id: '', quantity: 1, unit_price: 0 }]
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [suppData, ingData] = await Promise.all([
          getSuppliers(),
          getIngredients()
        ]);
        setSuppliers(suppData);
        setIngredients(ingData);
      } catch (err) {
        console.error(err);
        setError('Failed to load data for form.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { ingredient_id: '', quantity: 1, unit_price: 0 }]
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleRemoveItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.supplier_id) return setError('Please select a supplier.');
    if (formData.items.length === 0) return setError('Please add at least one item.');
    if (formData.items.some(i => !i.ingredient_id)) return setError('Please select an ingredient for all items.');
    if (formData.items.some(i => i.quantity <= 0)) return setError('Quantity must be greater than 0.');

    try {
      setSaving(true);
      await createPurchaseOrder({
        supplier_id: formData.supplier_id,
        expected_date: formData.expected_date || null,
        items: formData.items
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to create purchase order.');
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-gray-500 font-medium animate-[popIn_0.2s_ease-out]">Loading...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="m-0 text-lg font-semibold tracking-wide">Create Purchase Order</h2>
          <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">
          <div className="p-6 overflow-y-auto flex-1">
            {error && <div className="p-4 mb-6 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-bold shadow-sm">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Supplier</label>
                <select 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                  value={formData.supplier_id} 
                  onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                  required
                >
                  <option value="">Select a Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Expected Delivery Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                  value={formData.expected_date} 
                  onChange={e => setFormData({ ...formData, expected_date: e.target.value })} 
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50">
              <h3 className="m-0 mb-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Items</h3>
              <div className="flex flex-col gap-4">
                {formData.items.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap md:flex-nowrap items-end gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex flex-col gap-2 flex-[2] min-w-[200px]">
                      <label className="text-xs font-bold text-gray-700">Ingredient</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                        value={item.ingredient_id} 
                        onChange={e => handleItemChange(idx, 'ingredient_id', e.target.value)}
                        required
                      >
                        <option value="">Select...</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 min-w-[100px]">
                      <label className="text-xs font-bold text-gray-700">Qty</label>
                      <input 
                        type="number" 
                        min="0.1" 
                        step="0.1" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                        value={item.quantity} 
                        onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1 min-w-[100px]">
                      <label className="text-xs font-bold text-gray-700">Unit Price (₱)</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                        value={item.unit_price} 
                        onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col justify-end min-w-[40px]">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItem(idx)} 
                        className="h-[38px] px-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  type="button" 
                  onClick={handleAddItem} 
                  className="mt-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm self-start border-dashed"
                >
                  + Add Item
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
            <button 
              type="button" 
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50" 
              onClick={onClose} 
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 bg-gray-900 text-white border-none rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
