import React, { useState, useEffect } from 'react';
import './Login.css';
import Dashboard from '../dashboard/Dashboard';
import { useLogin } from './useLogin';
import locPic from '../../assets/images/loc_pic.png';
import PageLoader from './PageLoader/PageLoader';
import { getProducts } from '../../api/posApi';

const CATEGORIES = ['ALL', 'COFFEE', 'FRAPPE', 'MILK TEA', 'SODA', 'PASTRY'];

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

  return (
    <div className="menu-panel">
      <div className="menu-panel-header">
        <h2>Our Menu</h2>
        <p>Fresh brews &amp; sweet treats</p>
      </div>

      {/* Category Tabs */}
      <div className="menu-category-tabs">
        {presentCategories.map(cat => (
          <button
            key={cat}
            id={`menu-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
            className={`menu-cat-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="menu-items-list">
        {loading ? (
          <div className="menu-loading">
            <div className="menu-spinner" />
            <span>Loading menu...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="menu-empty">No items in this category yet.</div>
        ) : (
          filtered.map(product => (
            <div key={product.id} className="menu-item-row">
              <div className="menu-item-info">
                <span className="menu-item-name">{product.name}</span>
                <span className="menu-item-category">{product.category}</span>
              </div>
              <span className="menu-item-price">₱{parseFloat(product.price).toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
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
    handleSubmit
  } = useLogin();

  if (user) return <Dashboard />;
  if (isInitialLoading) return <PageLoader />;

  return (
    <div className='default_page'>
      {/* Header */}
      <header className="login-header">
        <div className="header-content">
          <h1>COF/TEA CAFE | ELWOOD</h1>
          <button className="open-btn" onClick={toggleModal}>Login</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="login-main">
        {/* Left Side - Location Photo */}
        <div className="login-left">
          <div className="images-container">
            <div className="image-placeholder">
              <img src={locPic} alt="Location" className="placeholder-image" />
            </div>
          </div>
        </div>

        {/* Right Side - Categorized Menu */}
        <div className="menu-panel-wrapper">
          <MenuPanel />
        </div>
      </div>

      <footer className="login-footer">
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

      {formOpen && (
        <div className="modal-overlay">
          <div className="login-container">
            <form onSubmit={handleSubmit}>
              <h3 className="back-btn" onClick={toggleModal}> ← Back </h3>
              <h1>Login</h1>
              {error && <p className="error">{error}</p>}
              <label>Username:</label>
              <input type="text" name="username"
                value={form.username}
                onChange={handleChange} required />
              <label>Password:</label>
              <input type="password" name="password"
                value={form.password}
                onChange={handleChange} required />
              <button type="submit" className="login-submit">Login</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
