import React, { useState, useEffect } from 'react';
import { formatNum } from '../../utils/productUtils';
import { getSuppliers, createPurchaseOrder } from '../../api/purchasingApi';
import { getIngredients } from '../../api/inventoryApi';
import { formatDisplayDate, getManilaDateOnly, addDaysManila } from '../../utils/dateUtils';
import { INPUT_LIMITS, validateAmountInput } from '../../utils/validationUtils';
import { useEscapeGuard } from '../../components/shared/useEscapeGuard';
import UnsavedNotice from '../../components/shared/UnsavedNotice';

// items: map of ingredient_id -> { selected, quantity, unit_price, purchase_unit, conversion_factor }
const BLANK_FORM = { supplier_id: '', expected_date: '', items: {} };

const PurchaseOrderForm = ({ onClose, onSuccess }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sortOption, setSortOption] = useState('name_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);

  const [formData, setFormData] = useState(BLANK_FORM);
  const isDirty = JSON.stringify(formData) !== JSON.stringify(BLANK_FORM);
  const lockTitle = isDirty ? 'Save or reset your changes first' : undefined;
  const escWarn = useEscapeGuard({ active: !loading && !saving && !reviewData, dirty: isDirty, onClose });
  const handleReset = () => {
    setFormData(BLANK_FORM);
    setSearchQuery('');
    setError('');
  };

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

  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);
  const supplierIngredientIds = selectedSupplier?.supplier_ingredients?.map(si => si.ingredient_id) || [];

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

  // Selected items are listed above unselected ones.
  const selectedIngredients = sortItems(searchedIngredients.filter(ing => formData.items[ing.id]?.selected));
  const unselectedIngredients = sortItems(searchedIngredients.filter(ing => !formData.items[ing.id]?.selected));

  const selectedItemsList = Object.entries(formData.items).filter(([, item]) => item.selected);
  const selectedCount = selectedItemsList.length;
  const orderTotal = selectedItemsList.reduce((sum, [, item]) => {
    return sum + ((item.quantity || 0) * (item.unit_price || 0));
  }, 0);

  const handleCheckboxChange = (ing) => {
    // Read PO defaults from supplier_ingredients if configured, falling back to ingredient
    const mapping = selectedSupplier?.supplier_ingredients?.find(si => si.ingredient_id === ing.id);
    const defaultPrice = mapping?.default_price != null && Number(mapping.default_price) > 0
      ? Number(mapping.default_price)
      : (ing.cost_per_purchase_unit || 0);
    const defaultUnit = mapping?.default_purchase_unit || ing.purchase_unit || 'Unit';
    const defaultFactor = mapping?.default_conversion_factor != null && Number(mapping.default_conversion_factor) > 0
      ? Number(mapping.default_conversion_factor)
      : (ing.conversion_factor || 1);

    setFormData(prev => {
      const isSelected = prev.items[ing.id]?.selected;
      return {
        ...prev,
        items: {
          ...prev.items,
          [ing.id]: {
            selected: !isSelected,
            quantity: prev.items[ing.id]?.quantity || 1,
            unit_price: prev.items[ing.id]?.unit_price || defaultPrice,
            purchase_unit: prev.items[ing.id]?.purchase_unit || defaultUnit,
            conversion_factor: prev.items[ing.id]?.conversion_factor || defaultFactor
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.supplier_id) return setError('Please select a supplier.');
    
    const selectedItems = Object.entries(formData.items)
      .filter(([, item]) => item.selected)
      .map(([ingId, item]) => {
        const fullIng = ingredients.find(i => i.id === ingId);
        return {
          ingredient_id: ingId,
          name: fullIng?.name || 'Ingredient',
          unit: fullIng?.unit || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_unit: item.purchase_unit,
          conversion_factor: item.conversion_factor,
          subtotal: (item.quantity || 0) * (item.unit_price || 0)
        };
      });

    if (selectedItems.length === 0) return setError('Please check at least one ingredient.');
    for (const item of selectedItems) {
      const qtyCheck = validateAmountInput(item.quantity, {
        label: `PO quantity for ${item.name}`,
        min: INPUT_LIMITS.PO_QTY_MIN,
        max: INPUT_LIMITS.PO_QTY_MAX
      });
      if (!qtyCheck.valid) return setError(qtyCheck.error);
      if (!item.purchase_unit || String(item.purchase_unit).trim().length > 40) {
        return setError(`Purchase unit for ${item.name} must be 1 to 40 characters.`);
      }
      const factorCheck = validateAmountInput(item.conversion_factor, {
        label: `Conversion factor for ${item.name}`,
        min: INPUT_LIMITS.CONVERSION_FACTOR_MIN,
        max: INPUT_LIMITS.CONVERSION_FACTOR_MAX
      });
      if (!factorCheck.valid) return setError(factorCheck.error);
      const priceCheck = validateAmountInput(item.unit_price ?? 0, {
        label: `Unit price for ${item.name}`,
        min: 0,
        max: INPUT_LIMITS.PURCHASE_COST_MAX
      });
      if (!priceCheck.valid) return setError(priceCheck.error);
    }

    setReviewAcknowledged(false);
    setReviewData({
      supplier: selectedSupplier,
      expected_date: formData.expected_date,
      items: selectedItems,
      total: orderTotal
    });
  };

  const handleConfirmAndSend = async () => {
    if (!reviewData || saving || !reviewAcknowledged) return;
    try {
      setSaving(true);
      await createPurchaseOrder({
        supplier_id: formData.supplier_id,
        expected_date: formData.expected_date || null,
        items: reviewData.items.map(i => ({
          ingredient_id: i.ingredient_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          purchase_unit: i.purchase_unit,
          conversion_factor: i.conversion_factor
        }))
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to create purchase order: ' + (err.message || ''));
      setSaving(false);
      setReviewData(null);
    }
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
            Stock: <strong className={ing.stock_quantity <= ing.low_stock_alert ? 'text-red-500 font-bold' : 'text-gray-700 font-semibold'}>{formatNum(ing.stock_quantity)}</strong> / {formatNum(ing.low_stock_alert)} {ing.unit} (threshold)
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
              max="100000"
              step="1" 
              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-xs"
              value={formData.items[ing.id]?.quantity ?? ''} 
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') {
                  handleItemChange(ing.id, 'quantity', '');
                  return;
                }
                const parsed = parseInt(raw, 10);
                const val = Number.isNaN(parsed)
                  ? INPUT_LIMITS.PO_QTY_MIN
                  : Math.min(100000, Math.max(1, parsed));
                handleItemChange(ing.id, 'quantity', val);
              }}
              onBlur={() => {
                const q = Number(formData.items[ing.id]?.quantity);
                if (!q || q < 1) {
                  handleItemChange(ing.id, 'quantity', 1);
                } else if (q > 100000) {
                  handleItemChange(ing.id, 'quantity', 100000);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-[modalBackdropFadeIn_var(--dur-base)_var(--ease-out-expo)]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-gray-500 font-medium animate-[modalPopIn_var(--dur-slow)_var(--ease-out-expo)]">Loading...</div>
    </div>
  );

  return (
    <>
      <UnsavedNotice show={escWarn} />
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget && !isDirty) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Create Purchase Order</h2>
            <button type="button" className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400" onClick={onClose} disabled={isDirty} title={lockTitle} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                    min={addDaysManila(getManilaDateOnly(), 1)}
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
                {isDirty && <span className="text-xs font-semibold text-amber-600">Unsaved changes</span>}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  onClick={onClose}
                  disabled={saving || isDirty}
                  title={lockTitle}
                >
                  Cancel
                </button>
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="px-5 py-2.5 bg-white border border-amber-400 text-amber-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-amber-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
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
      {reviewData && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[10000] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 animate-[popIn_0.2s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-zinc-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="m-0 text-base md:text-lg font-bold tracking-wide">Review & Confirm Purchase Order</h2>
                  <p className="m-0 text-xs text-zinc-400 font-medium">Verify order details and supplier costs before submitting</p>
                </div>
              </div>
              <button 
                type="button"
                className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" 
                onClick={() => setReviewData(null)}
                disabled={saving}
               aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <div>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Supplier</span>
                  <span className="text-sm font-extrabold text-zinc-900">{reviewData.supplier?.name}</span>
                  {reviewData.supplier?.contact_person && (
                    <span className="text-xs text-zinc-600 block mt-0.5">Contact: {reviewData.supplier.contact_person}</span>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Expected Delivery Date</span>
                  {reviewData.expected_date ? (
                    <span className="text-sm font-bold text-zinc-900">{formatDisplayDate(reviewData.expected_date)}</span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                      No target date set (open delivery)
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center text-xs font-bold text-zinc-600 uppercase tracking-wider">
                  <span>Ordered Items ({reviewData.items.length})</span>
                  <span>Total Value: ₱{reviewData.total.toFixed(2)}</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
                  {reviewData.items.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between text-xs md:text-sm">
                      <div>
                        <div className="font-bold text-zinc-900">{item.name}</div>
                        <div className="text-xs text-zinc-500 font-medium">
                          {formatNum(item.quantity)} {item.purchase_unit} • ₱{Number(item.unit_price).toFixed(2)} / {item.purchase_unit}
                          {item.conversion_factor > 1 && ` (Yields ${(item.quantity * item.conversion_factor).toLocaleString()} ${item.unit})`}
                        </div>
                      </div>
                      <div className="font-bold text-zinc-900 text-sm">
                        ₱{item.subtotal.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">Total Expenditure</span>
                  <span className="text-lg font-black text-zinc-900">₱{reviewData.total.toFixed(2)}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-100/70 border border-zinc-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reviewAcknowledged}
                  onChange={(e) => setReviewAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                />
                <span className="text-xs font-semibold text-zinc-700 leading-snug">
                  I have verified the ordered quantities, purchase units, and supplier costs, and authorize submitting this purchase order.
                </span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setReviewData(null)}
                disabled={saving}
                className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back to Edit</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSend}
                disabled={!reviewAcknowledged || saving}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs ${
                  reviewAcknowledged && !saving
                    ? 'bg-zinc-900 hover:bg-black text-white cursor-pointer'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300'
                }`}
              >
                {saving ? 'Creating Order...' : 'Confirm & Place Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PurchaseOrderForm;
