import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './features/auth/LandingPage';
import PageLoader from './features/auth/PageLoader/PageLoader';
import { getCurrentUser, pingUserActivity } from './api/authApi';
import { getCmsMap, isValidImageUrl } from './api/cmsApi';
import { isSessionExpired, clearUserSession, touchSessionActivity, USER_STORAGE_KEY } from './utils/authUtils';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));

// PrivateRoute component for protecting routes
const PrivateRoute = ({ children }) => {
  const user = getCurrentUser();
  return user ? children : <Navigate to="/coftealoginpageforstaff" replace />;
};

// Activity and Session Timeout Watcher
function SessionTimeoutWatcher() {
  const navigate = useNavigate();

  useEffect(() => {
    let lastThrottledTouch = 0;
    let lastServerPing = 0;

    const checkAndExpireIfNeeded = () => {
      const hasUser = !!localStorage.getItem(USER_STORAGE_KEY);
      if (hasUser && isSessionExpired()) {
        clearUserSession('expired');
        navigate('/coftealoginpageforstaff', { replace: true });
        return true;
      }
      return false;
    };

    const handleUserActivity = () => {
      if (!localStorage.getItem(USER_STORAGE_KEY)) return;
      // Check if session already expired while tab/device was asleep before refreshing timestamp
      if (checkAndExpireIfNeeded()) return;

      const now = Date.now();
      // Throttle localStorage updates to once every 15 seconds
      if (now - lastThrottledTouch > 15000) {
        lastThrottledTouch = now;
        touchSessionActivity();
      }
      // Throttle backend activity heartbeat to once every 60 seconds
      if (now - lastServerPing > 60000) {
        lastServerPing = now;
        pingUserActivity();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAndExpireIfNeeded();
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodically check every 15 seconds if session timed out while tab was idle
    const interval = setInterval(checkAndExpireIfNeeded, 15000);

    // Cross-tab synchronization: if logged out or expired in another tab
    const handleStorageChange = (e) => {
      if (e.key === USER_STORAGE_KEY && !e.newValue) {
        navigate('/coftealoginpageforstaff', { replace: true });
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

  return null;
}

// Dynamically syncs Browser Tab Title (document.title) and Tab Icon (<link rel="icon">)
// with CMS settings ('browser_tab' and 'brand_logo') on load and whenever CMS is updated.
function BrowserTabBrandingSync() {
  useEffect(() => {
    let isMounted = true;

    const applyTabBranding = async (force = false) => {
      try {
        const map = await getCmsMap(force);
        if (!isMounted || !map) return;

        const tabSection = map.browser_tab;
        const brandSection = map.brand_logo;

        const resolvedTitle =
          (tabSection?.title && tabSection.title.trim()) ||
          (brandSection?.title && brandSection.title.trim()) ||
          'CofTea';

        const candidateIcon =
          (tabSection?.image_url && tabSection.image_url.trim()) ||
          (brandSection?.image_url && brandSection.image_url.trim()) ||
          '';

        const resolvedIcon = isValidImageUrl(candidateIcon) ? candidateIcon : '/favicon.svg';

        if (document.title !== resolvedTitle) {
          document.title = resolvedTitle;
        }

        let iconLink = document.querySelector("link[rel='icon']");
        if (!iconLink) {
          iconLink = document.createElement('link');
          iconLink.setAttribute('rel', 'icon');
          document.head.appendChild(iconLink);
        }
        if (iconLink.getAttribute('href') !== resolvedIcon) {
          iconLink.setAttribute('href', resolvedIcon);
          if (resolvedIcon.endsWith('.svg')) {
            iconLink.setAttribute('type', 'image/svg+xml');
          } else {
            iconLink.removeAttribute('type');
          }
        }
      } catch {
        // Ignore network errors and keep default title/icon
      }
    };

    applyTabBranding(false);

    const handleCmsUpdated = () => applyTabBranding(true);
    window.addEventListener('cms:updated', handleCmsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('cms:updated', handleCmsUpdated);
    };
  }, []);

  return null;
}

function App() {
  return (
    <Router>
      <BrowserTabBrandingSync />
      <SessionTimeoutWatcher />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/coftealoginpageforstaff" element={<LoginPage />} />
          <Route 
            path="/dashboard/*" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
