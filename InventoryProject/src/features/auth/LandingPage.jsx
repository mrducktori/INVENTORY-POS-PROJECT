import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import locPic from '../../assets/images/loc_pic.png';
import PageLoader from './PageLoader/PageLoader';
import { getProducts } from '../../api/posApi';
import { getCmsContent } from '../../api/cmsApi';

// Menu Assets
import addonMenu from '../../assets/images/Addon_menu.png';
import amerikanoMenu from '../../assets/images/Amerikano_menu.png';
import frappeMenu from '../../assets/images/Frappe_menu.png';
import fruitSodaMenu from '../../assets/images/Fruit&Soda_menu.png';
import latteMenu from '../../assets/images/Latte_menu.png';
import milkteaMenu from '../../assets/images/Milktea_menu.png';
import pastryPlaceholder from '../../assets/images/Pastry_placeholder.png';

const CATEGORY_IMAGES = {
  'COFFEE': amerikanoMenu,
  'FRAPPE': frappeMenu,
  'MILK TEA': milkteaMenu,
  'SODA': fruitSodaMenu,
  'ADDONS': addonMenu,
  'LATTE': latteMenu,
  'PASTRY': pastryPlaceholder
};

function MenuPanel() {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    getProducts()
      .then(data => setProducts(data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'ALL'
    ? products
    : products.filter(p => p.category?.toUpperCase() === activeCategory);

  const presentCategories = ['ALL', ...new Set(products.map(p => p.category?.toUpperCase()).filter(Boolean))];
  const allMenuBoards = [amerikanoMenu, latteMenu, frappeMenu, milkteaMenu, fruitSodaMenu, addonMenu, pastryPlaceholder];

  useEffect(() => {
    let interval;
    if (activeCategory === 'ALL') {
      interval = setInterval(() => {
        setCycleIndex(prev => (prev + 1) % allMenuBoards.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeCategory, allMenuBoards.length]);

  const getCategoryImages = (cat) => {
    const key = cat.toUpperCase();
    if (key === 'ALL') return [allMenuBoards[cycleIndex]];
    if (key === 'COFFEE' || key === 'LATTE') return [amerikanoMenu, latteMenu];
    if (key === 'FRUIT DRINKS' || key === 'FRUIT' || key === 'SODA') return [fruitSodaMenu];
    if (key === 'PASTRY' || key === 'PASTRIES') return [pastryPlaceholder];
    const single = CATEGORY_IMAGES[key];
    return single ? [single] : [amerikanoMenu];
  };

  const displayCategories = presentCategories.includes('ADDONS') 
    ? presentCategories 
    : [...presentCategories, 'ADDONS'];

  const activeImages = getCategoryImages(activeCategory);

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md text-white rounded-xl overflow-hidden border border-white/20 shadow-2xl">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-300 mb-1">Browse Our</p>
          <h2 className="text-xl font-bold m-0 leading-tight drop-shadow-md">Menu Board</h2>
        </div>
        {activeCategory === 'ALL' && (
          <div className="text-[10px] text-green-400 flex items-center gap-1 uppercase font-bold tracking-wider px-2 py-1 border border-green-400/30 rounded-full bg-green-400/10">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse shadow-[0_0_8px_#4ade80]"></span>
            LIVE
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 bg-white/5 border-b border-white/10 overflow-x-auto">
        {displayCategories.map(cat => (
          <button
            key={cat}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full uppercase tracking-wider border transition-all duration-300 cursor-pointer ${activeCategory === cat ? 'bg-white/20 text-white border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/10'}`}
            onClick={() => { setActiveCategory(cat); setCycleIndex(0); }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className="flex-[2] bg-white/5 relative flex justify-center items-center p-4 min-h-[200px] md:min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mb-2" />
              <span className="text-sm tracking-wider uppercase">Loading menu...</span>
            </div>
          ) : (
            <div className="relative w-full h-full flex justify-center items-center gap-4">
              {activeImages.map((img, idx) => (
                <img 
                  src={img} 
                  alt={`${activeCategory}-${idx}`} 
                  className={`object-contain max-h-full cursor-pointer hover:scale-105 transition-transform duration-300 drop-shadow-2xl rounded-lg ${activeImages.length > 1 ? 'max-w-[48%]' : 'max-w-[90%]'}`}
                  key={`${activeCategory}-${img}-${idx}`}
                  onClick={() => setEnlargedImage(img)}
                />
              ))}
              
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm border border-white/20 text-white text-[10px] px-2 py-1 rounded uppercase tracking-wider">
                {activeCategory}
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-auto md:flex-1 bg-black/20 overflow-y-auto border-t md:border-t-0 md:border-l border-white/10 min-h-[150px]">
          <div className="sticky top-0 bg-black/60 backdrop-blur-md border-b border-white/10 p-2 px-3 text-[10px] font-bold text-gray-300 uppercase tracking-wider flex justify-between z-10">
            <span>All Items - {filtered.length} Items</span>
          </div>
          {!loading && filtered.map(product => (
            <div key={product.id} className="flex justify-between items-center py-2.5 px-3 border-b border-white/5 hover:bg-white/10 transition-colors">
              <span className="text-xs text-white/90">{product.name}</span>
              <span className="text-xs font-bold text-white whitespace-nowrap ml-2">₱{parseFloat(product.price).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {enlargedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-center p-8 cursor-pointer" onMouseDown={(e) => { if (e.target === e.currentTarget) setEnlargedImage(null); }}>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={enlargedImage} alt="Enlarged Menu" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-black border-2 border-white text-white flex items-center justify-center font-bold cursor-pointer hover:bg-white hover:text-black transition-colors" onClick={() => setEnlargedImage(null)}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LandingPage() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [cmsData, setCmsData] = useState({
    title: 'COF/TEA CAFÉ | ELWOOD BRANCH',
    description: '',
    image_url: locPic
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getCmsContent();
        const hero = data?.find(d => d.section_key === 'landing_hero');
        if (hero) {
          setCmsData({
            title: hero.title || cmsData.title,
            description: hero.description || '',
            image_url: hero.image_url || locPic
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
    <div className="w-full h-screen bg-cover bg-center bg-fixed font-sans" style={{ backgroundImage: `url(${cmsData.image_url})` }}>
      <div className="w-full h-full bg-black/60 backdrop-blur-[2px] flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center px-4 md:px-10 h-16 bg-black/30 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-white text-lg md:text-2xl font-black tracking-widest m-0 flex items-baseline gap-1 md:gap-2">
              {formatTitle(cmsData.title)}
            </h1>
          </div>
          {/* Discreet Login Trigger: using a subtle icon with low opacity instead of text */}
          <button 
            onClick={() => navigate('/login')}
            className="bg-transparent border-none text-white/30 hover:text-white/80 transition-colors cursor-pointer p-2 flex items-center justify-center rounded-full"
            title="Sign In"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 overflow-hidden">
          {cmsData.description && (
            <div className="mb-4 md:mb-6 max-w-2xl text-center hidden md:block">
              <p className="text-white/90 text-sm md:text-lg font-medium drop-shadow-md whitespace-pre-wrap">
                {cmsData.description}
              </p>
            </div>
          )}
          <div className="w-full max-w-[900px] h-full max-h-[600px] shadow-2xl">
            <MenuPanel />
          </div>
        </div>

        {/* Footer */}
        <footer className="px-4 md:px-10 py-4 md:py-5 bg-black/40 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 text-[10px] md:text-xs text-gray-400 shrink-0">
          <div className="text-gray-400 text-center md:text-left">
            &copy; 2026 Cof/tea Cafe. All rights reserved.
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
              <a href="https://www.facebook.com/cofteacafeelwood" target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:text-blue-400 transition-colors drop-shadow-md hover:scale-110">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://www.instagram.com/coftea.cafe_elwood/" target="_blank" rel="noopener noreferrer" className="text-[#E4405F] hover:text-pink-400 transition-colors drop-shadow-md hover:scale-110">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
