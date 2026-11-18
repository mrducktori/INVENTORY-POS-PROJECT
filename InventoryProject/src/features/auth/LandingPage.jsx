import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PageLoader from './PageLoader/PageLoader';
import { getProducts } from '../../api/posApi';
import { getCmsMap } from '../../api/cmsApi';

const DEFAULT_HERO_IMAGE = 'https://zngerymqycuxpxdmfftj.supabase.co/storage/v1/object/public/cms-images/public/landing_hero-0.8481000269201046.jpg';

const safeHref = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : '#');



function MenuPanel({ title, subtitle, onClose, products = [], loading = false, error = null, onRetry }) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const scrollRef = React.useRef(null);

  // Reset scroll to top when changing categories
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeCategory]);



  const presentCategories = ['ALL', ...new Set(products.map(p => p.category?.toUpperCase()).filter(Boolean))];
  
  // Group products by category to display them in sections when "ALL" is selected
  const groupedProducts = products.reduce((acc, product) => {
    const cat = product.category?.toUpperCase() || 'UNCATEGORIZED';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {});

  const categoriesToDisplay = activeCategory === 'ALL' 
    ? Object.keys(groupedProducts).sort() 
    : [activeCategory];

  return (
    <div className="flex flex-col h-full bg-black/50 backdrop-blur-2xl text-white rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
      <div className="p-3.5 sm:p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-300 mb-0.5">{subtitle}</p>
          <h2 className="text-lg sm:text-xl font-bold m-0 leading-tight drop-shadow-md">{title}</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold tracking-wider uppercase border border-white/20 transition-all cursor-pointer transition-colors shrink-0"
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
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold rounded-full uppercase tracking-wider border transition-all duration-300 cursor-pointer whitespace-nowrap ${activeCategory === cat ? 'bg-white/25 text-white border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.15)]' : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/10'}`}
            onClick={() => setActiveCategory(cat)}
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
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
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
                className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
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
                            <span className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider text-center px-1">Image<br/>Coming Soon</span>
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

// Lightbox Modal for Fullscreen Expandable Promo Picture
function PromoLightbox({ promo, promos = [], currentIndex = 0, onSelectIndex, onClose }) {
  const touchStartX = React.useRef(0);
  const touchEndX = React.useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (promos.length > 1) {
        if (e.key === 'ArrowRight') onSelectIndex((currentIndex + 1) % promos.length);
        if (e.key === 'ArrowLeft') onSelectIndex((currentIndex - 1 + promos.length) % promos.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, promos.length, onClose, onSelectIndex]);

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    onSelectIndex((currentIndex - 1 + promos.length) % promos.length);
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    onSelectIndex((currentIndex + 1) % promos.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/92 backdrop-blur-md overflow-y-auto flex flex-col items-center p-3 sm:p-6 animate-fade-in select-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl min-h-full flex flex-col justify-between items-center my-auto py-1 sm:py-2 gap-2 sm:gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lightbox Header */}
        <div 
          className="w-full flex justify-between items-center py-1 px-1 shrink-0 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow">
              Promo {promos.length > 1 ? `(${currentIndex + 1} of ${promos.length})` : ''}
            </span>
            {promo.title && (
              <h4 className="text-white text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-md m-0">
                {promo.title}
              </h4>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-colors cursor-pointer shadow-lg"
            title="Close (ESC)"
           aria-label="Close"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {/* Main Picture Area */}
        <div 
          className="relative flex-1 w-full flex items-center justify-center overflow-hidden my-1 sm:my-2 touch-pan-y"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Desktop Side Arrows: Shown only on sm+ screens, placed cleanly at the outer margins */}
          {promos.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="hidden sm:flex absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/75 hover:bg-black/95 text-white items-center justify-center text-3xl font-bold border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer z-20"
              title="Previous (Left Arrow)"
            >
              ‹
            </button>
          )}

          <img 
            src={promo.image_url} 
            alt={promo.title || "Expanded Promotion"} 
            className="max-h-[50vh] sm:max-h-[76vh] max-w-full w-auto object-contain rounded-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9)] transition-all select-none"
          />

          {/* Desktop Side Arrows: Shown only on sm+ screens, placed cleanly at the outer margins */}
          {promos.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="hidden sm:flex absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/75 hover:bg-black/95 text-white items-center justify-center text-3xl font-bold border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer z-20"
              title="Next (Right Arrow)"
            >
              ›
            </button>
          )}
        </div>

        {/* Lightbox Footer Caption & Mobile Controls */}
        <div 
          className="w-full max-w-4xl bg-zinc-950/85 border border-white/15 rounded-2xl p-3 sm:p-4 shrink-0 backdrop-blur-md shadow-xl mb-6 sm:mb-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            {promos.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="sm:hidden w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-colors shrink-0 cursor-pointer"
                aria-label="Previous promo"
                title="Previous"
              >
                ‹
              </button>
            )}

            <div className="flex-1 text-center min-w-0">
              {promo.title && (
                <h3 className="text-white text-base sm:text-xl font-black uppercase tracking-wider truncate m-0 mb-1">
                  {promo.title}
                </h3>
              )}
              {promo.description && (
                <p className="text-gray-300 text-xs sm:text-sm font-medium line-clamp-2 sm:line-clamp-none whitespace-pre-wrap max-w-2xl mx-auto m-0 mb-1">
                  {promo.description}
                </p>
              )}
              {promos.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 my-1.5">
                  {promos.map((p, idx) => (
                    <button
                      key={p.id || idx}
                      type="button"
                      onClick={() => onSelectIndex(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === currentIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/30 hover:bg-white/60'
                      }`}
                      aria-label={`Promo ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                Swipe left/right, use arrow keys, or click outside to close
              </span>
            </div>

            {promos.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="sm:hidden w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-colors shrink-0 cursor-pointer"
                aria-label="Next promo"
                title="Next"
              >
                ›
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
// Multi-Promo Showcase Carousel with Click-to-Expand Lightbox
function PromoShowcase({ promos = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedPromo, setExpandedPromo] = useState(null);

  const touchStartX = React.useRef(0);
  const touchEndX = React.useRef(0);

  // Auto-advance if multiple promos exist (paused on hover or modal open)
  useEffect(() => {
    if (promos.length <= 1 || isHovered || expandedPromo) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % promos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [promos.length, isHovered, expandedPromo]);

  if (!promos || promos.length === 0) return null;

  const currentPromo = promos[currentIndex] || promos[0];

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % promos.length);
  };

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + promos.length) % promos.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  return (
    <>
      <div 
        className="w-full h-full flex flex-col justify-center select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          onClick={() => currentPromo.image_url && setExpandedPromo(currentPromo)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative rounded-2xl overflow-hidden border border-white/20 bg-black/45 shadow-2xl backdrop-blur-xl group transition-all duration-300 touch-pan-y ${
            currentPromo.image_url ? 'cursor-zoom-in hover:border-white/35' : ''
          }`}
          title={currentPromo.image_url ? "Click to expand picture" : undefined}
        >
          {currentPromo.image_url ? (
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-[16/10] max-h-[380px] overflow-hidden bg-black/40">
              <img 
                src={currentPromo.image_url} 
                alt={currentPromo.title || "Promotion"} 
                className="w-full h-full object-cover object-center" 
              />
              
              {/* Expand Hint Badge in top-right */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 hover:bg-black/90 text-white/90 text-[10px] font-bold tracking-wider uppercase border border-white/20 backdrop-blur-md shadow-md transition-colors">
                <svg className="w-3.5 h-3.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Expand</span>
              </div>

              {/* Bottom Gradient Overlay for typography */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-5 sm:p-6 pointer-events-none pb-12 sm:pb-6">
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-400 text-zinc-950 text-[10px] sm:text-xs font-black tracking-widest uppercase mb-1.5 shadow-sm">
                  <span>Featured Promo</span>
                  {promos.length > 1 && (
                    <span className="text-[10px] font-extrabold text-zinc-800 ml-1">
                      ({currentIndex + 1} of {promos.length})
                    </span>
                  )}
                </div>
                {currentPromo.title && (
                  <h3 className="text-white text-base sm:text-xl md:text-2xl font-black uppercase tracking-wide drop-shadow-md m-0">
                    {currentPromo.title}
                  </h3>
                )}
                {currentPromo.description && (
                  <p className="text-zinc-200 text-xs sm:text-sm font-medium line-clamp-2 max-w-xl drop-shadow mt-1 m-0">
                    {currentPromo.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8 bg-zinc-900/90 flex flex-col justify-between min-h-[240px]">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold tracking-widest uppercase mb-2">
                  <span>Featured Promo</span>
                  {promos.length > 1 && <span className="text-amber-200 font-extrabold">({currentIndex + 1} of {promos.length})</span>}
                </div>
                <h3 className="text-white text-lg sm:text-xl font-black uppercase tracking-wide m-0">
                  {currentPromo.title || 'Featured Promotions'}
                </h3>
                {currentPromo.description && (
                  <p className="text-zinc-300 text-xs sm:text-sm mt-2 max-w-xl m-0 leading-relaxed">
                    {currentPromo.description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Previous / Next Slide Controls (when >1 promo) */}
          {promos.length > 1 && (
            <>
              {/* Desktop Side Arrows: Displayed only on sm+ viewports so they never obstruct poster artwork on mobile */}
              <button
                type="button"
                onClick={handlePrev}
                className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white items-center justify-center text-sm font-bold border border-white/20 backdrop-blur-md shadow-md transition-colors cursor-pointer z-10"
                aria-label="Previous promo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white items-center justify-center text-sm font-bold border border-white/20 backdrop-blur-md shadow-md transition-colors cursor-pointer z-10"
                aria-label="Next promo"
              >
                ›
              </button>

              {/* Bottom Control Bar: Integrates Previous & Next arrows cleanly into the bottom indicator pill on mobile */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/75 px-3 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-lg">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="sm:hidden w-6 h-6 rounded-full bg-white/15 active:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shrink-0"
                  aria-label="Previous promo"
                  title="Previous"
                >
                  ‹
                </button>

                <div className="flex items-center gap-1.5 px-0.5">
                  {promos.map((p, i) => (
                    <button
                      key={p.id || i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(i);
                      }}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        i === currentIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to promo ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="sm:hidden w-6 h-6 rounded-full bg-white/15 active:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shrink-0"
                  aria-label="Next promo"
                  title="Next"
                >
                  ›
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox Modal (Expandable Picture) */}
      {expandedPromo && (
        <PromoLightbox 
          promo={expandedPromo} 
          promos={promos}
          currentIndex={currentIndex}
          onSelectIndex={(idx) => {
            setCurrentIndex(idx);
            setExpandedPromo(promos[idx]);
          }}
          onClose={() => setExpandedPromo(null)} 
        />
      )}
    </>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  // Hidden staff entry: tap the logo 5 times quickly to open the login page
  const logoTapRef = React.useRef({ count: 0, timer: null });
  const handleLogoTap = () => {
    const tap = logoTapRef.current;
    clearTimeout(tap.timer);
    tap.count += 1;
    if (tap.count >= 5) {
      tap.count = 0;
      navigate('/coftealoginpageforstaff');
      return;
    }
    tap.timer = setTimeout(() => { tap.count = 0; }, 1500);
  };
  useEffect(() => () => clearTimeout(logoTapRef.current.timer), []);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Default is CLOSED per requirement
  const [cmsData, setCmsData] = useState({
    brand_logo: '',
    brand_title: 'CofTea Cafe',
    promos: [],
    promo_title: '',
    promo_description: '',
    promo_image: '',
    hero_title: 'COF/TEA CAFÉ | ELWOOD BRANCH',
    hero_description: '',
    hero_image: DEFAULT_HERO_IMAGE,
    menu_title: 'Menu Board',
    menu_subtitle: 'Browse Our',
    location_title: 'Location',
    location_address: '2nd flr, 4JCayton Bldg, 144 L. Wood Rd, Taytay, 1920 Rizal',
    location_link: 'https://maps.app.goo.gl/3gUeunPoZJfubcFd8',
    footer_text: '© 2026 Cof/tea Cafe. All rights reserved.',
    social_fb: 'https://www.facebook.com/cofteacafeelwood',
    social_ig: 'https://www.instagram.com/coftea.cafe_elwood/'
  });

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to load products for menu board:", err);
      setProductsError(err?.message || "Unable to load menu items right now.");
    } finally {
      setProductsLoading(false);
    }
  };

  const parsePromos = (p) => {
    if (!p) return [];
    if (p.description) {
      try {
        const parsed = JSON.parse(p.description);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(item => item && (item.image_url || item.title || item.description));
        }
      } catch {
        // legacy non-JSON
      }
    }
    if (p.image_url || p.title) {
      return [{
        id: 'promo_default',
        title: p.title || 'Featured Promotion',
        description: p.description || '',
        image_url: p.image_url || ''
      }];
    }
    return [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const map = await getCmsMap();
        if (map && Object.keys(map).length > 0) {
          const brand = map.brand_logo;
          const promo = map.promo_section;
          const hero = map.landing_hero;
          const menu = map.menu_section;
          const location = map.location_info;
          const footer = map.footer_info;
          const social = map.social_links;

          const parsedPromosList = parsePromos(promo);

          setCmsData({
            brand_logo: brand?.image_url || '',
            brand_title: brand?.title || 'CofTea Cafe',
            promos: parsedPromosList,
            promo_title: promo?.title || '',
            promo_description: promo?.description || '',
            promo_image: parsedPromosList[0]?.image_url || promo?.image_url || '',
            hero_title: hero?.title || 'COF/TEA CAFÉ | ELWOOD BRANCH',
            hero_description: hero?.description || '',
            hero_image: hero?.image_url || DEFAULT_HERO_IMAGE,
            menu_title: menu?.title || 'Menu Board',
            menu_subtitle: menu?.description || 'Browse Our',
            location_title: location?.title || 'Location',
            location_address: location?.description || '2nd flr, 4JCayton Bldg, 144 L. Wood Rd, Taytay, 1920 Rizal',
            location_link: location?.image_url || 'https://maps.app.goo.gl/3gUeunPoZJfubcFd8',
            footer_text: footer?.title || '© 2026 Cof/tea Cafe. All rights reserved.',
            social_fb: social?.title || 'https://www.facebook.com/cofteacafeelwood',
            social_ig: social?.description || 'https://www.instagram.com/coftea.cafe_elwood/'
          });
        }
      } catch (err) {
        console.error("Failed to load CMS content:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    // Fallback timer just in case API is slow/fails
    const timer = setTimeout(() => setIsInitialLoading(false), 1200);
    fetchData();
    // Defer product catalog fetch until after initial hero/CMS paint or when menu opens
    fetchProducts();
    
    return () => clearTimeout(timer);
  }, []);

  if (isInitialLoading) return <PageLoader />;

  // Helper to format title to match the original premium sleek look
  const formatTitle = (titleString) => {
    if (!titleString) return null;
    const parts = titleString.split('|');
    const mainBrand = parts[0]?.trim() || '';
    const location = parts[1]?.trim() || '';
    
    // Split mainBrand (e.g., "COF/TEA CAFE")
    const words = mainBrand.split(' ');
    const firstPart = words.length > 1 ? words.slice(0, -1).join(' ') : mainBrand;
    const lastWord = words.length > 1 ? words[words.length - 1] : '';

    return (
      <>
        {firstPart} {lastWord && <span className="text-gray-300 font-light">{lastWord}</span>}
        {location && <span className="text-gray-500 font-medium text-[8px] md:text-xs tracking-[0.2em] ml-1 md:ml-2">| {location}</span>}
      </>
    );
  };

  return (
    <div className="w-full min-h-[100dvh] h-screen bg-cover bg-center bg-fixed font-sans" style={{ backgroundImage: `url(${cmsData.hero_image})` }}>
      <div className="w-full h-full bg-black/60 backdrop-blur-[2px] flex flex-col">
        {/* Header - Brand with prominent, large logo */}
        <header className="flex justify-between items-center px-4 sm:px-8 md:px-12 py-3 sm:py-4 min-h-[4.75rem] sm:min-h-[5.75rem] bg-black/50 border-b border-white/15 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
            <img 
              src={cmsData.brand_logo || "/favicon.svg"} 
              alt={cmsData.brand_title || "Logo"} 
              onClick={handleLogoTap}
              draggable={false}
              className="w-14 h-14 sm:w-18 sm:h-18 md:w-22 md:h-22 object-contain rounded-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] border border-white/25 p-1 sm:p-1.5 bg-black/60 shrink-0 hover:border-white/40 transition-colors shadow-xl cursor-pointer" 
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-white text-lg sm:text-2xl md:text-3xl font-black tracking-widest m-0 flex items-baseline gap-1 md:gap-2 truncate drop-shadow-md">
                {formatTitle(cmsData.hero_title)}
              </h1>
              {cmsData.brand_title && (
                <span className="text-[10px] sm:text-xs text-amber-300 font-bold uppercase tracking-[0.25em] drop-shadow-sm mt-0.5">
                  {cmsData.brand_title}
                </span>
              )}
            </div>
          </div>
        </header>

              {/* Main Content - Side-by-Side Hero & Seamless In-Place Menu Expansion */}
        <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 relative w-full overflow-y-auto">
          <div className="relative w-full max-w-6xl mx-auto my-auto flex items-center justify-center">
            
            {/* Side-by-Side Overview (Fades & slightly scales out smoothly when menu opens) */}
            <div 
              className={`w-full py-2 transition-all duration-500 ease-out transform ${
                isMenuOpen 
                  ? 'opacity-0 scale-[0.97] pointer-events-none -translate-y-4 absolute inset-0' 
                  : 'opacity-100 scale-100 relative translate-y-0 z-10'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-stretch">
                {/* Left Card: Welcome info, Location, and Open Menu trigger - Taller with translucent glass opacity */}
                <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-black/45 border border-white/20 backdrop-blur-xl shadow-2xl text-left min-h-[340px] sm:min-h-[370px] lg:min-h-[380px]">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 border border-white/15 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase mb-4 shadow-sm backdrop-blur-sm">
                      <span>CofTea Cafe</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300">Elwood Branch</span>
                    </div>

                    {cmsData.hero_description && (
                      <h2 className="text-white text-base sm:text-lg md:text-xl font-bold leading-relaxed mb-4 text-white/95">
                        {cmsData.hero_description}
                      </h2>
                    )}

                    {cmsData.location_address && (
                      <a 
                        href={safeHref(cmsData.location_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 text-zinc-300 hover:text-white text-xs sm:text-sm font-semibold py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-sm transition-all mb-4 no-underline group max-w-full shadow-sm"
                      >
                        <svg className="w-4 h-4 text-red-400 shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{cmsData.location_address}</span>
                      </a>
                    )}
                  </div>

                  {/* Menu Board Access Button */}
                  <div className="pt-5 border-t border-white/15 mt-5">
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(true)}
                      className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 transition-all duration-200 cursor-pointer shadow-md group border border-white/30"
                    >
                      <div className="text-left">
                        <span className="text-[10px] sm:text-[11px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">
                          {cmsData.menu_subtitle || 'Browse Our'}
                        </span>
                        <span className="text-lg sm:text-xl font-black text-zinc-950 uppercase tracking-tight block">
                          {cmsData.menu_title || 'Menu Board'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-950 text-white text-xs sm:text-sm font-bold uppercase tracking-wider group-hover:bg-amber-400 group-hover:text-zinc-950 transition-colors shadow">
                        <span>Open Menu</span>
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right Card: Featured Promo Carousel */}
                <div className="lg:col-span-7 flex flex-col justify-center">
                  <PromoShowcase promos={cmsData.promos} />
                </div>
              </div>
            </div>

            {/* Interactive Menu Board (Expands in place smoothly) */}
            <div 
              className={`w-full h-[78vh] sm:h-[82vh] max-h-[850px] shadow-2xl flex flex-col transition-all duration-500 ease-out transform ${
                isMenuOpen 
                  ? 'opacity-100 scale-100 relative translate-y-0 z-20 pointer-events-auto' 
                  : 'opacity-0 scale-[0.97] pointer-events-none translate-y-4 absolute inset-0 z-0'
              }`}
            >
              <MenuPanel 
                title={cmsData.menu_title} 
                subtitle={cmsData.menu_subtitle} 
                onClose={() => setIsMenuOpen(false)}
                products={products}
                loading={productsLoading}
                error={productsError}
                onRetry={fetchProducts}
              />
            </div>

          </div>
        </main>

  {/* Footer */}
        <footer className="px-4 md:px-10 py-4 md:py-5 bg-black/40 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 text-[10px] md:text-xs text-gray-400 shrink-0">
          <div className="text-gray-400 text-center md:text-left">
            {cmsData.footer_text}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <a href="#privacy" className="text-gray-400 no-underline hover:text-white transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="#terms" className="text-gray-400 no-underline hover:text-white transition-colors">Terms of Service</a>
              <span>•</span>
              <a href="#support" className="text-gray-400 no-underline hover:text-white transition-colors">Support</a>
            </div>
            <div className="flex items-center gap-4 border-l border-white/20 pl-6">
              {cmsData.social_fb && (
                <a href={safeHref(cmsData.social_fb)} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:text-blue-400 transition-colors drop-shadow-md hover:opacity-80">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {cmsData.social_ig && (
                <a href={safeHref(cmsData.social_ig)} target="_blank" rel="noopener noreferrer" className="text-[#E4405F] hover:text-pink-400 transition-colors drop-shadow-md hover:opacity-80">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
