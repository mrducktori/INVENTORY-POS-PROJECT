import React, { useState, useEffect } from 'react';
import locPic from '../../assets/images/LOC_PIC.png';
import PageLoader from './PageLoader/PageLoader';
import { getProducts } from '../../api/posApi';
import { getCmsContent } from '../../api/cmsApi';



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
    <div className="flex flex-col h-full bg-black/60 backdrop-blur-md text-white rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
      <div className="p-3.5 sm:p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-300 mb-0.5">{subtitle}</p>
          <h2 className="text-lg sm:text-xl font-bold m-0 leading-tight drop-shadow-md">{title}</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold tracking-wider uppercase border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
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
                      <div key={product.id} className="bg-black/60 border border-white/10 rounded-xl p-2.5 sm:p-4 flex flex-col h-full items-center hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] group">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-full aspect-square object-cover rounded-lg mb-2 sm:mb-3 drop-shadow-lg group-hover:scale-105 transition-transform duration-500"
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

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col justify-between items-center p-3 sm:p-6 animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Lightbox Header */}
      <div 
        className="w-full max-w-5xl flex justify-between items-center py-2 px-1 shrink-0 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow">
            ★ Promo {promos.length > 1 ? `${currentIndex + 1} of ${promos.length}` : ''}
          </span>
          {promo.title && (
            <h4 className="text-white text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-md m-0">
              {promo.title}
            </h4>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold border border-white/20 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-lg"
          title="Close (ESC)"
        >
          ✕
        </button>
      </div>

      {/* Main Picture Area */}
      <div 
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden my-2 sm:my-3"
        onClick={(e) => e.stopPropagation()}
      >
        {promos.length > 1 && (
          <button
            onClick={() => onSelectIndex((currentIndex - 1 + promos.length) % promos.length)}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center text-2xl font-bold border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer z-10"
            title="Previous (Left Arrow)"
          >
            ‹
          </button>
        )}

        <img 
          src={promo.image_url} 
          alt={promo.title || "Expanded Promotion"} 
          className="max-h-[72vh] sm:max-h-[78vh] max-w-full w-auto object-contain rounded-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9)] transition-all"
        />

        {promos.length > 1 && (
          <button
            onClick={() => onSelectIndex((currentIndex + 1) % promos.length)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center text-2xl font-bold border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer z-10"
            title="Next (Right Arrow)"
          >
            ›
          </button>
        )}
      </div>

      {/* Lightbox Footer Caption */}
      <div 
        className="w-full max-w-5xl bg-zinc-950/80 border border-white/15 rounded-2xl p-3 sm:p-4 text-center shrink-0 backdrop-blur-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {promo.title && (
          <h3 className="text-white text-base sm:text-xl font-black uppercase tracking-wider m-0 mb-1">
            {promo.title}
          </h3>
        )}
        {promo.description && (
          <p className="text-gray-300 text-xs sm:text-sm font-medium whitespace-pre-wrap max-w-2xl mx-auto m-0 mb-1">
            {promo.description}
          </p>
        )}
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
          Click anywhere outside or press ESC to close
        </span>
      </div>
    </div>
  );
}

