import React, { useState, useMemo } from 'react';
import Pagination from '../../../../components/shared/Pagination';

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

const SupplierPriceComparison = ({ suppliers, ingredients, onEditSupplier }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  // Build matrix: for every ingredient, gather all suppliers offering it
  const comparisonData = useMemo(() => {
    return ingredients.map((ing) => {
      const category = classifyIngredient(ing.name);

      // Find all supplier offerings
      const offerings = [];
      suppliers.forEach((supp) => {
        const mapping = (supp.supplier_ingredients || []).find((si) => si.ingredient_id === ing.id);
        if (mapping) {
          const price = parseFloat(mapping.default_price) || 0;
          const factor = parseFloat(mapping.default_conversion_factor) || parseFloat(ing.conversion_factor) || 1;
          const unit = mapping.default_purchase_unit || ing.purchase_unit || 'Unit';
          const costPerBase = factor > 0 ? price / factor : price;

          offerings.push({
            supplierId: supp.id,
            supplierName: supp.name,
            purchaseUnit: unit,
            conversionFactor: factor,
            price,
            costPerBase
          });
        }
      });

      // Sort offerings by costPerBase ascending (lowest price first)
      offerings.sort((a, b) => a.costPerBase - b.costPerBase);

      const lowestOffering = offerings[0] || null;
      const highestOffering = offerings[offerings.length - 1] || null;
      const priceDifference =
        offerings.length > 1
          ? highestOffering.costPerBase - lowestOffering.costPerBase
          : 0;

      return {
        ingredient: ing,
        category,
        offerings,
        lowestOffering,
        highestOffering,
        priceDifference
      };
    });
  }, [suppliers, ingredients]);

  const filteredData = useMemo(() => {
    return comparisonData.filter((row) => {
      if (selectedCategory !== 'All' && row.category !== selectedCategory) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        row.ingredient.name.toLowerCase().includes(term) ||
        row.offerings.some((o) => o.supplierName.toLowerCase().includes(term))
      );
    });
  }, [comparisonData, selectedCategory, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Key stats
  const stats = useMemo(() => {
    const multiSupplier = comparisonData.filter((r) => r.offerings.length > 1).length;
    const covered = comparisonData.filter((r) => r.offerings.length > 0).length;
    return {
      total: comparisonData.length,
      covered,
      multiSupplier
    };
  }, [comparisonData]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
            Supplier Catalog Coverage
          </div>
          <div className="text-2xl font-bold text-zinc-950 tabular-nums">
            {stats.covered} / {stats.total}
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1">
            100% of raw materials mapped to verified suppliers
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
            Multi-Supplier Sourcing
          </div>
          <div className="text-2xl font-bold text-zinc-950 tabular-nums">
            {stats.multiSupplier} materials
          </div>
          <div className="text-xs font-semibold text-zinc-600 mt-1">
            Multiple vendor quotes available for price comparison
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
            Active Vendors
          </div>
          <div className="text-2xl font-bold text-zinc-950 tabular-nums">
            {suppliers.length} suppliers
          </div>
          <div className="text-xs font-semibold text-zinc-600 mt-1">
            Agreed packaging units & conversion factors
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative md:w-80">
          <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search material or supplier..."
            className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="px-5 py-3">Raw Material</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Standard Packaging</th>
                <th className="px-5 py-3">Supplier Quotes & Pricing</th>
                <th className="px-5 py-3 text-right">Price Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-zinc-400">
                    No materials found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map(({ ingredient, category, offerings, priceDifference }) => (
                  <tr key={ingredient.id} className="hover:bg-zinc-50/60 transition-colors">
                    {/* Material info */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-zinc-900">{ingredient.name}</div>
                      <div className="text-xs text-zinc-500 font-medium">Base Unit: {ingredient.unit}</div>
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {category}
                      </span>
                    </td>

                    {/* Standard packaging */}
                    <td className="px-5 py-3.5 text-xs text-zinc-600">
                      <div>
                        1 {ingredient.purchase_unit || 'Unit'} = {ingredient.conversion_factor || 1} {ingredient.unit}
                      </div>
                      <div className="font-mono text-zinc-500 mt-0.5">
                        Baseline: ₱{Number(ingredient.cost_per_purchase_unit || 0).toFixed(2)}
                      </div>
                    </td>

                    {/* All supplier quotes */}
                    <td className="px-5 py-3.5">
                      {offerings.length === 0 ? (
                        <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200">
                          No Supplier Assigned
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5 py-1">
                          {offerings.map((off, idx) => {
                            const isBestPrice = offerings.length > 1 && idx === 0;
                            return (
                              <div
                                key={off.supplierId}
                                className="inline-flex items-center gap-2 text-xs"
                              >
                                <span className="font-bold text-zinc-900">{off.supplierName}:</span>
                                <span className="font-mono font-bold text-zinc-950">
                                  ₱{off.price.toFixed(2)}
                                </span>
                                <span className="text-zinc-500">
                                  / {off.purchaseUnit}
                                </span>
                                <span className="text-zinc-400 font-mono">
                                  (₱{off.costPerBase.toFixed(4)}/{ingredient.unit})
                                </span>
                                {isBestPrice && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Lowest Cost
                                  </span>
                                )}
                                {onEditSupplier && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const supp = suppliers.find((s) => s.id === off.supplierId);
                                      if (supp) onEditSupplier(supp);
                                    }}
                                    className="text-[10px] text-zinc-400 hover:text-zinc-900 underline font-semibold cursor-pointer ml-1"
                                    title="Edit price for this supplier"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Price Difference / Delta */}
                    <td className="px-5 py-3.5 text-right font-mono text-xs">
                      {offerings.length > 1 && priceDifference > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                          Δ ₱{priceDifference.toFixed(4)} / {ingredient.unit}
                        </span>
                      ) : offerings.length > 1 ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Identical Pricing
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">Single Vendor</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
            itemsPerPageOptions={[10, 20, 50]}
          />
        )}
      </div>
    </div>
  );
};

export default SupplierPriceComparison;
