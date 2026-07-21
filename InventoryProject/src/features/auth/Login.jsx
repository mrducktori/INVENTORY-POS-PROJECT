import React, { useState, useEffect } from 'react';
import './Login.css';
import Dashboard from '../dashboard/Dashboard';
import { useLogin } from './useLogin';
import locPic from '../../assets/images/loc_pic.png';
import PageLoader from './PageLoader/PageLoader';
import { getProducts } from '../../api/posApi';

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

  useEffect(() => {
    getProducts()
      .then(data => setProducts(data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'ALL'
    ? products
    : products.filter(p => p.category?.toUpperCase() === activeCategory);

  // Build dynamic category list from actual products
  const presentCategories = ['ALL', ...new Set(products.map(p => p.category?.toUpperCase()).filter(Boolean))];

  const [enlargedImage, setEnlargedImage] = useState(null);
  const [cycleIndex, setCycleIndex] = useState(0);

  // All menu boards for cycling
  const allMenuBoards = [amerikanoMenu, latteMenu, frappeMenu, milkteaMenu, fruitSodaMenu, addonMenu, pastryPlaceholder];

  useEffect(() => {
    let interval;
    if (activeCategory === 'ALL') {
      interval = setInterval(() => {
        setCycleIndex(prev => (prev + 1) % allMenuBoards.length);
      }, 5000); // Cycle every 5 seconds
    }
    return () => clearInterval(interval);
  }, [activeCategory, allMenuBoards.length]);

  // Map categories to image(s)
  const getCategoryImages = (cat) => {
    const key = cat.toUpperCase();
    if (key === 'ALL') return [allMenuBoards[cycleIndex]];
    if (key === 'COFFEE' || key === 'LATTE') return [amerikanoMenu, latteMenu];
    if (key === 'FRUIT DRINKS' || key === 'FRUIT' || key === 'SODA') return [fruitSodaMenu];
    if (key === 'PASTRY' || key === 'PASTRIES') return [pastryPlaceholder];
    const single = CATEGORY_IMAGES[key];
    return single ? [single] : [amerikanoMenu];
  };

  // Add ADDONS to the category list if not present
  const displayCategories = presentCategories.includes('ADDONS') 
    ? presentCategories 
    : [...presentCategories, 'ADDONS'];

  const activeImages = getCategoryImages(activeCategory);

  return (
    <div className="menu-panel">
      <div className="menu-panel-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Visual Menu</h2>
            <p>Explore our seasonal offerings. Click an image to enlarge.</p>
          </div>
          {activeCategory === 'ALL' && (
            <div className="cycling-indicator">
              Auto-cycling...
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="menu-category-tabs">
        {displayCategories.map(cat => (
          <button
            key={cat}
            id={`menu-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
            className={`menu-cat-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => { setActiveCategory(cat); setCycleIndex(0); }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Visual Menu Display */}
      <div className="menu-visual-display">
        {loading ? (
          <div className="menu-loading">
            <div className="menu-spinner" />
            <span>Loading menu...</span>
          </div>
        ) : (
          <div className={`menu-image-container ${activeImages.length > 1 ? 'multi' : ''}`}>
            {activeImages.map((img, idx) => (
              <img 
                src={img} 
                alt={`${activeCategory}-${idx}`} 
                className="menu-board-image clickable" 
                key={`${activeCategory}-${img}-${idx}`}
                onClick={() => setEnlargedImage(img)}
              />
            ))}
            
            <div className="menu-board-overlay">
              <span className="overlay-tag">{activeCategory}</span>
              <span className="overlay-hint">Click to enlarge</span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable list remains compact at the bottom */}
      <div className="menu-items-list mini">
        {!loading && filtered.map(product => (
          <div key={product.id} className="menu-item-row compact">
            <div className="menu-item-info">
              <span className="menu-item-name">{product.name}</span>
            </div>
            <span className="menu-item-price">₱{parseFloat(product.price).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {enlargedImage && (
        <div className="image-modal-overlay" onClick={() => setEnlargedImage(null)}>
          <div className="image-modal-content">
            <img src={enlargedImage} alt="Enlarged Menu" />
            <button className="close-modal-btn">×</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Login() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const {
    form,
    user,
    error,
    formOpen,
    toggleModal,
    handleChange,
    handleSubmit,
    isLocked,
    countdown,
    attemptsLeft
  } = useLogin();

  if (user) return <Dashboard />;
  if (isInitialLoading) return <PageLoader />;

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className='default_page' style={{ backgroundImage: `url(${locPic})` }}>
      <div className="page-overlay">
        {/* Header */}
        <header className="glass-header">
          <div className="header-content">
            <h1>COF/TEA CAFE <span className="location-tag">| ELWOOD</span></h1>
            <button className="open-btn glass-btn" onClick={toggleModal}>Login / Access</button>
          </div>
        </header>

        {/* Main Content */}
        <div className="login-main">
          <div className="glass-menu-wrapper">
            <MenuPanel />
          </div>
        </div>

        <footer className="glass-footer">
          <div className="footer-content">
            <p>&copy; 2026 Inventory + POS System. All rights matters.</p>
            <div className="footer-links">
              <a href="#privacy">Privacy Policy</a>
              <span>•</span>
              <a href="#terms">Terms of Service</a>
              <span>•</span>
              <a href="#support">Support</a>
            </div>
          </div>
        </footer>
      </div>

      {formOpen && (
        <div className="modal-overlay">
          <div className="login-container glass-panel">
            <form onSubmit={handleSubmit}>
              <h3 className="back-btn" onClick={toggleModal}> ← Back </h3>
              <h2>Welcome Back</h2>
              <p className="modal-subtitle">Enter your credentials to access the POS</p>

              {/* Lockout Banner */}
              {isLocked && (
                <div className="lockout-banner">
                  <span className="lockout-icon">🔒</span>
                  <div>
                    <strong>Account Temporarily Locked</strong>
                    <p>Too many failed attempts. Please wait:</p>
                    <div className="lockout-countdown">{fmt(countdown)}</div>
                  </div>
                </div>
              )}

              {/* Error / Attempts Warning */}
              {!isLocked && error && (
                <div className="error-banner">
                  <span className="error-icon">⚠️</span>
                  <div>
                    <strong>Authentication Failed</strong>
                    <p>{error}
                      {attemptsLeft > 0 && attemptsLeft < 3 && (
                        <span className="attempts-warning"> ({attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left)</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Username</label>
                <input type="text" name="username"
                  value={form.username}
                  onChange={handleChange}
                  disabled={isLocked}
                  placeholder="Enter username"
                  required />
              </div>
              
              <div className="input-group">
                <label>Password</label>
                <input type="password" name="password"
                  value={form.password}
                  onChange={handleChange}
                  disabled={isLocked}
                  placeholder="Enter password"
                  required />
              </div>

              <button
                type="submit"
                className="login-submit glow-btn"
                disabled={isLocked}
                style={{ opacity: isLocked ? 0.5 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              >
                {isLocked ? `Locked (${fmt(countdown)})` : 'Login'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
