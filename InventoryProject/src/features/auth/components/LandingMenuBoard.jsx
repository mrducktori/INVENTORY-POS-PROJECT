import React, { useEffect, useRef } from 'react';

function LandingMenuBoard({
  title,
  subtitle,
  onClose,
  products = [],
  loading = false,
  error = null,
  onRetry,
  activeCategory = 'ALL',
  onSelectCategory,
  presentCategories = ['ALL'],
  groupedProducts = {},
  categoriesToDisplay = []
}) {
  const scrollRef = useRef(null);

  // Reset scroll to top when changing categories
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeCategory]);

  return (
    <div className="flex flex-col h-full bg-black/45 backdrop-blur-2xl text-white rounded-xl overflow-hidden border border-white/20 shadow-2xl">
      <div className="p-3.5 sm:p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-300 mb-0.5">{subtitle}</p>
          <h2 className="text-lg sm:text-xl font-bold m-0 leading-tight drop-shadow-md">{title}</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold tracking-wider uppercase border border-white/20 transition-colors cursor-pointer shrink-0"
            title="Collapse Menu"
          >
            <span>Collapse</span>
            <span className="text-sm">▴</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap sm:justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border-b border-white/10 shrink-0 overflow-x-auto max-h-24 sm:max-h-none">
        {presentCategories.map(cat => (
          <button
            key={cat}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg uppercase tracking-wider border transition-all duration-300 cursor-pointer whitespace-nowrap ${activeCategory === cat ? 'bg-white/25 text-white border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.15)]' : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/10'}`}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-gradient-to-b from-transparent to-black/20"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
            <div className="w-10 h-10 border-3 border-white/20 border-t-amber-400 rounded-full animate-spin mb-3" />
            <span className="text-xs sm:text-sm tracking-wider uppercase font-semibold">Loading menu items...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-sm sm:text-base font-bold text-white mb-1">Failed to load menu</p>
            <p className="text-xs text-gray-400 mb-4 max-w-sm">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-md cursor-pointer"
              >
                Tap to Retry
              </button>
            )}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16 text-center">
            <p className="text-sm font-semibold">No menu items currently available.</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase rounded-lg transition-all cursor-pointer"
              >
                Refresh Menu
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:gap-8">
            {categoriesToDisplay.map(cat => {
              const catProducts = groupedProducts[cat] || [];
              if (catProducts.length === 0) return null;

              return (
                <div key={cat} className="animate-fade-in">
                  <h3 className="text-base sm:text-lg md:text-xl font-black tracking-widest uppercase text-white/90 border-b border-white/10 pb-1.5 mb-3 sm:mb-4 drop-shadow-md">
                    {cat}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 items-start">
                    {catProducts.map(product => (
                      <div key={product.id} className="bg-black/60 border border-white/10 rounded-xl p-2.5 sm:p-4 flex flex-col h-full items-center hover:bg-white/10 transition-all duration-300 hover:border-white/25 group">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full aspect-square object-cover rounded-lg mb-2 sm:mb-3 drop-shadow-lg transition-opacity"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-white/5 rounded-lg flex flex-col items-center justify-center mb-2 sm:mb-3 border border-white/10 text-gray-500">
                            <svg className="w-8 h-8 sm:w-10 sm:h-10 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider text-center px-1">Image<br />Coming Soon</span>
                          </div>
                        )}
                        <h4 className="text-xs sm:text-base font-bold text-white text-center mb-2 sm:mb-3 uppercase tracking-wide leading-tight flex-1 line-clamp-2">
                          {product.name}
                        </h4>

                        <div className="flex flex-wrap justify-center gap-1 sm:gap-2 w-full mt-auto pt-2 border-t border-white/10">
                          {product.sizes && product.sizes.length > 0 ? (
                            product.sizes.map((sz, i) => (
                              <div key={i} className="flex flex-col items-center bg-white/10 px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-md border border-white/5 flex-1 min-w-[50px] sm:min-w-[65px]">
                                <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wide truncate max-w-[60px] sm:max-w-none">{sz.name || sz.size}</span>
                                <span className="text-xs sm:text-sm md:text-base text-green-400 font-black">₱{(parseFloat(product.price) + (parseFloat(sz.price_add) || 0)).toFixed(0)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center bg-white/10 px-2 py-1 sm:px-4 sm:py-1.5 rounded-md border border-white/5 w-full">
                              <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-bold tracking-wide mb-0.5">Price</span>
                              <span className="text-xs sm:text-sm md:text-base text-green-400 font-black">₱{parseFloat(product.price || 0).toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingMenuBoard;
