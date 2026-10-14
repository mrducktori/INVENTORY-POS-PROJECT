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

// Security: Prevent right-click and common Inspect Element shortcuts
// Active in all environments for maximum protection as requested
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Disable specific shortcuts
document.addEventListener('keydown', (e) => {
  // F12
  if (e.keyCode === 123) {
    e.preventDefault();
    return false;
  }
  // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspect/Console/Select)
  if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
    e.preventDefault();
    return false;
  }
  // Ctrl+U (View Source)
  if (e.ctrlKey && e.keyCode === 85) {
    e.preventDefault();
    return false;
  }
});

// Extra: Disable text selection and dragging to prevent copying
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

// Aggressive: Debugger loop to pause if DevTools is opened
setInterval(() => {
  (function() {
    return false;
  }['constructor']('debugger')());
}, 100);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
