import React, { useState, useMemo } from 'react';

const SupplierCatalogModal = ({ supplier, onClose, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const catalogItems = useMemo(() => {
    return (supplier?.supplier_ingredients || []).map((si) => {
      const ingName = si.ingredients?.name || 'Unknown Ingredient';
      const baseUnit = si.ingredients?.unit || 'Unit';
      const purchaseUnit = si.default_purchase_unit || 'Unit';
      const conversionFactor = parseFloat(si.default_conversion_factor) || 1;
      const price = parseFloat(si.default_price) || 0;
      const costPerBaseUnit = conversionFactor > 0 ? price / conversionFactor : price;

      return {
        id: si.ingredient_id,
        name: ingName,
        baseUnit,
        purchaseUnit,
        conversionFactor,
        price,
        costPerBaseUnit
      };
    });
  }, [supplier]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return catalogItems;
    const term = searchTerm.toLowerCase();
    return catalogItems.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.purchaseUnit.toLowerCase().includes(term)
    );
  }, [catalogItems, searchTerm]);

  if (!supplier) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="m-0 text-lg font-black text-white tracking-tight">{supplier.name}</h3>
              <p className="m-0 text-xs text-zinc-400 mt-0.5">
                Official Price List & Catalog &middot; {catalogItems.length} items supplied
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contact Info Subheader */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-zinc-600">
            {supplier.contact_person && (
              <div>
                <span className="font-bold text-zinc-800">Contact: </span>
                {supplier.contact_person}
              </div>
            )}
            {supplier.contact_number && (
              <div>
                <span className="font-bold text-zinc-800">Phone: </span>
                {supplier.contact_number}
              </div>
            )}
            {supplier.email && (
              <div>
                <span className="font-bold text-zinc-800">Email: </span>
                {supplier.email}
              </div>
            )}
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(supplier);
              }}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
            >
              Update Prices
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-100 flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items in catalog..."
              className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-zinc-500 tabular-nums">
            {filteredItems.length} of {catalogItems.length} items
          </span>
        </div>

        {/* Catalog Table */}
        <div className="overflow-y-auto flex-1 p-0">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-400">
              No catalog items match your search.
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 z-10">
                <tr className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Raw Material</th>
                  <th className="px-5 py-3">Packaging Unit</th>
                  <th className="px-5 py-3 text-right">Yield / Conversion</th>
                  <th className="px-5 py-3 text-right">Agreed Price</th>
                  <th className="px-5 py-3 text-right">Cost Per Base Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-zinc-900">{item.name}</div>
                      <div className="text-xs text-zinc-500">Base: {item.baseUnit}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {item.purchaseUnit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-zinc-600 font-mono">
                      1 {item.purchaseUnit} = {item.conversionFactor.toLocaleString()} {item.baseUnit}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black font-mono text-zinc-950">
                      ₱{item.price.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs font-semibold text-zinc-600 font-mono">
                      ₱{item.costPerBaseUnit.toFixed(4)} / {item.baseUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierCatalogModal;
