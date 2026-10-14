import React, { useState, useEffect } from 'react';
import { getSuppliers, createPurchaseOrder } from '../../api/purchasingApi';
import { getIngredients } from '../../api/inventoryApi';
import ConfirmModal from '../../components/shared/ConfirmModal';

const PurchaseOrderForm = ({ onClose, onSuccess }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sortOption, setSortOption] = useState('name_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_date: '',
    items: {} // map of ingredient_id -> { selected: boolean, quantity: number, unit_price: number }
  });

  useEffect(() => {
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
        setError('Failed to load data for form.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // When supplier changes, we could pre-filter the checklist
  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);
  const supplierIngredientIds = selectedSupplier?.supplier_ingredients?.map(si => si.ingredient_id) || [];

  // Determine which ingredients to show in checklist
  const displayedIngredients = formData.supplier_id 
    ? (supplierIngredientIds.length > 0 
        ? ingredients.filter(ing => supplierIngredientIds.includes(ing.id))
        : ingredients) // Fallback to all if supplier has no mapped ingredients
    : [];

  const searchedIngredients = displayedIngredients.filter(ing => 
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortItems = (items) => {
    return [...items].sort((a, b) => {
      if (sortOption === 'stock_asc') return (a.stock_quantity || 0) - (b.stock_quantity || 0);
      if (sortOption === 'stock_desc') return (b.stock_quantity || 0) - (a.stock_quantity || 0);
      if (sortOption === 'threshold_first') {
        const aLow = (a.stock_quantity || 0) <= (a.low_stock_alert || 0) ? -1 : 1;
        const bLow = (b.stock_quantity || 0) <= (b.low_stock_alert || 0) ? -1 : 1;
        if (aLow !== bLow) return aLow - bLow;
        return (a.stock_quantity || 0) - (b.stock_quantity || 0);
      }
      return a.name.localeCompare(b.name);
    });
  };

  // Auto bring up selected items: partition into selected (top) and unselected (bottom)
  const selectedIngredients = sortItems(searchedIngredients.filter(ing => formData.items[ing.id]?.selected));
  const unselectedIngredients = sortItems(searchedIngredients.filter(ing => !formData.items[ing.id]?.selected));

  // Compute selected items count & total PO cost
  const selectedItemsList = Object.entries(formData.items).filter(([_, item]) => item.selected);
  const selectedCount = selectedItemsList.length;
  const orderTotal = selectedItemsList.reduce((sum, [_, item]) => {
    return sum + ((item.quantity || 0) * (item.unit_price || 0));
  }, 0);

  const handleCheckboxChange = (ing) => {
    // Read PO defaults from the ingredient itself (not the supplier mapping)
    setFormData(prev => {
      const isSelected = prev.items[ing.id]?.selected;
      return {
        ...prev,
        items: {
          ...prev.items,
          [ing.id]: {
            selected: !isSelected,
            quantity: prev.items[ing.id]?.quantity || 1,
            unit_price: prev.items[ing.id]?.unit_price || ing.cost_per_purchase_unit || 0,
            purchase_unit: prev.items[ing.id]?.purchase_unit || ing.purchase_unit || 'Unit',
            conversion_factor: prev.items[ing.id]?.conversion_factor || ing.conversion_factor || 1
          }
        }
      };
    });
  };

  const handleItemChange = (ingId, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [ingId]: {
          ...prev.items[ingId],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.supplier_id) return setError('Please select a supplier.');
    
    // Filter out selected items
    const selectedItems = Object.entries(formData.items)
      .filter(([_, item]) => item.selected)
      .map(([ingId, item]) => ({
        ingredient_id: ingId,
        quantity: item.quantity,
        unit_price: item.unit_price,
        purchase_unit: item.purchase_unit,
        conversion_factor: item.conversion_factor
      }));

    if (selectedItems.length === 0) return setError('Please check at least one ingredient.');
    if (selectedItems.some(i => i.quantity <= 0)) return setError('Quantity must be greater than 0.');
    if (selectedItems.some(i => !i.purchase_unit || i.conversion_factor <= 0)) return setError('Please provide valid purchase units and conversion factors.');

    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Purchase Order',
      message: `Are you sure you want to create a purchase order for ${selectedSupplier?.name} with ${selectedItems.length} items?`,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          setSaving(true);
          await createPurchaseOrder({
            supplier_id: formData.supplier_id,
            expected_date: formData.expected_date || null,
            items: selectedItems
          });
          onSuccess();
        } catch (err) {
          console.error(err);
          setError('Failed to create purchase order.');
          setSaving(false);
        }
      }
    });
  };

  const renderItemCard = (ing, isSelected) => (
    <div 
      key={ing.id} 
      className={`flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3.5 md:p-4 border rounded-xl transition-all duration-150 ${isSelected ? 'border-gray-900 bg-white shadow-sm ring-1 ring-gray-900/5' : 'border-gray-200 bg-gray-50 hover:bg-white cursor-pointer'}`} 
      onClick={(e) => { if (e.target.tagName !== 'INPUT') handleCheckboxChange(ing); }}
    >
      <div className="flex items-center gap-3 md:w-60 md:shrink-0">
        <input 
          type="checkbox" 
          className="w-5 h-5 text-gray-900 focus:ring-gray-900 rounded border-gray-300 cursor-pointer shrink-0"
          checked={isSelected}
          onChange={() => handleCheckboxChange(ing)}
          onClick={e => e.stopPropagation()}
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`text-sm md:text-base font-bold truncate ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
            {ing.name} <span className="text-xs text-gray-400 font-normal">({ing.unit})</span>
          </span>
          <span className="text-xs text-gray-500">
            Stock: <strong className={ing.stock_quantity <= ing.low_stock_alert ? 'text-red-500 font-bold' : 'text-gray-700 font-semibold'}>{ing.stock_quantity}</strong> / {ing.low_stock_alert} {ing.unit} (threshold)
          </span>
        </div>
      </div>
      
      {isSelected && (
        <div className="flex flex-col sm:flex-row gap-3 flex-1 items-end animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
          <div className="flex flex-col gap-1 flex-[1.4] min-w-0 w-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight whitespace-nowrap">Purchase Unit</label>
            <input 
              type="text" 
              placeholder="e.g. 750ml Bottle"
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm font-semibold bg-gray-50 text-gray-700 cursor-not-allowed focus:outline-none"
              value={formData.items[ing.id]?.purchase_unit || ''} 
              readOnly
              required={isSelected}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0 w-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight whitespace-nowrap">Base Units/Purch.</label>
            <input 
              type="number" 
              min="0.01" 
              step="0.01" 
              placeholder="1000"
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm font-semibold bg-gray-50 text-gray-700 cursor-not-allowed focus:outline-none"
              value={formData.items[ing.id]?.conversion_factor || ''} 
              readOnly
              required={isSelected}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0 w-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight whitespace-nowrap">PO Quantity</label>
            <input 
              type="number" 
              min="1" 
              step="1" 
              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-xs"
              value={formData.items[ing.id]?.quantity ?? ''} 
              onChange={e => {
                const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                handleItemChange(ing.id, 'quantity', val);
              }}
              onBlur={() => {
                if (!formData.items[ing.id]?.quantity || formData.items[ing.id]?.quantity < 1) {
                  handleItemChange(ing.id, 'quantity', 1);
                }
              }}
              required={isSelected}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0 w-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight whitespace-nowrap">Price/Unit (₱)</label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm font-semibold bg-gray-50 text-gray-700 cursor-not-allowed focus:outline-none"
              value={formData.items[ing.id]?.unit_price || ''} 
              readOnly
              required={isSelected}
            />
          </div>
          <div className="flex flex-col gap-1 flex-[1.1] min-w-0 w-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight whitespace-nowrap text-right">Total</label>
            <div className="px-2.5 py-2 bg-gray-100 rounded-lg text-sm font-black text-gray-900 border border-gray-200 text-right tabular-nums whitespace-nowrap">
              ₱{((formData.items[ing.id]?.quantity || 0) * (formData.items[ing.id]?.unit_price || 0)).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-gray-500 font-medium animate-[popIn_0.2s_ease-out]">Loading...</div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Create Purchase Order</h2>
            <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" onClick={onClose}>✕</button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">
            <div className="p-6 overflow-y-auto flex-1">
              {error && <div className="p-4 mb-6 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-bold shadow-sm">{error}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Supplier</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
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
                  <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Expected Delivery Date <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                    value={formData.expected_date} 
                    onChange={e => setFormData({ ...formData, expected_date: e.target.value })} 
                    required
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <h3 className="m-0 text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Item Selection Checklist</h3>
                    {selectedCount > 0 && (
                      <span className="px-2.5 py-0.5 bg-gray-900 text-white rounded-full text-xs font-bold tracking-tight">
                        {selectedCount} Selected
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text"
                      placeholder="Search items..."
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 shadow-sm"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <select 
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer shadow-sm"
                      value={sortOption}
                      onChange={e => setSortOption(e.target.value)}
                    >
                      <option value="name_asc">Sort by Name (A-Z)</option>
                      <option value="threshold_first">Sort by Low Stock (Critical First)</option>
                      <option value="stock_asc">Sort by Stock (Lowest First)</option>
                      <option value="stock_desc">Sort by Stock (Highest First)</option>
                    </select>
                  </div>
                </div>
                
                {!formData.supplier_id ? (
                  <div className="text-sm text-gray-500 italic">Please select a supplier first to view available ingredients.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Auto brought up: Selected items appear first */}
                    {selectedIngredients.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {selectedIngredients.map(ing => renderItemCard(ing, true))}
                      </div>
                    )}

                    {/* Section divider when there are both selected and available items */}
                    {selectedIngredients.length > 0 && unselectedIngredients.length > 0 && (
                      <div className="flex items-center gap-3 my-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span>Available Items ({unselectedIngredients.length})</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                      </div>
                    )}

                    {/* Remaining available items */}
                    {unselectedIngredients.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {unselectedIngredients.map(ing => renderItemCard(ing, false))}
                      </div>
                    )}

                    {selectedIngredients.length === 0 && unselectedIngredients.length === 0 && (
                      <div className="text-sm text-gray-500 italic text-center py-4">
                        {searchQuery ? 'No ingredients match your search.' : 'No ingredients available for this supplier.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {selectedCount > 0 ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected:
                    </span>
                    <span className="text-base md:text-lg font-black text-gray-900">
                      ₱{orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">No items selected</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer" 
                  onClick={onClose} 
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-gray-900 text-white border-none rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer" 
                  disabled={saving || selectedCount === 0}
                >
                  {saving ? 'Creating...' : 'Create PO'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};

export default PurchaseOrderForm;
