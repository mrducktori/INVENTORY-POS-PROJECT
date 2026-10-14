import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import locPic from '../../assets/images/loc_pic.png';
import PageLoader from './PageLoader/PageLoader';
import { getProducts } from '../../api/posApi';
import { getCmsContent } from '../../api/cmsApi';



function MenuPanel({ title, subtitle }) {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    getProducts()
      .then(data => setProducts(data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md text-white rounded-xl overflow-hidden border border-white/20 shadow-2xl">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-300 mb-1">{subtitle}</p>
          <h2 className="text-xl font-bold m-0 leading-tight drop-shadow-md">{title}</h2>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 p-3 bg-white/5 border-b border-white/10 shrink-0">
        {presentCategories.map(cat => (
          <button
            key={cat}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-full uppercase tracking-wider border transition-all duration-300 cursor-pointer whitespace-nowrap ${activeCategory === cat ? 'bg-white/20 text-white border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/10'}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div 
        ref={scrollRef}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onTouchStart={() => setIsHovering(true)}
        onTouchEnd={() => setIsHovering(false)}
        className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-b from-transparent to-black/20"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mb-2" />
            <span className="text-sm tracking-wider uppercase">Loading menu...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {categoriesToDisplay.map(cat => {
              const catProducts = groupedProducts[cat] || [];
              if (catProducts.length === 0) return null;
              
              return (
                <div key={cat} className="animate-fade-in">
                  <h3 className="text-lg md:text-xl font-black tracking-widest uppercase text-white/90 border-b border-white/10 pb-2 mb-4 drop-shadow-md">
                    {cat}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 items-start">
                    {catProducts.map(product => (
                      <div key={product.id} className="bg-black/60 border border-white/10 rounded-lg p-3 md:p-4 flex flex-col h-full items-center hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] group">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-full aspect-square object-cover rounded-md mb-4 drop-shadow-lg group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-white/5 rounded-md flex flex-col items-center justify-center mb-4 border border-white/10 text-gray-500">
                            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-[10px] md:text-xs uppercase tracking-wider text-center px-2">Image<br/>Coming Soon</span>
                          </div>
                        )}
                        <h4 className="text-base md:text-lg text-white font-black text-center mb-4 uppercase tracking-wide leading-tight flex-1">
                          {product.name}
                        </h4>
                        
                        <div className="flex flex-wrap justify-center gap-2 w-full mt-auto pt-2 border-t border-white/10">
                          {product.sizes && product.sizes.length > 0 ? (
                            product.sizes.map((sz, i) => (
                              <div key={i} className="flex flex-col items-center bg-white/10 px-3 py-1.5 rounded-md border border-white/5 flex-1 min-w-[70px]">
                                <span className="text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wide">{sz.name || sz.size}</span>
                                <span className="text-sm md:text-base text-green-400 font-black">₱{(parseFloat(product.price) + (parseFloat(sz.price_add) || 0)).toFixed(0)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center bg-white/10 px-4 py-1.5 rounded-md border border-white/5 w-full">
                              <span className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-0.5">Price</span>
                              <span className="text-sm md:text-base text-green-400 font-black">₱{parseFloat(product.price || 0).toFixed(0)}</span>
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

function LandingPage() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [cmsData, setCmsData] = useState({
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
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getCmsContent();
        if (data && data.length > 0) {
          const hero = data.find(d => d.section_key === 'landing_hero');
          const menu = data.find(d => d.section_key === 'menu_section');
          const location = data.find(d => d.section_key === 'location_info');
          const footer = data.find(d => d.section_key === 'footer_info');
          const social = data.find(d => d.section_key === 'social_links');

          setCmsData({
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
    <div className="w-full h-screen bg-cover bg-center bg-fixed font-sans" style={{ backgroundImage: `url(${cmsData.hero_image})` }}>
      <div className="w-full h-full bg-black/60 backdrop-blur-[2px] flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center px-4 md:px-10 h-16 bg-black/30 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-white text-lg md:text-2xl font-black tracking-widest m-0 flex items-baseline gap-1 md:gap-2">
              {formatTitle(cmsData.hero_title)}
            </h1>
          </div>
          {/* Discreet Login Trigger removed per user request: Staff login is via /coftealoginpageforstaff URL directly */}
          {/* 
          <button 
            onClick={() => navigate('/coftealoginpageforstaff')}
            className="bg-transparent border-none text-white/30 hover:text-white/80 transition-colors cursor-pointer p-2 flex items-center justify-center rounded-full"
            title="Sign In"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
          */}
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 overflow-hidden">
          {cmsData.hero_description && (
            <div className="mb-4 md:mb-6 max-w-2xl text-center hidden md:block">
              <p className="text-white/90 text-sm md:text-lg font-medium drop-shadow-md whitespace-pre-wrap">
                {cmsData.hero_description}
              </p>
            </div>
          )}
          {cmsData.location_address && (
            <a 
              href={cmsData.location_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-6 flex items-center justify-center gap-2 text-white/90 bg-black/50 px-5 py-2.5 rounded-full border border-white/20 backdrop-blur-md shadow-lg hover:bg-black/60 transition-colors no-underline"
            >
              <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="text-sm md:text-base font-bold tracking-wide uppercase drop-shadow-sm">{cmsData.location_address}</span>
            </a>
          )}
          <div className="w-full max-w-[900px] h-full max-h-[600px] shadow-2xl">
            <MenuPanel title={cmsData.menu_title} subtitle={cmsData.menu_subtitle} />
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
