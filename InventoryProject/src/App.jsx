import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './features/auth/LandingPage';
import LoginPage from './features/auth/LoginPage';
import Dashboard from './features/dashboard/Dashboard';
import { getCurrentUser } from './api/authApi';
import { isSessionExpired, clearUserSession, touchSessionActivity, USER_STORAGE_KEY } from './utils/authUtils';

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

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle touches so localStorage is only updated at most once every 15 seconds
      if (now - lastThrottledTouch > 15000) {
        lastThrottledTouch = now;
        if (localStorage.getItem(USER_STORAGE_KEY)) {
          touchSessionActivity();
        }
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Periodically check every 15 seconds if session timed out while tab was idle
    const interval = setInterval(() => {
      const hasUser = !!localStorage.getItem(USER_STORAGE_KEY);
      if (hasUser && isSessionExpired()) {
        clearUserSession('expired');
        navigate('/coftealoginpageforstaff', { replace: true });
      }
    }, 15000);

    // Cross-tab synchronization: if logged out or expired in another tab
    const handleStorageChange = (e) => {
      if (e.key === USER_STORAGE_KEY && !e.newValue) {
        navigate('/coftealoginpageforstaff', { replace: true });
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
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
    </Router>
  );
}

export default App;
