import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCategorySettings,
  createCategory,
  updateCategorySettings,
  renameCategory,
  deleteCategory
} from '../../../../api/categorySettingsApi';
import { INPUT_LIMITS, validateAmountInput } from '../../../../utils/validationUtils';
import CategoryListSidebar from './CategoryListSidebar';
import CategoryDefaultsEditor from './CategoryDefaultsEditor';
import { useEscapeGuard } from '../../../../components/shared/useEscapeGuard';
import UnsavedNotice from '../../../../components/shared/UnsavedNotice';

const normalizeInput = (val) => String(val || '').trim().replace(/\s+/g, ' ').toUpperCase();
const KITCHEN_HINT_PATTERN =
  /PASTRY|PASTRIES|PASTA|SPAGHETTI|FOOD|MEAL|RICE|SNACK|SANDWICH|CAKE|WAFFLE|CROFFLE|BREAD|BURGER|PIZZA|DESSERT|NOODLE/i;

const CategorySettingsModal = ({ onClose, allIngredients = [], onCategoriesChanged }) => {
  const [categoryList, setCategoryList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const selectedCategoryRef = useRef('');
  selectedCategoryRef.current = selectedCategory;

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  // Category CRUD Form States
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryStation, setNewCategoryStation] = useState('BARISTA');
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Prep Station, Sizes & Add-ons Form State for current category
  const [editPrepStation, setEditPrepStation] = useState('BARISTA');
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    const ms = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      setNotice((curr) => (curr.text === text ? { type: '', text: '' } : curr));
    }, ms);
  }, []);

  const fetchSettings = useCallback(async (preferredSelection = null) => {
    try {
      setLoading(true);
      const data = await getCategorySettings();
      const rows = Array.isArray(data) ? data : [];
      setCategoryList(rows);

      const target = preferredSelection || selectedCategoryRef.current;
      const match = rows.find((r) => r.category === target);
      if (match) {
        setSelectedCategory(match.category);
      } else if (rows.length > 0) {
        setSelectedCategory(rows[0].category);
      } else {
        setSelectedCategory('');
      }
    } catch (err) {
      showNotice('error', err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const activeCategoryObj = categoryList.find((c) => c.category === selectedCategory) || null;
  const selectedProductCount = activeCategoryObj?.product_count ?? 0;

  useEffect(() => {
    setRenameValue(selectedCategory || '');
    setConfirmDeleteOpen(false);
    if (activeCategoryObj) {
      setEditPrepStation(String(activeCategoryObj.prep_station || 'BARISTA').toUpperCase() === 'KITCHEN' ? 'KITCHEN' : 'BARISTA');
      setEditSizes(activeCategoryObj.sizes || []);
      setEditAddOns(activeCategoryObj.add_ons || []);
    } else {
      setEditPrepStation('BARISTA');
      setEditSizes([]);
      setEditAddOns([]);
    }
  }, [selectedCategory, activeCategoryObj]);

  const handleNewCategoryNameChange = (val) => {
    setNewCategoryName(val);
    if (KITCHEN_HINT_PATTERN.test(val)) {
      setNewCategoryStation('KITCHEN');
    } else if (/COFFEE|TEA|FRAPPE|DRINK|JUICE|SODA|LATTE/i.test(val)) {
      setNewCategoryStation('BARISTA');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const cleaned = normalizeInput(newCategoryName);
    if (!cleaned) return;
    try {
      setLoading(true);
      const created = await createCategory(cleaned, {
        sizes: [],
        add_ons: [],
        prep_station: newCategoryStation
      });
      setNewCategoryName('');
      setNewCategoryStation('BARISTA');
      await fetchSettings(created.category || cleaned);
      await onCategoriesChanged?.();
      showNotice('success', `Category "${created.category || cleaned}" created.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not create category.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return;
    try {
      setLoading(true);
      const deletedName = selectedCategory;
      await deleteCategory(deletedName);
      setConfirmDeleteOpen(false);
      await fetchSettings('');
      await onCategoriesChanged?.();
      showNotice('success', `Category "${deletedName}" deleted.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not delete category.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCategory) return;
    const cleanedName = normalizeInput(renameValue);
    if (!cleanedName) {
      showNotice('error', 'Category name is required.');
      return;
    }

    try {
      setLoading(true);
      let targetCategory = selectedCategory;
      let movedNote = '';
      const isRenamed = cleanedName !== selectedCategory;

      if (isRenamed) {
        const res = await renameCategory(selectedCategory, cleanedName);
        targetCategory = res.category || cleanedName;
        if (res.moved_count > 0) {
          movedNote = ` (${res.moved_count} product(s) updated)`;
        }
      }

      await updateCategorySettings(targetCategory, {
        sizes: editSizes,
        add_ons: editAddOns,
        prep_station: editPrepStation
      });
      await fetchSettings(targetCategory);
      await onCategoriesChanged?.();

      if (isRenamed) {
        showNotice('success', `Saved changes — renamed "${selectedCategory}" to "${targetCategory}"${movedNote}.`);
      } else {
        showNotice('success', `Saved changes for ${targetCategory}.`);
      }
    } catch (err) {
      showNotice('error', err.message || 'Error saving changes.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSize = (sizeObj) => {
    if (!sizeObj?.name?.trim()) return false;
    const priceCheck = validateAmountInput(sizeObj.price_add === '' ? 0 : (sizeObj.price_add ?? 0), {
      label: `Size price add for ${sizeObj.name}`,
      min: 0,
      max: INPUT_LIMITS.ADDON_PRICE_MAX
    });
    if (!priceCheck.valid) {
      showNotice('error', priceCheck.error);
      return false;
    }
    const multVal =
      sizeObj.recipe_multiplier === '' || sizeObj.recipe_multiplier === null || sizeObj.recipe_multiplier === undefined
        ? 1
        : sizeObj.recipe_multiplier;
    const multCheck = validateAmountInput(multVal, {
      label: `Recipe multiplier for ${sizeObj.name}`,
      min: 0.1,
      max: 10
    });
    if (!multCheck.valid) {
      showNotice('error', multCheck.error);
      return false;
    }

    setEditSizes((prev) => [
      ...prev,
      {
        ...sizeObj,
        name: sizeObj.name.trim(),
        price_add: priceCheck.numericValue,
        recipe_multiplier: multCheck.numericValue,
        ingredient_id: sizeObj.ingredient_id || null,
        lid_ingredient_id: sizeObj.lid_ingredient_id || null,
        straw_ingredient_id: sizeObj.straw_ingredient_id || null,
        dine_in_no_cup: Boolean(sizeObj.dine_in_no_cup)
      }
    ]);
    return true;
  };

  const handleRemoveSize = (index) => {
    setEditSizes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSize = (index, patch) => {
    setEditSizes((prev) => prev.map((sz, i) => (i === index ? { ...sz, ...patch } : sz)));
  };

  const handleAddAddOn = (addonObj) => {
    if (!addonObj?.name?.trim()) return false;
    const priceCheck = validateAmountInput(addonObj.price === '' ? 0 : (addonObj.price ?? 0), {
      label: `Add-on price for ${addonObj.name}`,
      min: 0,
      max: INPUT_LIMITS.ADDON_PRICE_MAX
    });
    if (!priceCheck.valid) {
      showNotice('error', priceCheck.error);
      return false;
    }
    const qtyCheck = validateAmountInput(addonObj.quantity === '' ? 0 : (addonObj.quantity ?? 0), {
      label: `Add-on quantity for ${addonObj.name}`,
      min: 0,
      max: INPUT_LIMITS.RECIPE_QTY_MAX
    });
    if (!qtyCheck.valid) {
      showNotice('error', qtyCheck.error);
      return false;
    }

    setEditAddOns((prev) => [
      ...prev,
      {
        ...addonObj,
        name: addonObj.name.trim(),
        price: priceCheck.numericValue,
        quantity: qtyCheck.numericValue
      }
    ]);
    return true;
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns((prev) => prev.filter((_, i) => i !== index));
  };

  const hasPendingRename =
    Boolean(selectedCategory) &&
    Boolean(normalizeInput(renameValue)) &&
    normalizeInput(renameValue) !== selectedCategory;

  // Baseline = the saved category (same values the sync effect loads into the form).
  const basePrep = String(activeCategoryObj?.prep_station || 'BARISTA').toUpperCase() === 'KITCHEN' ? 'KITCHEN' : 'BARISTA';
  const dirty =
    Boolean(activeCategoryObj) &&
    (renameValue !== selectedCategory ||
      editPrepStation !== basePrep ||
      JSON.stringify(editSizes) !== JSON.stringify(activeCategoryObj.sizes || []) ||
      JSON.stringify(editAddOns) !== JSON.stringify(activeCategoryObj.add_ons || []));
  const lockTitle = dirty ? 'Save or reset your changes first' : undefined;
  const guardedClose = () => { if (!dirty) onClose(); };
  const escWarn = useEscapeGuard({ active: !loading, dirty, onClose });
  const handleReset = () => {
    setRenameValue(selectedCategory);
    setEditPrepStation(basePrep);
    setEditSizes(activeCategoryObj?.sizes || []);
    setEditAddOns(activeCategoryObj?.add_ons || []);
  };

  return (
    <>
    <UnsavedNotice show={escWarn} />
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) guardedClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">Manage Categories</h2>
            <p className="m-0 text-xs text-gray-300 font-medium mt-0.5">
              Add, rename, or delete categories and configure default sizes &amp; add-ons
            </p>
          </div>
          <button
            className="text-gray-200 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={dirty}
            title={lockTitle}
            onClick={guardedClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {notice.text && (
            <div
              className={`p-3.5 mb-5 rounded-xl text-sm md:text-base font-bold flex items-center shadow-sm ${
                notice.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {notice.text}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <CategoryListSidebar
              categoryList={categoryList}
              selectedCategory={selectedCategory}
              onSelectCategory={(c) => { if (!dirty) setSelectedCategory(c); }}
              newCategoryName={newCategoryName}
              onNewCategoryNameChange={handleNewCategoryNameChange}
              newCategoryStation={newCategoryStation}
              onNewCategoryStationChange={setNewCategoryStation}
              onAddCategory={handleAddCategory}
              loading={loading}
            />

            <div className="flex-1 min-w-0 w-full">
              {selectedCategory ? (
                <>
                  {/* Category Rename & Delete Header Bar */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 flex flex-col gap-3">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base md:text-lg font-black text-gray-900 tracking-tight">
                          {selectedCategory}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-mono font-bold text-gray-700">
                          {selectedProductCount} {selectedProductCount === 1 ? 'product' : 'products'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor="category-rename-input" className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Name
                          </label>
                          <input
                            id="category-rename-input"
                            type="text"
                            maxLength={40}
                            aria-label="Category name"
                            className="w-44 sm:w-52 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs md:text-sm font-semibold uppercase focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            disabled={loading}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteOpen((prev) => !prev)}
                          disabled={loading || selectedProductCount > 0}
                          title={
                            selectedProductCount > 0
                              ? `In use by ${selectedProductCount} product(s)`
                              : `Delete ${selectedCategory}`
                          }
                          className="px-3.5 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition-colors disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {hasPendingRename && (
                      <p className="m-0 text-xs text-amber-700 font-semibold">
                        Pending rename to &ldquo;{normalizeInput(renameValue)}&rdquo; — click Save Changes below to apply.
                      </p>
                    )}

                    {selectedProductCount > 0 && (
                      <p className="m-0 text-xs text-gray-500 font-medium">
                        In use by {selectedProductCount} product(s) — reassign or delete those products before removing this category.
                      </p>
                    )}

                    {confirmDeleteOpen && selectedProductCount === 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200">
                        <span className="text-xs md:text-sm font-bold text-red-700">
                          Delete &ldquo;{selectedCategory}&rdquo;? This cannot be undone.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteOpen(false)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmDelete}
                            disabled={loading}
                            className="px-3 py-1.5 bg-red-600 text-white border-none rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-700 cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs md:text-sm text-gray-600 mb-4 font-medium">
                    Any sizes or add-ons defined here automatically apply to all products inside{' '}
                    <strong className="text-gray-900">{selectedCategory}</strong>. Leave both empty for non-beverage items like pastries or rice meals.
                  </p>

                  <CategoryDefaultsEditor
                    allIngredients={allIngredients}
                    prepStation={editPrepStation}
                    onPrepStationChange={setEditPrepStation}
                    editSizes={editSizes}
                    onAddSize={handleAddSize}
                    onRemoveSize={handleRemoveSize}
                    onUpdateSize={handleUpdateSize}
                    editAddOns={editAddOns}
                    onAddAddOn={handleAddAddOn}
                    onRemoveAddOn={handleRemoveAddOn}
                  />

                  <div className="mt-6 flex justify-end items-center gap-3">
                    {dirty && <span className="text-xs font-bold text-amber-600">Unsaved changes</span>}
                    {dirty && (
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={loading}
                        className="px-6 py-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-amber-100 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-7 py-3 bg-gray-900 text-white rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:bg-gray-400 disabled:hover:translate-y-0 cursor-pointer"
                      onClick={handleSave}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-10 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500">
                  {loading ? 'Loading categories...' : 'Create a category on the left to configure default sizes and add-ons.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default CategorySettingsModal;
