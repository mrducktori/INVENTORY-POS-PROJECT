import React, { useState, useMemo } from 'react';

const SupplierCatalogModal = ({ supplier, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const recentUpdates = supplier?.recent_price_updates || null;
  const recentItemsMap = recentUpdates?.items || {};

  const catalogItems = useMemo(() => {
    return (supplier?.supplier_ingredients || []).map((si) => {
      const ingName = si.ingredients?.name || 'Unknown Ingredient';
      const baseUnit = si.ingredients?.unit || 'Unit';
      const purchaseUnit = si.default_purchase_unit || 'Unit';
      const conversionFactor = parseFloat(si.default_conversion_factor) || 1;
      const price = parseFloat(si.default_price) || 0;
      const costPerBaseUnit = conversionFactor > 0 ? price / conversionFactor : price;
      const priceChange = recentItemsMap[si.ingredient_id] || null;

      return {
        id: si.ingredient_id,
        name: ingName,
        baseUnit,
        purchaseUnit,
        conversionFactor,
        price,
        costPerBaseUnit,
        priceChange
      };
    });
  }, [supplier, recentItemsMap]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
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
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-lg font-black text-white tracking-tight">{supplier.name}</h3>
                {recentUpdates?.changes_count > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Price Changes
                  </span>
                )}
              </div>
              <p className="m-0 text-xs text-zinc-400 mt-0.5">
                Official Price List &middot; {catalogItems.length} items supplied
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

        {/* Contact Info Subheader & Supplier Pricing Protection Badge */}
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

          {/* Supplier-Maintained Pricing Badge (No Admin Edit) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>Prices Managed by Supplier</span>
          </div>
        </div>

        {/* Notice Banner when Supplier recently updated prices */}
        {recentUpdates?.changes_count > 0 && (
          <div className="mx-6 mt-4 p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 animate-[fadeIn_0.2s_ease-out]">
            <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <span className="font-bold">Supplier Price Adjustment Notice: </span>
              {supplier.name} updated pricing for {recentUpdates.changes_count} raw material(s) on their portal. Adjusted items are indicated with badge highlights below.
            </div>
          </div>
        )}

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
                {filteredItems.map((item) => {
                  const change = item.priceChange;
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        change ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-zinc-50/60'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900">{item.name}</span>
                          {change && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                              Updated
                            </span>
                          )}
                        </div>
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
                        <div>₱{item.price.toFixed(2)}</div>
                        {change && (
                          <div className="text-[10px] font-sans font-semibold mt-0.5">
                            {change.difference > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                <svg className="w-2.5 h-2.5 text-amber-700 inline shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> +₱{change.difference.toFixed(2)} (Was ₱{change.old_price.toFixed(2)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <svg className="w-2.5 h-2.5 text-emerald-700 inline shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> -₱{Math.abs(change.difference).toFixed(2)} (Was ₱{change.old_price.toFixed(2)})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs font-semibold text-zinc-600 font-mono">
                        ₱{item.costPerBaseUnit.toFixed(4)} / {item.baseUnit}
                      </td>
                    </tr>
                  );
                })}
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
