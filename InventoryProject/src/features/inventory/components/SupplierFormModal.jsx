import React, { useState, useMemo } from 'react';

const CATEGORIES = ['All', 'Coffee & Tea', 'Dairy', 'Syrups & Powders', 'Packaging'];

const classifyIngredient = (name) => {
  const upper = (name || '').toUpperCase();
  if (upper.includes('CUP') || upper.includes('STRAW') || upper.includes('LID') || upper.includes('NAPKIN') || upper.includes('CARRIER')) {
    return 'Packaging';
  }
  if (upper.includes('MILK') || upper.includes('CREAM') || upper.includes('YAKULT')) {
    return 'Dairy';
  }
  if (upper.includes('COFFEE') || upper.includes('BEANS') || upper.includes('BREW') || upper.includes('ESPRESSO') || upper.includes('TEA')) {
    return 'Coffee & Tea';
  }
  return 'Syrups & Powders';
};

const SupplierFormModal = ({
  isOpen,
  editingSupplier,
  ingredients,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState(() => {
    if (editingSupplier) {
      // Map existing supplier_ingredients into items state keyed by ingredient_id
      const itemsMap = {};
      (editingSupplier.supplier_ingredients || []).forEach((si) => {
        itemsMap[si.ingredient_id] = {
          selected: true,
          price: si.default_price != null ? si.default_price : '',
          purchase_unit: si.default_purchase_unit || '',
          conversion_factor: si.default_conversion_factor != null ? si.default_conversion_factor : ''
        };
      });

      return {
        name: editingSupplier.name || '',
        contact_person: editingSupplier.contact_person || '',
        contact_number: editingSupplier.contact_number || '',
        email: editingSupplier.email || '',
        address: editingSupplier.address || '',
        items: itemsMap
      };
    }

    return {
      name: '',
      contact_person: '',
      contact_number: '',
      email: '',
      address: '',
      items: {}
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  // Classified ingredients
  const categorizedIngredients = useMemo(() => {
    return ingredients.map((ing) => ({
      ...ing,
      category: classifyIngredient(ing.name)
    }));
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    return categorizedIngredients.filter((ing) => {
      if (selectedCat !== 'All' && ing.category !== selectedCat) return false;
      if (!searchQuery.trim()) return true;
      return ing.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [categorizedIngredients, selectedCat, searchQuery]);

  const handleToggleItem = (ing) => {
    setFormData((prev) => {
      const current = prev.items[ing.id];
      const isSelected = !!current?.selected;

      if (isSelected) {
        // Deselect
        const newItems = { ...prev.items };
        delete newItems[ing.id];
        return { ...prev, items: newItems };
      } else {
        // Select with defaults from ingredient
        return {
          ...prev,
          items: {
            ...prev.items,
            [ing.id]: {
              selected: true,
              price: ing.cost_per_purchase_unit || 0,
              purchase_unit: ing.purchase_unit || 'Unit',
              conversion_factor: ing.conversion_factor || 1
            }
          }
        };
      }
    });
  };

  const handleFieldChange = (ingId, field, val) => {
    setFormData((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [ingId]: {
          ...prev.items[ingId],
          [field]: val
        }
      }
    }));
  };

  const handleSelectAllFiltered = () => {
    setFormData((prev) => {
      const updated = { ...prev.items };
      filteredIngredients.forEach((ing) => {
        if (!updated[ing.id]) {
          updated[ing.id] = {
            selected: true,
            price: ing.cost_per_purchase_unit || 0,
            purchase_unit: ing.purchase_unit || 'Unit',
            conversion_factor: ing.conversion_factor || 1
          };
        }
      });
      return { ...prev, items: updated };
    });
  };

  const handleDeselectAllFiltered = () => {
    setFormData((prev) => {
      const updated = { ...prev.items };
      filteredIngredients.forEach((ing) => {
        delete updated[ing.id];
      });
      return { ...prev, items: updated };
    });
  };

  const selectedCount = Object.keys(formData.items).length;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prepare structured items payload
    const ingredientItems = Object.entries(formData.items)
      .filter(([, item]) => item.selected)
      .map(([ingId, item]) => {
        const defaultIng = ingredients.find((i) => i.id === ingId);
        return {
          ingredient_id: ingId,
          default_price: parseFloat(item.price) || 0,
          default_purchase_unit: (item.purchase_unit || defaultIng?.purchase_unit || 'Unit').trim(),
          default_conversion_factor: parseFloat(item.conversion_factor) || defaultIng?.conversion_factor || 1
        };
      });

    onSave({
      name: formData.name.trim(),
      contact_person: formData.contact_person.trim(),
      contact_number: formData.contact_number.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      ingredient_items: ingredientItems,
      ingredient_ids: ingredientItems.map((i) => i.ingredient_id)
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-zinc-950 text-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-zinc-800">
          <div>
            <h2 className="m-0 text-lg font-bold tracking-tight">
              {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Supplier'}
            </h2>
            <p className="m-0 text-xs text-zinc-400 mt-0.5">
              Configure supplier profile and agreed raw material pricing
            </p>
          </div>
          <button
            type="button"
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-xl leading-none p-1"
            onClick={onClose}
           aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0 flex-1">
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            {/* General Info Card */}
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Supplier Information
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Dairy Co."
                    className="px-3.5 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Smith"
                    className="px-3.5 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0918-987-6543"
                    className="px-3.5 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value.replace(/[^0-9+\s-]/g, '') })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. orders@supplier.ph"
                    className="px-3.5 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                  Office / Warehouse Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 45 Industrial Road, Pasig City"
                  className="px-3.5 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            {/* Supplied Materials & Pricing Configuration */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                    Supplied Materials & Price List
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Select ingredients this supplier provides and set agreed prices and packaging.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
                    {selectedCount} of {ingredients.length} items configured
                  </span>
                </div>
              </div>

              {/* Search & Categories */}
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                <div className="relative w-full sm:w-64">
                  <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search material..."
                    className="w-full pl-9 pr-3 py-1.5 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-1 items-center">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCat(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                        selectedCat === cat
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <div className="h-4 w-px bg-zinc-300 mx-1 hidden sm:block" />
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[11px] font-bold text-zinc-700 hover:text-black underline cursor-pointer px-1"
                  >
                    Select Filtered
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="text-[11px] font-bold text-zinc-400 hover:text-red-600 underline cursor-pointer px-1"
                  >
                    Clear Filtered
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200 max-h-96 overflow-y-auto">
                {filteredIngredients.map((ing) => {
                  const itemConfig = formData.items[ing.id];
                  const isChecked = !!itemConfig?.selected;
                  const price = parseFloat(itemConfig?.price) || 0;
                  const factor = parseFloat(itemConfig?.conversion_factor) || parseFloat(ing.conversion_factor) || 1;
                  const costPerBase = factor > 0 ? price / factor : price;

                  return (
                    <div
                      key={ing.id}
                      className={`p-3.5 transition-colors ${
                        isChecked ? 'bg-zinc-50/80' : 'bg-white hover:bg-zinc-50/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleItem(ing)}
                            className="w-4 h-4 text-zinc-900 focus:ring-zinc-900 rounded border-zinc-300 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-sm text-zinc-900">{ing.name}</span>
                            <span className="text-xs text-zinc-400 ml-2">Base: {ing.unit}</span>
                          </div>
                        </label>

                        {/* Inline Pricing Fields when Checked */}
                        {isChecked && (
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-7 sm:pl-0">
                            {/* Packaging Unit */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-zinc-500 uppercase">Unit:</span>
                              <input
                                type="text"
                                value={itemConfig.purchase_unit || ''}
                                onChange={(e) => handleFieldChange(ing.id, 'purchase_unit', e.target.value)}
                                placeholder="e.g. 1 kg Bag"
                                className="w-28 px-2 py-1 text-xs border border-zinc-300 rounded font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-black"
                              />
                            </div>

                            {/* Conversion Factor */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-zinc-500 uppercase">Yield ({ing.unit}):</span>
                              <input
                                type="number"
                                min="1"
                                value={itemConfig.conversion_factor || ''}
                                onChange={(e) => handleFieldChange(ing.id, 'conversion_factor', e.target.value)}
                                className="w-20 px-2 py-1 text-xs border border-zinc-300 rounded font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-black font-mono"
                              />
                            </div>

                            {/* Price: Protected from admin edit when editing existing supplier */}
                            {editingSupplier ? (
                              <div className="flex items-center gap-1.5" title="Prices can only be modified by the supplier through their portal">
                                <span className="text-[11px] font-bold text-zinc-500 uppercase">Price:</span>
                                <div className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold text-xs text-zinc-800 flex items-center gap-1">
                                  <span>₱{parseFloat(itemConfig.price || 0).toFixed(2)}</span>
                                  <span className="text-[10px] text-zinc-400 font-sans font-normal">(Supplier)</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-zinc-700">₱</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={itemConfig.price || ''}
                                  onChange={(e) => handleFieldChange(ing.id, 'price', e.target.value)}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1 text-xs border border-zinc-300 rounded font-black bg-white focus:outline-none focus:ring-1 focus:ring-black font-mono text-zinc-950"
                                />
                              </div>
                            )}

                            {/* Base unit calculation indicator */}
                            <div className="text-[11px] font-mono text-zinc-500 whitespace-nowrap hidden lg:block">
                              = ₱{costPerBase.toFixed(3)}/{ing.unit}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center shrink-0">
            <span className="text-xs text-zinc-500 font-medium">
              {selectedCount} ingredients will be linked to this supplier.
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors shadow-sm cursor-pointer"
              >
                {editingSupplier ? 'Save Changes' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierFormModal;
