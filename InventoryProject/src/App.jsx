import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './features/auth/LandingPage';
import PageLoader from './features/auth/PageLoader/PageLoader';
import { getCurrentUser, pingUserActivity } from './api/authApi';
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

function App() {
  return (
    <Router>
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
