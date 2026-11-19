import React, { useState, useRef } from 'react';
import { CATEGORIES } from '../../../../utils/constants';
import SearchableIngredientSelect from '../../../../components/shared/SearchableIngredientSelect';

const ModifyProductModal = ({
  selectedProduct,
  categories,
  onClose,
  editName,
  setEditName,
  editCategory,
  setEditCategory,
  editPrice,
  setEditPrice,
  editImageUrl,
  uploading,
  onImageUpload,
  editTrackStock,
  setEditTrackStock,
  editStockQty,
  editThreshold,
  setEditThreshold,
  onUpdateProduct,
  recipe,
  allIngredients,
  newRecipeItem,
  setNewRecipeItem,
  onAddRecipeItem,
  onUpdateRecipeItem,
  onDeleteRecipeItem
}) => {
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [editRecipeQty, setEditRecipeQty] = useState('');
  const [editRecipeUnit, setEditRecipeUnit] = useState('');
  const quantityInputRef = useRef(null);

  if (!selectedProduct) return null;

  const baseCategories =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : CATEGORIES.filter((c) => c !== 'OTHERS');
  const categoryOptions =
    editCategory && !baseCategories.includes(editCategory)
      ? [editCategory, ...baseCategories]
      : baseCategories;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] flex flex-col max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Modify Product: {selectedProduct.name}</h2>
          <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" onClick={onClose} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          <form id="modify-product-form" onSubmit={onUpdateProduct} className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Name</label>
                <input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text md:text-sm font-bold text-gray-700 uppercase tracking-wider">Category</label>
                <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer" value={editCategory} onChange={e => setEditCategory(e.target.value)} required>
                  <option value="">Select Category</option>
                  {categoryOptions.map(cat => (
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
                  onChange={(e) => onImageUpload(e, true)}
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
          </form>

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
                                        onUpdateRecipeItem(r.id, qty, editRecipeUnit);
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
                                      onUpdateRecipeItem(r.id, qty, editRecipeUnit);
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
                              onClick={() => onDeleteRecipeItem(r.id)}
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

              <form onSubmit={onAddRecipeItem} className="flex flex-col sm:flex-row gap-3 items-end">
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

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            form="modify-product-form"
            type="submit"
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModifyProductModal;
