import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Auto-recover from stale chunks / MIME type mismatch after a new build / deployment
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = Number(sessionStorage.getItem('last_preload_reload') || 0);
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem('last_preload_reload', String(Date.now()));
    window.location.reload();
  }
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('error loading dynamically imported module') ||
    msg.includes('disallowed MIME type') ||
    msg.includes('Failed to fetch dynamically imported module')
  ) {
    const lastReload = Number(sessionStorage.getItem('last_preload_reload') || 0);
    if (Date.now() - lastReload > 10000) {
      sessionStorage.setItem('last_preload_reload', String(Date.now()));
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);