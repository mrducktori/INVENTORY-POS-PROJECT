// Centralized API client for all backend calls
// Using a relative path so this works in both:
//   - Development: Vite proxy forwards /api → http://localhost:5000
//   - Production:  Same domain, /api is served by the Node.js app
import {
  isSessionExpired,
  clearUserSession,
  touchSessionActivity,
  registerSessionExpiredCallback,
  USER_STORAGE_KEY
} from "../utils/authUtils.js";

/**
 * Determine the API base URL:
 * - If VITE_API_URL is configured (e.g. "https://coftea-backend.onrender.com"),
 *   ensures it ends with "/api" and trims any trailing slashes.
 * - Otherwise falls back to relative "/api", which works with:
 *     1. Local Vite dev proxy (forwards /api → http://localhost:5000)
 *     2. Same-domain deployments (e.g. cPanel)
 *     3. Vercel serverless rewrites (if configured)
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return "/api";
  const trimmed = envUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Returns the currently logged-in user's JWT token from localStorage.
 * Returns null if no session exists (e.g. on the login page).
 */
function getSessionToken() {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    return userJson ? JSON.parse(userJson)?.token : null;
  } catch {
    return null;
  }
}

/**
 * Centralized fetch function with error handling and inactivity checking.
 * Automatically injects Authorization header so the backend auth middleware
 * can validate the session on every protected request.
 */
export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Endpoints that run outside a session — skip the auth header & session check
  const PUBLIC_ENDPOINTS = ["/auth/login"];
  const isGet = !options.method || options.method === "GET";
  const isPublic = PUBLIC_ENDPOINTS.some(p => endpoint.startsWith(p)) || 
    ((endpoint.startsWith("/cms") || endpoint.startsWith("/pos/products")) && isGet);

  // If this is a protected request and the session timed out (2h inactivity)
  if (!isPublic && endpoint !== "/auth/logout" && isSessionExpired()) {
    clearUserSession("expired");
    if (window.location.pathname !== "/coftealoginpageforstaff") {
      window.location.href = "/coftealoginpageforstaff";
    }
    const err = new Error("Session expired due to inactivity");
    err.status = 401;
    throw err;
  }

  const token = isPublic ? null : getSessionToken();

  const defaultOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      // Merge any headers the caller explicitly passed
      ...(options.headers || {})
    }
  };

  try {
    let response;
    try {
      response = await fetch(url, { ...defaultOptions, signal: options.signal ?? AbortSignal.timeout(20000) });
    } catch (netErr) {
      if (netErr?.name === "AbortError" || netErr?.name === "TimeoutError" || netErr instanceof TypeError) {
        throw new Error("Network problem. Check the connection and try again.", { cause: netErr });
      }
      throw netErr;
    }
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Server error (${response.status})` };
    }

    if (!response.ok) {
      // If the server says our session is invalid, force a logout and redirect
      if ((response.status === 401 || (response.status === 403 && data.code === "ACCOUNT_DEACTIVATED")) && window.location.pathname !== "/coftealoginpageforstaff") {
        const reason = data.code === "ACCOUNT_DEACTIVATED" ? "deactivated" : (data.code === "SESSION_REPLACED" ? "replaced" : "expired");
        clearUserSession(reason);
        window.location.href = "/coftealoginpageforstaff";
      }
      const err = new Error(data.error || `API Error: ${response.status}`);
      err.payload = data;
      err.code = data.code;
      err.status = response.status;
      throw err;
    }

    // Refresh activity timestamp on explicit user-initiated mutating actions (not background GET polls)
    const method = (options.method || "GET").toUpperCase();
    if (!isPublic && method !== "GET" && endpoint !== "/auth/logout") {
      touchSessionActivity();
    }

    return data;
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    throw error;
  }
}

// Automatically notify the backend whenever a session expires due to inactivity
// so users.current_session_id is cleared (Offline in Account Manager) and LOGOUT is recorded in audit_logs.
registerSessionExpiredCallback((expiringUser) => {
  if (!expiringUser) return;
  apiCall("/auth/logout", {
    method: "POST",
    keepalive: true,
    headers: expiringUser.token ? { Authorization: `Bearer ${expiringUser.token}` } : {},
    body: JSON.stringify({
      reason: "inactivity",
      user_id: expiringUser.id,
      username: expiringUser.username,
      role: expiringUser.role
    })
  }).catch(() => {});
});
