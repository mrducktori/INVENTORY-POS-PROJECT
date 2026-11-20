import React, { useState, useMemo } from 'react';

const SupplierCatalogModal = ({ supplier, onClose, onAcknowledgePriceUpdates }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'UPDATED'

  const recentUpdates = supplier?.recent_price_updates || null;
  const hasPriceUpdates = Boolean(recentUpdates && recentUpdates.changes_count > 0);

  // Default to sorting updated items first if any price updates exist
  const [sortUpdatedFirst, setSortUpdatedFirst] = useState(hasPriceUpdates);

  const catalogItems = useMemo(() => {
    const recentItemsMap = recentUpdates?.items || {};
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
  }, [supplier, recentUpdates]);

  const updatedCount = useMemo(() => {
    return catalogItems.filter((i) => Boolean(i.priceChange)).length;
  }, [catalogItems]);

  const effectiveFilterMode = updatedCount > 0 ? filterMode : 'ALL';

  const displayedItems = useMemo(() => {
    let items = catalogItems;

    // Filter by tab / mode
    if (effectiveFilterMode === 'UPDATED') {
      items = items.filter((item) => Boolean(item.priceChange));
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.purchaseUnit.toLowerCase().includes(term)
      );
    }

    // Sort: if sortUpdatedFirst is active, place items with priceChange on top
    return [...items].sort((a, b) => {
      if (sortUpdatedFirst) {
        const aHas = a.priceChange ? 1 : 0;
        const bHas = b.priceChange ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas; // Updated items on top
      }
      return a.name.localeCompare(b.name);
    });
  }, [catalogItems, effectiveFilterMode, searchTerm, sortUpdatedFirst]);

  if (!supplier) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
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
                    Price Changes ({recentUpdates.changes_count})
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

          {/* Supplier-Maintained Pricing Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>Prices Managed by Supplier</span>
          </div>
        </div>

        {/* Notice Banner when Supplier recently updated prices */}
        {recentUpdates?.changes_count > 0 && (
          <div className="mx-6 mt-4 p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <span className="font-bold">Supplier Price Adjustment Notice: </span>
                {supplier.name} updated pricing for {recentUpdates.changes_count} raw material(s) on their portal.
                {sortUpdatedFirst && effectiveFilterMode === 'ALL' && (
                  <span className="text-amber-800 block sm:inline sm:ml-1">
                    Updated materials are pinned to the top of the list below.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode(effectiveFilterMode === 'UPDATED' ? 'ALL' : 'UPDATED')}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {effectiveFilterMode === 'UPDATED' ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Show All Materials
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Filter Updated Only ({recentUpdates.changes_count})
                  </>
                )}
              </button>
              {onAcknowledgePriceUpdates && (
                <button
                  type="button"
                  onClick={() => {
                    onAcknowledgePriceUpdates(null);
                    setFilterMode('ALL');
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  title="Mark all price updates for this supplier as read"
                >
                  <svg className="w-3 h-3 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Mark All as Read
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search & Filter Controls Toolbar */}
        <div className="p-4 border-b border-zinc-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-50/40">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items in catalog..."
              className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills: All vs Updated */}
            <div className="inline-flex p-0.5 bg-zinc-200/70 rounded-lg border border-zinc-200 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  effectiveFilterMode === 'ALL'
                    ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All ({catalogItems.length})
              </button>
              {updatedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('UPDATED')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    effectiveFilterMode === 'UPDATED'
                      ? 'bg-amber-500 text-white shadow-2xs font-bold'
                      : 'text-amber-800 hover:text-amber-950 font-semibold'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${effectiveFilterMode === 'UPDATED' ? 'bg-white' : 'bg-amber-600'}`} />
                  Updated ({updatedCount})
                </button>
              )}
            </div>

            {/* Sort Toggle Button (Updated on top vs A-Z order) */}
            {updatedCount > 0 && effectiveFilterMode === 'ALL' && (
              <button
                type="button"
                onClick={() => setSortUpdatedFirst((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  sortUpdatedFirst
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                }`}
                title={sortUpdatedFirst ? 'Currently sorting updated items first. Click to sort purely A-Z.' : 'Click to pin updated items to top'}
              >
                <svg className={`w-3.5 h-3.5 ${sortUpdatedFirst ? 'text-amber-600' : 'text-zinc-500'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                </svg>
                <span>{sortUpdatedFirst ? 'Updated on Top' : 'A-Z Order'}</span>
              </button>
            )}

            <span className="text-xs font-semibold text-zinc-500 tabular-nums pl-1">
              {displayedItems.length} of {catalogItems.length} items
            </span>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="overflow-y-auto flex-1 p-0">
          {displayedItems.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-400">
              <p className="font-semibold text-zinc-600 mb-1">
                {effectiveFilterMode === 'UPDATED'
                  ? 'No price-updated materials found.'
                  : 'No catalog items match your search.'}
              </p>
              {(searchTerm || effectiveFilterMode !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterMode('ALL');
                  }}
                  className="mt-2 text-xs text-zinc-900 underline font-semibold hover:text-black cursor-pointer"
                >
                  Reset filters and search
                </button>
              )}
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
                {displayedItems.map((item) => {
                  const change = item.priceChange;
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        change
                          ? 'bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                          : 'hover:bg-zinc-50/60'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-900">{item.name}</span>
                          {change && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              Price Updated
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
                          <div className="text-[10px] font-sans font-semibold mt-0.5 flex items-center justify-end gap-1.5 flex-wrap">
                            {change.difference > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                <svg className="w-2.5 h-2.5 text-amber-700 inline shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> +₱{change.difference.toFixed(2)} (Was ₱{change.old_price.toFixed(2)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <svg className="w-2.5 h-2.5 text-emerald-700 inline shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> -₱{Math.abs(change.difference).toFixed(2)} (Was ₱{change.old_price.toFixed(2)})
                              </span>
                            )}
                            {onAcknowledgePriceUpdates && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (updatedCount <= 1) setFilterMode('ALL');
                                  onAcknowledgePriceUpdates(item.id);
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 border border-zinc-300 transition-colors cursor-pointer font-bold"
                                title={`Mark ${item.name} price update as read`}
                              >
                                <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>Mark read</span>
                              </button>
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
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500">
            {updatedCount > 0 ? (
              <span>
                <strong className="text-amber-700">{updatedCount}</strong> material{updatedCount === 1 ? '' : 's'} updated recently by supplier
              </span>
            ) : (
              <span>All catalog pricing up to date</span>
            )}
          </div>
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
