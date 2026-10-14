import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global button double-click preventer (500ms cooldown)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) {
    if (btn.hasAttribute('data-cooldown')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
    btn.setAttribute('data-cooldown', 'true');
    btn.style.opacity = '0.8'; // Slight visual feedback
    
    setTimeout(() => {
      btn.removeAttribute('data-cooldown');
      btn.style.opacity = '';
    }, 500);
  }
}, true); // Use capture phase to intercept before React



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
