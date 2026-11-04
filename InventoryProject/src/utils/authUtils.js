// Session timeout configuration: 2 hours in milliseconds
export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const USER_STORAGE_KEY = "user";
export const LAST_ACTIVITY_KEY = "session_last_activity";
export const EXPIRED_MSG_KEY = "session_expired_msg";

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
      // Legacy session without timestamp — treat as expired to force fresh timed session
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
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    if (reason === "expired") {
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
