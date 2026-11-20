import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createRawMaterialCategory,
  renameRawMaterialCategory,
  deleteRawMaterialCategory
} from '../../../api/inventoryApi';

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
  const [renameValue, setRenameValue] = useState(
    () => categoryObjects[0]?.category || ''
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const noticeTimerRef = useRef(null);

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

  // Keep selection valid if categoryObjects updates from parent
  useEffect(() => {
    if (categoryObjects.length === 0) {
      setSelectedCategory('');
      return;
    }
    const stillExists = categoryObjects.some(
      (item) => item.category === selectedCategory
    );
    if (!stillExists) {
      setSelectedCategory(categoryObjects[0].category);
    }
  }, [categoryObjects, selectedCategory]);

  // Sync rename input when selected category changes
  useEffect(() => {
    setRenameValue(selectedCategory || '');
    setConfirmDeleteOpen(false);
  }, [selectedCategory]);

  const activeCategoryObj =
    categoryObjects.find((item) => item.category === selectedCategory) || null;
  const selectedCount = activeCategoryObj?.ingredient_count ?? 0;

  const cleanedRename = normalizeCategory(renameValue);
  const hasPendingRename =
    Boolean(selectedCategory) &&
    Boolean(cleanedRename) &&
    cleanedRename !== selectedCategory;

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
    if (!selectedCategory) return;
    if (!cleanedRename) {
      showNotice('error', 'Category name is required.');
      return;
    }
    if (cleanedRename === selectedCategory) return;

    try {
      setIsSubmitting(true);
      const res = await renameRawMaterialCategory(selectedCategory, cleanedRename);
      const updatedName = res?.new_name || cleanedRename;
      const updatedCount = res?.updated_count ?? 0;
      setSelectedCategory(updatedName);
      await onCategoriesChanged?.();
      const countNote =
        updatedCount > 0 ? ` (${updatedCount} material(s) updated)` : '';
      showNotice(
        'success',
        `Renamed "${selectedCategory}" to "${updatedName}"${countNote}.`
      );
    } catch (err) {
      showNotice('error', err.message || 'Could not rename category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedCategory || selectedCount > 0) return;

    try {
      setIsSubmitting(true);
      const deletedName = selectedCategory;
      await deleteRawMaterialCategory(deletedName);
      setConfirmDeleteOpen(false);
      await onCategoriesChanged?.();
      showNotice('success', `Category "${deletedName}" deleted.`);
    } catch (err) {
      showNotice('error', err.message || 'Could not delete category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">
              Manage Raw Material Categories
            </h2>
            <p className="m-0 text-xs text-gray-300 font-medium mt-0.5">
              Add, rename, or delete categories used to organize raw materials
            </p>
          </div>
          <button
            type="button"
            className="text-gray-300 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1"
            onClick={onClose}
            disabled={isSubmitting}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {notice.text && (
            <div
              className={`p-3.5 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm ${
                notice.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice({ type: '', text: '' })}
                className="text-xs font-bold uppercase opacity-75 hover:opacity-100 cursor-pointer ml-3 bg-transparent border-none"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Add New Category Bar */}
          <form
            onSubmit={handleAddCategory}
            className="bg-gray-50 border border-gray-200 rounded-xl p-4"
          >
            <label
              htmlFor="new-raw-material-category"
              className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2"
            >
              Add New Category
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="new-raw-material-category"
                type="text"
                maxLength={40}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. SYRUPS & SAUCES"
                disabled={isSubmitting}
                className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold uppercase focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmitting || !normalizeCategory(newCategoryName)}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                + Add
              </button>
            </div>
          </form>

          {/* Categories List & Editor */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Category List */}
            <div className="md:col-span-6 border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Categories
                </span>
                <span className="text-xs font-semibold text-gray-500">
                  {categoryObjects.length} total
                </span>
              </div>
              {categoryObjects.length > 0 ? (
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {categoryObjects.map((item) => {
                    const isSelected = item.category === selectedCategory;
                    const count = item.ingredient_count ?? 0;
                    return (
                      <button
                        key={item.category}
                        type="button"
                        onClick={() => setSelectedCategory(item.category)}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer border-none ${
                          isSelected
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wide truncate">
                          {item.category}
                        </span>
                        <span
                          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            isSelected
                              ? 'bg-white/15 text-white'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {count} {count === 1 ? 'material' : 'materials'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-400">
                  No categories found.
                </div>
              )}
            </div>

            {/* Selected Category Editor */}
            <div className="md:col-span-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
              {selectedCategory ? (
                <form onSubmit={handleSaveRename} className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-200">
                    <div className="min-w-0">
                      <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Selected Category
                      </span>
                      <h3 className="m-0 mt-0.5 text-sm font-extrabold text-gray-900 uppercase tracking-wide break-words">
                        {selectedCategory}
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-mono font-bold text-gray-700 shrink-0">
                      {selectedCount} {selectedCount === 1 ? 'material' : 'materials'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="rename-raw-material-category"
                      className="text-xs font-bold text-gray-600 uppercase tracking-wider"
                    >
                      Category Name
                    </label>
                    <input
                      id="rename-raw-material-category"
                      type="text"
                      maxLength={40}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold uppercase focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                    {hasPendingRename && (
                      <p className="m-0 text-xs text-amber-700 font-semibold">
                        Click Save Changes to rename to &ldquo;{cleanedRename}&rdquo;.
                      </p>
                    )}
                  </div>

                  {selectedCount > 0 && (
                    <p className="m-0 text-xs text-gray-500 font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
                      Cannot delete while in use by {selectedCount}{' '}
                      {selectedCount === 1 ? 'material' : 'materials'}. Reassign
                      those materials first.
                    </p>
                  )}

                  {confirmDeleteOpen && selectedCount === 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col gap-2.5">
                      <span className="text-xs font-bold text-red-700">
                        Delete &ldquo;{selectedCategory}&rdquo;? This cannot be undone.
                      </span>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteOpen(false)}
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

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen((prev) => !prev)}
                      disabled={isSubmitting || selectedCount > 0}
                      title={
                        selectedCount > 0
                          ? `Cannot delete: in use by ${selectedCount} material(s)`
                          : `Delete ${selectedCategory}`
                      }
                      className="px-3.5 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition-colors disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !hasPendingRename}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  Select a category to rename or delete.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RawMaterialCategoriesModal;
