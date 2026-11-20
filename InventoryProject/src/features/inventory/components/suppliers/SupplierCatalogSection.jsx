import React, { useState, useEffect, useMemo } from 'react';
import { getSupplierOwnCatalog, updateSupplierOwnCatalog } from '../../../../api/purchasingApi';
import Pagination from '../../../../components/shared/Pagination';
import { TableSkeleton } from '../../../../components/shared/SkeletonLoader';

const RAW_MATERIAL_CATEGORIES = [
  'COFFEE & TEA BASES',
  'DAIRY & CREAMERS',
  'SWEETENERS & SYRUPS',
  'FLAVORING POWDERS',
  'SINKERS & TOPPINGS',
  'BEVERAGE ENHANCERS',
  'PACKAGING & SUPPLIES'
];

const COMMON_PURCHASE_UNITS = [
  'Bag', 'Box', 'Bottle', 'Can', 'Pack', 'Pouch', 'Carton', 'Sack', 'Tub', 'Roll', 'Piece', 'Kg', 'Liter'
];

export default function SupplierCatalogSection() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'EDITED' | 'SAVED'
  const [sortOption, setSortOption] = useState('NAME_ASC'); // 'NAME_ASC' | 'NAME_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'EDITED_FIRST'
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Track edited values: { [ingredient_id]: { price, purchase_unit } }
  const [edits, setEdits] = useState({});

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getSupplierOwnCatalog();
      setCatalog(data);
      setEdits({});
    } catch (err) {
      setError(err.message || 'Failed to load supplier catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setStatusFilter('ALL');
    setSortOption('NAME_ASC');
    setCurrentPage(1);
  };

  const isFiltered = Boolean(
    searchTerm.trim() ||
    selectedCategory !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sortOption !== 'NAME_ASC'
  );

  const items = useMemo(() => {
    return catalog?.supplier_ingredients || [];
  }, [catalog]);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: items.length };
    items.forEach(row => {
      const cat = (row.ingredients?.category || 'GENERAL').toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  const availableCategories = useMemo(() => {
    const set = new Set();
    items.forEach(row => {
      set.add((row.ingredients?.category || 'GENERAL').toUpperCase());
    });
    const list = RAW_MATERIAL_CATEGORIES.filter(c => set.has(c));
    set.forEach(c => {
      if (!list.includes(c)) list.push(c);
    });
    return list;
  }, [items]);

  const statusCounts = useMemo(() => {
    let edited = 0;
    items.forEach(row => {
      const ingredientId = row.ingredient_id || row.ingredients?.id;
      const editData = edits[ingredientId];
      if (editData && (editData.price !== undefined || editData.purchase_unit !== undefined)) {
        edited++;
      }
    });
    return {
      all: items.length,
      edited,
      saved: items.length - edited
    };
  }, [items, edits]);

  const handlePriceChange = (ingredientId, value) => {
    setEdits(prev => ({
      ...prev,
      [ingredientId]: {
        ...(prev[ingredientId] || {}),
        price: value
      }
    }));
  };

  const handleUnitChange = (ingredientId, value) => {
    setEdits(prev => ({
      ...prev,
      [ingredientId]: {
        ...(prev[ingredientId] || {}),
        purchase_unit: value
      }
    }));
  };

  const handleReset = () => {
    setEdits({});
    setSuccessMsg('');
  };

  const dirtyCount = Object.keys(edits).length;

  const handleSaveAll = async () => {
    if (dirtyCount === 0) return;
    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');

      const payload = Object.entries(edits).map(([ingredientId, change]) => {
        const original = items.find(i => (i.ingredient_id || i.ingredients?.id) === ingredientId);
        return {
          ingredient_id: ingredientId,
          default_price: change.price !== undefined ? parseFloat(change.price) : original?.default_price,
          default_purchase_unit: change.purchase_unit !== undefined ? change.purchase_unit : original?.default_purchase_unit
        };
      });

      await updateSupplierOwnCatalog(payload);
      setSuccessMsg(`Successfully updated pricing for ${payload.length} item${payload.length > 1 ? 's' : ''}.`);
      setEdits({});
      await loadCatalog();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      setError(err.message || 'Failed to save price updates');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const result = items.filter(row => {
      const ing = row.ingredients || {};
      const name = (ing.name || '').toLowerCase();
      const cat = (ing.category || 'GENERAL').toUpperCase();
      const ingredientId = row.ingredient_id || ing.id;
      const editData = edits[ingredientId];
      const isModified = editData && (
        editData.price !== undefined || 
        editData.purchase_unit !== undefined
      );

      const matchesSearch = !term || 
        name.includes(term) || 
        cat.toLowerCase().includes(term) ||
        String(row.default_purchase_unit || '').toLowerCase().includes(term);

      const matchesCategory = selectedCategory === 'ALL' || cat === selectedCategory;

      let matchesStatus = true;
      if (statusFilter === 'EDITED') {
        matchesStatus = Boolean(isModified);
      } else if (statusFilter === 'SAVED') {
        matchesStatus = !isModified;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sorting
    return [...result].sort((a, b) => {
      const aIng = a.ingredients || {};
      const bIng = b.ingredients || {};
      const aId = a.ingredient_id || aIng.id;
      const bId = b.ingredient_id || bIng.id;
      const aEdit = edits[aId];
      const bEdit = edits[bId];
      const aModified = Boolean(aEdit && (aEdit.price !== undefined || aEdit.purchase_unit !== undefined));
      const bModified = Boolean(bEdit && (bEdit.price !== undefined || bEdit.purchase_unit !== undefined));

      const aPrice = aEdit?.price !== undefined ? parseFloat(aEdit.price) : (parseFloat(a.default_price) || 0);
      const bPrice = bEdit?.price !== undefined ? parseFloat(bEdit.price) : (parseFloat(b.default_price) || 0);

      if (sortOption === 'EDITED_FIRST') {
        if (aModified !== bModified) return bModified ? 1 : -1;
      } else if (sortOption === 'PRICE_ASC') {
        if (aPrice !== bPrice) return aPrice - bPrice;
      } else if (sortOption === 'PRICE_DESC') {
        if (aPrice !== bPrice) return bPrice - aPrice;
      } else if (sortOption === 'NAME_DESC') {
        return (bIng.name || '').localeCompare(aIng.name || '');
      }

      // Default: NAME_ASC
      return (aIng.name || '').localeCompare(bIng.name || '');
    });
  }, [items, searchTerm, selectedCategory, statusFilter, sortOption, edits]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Supplier Profile Info Header */}
      {catalog && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-zinc-900 text-white rounded text-xs font-bold uppercase tracking-wider">
                Supplier Profile
              </span>
              <h2 className="text-xl font-black text-gray-900 tracking-tight m-0">{catalog.name}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600 font-medium">
              {catalog.contact_person && (
                <span>Contact: <strong className="text-gray-900">{catalog.contact_person}</strong></span>
              )}
              {catalog.contact_number && (
                <span>Phone: <strong className="text-gray-900">{catalog.contact_number}</strong></span>
              )}
              {catalog.email && (
                <span>Email: <strong className="text-gray-900">{catalog.email}</strong></span>
              )}
              {catalog.address && (
                <span>Address: <strong className="text-gray-900">{catalog.address}</strong></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">Items Supplied</span>
              <span className="text-lg font-black text-gray-900">{items.length}</span>
            </div>
            {dirtyCount > 0 && (
              <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-700">Modified</span>
                <span className="text-lg font-black text-amber-900">{dirtyCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl text-sm font-semibold bg-red-50 text-red-800 border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-900 font-bold text-xs uppercase cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-bold text-xs uppercase cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Action Toolbar & Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
        {/* Row 1: Search, Sort, Status Scope Pills & Save Updates */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search supplied material or unit..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none cursor-pointer"
              >
                <option value="NAME_ASC">Sort: Name (A to Z)</option>
                <option value="NAME_DESC">Sort: Name (Z to A)</option>
                <option value="PRICE_ASC">Sort: Price (Low to High)</option>
                <option value="PRICE_DESC">Sort: Price (High to Low)</option>
                <option value="EDITED_FIRST">Sort: Edited First</option>
              </select>
            </div>
          </div>

          {/* Status Scope Pills (All, Edited, Saved) & Save Actions */}
          <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
            <div className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 gap-1 text-xs">
              {[
                { id: 'ALL', label: 'All', count: statusCounts.all },
                { id: 'EDITED', label: 'Edited', count: statusCounts.edited, isAlert: statusCounts.edited > 0 },
                { id: 'SAVED', label: 'Saved', count: statusCounts.saved },
              ].map((s) => {
                const isActive = statusFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(s.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? s.isAlert
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-zinc-900 text-white shadow-2xs'
                        : s.isAlert
                          ? 'text-amber-800 hover:bg-amber-50 font-black'
                          : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <span>{s.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : s.isAlert
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={dirtyCount === 0 || saving}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                dirtyCount > 0 && !saving
                  ? 'bg-zinc-900 text-white hover:bg-black shadow-xs'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Save Price Updates {dirtyCount > 0 ? `(${dirtyCount})` : ''}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Category Filter Pills & Clear Filters */}
        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCategoryChange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'ALL'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
            }`}
          >
            <span>All Categories</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              selectedCategory === 'ALL' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
            }`}>
              {items.length}
            </span>
          </button>

          {availableCategories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {isFiltered && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="ml-auto text-xs font-bold text-red-600 hover:text-red-800 hover:underline px-2 py-1 cursor-pointer transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-gray-900 transition-colors"
                  onClick={() => {
                    setSortOption(prev => prev === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC');
                    setCurrentPage(1);
                  }}
                  title="Click to sort by material name"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Raw Material</span>
                    {sortOption === 'NAME_ASC' && (
                      <svg className="w-3.5 h-3.5 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    )}
                    {sortOption === 'NAME_DESC' && (
                      <svg className="w-3.5 h-3.5 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Packaging / Purchase Unit</th>
                <th className="py-3 px-4">Yield (Base Units)</th>
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-gray-900 transition-colors"
                  onClick={() => {
                    setSortOption(prev => prev === 'PRICE_ASC' ? 'PRICE_DESC' : 'PRICE_ASC');
                    setCurrentPage(1);
                  }}
                  title="Click to sort by price"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Agreed Price (₱)</span>
                    {sortOption === 'PRICE_ASC' && (
                      <svg className="w-3.5 h-3.5 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    )}
                    {sortOption === 'PRICE_DESC' && (
                      <svg className="w-3.5 h-3.5 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Cost Per Base Unit</th>
                <th
                  className="py-3 px-4 text-center cursor-pointer select-none hover:text-gray-900 transition-colors"
                  onClick={() => {
                    setSortOption(prev => prev === 'EDITED_FIRST' ? 'NAME_ASC' : 'EDITED_FIRST');
                    setCurrentPage(1);
                  }}
                  title="Click to toggle edited items first"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {sortOption === 'EDITED_FIRST' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span>No materials found matching your filters.</span>
                      {isFiltered && (
                        <button
                          type="button"
                          onClick={handleClearAllFilters}
                          className="px-3 py-1.5 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer mt-1"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(row => {
                  const ing = row.ingredients || {};
                  const ingredientId = row.ingredient_id || ing.id;
                  const editData = edits[ingredientId] || {};
                  const isModified = editData.price !== undefined || editData.purchase_unit !== undefined;

                  const currentPrice = editData.price !== undefined ? editData.price : (row.default_price || 0);
                  const currentUnit = editData.purchase_unit !== undefined ? editData.purchase_unit : (row.default_purchase_unit || 'Unit');
                  const currentConversion = row.default_conversion_factor || 1;

                  const numericPrice = parseFloat(currentPrice) || 0;
                  const numericConversion = parseFloat(currentConversion) || 1;
                  const effectiveBaseCost = numericConversion > 0 ? (numericPrice / numericConversion) : 0;

                  return (
                    <tr 
                      key={ingredientId} 
                      className={`hover:bg-gray-50/60 transition-colors ${isModified ? 'bg-amber-50/40' : ''}`}
                    >
                      {/* Name & Base Unit */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 text-sm">{ing.name || 'Unnamed Material'}</div>
                        <div className="text-[11px] text-gray-400 font-medium">Base stock unit: {ing.unit || 'unit'}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {ing.category || 'GENERAL'}
                        </span>
                      </td>

                      {/* Purchase Unit */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            list={`units-${ingredientId}`}
                            value={currentUnit}
                            onChange={(e) => handleUnitChange(ingredientId, e.target.value)}
                            placeholder="Unit"
                            className="w-28 px-2.5 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          />
                          <datalist id={`units-${ingredientId}`}>
                            {COMMON_PURCHASE_UNITS.map(u => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                        </div>
                      </td>

                      {/* Yield / Conversion Factor (Managed by Cafe Admin/Owner) */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-gray-700 font-mono">
                          {Number(currentConversion).toLocaleString()} {ing.unit || 'units'}
                        </div>
                        <div className="text-[10px] text-gray-400">Managed by café</div>
                      </td>

                      {/* Agreed Price */}
                      <td className="py-3.5 px-4">
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(ingredientId, e.target.value)}
                            className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors ${
                              isModified 
                                ? 'bg-amber-50 border-amber-400 text-amber-950 font-black' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Effective Base Cost */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-gray-800 text-xs">
                          ₱{effectiveBaseCost.toFixed(4)}
                        </span>
                        <span className="block text-[10px] text-gray-400">/ {ing.unit || 'unit'}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isModified ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Edited
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                            Saved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
            itemsPerPageOptions={[10, 20, 50]}
          />
        )}

        {/* Footer info */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> raw materials in your catalog.
          </span>
          <span className="text-[11px] text-gray-400 font-medium">
            Price updates apply to future purchase orders generated by the store.
          </span>
        </div>
      </div>
    </div>
  );
}
