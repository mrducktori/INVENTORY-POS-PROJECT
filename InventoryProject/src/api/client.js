// Central API client: every backend call goes through apiCall.
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

  // Protected request past the 2h inactivity timeout: clear the session and send the user to login.
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

    // Only user-initiated mutations refresh the activity timestamp; background GET polls must not
    // keep an idle session alive.
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

// When a session expires from inactivity, tell the backend so users.current_session_id is cleared
// (shows Offline in Account Manager) and a LOGOUT row is written to audit_logs.
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
