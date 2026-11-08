import React, { useState, useEffect, useMemo } from 'react';
import { getSupplierOwnCatalog, updateSupplierOwnCatalog } from '../../../api/purchasingApi';
import Pagination from '../../../components/shared/Pagination';
import { TableSkeleton } from '../../../components/shared/SkeletonLoader';

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
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Track edited values: { [ingredient_id]: { price, purchase_unit, conversion_factor } }
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

  const items = useMemo(() => {
    return catalog?.supplier_ingredients || [];
  }, [catalog]);

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

  const handleConversionChange = (ingredientId, value) => {
    setEdits(prev => ({
      ...prev,
      [ingredientId]: {
        ...(prev[ingredientId] || {}),
        conversion_factor: value
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
          default_purchase_unit: change.purchase_unit !== undefined ? change.purchase_unit : original?.default_purchase_unit,
          default_conversion_factor: change.conversion_factor !== undefined ? parseFloat(change.conversion_factor) : original?.default_conversion_factor
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
    return items.filter(row => {
      const ing = row.ingredients || {};
      const name = (ing.name || '').toLowerCase();
      const cat = (ing.category || '').toUpperCase();
      const matchesSearch = !searchTerm.trim() || name.includes(searchTerm.toLowerCase().trim());
      const matchesCategory = selectedCategory === 'ALL' || cat === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

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
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search supplied material..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {RAW_MATERIAL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Save Bar */}
        <div className="flex items-center gap-3 justify-end">
          {dirtyCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={dirtyCount === 0 || saving}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              dirtyCount > 0 && !saving
                ? 'bg-zinc-900 text-white hover:bg-black shadow-xs'
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Saving Changes...
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

      {/* Catalog Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Raw Material</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Packaging / Purchase Unit</th>
                <th className="py-3 px-4">Yield (Base Units)</th>
                <th className="py-3 px-4">Agreed Price (₱)</th>
                <th className="py-3 px-4 text-right">Cost Per Base Unit</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400 font-semibold">
                    No materials found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map(row => {
                  const ing = row.ingredients || {};
                  const ingredientId = row.ingredient_id || ing.id;
                  const editData = edits[ingredientId] || {};
                  const isModified = editData.price !== undefined || editData.purchase_unit !== undefined || editData.conversion_factor !== undefined;

                  const currentPrice = editData.price !== undefined ? editData.price : (row.default_price || 0);
                  const currentUnit = editData.purchase_unit !== undefined ? editData.purchase_unit : (row.default_purchase_unit || 'Unit');
                  const currentConversion = editData.conversion_factor !== undefined ? editData.conversion_factor : (row.default_conversion_factor || 1);

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

                      {/* Yield / Conversion Factor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={currentConversion}
                            onChange={(e) => handleConversionChange(ingredientId, e.target.value)}
                            className="w-24 px-2.5 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          />
                          <span className="text-[11px] text-gray-400 font-medium">{ing.unit || 'units'}</span>
                        </div>
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