// Multi-Promo Showcase Carousel with Click-to-Expand Lightbox
function PromoShowcase({ promos = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedPromo, setExpandedPromo] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance if multiple promos exist (paused on hover or modal open)
  useEffect(() => {
    if (promos.length <= 1 || isHovered || expandedPromo) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % promos.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [promos.length, isHovered, expandedPromo]);

  if (!promos || promos.length === 0) return null;

  const currentPromo = promos[currentIndex] || promos[0];

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % promos.length);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + promos.length) % promos.length);
  };

  return (
    <>
      <div 
        className="w-full max-w-[960px] px-3 sm:px-4 mb-4 sm:mb-5 animate-fade-in shrink-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          onClick={() => currentPromo.image_url && setExpandedPromo(currentPromo)}
          className={`relative rounded-2xl overflow-hidden border border-white/20 bg-zinc-900/85 shadow-[0_15px_35px_rgba(0,0,0,0.6)] backdrop-blur-md group transition-all duration-300 ${
            currentPromo.image_url ? 'cursor-zoom-in hover:border-white/50' : ''
          }`}
          title={currentPromo.image_url ? "Click to expand picture" : undefined}
        >
          {currentPromo.image_url ? (
            <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] md:aspect-[3/1] max-h-[230px] sm:max-h-[270px] overflow-hidden bg-black/40">
              <img 
                src={currentPromo.image_url} 
                alt={currentPromo.title || "Promotion"} 
                className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700" 
              />
              
              {/* Expand Hint Badge in top-right */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 text-white/90 text-[10px] sm:text-xs font-bold tracking-wider uppercase border border-white/20 backdrop-blur-md shadow-md transition-all group-hover:scale-105">
                <svg className="w-3.5 h-3.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Expand</span>
              </div>

              {/* Bottom Gradient Overlay for typography */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent flex flex-col justify-end p-4 sm:p-6 pointer-events-none">
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-400 text-zinc-950 text-[10px] sm:text-xs font-black tracking-widest uppercase mb-1.5 shadow-md">
                  <span>★ Featured Promo</span>
                  {promos.length > 1 && (
                    <span className="text-[9px] font-extrabold text-zinc-800 ml-1">
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
                  <p className="text-gray-200 text-xs sm:text-sm font-medium line-clamp-2 max-w-2xl drop-shadow mt-1 m-0">
                    {currentPromo.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-900/90 via-black/80 to-zinc-900/90 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold tracking-widest uppercase mb-1">
                  <span>★ Featured Promo</span>
                  {promos.length > 1 && <span className="text-amber-200 font-extrabold">({currentIndex + 1} of {promos.length})</span>}
                </div>
                <h3 className="text-white text-base sm:text-lg font-black uppercase tracking-wide m-0">
                  {currentPromo.title || 'Featured Promotions'}
                </h3>
                {currentPromo.description && (
                  <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-xl m-0">
                    {currentPromo.description}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <span className="text-xs text-amber-300/80 font-medium px-3 py-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10">
                  Seasonal Exclusive
                </span>
              </div>
            </div>
          )}

          {/* Previous / Next Slide Controls (when >1 promo) */}
          {promos.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-lg font-bold border border-white/20 backdrop-blur-md shadow-lg transition-all hover:scale-110 active:scale-90 cursor-pointer z-10"
                aria-label="Previous promo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-lg font-bold border border-white/20 backdrop-blur-md shadow-lg transition-all hover:scale-110 active:scale-90 cursor-pointer z-10"
                aria-label="Next promo"
              >
                ›
              </button>

              {/* Indicator Dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10">
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
    hero_image: locPic,
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
        const data = await getCmsContent();
        if (data && data.length > 0) {
          const brand = data.find(d => d.section_key === 'brand_logo');
          const promo = data.find(d => d.section_key === 'promo_section');
          const hero = data.find(d => d.section_key === 'landing_hero');
          const menu = data.find(d => d.section_key === 'menu_section');
          const location = data.find(d => d.section_key === 'location_info');
          const footer = data.find(d => d.section_key === 'footer_info');
          const social = data.find(d => d.section_key === 'social_links');

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
            hero_image: hero?.image_url || locPic,
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
    const timer = setTimeout(() => setIsInitialLoading(false), 2000);
    fetchData();
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
            {cmsData.brand_logo && (
              <img 
                src={cmsData.brand_logo} 
                alt={cmsData.brand_title || "Logo"} 
                className="w-14 h-14 sm:w-18 sm:h-18 md:w-22 md:h-22 object-contain rounded-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] border border-white/25 p-1 sm:p-1.5 bg-black/60 shrink-0 hover:scale-105 transition-transform duration-300 shadow-xl" 
              />
            )}
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

        {/* Main Content - Central in-place expansion */}
        <div className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 relative w-full ${
          isMenuOpen ? 'overflow-hidden' : 'overflow-y-auto'
        }`}>
          {/* Hero text, Location & Promos - smoothly close when menu expands for maximum screen space */}
          {!isMenuOpen && (
            <>
              {(cmsData.hero_description || cmsData.location_address) && (
                <div className="flex flex-col items-center text-center max-w-3xl px-2 sm:px-4 mb-4 sm:mb-5 animate-fade-in shrink-0">
                  {cmsData.hero_description && (
                    <div className="mb-3 sm:mb-4 max-w-2xl px-2">
                      <p className="text-white/95 text-sm sm:text-lg md:text-xl font-medium drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] whitespace-pre-wrap leading-relaxed">
                        {cmsData.hero_description}
                      </p>
                    </div>
                  )}

                  {cmsData.location_address && (
                    <a 
                      href={cmsData.location_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 text-white/90 bg-black/60 hover:bg-black/80 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full border border-white/20 backdrop-blur-md shadow-lg hover:border-white/40 transition-all no-underline text-xs sm:text-sm font-bold tracking-wide uppercase drop-shadow-sm hover:scale-105"
                    >
                      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="truncate max-w-[260px] sm:max-w-none">{cmsData.location_address}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Multi-Promo Showcase & Lightbox (Closes when Menu Board is Open) */}
              <PromoShowcase promos={cmsData.promos} />
            </>
          )}

          {/* Central Menu Board Container - Expands in-place */}
          <div className={`w-full max-w-[960px] px-3 sm:px-4 transition-all duration-500 ease-out flex flex-col items-center ${
            isMenuOpen 
              ? 'h-full max-h-[80vh] sm:max-h-[82vh]' 
              : 'shrink-0'
          }`}>
            {isMenuOpen ? (
              <div className="w-full h-full shadow-2xl animate-fade-in flex flex-col">
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
            ) : (
              <button
                onClick={() => setIsMenuOpen(true)}
                className="w-full group relative flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-zinc-900/95 hover:bg-zinc-900 text-white rounded-2xl border border-white/20 hover:border-white/50 shadow-[0_15px_35px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <div className="text-left">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest block">
                    {cmsData.menu_subtitle || 'Browse Our'}
                  </span>
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-white uppercase tracking-wider m-0 group-hover:text-amber-300 transition-colors">
                    {cmsData.menu_title || 'Menu Board'}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-gray-200 bg-white/10 group-hover:bg-amber-400 group-hover:text-zinc-950 rounded-full border border-white/20 transition-all uppercase tracking-wider shadow-sm shrink-0">
                  <span>Open Menu</span>
                  <span className="text-xs group-hover:translate-y-0.5 transition-transform">▾</span>
                </div>
              </button>
            )}
          </div>
        </div>

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
                <a href={cmsData.social_fb} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:text-blue-400 transition-colors drop-shadow-md hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {cmsData.social_ig && (
                <a href={cmsData.social_ig} target="_blank" rel="noopener noreferrer" className="text-[#E4405F] hover:text-pink-400 transition-colors drop-shadow-md hover:scale-110">
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
