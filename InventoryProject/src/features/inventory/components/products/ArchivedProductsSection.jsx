import React from 'react';

const ArchivedProductsSection = ({
  archivedProducts,
  processingId,
  onRefresh,
  onRestore,
  onPermanentDelete
}) => {
  if (!archivedProducts || archivedProducts.length === 0) return null;

  return (
    <div className="mt-8 mb-6 bg-zinc-950 text-white rounded-2xl p-6 border border-zinc-800 shadow-xl w-full">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight m-0">Archived Products</h3>
          <p className="text-xs text-zinc-400 m-0 mt-0.5">Archived items are hidden from inventory and POS until restored.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {archivedProducts.map(p => (
          <div key={p.id} className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-lg border border-zinc-800 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                  {p.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-100 truncate">{p.name}</div>
                <div className="text-xs text-zinc-400">
                  {p.category} • ₱{Number(p.price).toFixed(2)}
                  {p.days_since_archived !== undefined && (
                    <span className="block text-[11px] text-zinc-500 mt-0.5">
                      Archived {p.days_since_archived}d ago
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onRestore(p.id)}
                disabled={processingId === p.id}
                className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {processingId === p.id ? 'Restoring...' : 'Restore'}
              </button>
              <button
                type="button"
                onClick={() => onPermanentDelete(p.id)}
                disabled={processingId === p.id || (p.days_since_archived ?? 0) < 30}
                className={`px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                  (p.days_since_archived ?? 0) >= 30
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-60'
                }`}
                title={
                  (p.days_since_archived ?? 0) >= 30
                    ? 'Permanently delete this product'
                    : `Can be permanently deleted after 30 days (${Math.max(1, 30 - (p.days_since_archived || 0))} days remaining)`
                }
              >
                {(p.days_since_archived ?? 0) >= 30 ? 'Delete' : `${Math.max(1, 30 - (p.days_since_archived || 0))}d`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchivedProductsSection;
