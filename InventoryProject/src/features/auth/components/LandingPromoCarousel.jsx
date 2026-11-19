import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Lightbox Modal for Fullscreen Expandable Promo Picture
function PromoLightbox({ promo, promos = [], currentIndex = 0, onSelectIndex, onClose }) {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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
            <span className="px-2.5 py-1 rounded-xs bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow">
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
            className="w-10 h-10 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-colors cursor-pointer shadow-lg"
            title="Close (ESC)"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
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
              className="hidden sm:flex absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded bg-black/75 hover:bg-black/95 text-white items-center justify-center text-3xl font-bold border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer z-20"
              title="Previous (Left Arrow)"
            >
              ‹
            </button>
          )}

          <img
            src={promo.image_url}
            alt={promo.title || 'Expanded Promotion'}
            className="max-h-[50vh] sm:max-h-[76vh] max-w-full w-auto object-contain rounded-md border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9)] transition-all select-none"
          />

          {/* Desktop Side Arrows: Shown only on sm+ screens, placed cleanly at the outer margins */}
          {promos.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="hidden sm:flex absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded bg-black/75 hover:bg-black/95 text-white items-center justify-center text-3xl font-bold border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer z-20"
              title="Next (Right Arrow)"
            >
              ›
            </button>
          )}
        </div>

        {/* Lightbox Footer Caption & Mobile Controls */}
        <div
          className="w-full max-w-4xl bg-zinc-950/85 border border-white/15 rounded-md p-3 sm:p-4 shrink-0 backdrop-blur-md shadow-xl mb-6 sm:mb-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            {promos.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="sm:hidden w-10 h-10 rounded-xs bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-colors shrink-0 cursor-pointer"
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
                      className={`h-1.5 rounded-xs transition-all cursor-pointer ${
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
                className="sm:hidden w-10 h-10 rounded-xs bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-colors shrink-0 cursor-pointer"
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
function LandingPromoCarousel({
  promos = [],
  currentIndex = 0,
  onSelectIndex,
  onNext,
  onPrev,
  onHoverChange,
  expandedPromo,
  onOpenLightbox,
  onCloseLightbox,
  connected = false
}) {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  if (!promos || promos.length === 0) return null;

  const currentPromo = promos[currentIndex] || promos[0];

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
        onNext();
      } else {
        onPrev();
      }
    }
  };

  return (
    <>
      <div
        className="w-full h-full flex flex-col justify-center select-none"
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        <div
          onClick={() => currentPromo.image_url && onOpenLightbox(currentPromo)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative rounded-md overflow-hidden border border-white/20 bg-black/55 shadow-2xl backdrop-blur-xl group transition-all duration-300 touch-pan-y ${
            connected ? 'lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none lg:h-full lg:flex lg:flex-col' : ''
          } ${
            currentPromo.image_url ? 'cursor-zoom-in' : ''
          }`}
          title={currentPromo.image_url ? 'Click to expand picture' : undefined}
        >
          {currentPromo.image_url ? (
            <div
              className={`relative w-full aspect-[16/10] sm:aspect-[16/9] ${
                connected
                  ? 'lg:aspect-auto lg:flex-1 lg:h-full lg:min-h-[390px] lg:max-h-[460px]'
                  : 'lg:aspect-[16/10] max-h-[390px]'
              } overflow-hidden bg-black/40`}
            >
              <img
                src={currentPromo.image_url}
                alt={currentPromo.title || 'Promotion'}
                className="w-full h-full object-cover object-center"
              />

              {/* Expand Hint Badge in top-right */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-black/75 hover:bg-black/90 text-white/90 text-[10px] font-bold tracking-wider uppercase border border-white/20 backdrop-blur-md shadow-md transition-colors">
                <svg className="w-3.5 h-3.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Expand</span>
              </div>

              {/* Bottom Gradient Overlay for typography */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-5 sm:p-6 pointer-events-none pb-12 sm:pb-6">
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-0.5 sm:py-1 rounded-xs bg-amber-400 text-zinc-950 text-[10px] sm:text-xs font-black tracking-widest uppercase mb-1.5 shadow-sm">
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
            <div className="p-6 sm:p-8 bg-zinc-900/90 flex-1 h-full flex flex-col justify-between min-h-[240px]">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold tracking-widest uppercase mb-2">
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
                onClick={onPrev}
                className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-black/70 hover:bg-black/90 text-white items-center justify-center text-sm font-bold border border-white/20 backdrop-blur-md shadow-md transition-colors cursor-pointer z-10"
                aria-label="Previous promo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={onNext}
                className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-black/70 hover:bg-black/90 text-white items-center justify-center text-sm font-bold border border-white/20 backdrop-blur-md shadow-md transition-colors cursor-pointer z-10"
                aria-label="Next promo"
              >
                ›
              </button>

              {/* Bottom Control Bar: Integrates Previous & Next arrows cleanly into the bottom indicator pill on mobile */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/75 px-3 py-1 rounded-sm backdrop-blur-md border border-white/20 shadow-lg">
                <button
                  type="button"
                  onClick={onPrev}
                  className="sm:hidden w-6 h-6 rounded-xs bg-white/15 active:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shrink-0"
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
                        onSelectIndex(i);
                      }}
                      className={`h-1.5 rounded-xs transition-all cursor-pointer ${
                        i === currentIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to promo ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onNext}
                  className="sm:hidden w-6 h-6 rounded-xs bg-white/15 active:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shrink-0"
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
          onSelectIndex={onSelectIndex}
          onClose={onCloseLightbox}
        />
      )}
    </>
  );
}

export default LandingPromoCarousel;
