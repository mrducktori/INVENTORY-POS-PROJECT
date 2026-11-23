import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '../../../api/posApi';
import { getCmsMap } from '../../../api/cmsApi';

export const DEFAULT_HERO_IMAGE = 'https://zngerymqycuxpxdmfftj.supabase.co/storage/v1/object/public/cms-images/public/landing_hero-0.8481000269201046.jpg';

export const safeHref = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : '#');

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

export const useLandingPage = () => {
  const navigate = useNavigate();

  // Hidden staff entry: tap the logo 5 times quickly to open the login page
  const logoTapRef = useRef({ count: 0, timer: null });
  const handleLogoTap = useCallback(() => {
    const tap = logoTapRef.current;
    clearTimeout(tap.timer);
    tap.count += 1;
    if (tap.count >= 5) {
      tap.count = 0;
      navigate('/coftealoginpageforstaff');
      return;
    }
    tap.timer = setTimeout(() => { tap.count = 0; }, 1500);
  }, [navigate]);

  useEffect(() => {
    const tap = logoTapRef.current;
    return () => clearTimeout(tap.timer);
  }, []);

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

  // Digital Menu Board filtering state
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Promo Carousel & Lightbox state
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [isPromoHovered, setIsPromoHovered] = useState(false);
  const [expandedPromo, setExpandedPromo] = useState(null);

  const fetchProducts = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setProductsLoading(true);
        setProductsError(null);
      }
      const data = await getProducts();
      setProducts(data || []);
      if (silent) setProductsError(null);
    } catch (err) {
      console.error('Failed to load products for menu board:', err);
      if (!silent) setProductsError(err?.message || 'Unable to load menu items right now.');
    } finally {
      if (!silent) setProductsLoading(false);
    }
  }, []);

  // Keep availability fresh while the menu is open: refresh on open, then every 60s while the tab is visible.
  useEffect(() => {
    if (!isMenuOpen) return;
    fetchProducts({ silent: true });
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchProducts({ silent: true });
    }, 60000);
    return () => clearInterval(interval);
  }, [isMenuOpen, fetchProducts]);

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
        console.error('Failed to load CMS content:', err);
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
  }, [fetchProducts]);

  // Menu category filtering memos
  const presentCategories = useMemo(() => {
    return ['ALL', ...new Set(products.map(p => p.category?.toUpperCase()).filter(Boolean))];
  }, [products]);

  const groupedProducts = useMemo(() => {
    const groups = products.reduce((acc, product) => {
      const cat = product.category?.toUpperCase() || 'UNCATEGORIZED';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(product);
      return acc;
    }, {});
    // Available first, then A-Z within each group.
    Object.values(groups).forEach((list) => list.sort((a, b) =>
      (a.is_available === false) - (b.is_available === false) || (a.name || '').localeCompare(b.name || '')
    ));
    return groups;
  }, [products]);

  const categoriesToDisplay = useMemo(() => {
    return activeCategory === 'ALL'
      ? Object.keys(groupedProducts).sort()
      : [activeCategory];
  }, [activeCategory, groupedProducts]);

  // Auto-advance promo carousel if multiple promos exist (paused on hover or modal open)
  const promos = cmsData.promos;
  useEffect(() => {
    if (promos.length <= 1 || isPromoHovered || expandedPromo) return;
    const interval = setInterval(() => {
      setCurrentPromoIndex(prev => (prev + 1) % promos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [promos.length, isPromoHovered, expandedPromo]);

  const handleNextPromo = useCallback((e) => {
    if (e) e.stopPropagation();
    if (promos.length === 0) return;
    setCurrentPromoIndex(prev => (prev + 1) % promos.length);
  }, [promos.length]);

  const handlePrevPromo = useCallback((e) => {
    if (e) e.stopPropagation();
    if (promos.length === 0) return;
    setCurrentPromoIndex(prev => (prev - 1 + promos.length) % promos.length);
  }, [promos.length]);

  const handleSelectPromoIndex = useCallback((idx) => {
    setCurrentPromoIndex(idx);
    setExpandedPromo(prev => (prev ? promos[idx] : prev));
  }, [promos]);

  const openPromoLightbox = useCallback((promo) => {
    if (promo?.image_url) {
      setExpandedPromo(promo);
    }
  }, []);

  const closePromoLightbox = useCallback(() => {
    setExpandedPromo(null);
  }, []);

  return {
    handleLogoTap,
    isInitialLoading,
    isMenuOpen,
    setIsMenuOpen,
    cmsData,
    products,
    productsLoading,
    productsError,
    fetchProducts,
    activeCategory,
    setActiveCategory,
    presentCategories,
    groupedProducts,
    categoriesToDisplay,
    currentPromoIndex,
    isPromoHovered,
    setIsPromoHovered,
    expandedPromo,
    handleNextPromo,
    handlePrevPromo,
    handleSelectPromoIndex,
    openPromoLightbox,
    closePromoLightbox
  };
};
