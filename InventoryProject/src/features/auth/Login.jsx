import React from 'react';
import './Login.css';
import Dashboard from '../dashboard/Dashboard';
import { useLogin } from './useLogin';
import locPic from '../../assets/images/loc_pic.png';
import coffeeMenu from '../../assets/images/coffee_menu.png';

function Login() {
  const {
    form,
    user,
    error,
    formOpen,
    isMenuZoomed,
    toggleModal,
    toggleZoom,
    handleChange,
    handleSubmit
  } = useLogin();

  if (user) return <Dashboard />;

  return (
    <div className='default_page'>
      {/* Header */}
      <header className="login-header">
        <div className="header-content">
          <h1>COF/TEA CAFE | ELWOOD</h1>
          <button className="open-btn" onClick={toggleModal}>Login</button>
        </div>
      </header>

      {/* Main Content - 70/30 Split */}
      <div className="login-main">
        {/* Left Side - 70% */}
        <div className="login-left">
          <div className="images-container">
            {/* Photo 1 - Location */}
            <div className="image-placeholder">
              <img src={locPic} alt="Location" className="placeholder-image" />
            </div>
          </div>
        </div>

        {/* Photo 2 - Menu */}
        <div className="image-placeholder menu-image" onClick={toggleZoom} title="Click to enlarge menu">
          <img src={coffeeMenu} alt="Coffee Menu" className="placeholder-image" />
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

      {isMenuZoomed && (
        <div className="zoom-overlay" onClick={toggleZoom}>
          <img src={coffeeMenu} alt="Zoomed Menu" />
        </div>
      )}
    </div>
  );
}

export default Login;
