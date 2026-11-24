import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createRawMaterialCategory,
  renameRawMaterialCategory,
  deleteRawMaterialCategory,
  getCategoryShelfLife,
  updateCategoryShelfLife
} from '../../../api/inventoryApi';
import { useEscapeGuard } from '../../../components/shared/useEscapeGuard';
import UnsavedNotice from '../../../components/shared/UnsavedNotice';

const normalizeCategory = (val) =>
  String(val || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const RawMaterialCategoriesModal = ({
  onClose,
  categoryObjects = [],
  onCategoriesChanged
}) => {
  const [selectedCategory, setSelectedCategory] = useState(
    () => categoryObjects[0]?.category || ''
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameDraft, setRenameDraft] = useState(null);
  const [confirmDeleteFor, setConfirmDeleteFor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const noticeTimerRef = useRef(null);
  const [shelfMap, setShelfMap] = useState({});
  const [shelfDraft, setShelfDraft] = useState(null); // { category, perishable, days }

  const loadShelfLife = useCallback(async () => {
    try {
      const rows = await getCategoryShelfLife();
      setShelfMap(Object.fromEntries((rows || []).map((r) => [r.category, r])));
    } catch { /* editor falls back to defaults */ }
  }, []);

  useEffect(() => { loadShelfLife(); }, [loadShelfLife]);

  const showNotice = useCallback((type, text) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setNotice({ type, text });
    const ms = type === 'error' ? 5000 : 3000;
    noticeTimerRef.current = setTimeout(() => {
      setNotice((curr) => (curr.text === text ? { type: '', text: '' } : curr));
    }, ms);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const effectiveSelectedCategory = categoryObjects.some(
    (item) => item.category === selectedCategory
  )
    ? selectedCategory
    : categoryObjects[0]?.category || '';

  const activeCategoryObj =
    categoryObjects.find((item) => item.category === effectiveSelectedCategory) ||
    null;
  const selectedCount = activeCategoryObj?.ingredient_count ?? 0;

  const savedShelf = shelfMap[effectiveSelectedCategory];
  const shelf =
    shelfDraft?.category === effectiveSelectedCategory
      ? shelfDraft
      : {
          category: effectiveSelectedCategory,
          perishable: savedShelf ? savedShelf.is_perishable !== false : true,
          days: savedShelf?.default_shelf_life_days ?? ''
        };

  const shelfDirty =
    shelfDraft?.category === effectiveSelectedCategory &&
    (shelfDraft.perishable !== (savedShelf ? savedShelf.is_perishable !== false : true) ||
      String(shelfDraft.days) !== String(savedShelf?.default_shelf_life_days ?? ''));

  const handleSaveShelfLife = async () => {
    const days = Math.round(Number(shelf.days));
    if (shelf.perishable && !(days >= 1 && days <= 3650)) {
      showNotice('error', 'Shelf life must be between 1 and 3650 days.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateCategoryShelfLife(effectiveSelectedCategory, {
        is_perishable: shelf.perishable,
        default_shelf_life_days: shelf.perishable ? days : null
      });
      setShelfDraft(null);
      await loadShelfLife();
      if (onCategoriesChanged) await onCategoriesChanged();
      showNotice('success', 'Category shelf life saved.');
    } catch (err) {
      showNotice('error', err.message || 'Failed to save shelf life.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renameValue =
    renameDraft && renameDraft.category === effectiveSelectedCategory
      ? renameDraft.value
      : effectiveSelectedCategory;
  const cleanedRename = normalizeCategory(renameValue);
  const hasPendingRename =
    Boolean(effectiveSelectedCategory) &&
    Boolean(cleanedRename) &&
    cleanedRename !== effectiveSelectedCategory;
  const dirty = shelfDirty || (renameDraft?.category === effectiveSelectedCategory && renameDraft.value !== effectiveSelectedCategory);
  const lockTitle = dirty ? 'Save or reset your changes first' : undefined;
  const guardedClose = () => { if (!dirty) onClose(); };
  const escWarn = useEscapeGuard({ active: !isSubmitting, dirty, onClose });
  const handleReset = () => { setRenameDraft(null); setShelfDraft(null); };
  const isConfirmDeleteOpen =
    confirmDeleteFor === effectiveSelectedCategory && selectedCount === 0;

  const handleSelectCategory = (categoryName) => {
    if (dirty) return;
    setSelectedCategory(categoryName);
    setRenameDraft(null);
    setConfirmDeleteFor('');
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const cleaned = normalizeCategory(newCategoryName);
    if (!cleaned) {
      showNotice('error', 'Please enter a category name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createRawMaterialCategory(cleaned);
      const createdName = res?.category || cleaned;
      setNewCategoryName('');
      setSelectedCategory(createdName);
      setRenameDraft(null);
      setConfirmDeleteFor('');
      await onCategoriesChanged?.();
      showNotice('success', `Category "${createdName}" added.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    if (!effectiveSelectedCategory) return;
    if (!cleanedRename) {
      showNotice('error', 'Category name is required.');
      return;
    }
    if (cleanedRename === effectiveSelectedCategory) return;

    const previousName = effectiveSelectedCategory;

    try {
      setIsSubmitting(true);
      const res = await renameRawMaterialCategory(previousName, cleanedRename);
      const updatedName = res?.new_name || cleanedRename;
      const updatedCount = res?.updated_count ?? 0;
      setSelectedCategory(updatedName);
      setRenameDraft(null);
      setConfirmDeleteFor('');
      await onCategoriesChanged?.();
      const countNote =
        updatedCount > 0 ? ` (${updatedCount} material(s) updated)` : '';
      showNotice(
        'success',
        `Renamed "${previousName}" to "${updatedName}"${countNote}.`
      );
    } catch (err) {
      showNotice('error', err.message || 'Could not rename category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!effectiveSelectedCategory || selectedCount > 0) return;

    const deletedName = effectiveSelectedCategory;

    try {
      setIsSubmitting(true);
      await deleteRawMaterialCategory(deletedName);
      setConfirmDeleteFor('');
      setRenameDraft(null);
      await onCategoriesChanged?.();
      showNotice('success', `Category "${deletedName}" deleted.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not delete category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <UnsavedNotice show={escWarn} />
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) guardedClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">
              Manage Categories
            </h2>
            <p className="m-0 text-xs text-gray-300 font-medium mt-0.5">
              Add, rename, or delete raw material categories
            </p>
          </div>
          <button
            type="button"
            className="text-gray-200 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={guardedClose}
            disabled={isSubmitting || dirty}
            title={lockTitle}
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
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
            {/* Left Sidebar */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
              <form
                onSubmit={handleAddCategory}
                className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-2"
              >
                <label
                  htmlFor="new-raw-material-category"
                  className="text-xs font-bold text-gray-700 uppercase tracking-wider"
                >
                  New Category
                </label>
                <div className="flex gap-2">
                  <input
                    id="new-raw-material-category"
                    type="text"
                    maxLength={40}
                    className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs md:text-sm font-semibold uppercase placeholder:normal-case focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    placeholder="e.g., SYRUPS & SAUCES"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newCategoryName.trim()}
                    className="px-3.5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </form>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Categories
                  </span>
                  <span className="text-xs font-bold text-gray-500 font-mono">
                    {categoryObjects.length}
                  </span>
                </div>

                <div className="divide-y divide-gray-100 max-h-60 lg:max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                  {categoryObjects.length > 0 ? (
                    categoryObjects.map((item) => {
                      const isSelected =
                        item.category === effectiveSelectedCategory;
                      const count = item.ingredient_count ?? 0;
                      return (
                        <button
                          key={item.category}
                          type="button"
                          onClick={() => handleSelectCategory(item.category)}
                          className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors border-none cursor-pointer ${
                            isSelected
                              ? 'bg-gray-900 text-white'
                              : 'bg-white text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xs md:text-sm font-bold truncate">
                            {item.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                            title={`${count} material(s)`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-gray-500">
                      No categories found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 min-w-0 w-full">
              {effectiveSelectedCategory ? (
                <form onSubmit={handleSaveRename}>
                  {/* Category Rename & Delete Header Bar */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 flex flex-col gap-3">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base md:text-lg font-black text-gray-900 tracking-tight">
                          {effectiveSelectedCategory}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-mono font-bold text-gray-700">
                          {selectedCount}{' '}
                          {selectedCount === 1 ? 'material' : 'materials'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="rename-raw-material-category"
                            className="text-xs font-bold text-gray-500 uppercase tracking-wider"
                          >
                            Name
                          </label>
                          <input
                            id="rename-raw-material-category"
                            type="text"
                            maxLength={40}
                            aria-label="Category name"
                            className="w-44 sm:w-52 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs md:text-sm font-semibold uppercase focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                            value={renameValue}
                            onChange={(e) =>
                              setRenameDraft({
                                category: effectiveSelectedCategory,
                                value: e.target.value
                              })
                            }
                            disabled={isSubmitting}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteFor((prev) =>
                              prev === effectiveSelectedCategory
                                ? ''
                                : effectiveSelectedCategory
                            )
                          }
                          disabled={isSubmitting || selectedCount > 0}
                          title={
                            selectedCount > 0
                              ? `In use by ${selectedCount} material(s)`
                              : `Delete ${effectiveSelectedCategory}`
                          }
                          className="px-3.5 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition-colors disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {hasPendingRename && (
                      <p className="m-0 text-xs text-amber-700 font-semibold">
                        Pending rename to &ldquo;{cleanedRename}&rdquo; — click
                        Save Changes below to apply.
                      </p>
                    )}

                    {selectedCount > 0 && (
                      <p className="m-0 text-xs text-gray-500 font-medium">
                        In use by {selectedCount} material(s) — reassign or
                        archive those materials before removing this category.
                      </p>
                    )}

                    {isConfirmDeleteOpen && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200">
                        <span className="text-xs md:text-sm font-bold text-red-700">
                          Delete &ldquo;{effectiveSelectedCategory}&rdquo;? This
                          cannot be undone.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFor('')}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmDelete}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 bg-red-600 text-white border-none rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-700 cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3 mb-4">
                    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                      <div>
                        <span className="block text-xs font-bold text-gray-800 uppercase tracking-wider">Perishable Category</span>
                        <span className="block text-[11px] text-gray-500">Default for materials that do not set their own shelf life</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={shelf.perishable}
                        onChange={(e) => setShelfDraft({ ...shelf, perishable: e.target.checked })}
                        className="w-4 h-4 accent-gray-900 rounded cursor-pointer"
                      />
                    </label>
                    {shelf.perishable && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Default Shelf Life (Days)</label>
                        <input
                          type="number"
                          min="1"
                          max="3650"
                          step="1"
                          value={shelf.days}
                          onChange={(e) => setShelfDraft({ ...shelf, days: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveShelfLife}
                      disabled={isSubmitting || shelfDraft?.category !== effectiveSelectedCategory}
                      className="self-start px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Save Shelf Life
                    </button>
                  </div>

                  <p className="text-xs md:text-sm text-gray-600 mb-4 font-medium">
                    Raw materials assigned to{' '}
                    <strong className="text-gray-900">
                      {effectiveSelectedCategory}
                    </strong>{' '}
                    use this category across Inventory, Purchasing, and Demand
                    Forecasting.
                  </p>

                  <div className="mt-6 flex justify-end items-center gap-3">
                    {dirty && <span className="text-xs font-bold text-amber-600">Unsaved changes</span>}
                    {dirty && (
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-amber-100 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting || !hasPendingRename}
                      className="px-7 py-3 bg-gray-900 text-white rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:bg-gray-400 disabled:hover:translate-y-0 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-10 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500">
                  Create a category on the left to rename or remove categories.
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

export default RawMaterialCategoriesModal;
