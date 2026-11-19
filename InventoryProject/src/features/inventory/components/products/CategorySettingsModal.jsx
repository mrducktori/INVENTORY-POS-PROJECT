import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCategorySettings,
  createCategory,
  updateCategorySettings,
  renameCategory,
  deleteCategory
} from '../../../../api/categorySettingsApi';
import CategoryListSidebar from './CategoryListSidebar';
import CategoryDefaultsEditor from './CategoryDefaultsEditor';

const normalizeInput = (val) => String(val || '').trim().replace(/\s+/g, ' ').toUpperCase();

const CategorySettingsModal = ({ onClose, allIngredients = [], onCategoriesChanged }) => {
  const [categoryList, setCategoryList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const selectedCategoryRef = useRef('');
  selectedCategoryRef.current = selectedCategory;

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  // Category CRUD Form States
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Sizes & Add-ons Form State for current category
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);
  const [newSize, setNewSize] = useState({ name: '', price_add: '', ingredient_id: '' });
  const [newAddOn, setNewAddOn] = useState({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });

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
      setEditSizes(activeCategoryObj.sizes || []);
      setEditAddOns(activeCategoryObj.add_ons || []);
    } else {
      setEditSizes([]);
      setEditAddOns([]);
    }
  }, [selectedCategory, activeCategoryObj]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const cleaned = normalizeInput(newCategoryName);
    if (!cleaned) return;
    try {
      setLoading(true);
      const created = await createCategory(cleaned, { sizes: [], add_ons: [] });
      setNewCategoryName('');
      await fetchSettings(created.category || cleaned);
      await onCategoriesChanged?.();
      showNotice('success', `Category "${created.category || cleaned}" created.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not create category.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameCategory = async (e) => {
    e.preventDefault();
    if (!selectedCategory) return;
    const cleaned = normalizeInput(renameValue);
    if (!cleaned || cleaned === selectedCategory) return;
    try {
      setLoading(true);
      const res = await renameCategory(selectedCategory, cleaned);
      const updatedName = res.category || cleaned;
      await fetchSettings(updatedName);
      await onCategoriesChanged?.();
      const movedNote = res.moved_count > 0 ? ` (${res.moved_count} product(s) updated)` : '';
      showNotice('success', `Renamed to "${updatedName}"${movedNote}.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not rename category.');
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
    try {
      setLoading(true);
      await updateCategorySettings(selectedCategory, { sizes: editSizes, add_ons: editAddOns });
      await fetchSettings(selectedCategory);
      await onCategoriesChanged?.();
      showNotice('success', `Settings saved for ${selectedCategory}.`);
    } catch (err) {
      showNotice('error', 'Error saving: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSize = () => {
    if (!newSize.name) return;
    setEditSizes((prev) => [...prev, { ...newSize, price_add: parseFloat(newSize.price_add) || 0 }]);
    setNewSize({ name: '', price_add: '', ingredient_id: '' });
  };

  const handleRemoveSize = (index) => {
    setEditSizes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAddOn = () => {
    if (!newAddOn.name) return;
    setEditAddOns((prev) => [
      ...prev,
      {
        ...newAddOn,
        price: parseFloat(newAddOn.price) || 0,
        quantity: parseFloat(newAddOn.quantity) || 0
      }
    ]);
    setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns((prev) => prev.filter((_, i) => i !== index));
  };

  const canRename =
    Boolean(selectedCategory) &&
    Boolean(normalizeInput(renameValue)) &&
    normalizeInput(renameValue) !== selectedCategory;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
            className="text-gray-200 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0"
            onClick={onClose}
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
              onSelectCategory={setSelectedCategory}
              newCategoryName={newCategoryName}
              onNewCategoryNameChange={setNewCategoryName}
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
                        <form onSubmit={handleRenameCategory} className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={40}
                            aria-label="Rename category"
                            className="w-44 sm:w-52 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs md:text-sm font-semibold uppercase focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            disabled={loading}
                          />
                          <button
                            type="submit"
                            disabled={loading || !canRename}
                            className="px-3.5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Rename
                          </button>
                        </form>

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
                    editSizes={editSizes}
                    newSize={newSize}
                    onNewSizeChange={setNewSize}
                    onAddSize={handleAddSize}
                    onRemoveSize={handleRemoveSize}
                    editAddOns={editAddOns}
                    newAddOn={newAddOn}
                    onNewAddOnChange={setNewAddOn}
                    onAddAddOn={handleAddAddOn}
                    onRemoveAddOn={handleRemoveAddOn}
                  />

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      className="px-7 py-3 bg-gray-900 text-white rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:bg-gray-400 disabled:hover:translate-y-0 cursor-pointer"
                      onClick={handleSave}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Settings for ' + selectedCategory}
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
  );
};

export default CategorySettingsModal;
