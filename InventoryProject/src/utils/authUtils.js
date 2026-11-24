// Inactivity timeout: 2 hours.
export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const USER_STORAGE_KEY = "user";
export const LAST_ACTIVITY_KEY = "session_last_activity";
export const EXPIRED_MSG_KEY = "session_expired_msg";
export const ADMIN_POPUP_STORAGE_PREFIX = "coftea_admin_notif_popup_";

let onSessionExpiredCallback = null;

/**
 * Registers a callback invoked with the expiring user object before localStorage is cleared
 * so the backend can clear current_session_id and write an inactivity LOGOUT audit log.
 */
export const registerSessionExpiredCallback = (cb) => {
  onSessionExpiredCallback = cb;
};

/**
 * Updates the last recorded activity timestamp to now
 */
export const touchSessionActivity = () => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {
    // Ignore storage quota or access errors
  }
};

/**
 * Checks if the current session has exceeded the inactivity limit
 */
export const isSessionExpired = () => {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!userJson) return false; // Not logged in

    const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActive) {
      // A session with no timestamp predates the timeout; treat it as expired.
      return true;
    }

    const elapsed = Date.now() - Number(lastActive);
    return elapsed > SESSION_TIMEOUT_MS;
  } catch {
    return false;
  }
};

/**
 * Clears user session from storage and optionally saves an expiration notice
 */
export const clearUserSession = (reason = null) => {
  try {
    let expiringUser = null;
    if (reason === "expired") {
      try {
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        if (raw) expiringUser = JSON.parse(raw);
      } catch {
        expiringUser = null;
      }
    }

    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem('coftea_active_tab');
    localStorage.removeItem('coftea_reports_active_tab');
    localStorage.removeItem('coftea_forecasting_tab');
    localStorage.removeItem('coftea_suppliers_tab');
    localStorage.removeItem('coftea_cms_tab');
    localStorage.removeItem('coftea_request_tab');
    if (typeof sessionStorage !== 'undefined') {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(ADMIN_POPUP_STORAGE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (reason === "expired") {
      if (expiringUser && typeof onSessionExpiredCallback === "function") {
        try {
          onSessionExpiredCallback(expiringUser);
        } catch {
          // Ignore callback errors
        }
      }
      sessionStorage.setItem(
        EXPIRED_MSG_KEY,
        JSON.stringify({
          title: "Session Timed Out",
          message: "Your session timed out after 2 hours of inactivity. Please log in again."
        })
      );
    } else if (reason === "replaced") {
      sessionStorage.setItem(
        EXPIRED_MSG_KEY,
        JSON.stringify({
          title: "Signed Out on Another Device",
          message: "This account was signed in on another device or window. Only one active session is allowed at a time."
        })
      );
    } else if (reason === "deactivated") {
      sessionStorage.setItem(
        EXPIRED_MSG_KEY,
        JSON.stringify({
          title: "Account Archived",
          message: "Your account has been archived by an administrator. Active session terminated."
        })
      );
    }
  } catch {
    // Ignore storage errors
  }
};

/**
 * Get current user from localStorage with automatic expiration validation
 */
export const getCurrentUser = () => {
  try {
    if (isSessionExpired()) {
      clearUserSession("expired");
      return null;
    }
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
};

/**
 * Check if user is authorized to access POS
 */
export const isAuthorized = (user) => {
  return user && ["ADMIN", "STAFF", "Owner", "Admin", "Staff"].includes(user.role);
};
