// Centralized API client for all backend calls
// Using a relative path so this works in both:
//   - Development: Vite proxy forwards /api → http://localhost:5000
//   - Production:  Same domain, /api is served by the Node.js app
import {
  isSessionExpired,
  clearUserSession,
  touchSessionActivity,
  USER_STORAGE_KEY
} from "../utils/authUtils.js";

const API_BASE_URL = "/api";

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
  const PUBLIC_ENDPOINTS = ["/auth/login", "/auth/logout", "/pos/products"];
  const isPublic = PUBLIC_ENDPOINTS.some(p => endpoint.startsWith(p)) || 
    (endpoint.startsWith("/cms") && (!options.method || options.method === "GET"));

  // If this is a protected request and the session timed out (2h inactivity)
  if (!isPublic && isSessionExpired()) {
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
    const response = await fetch(url, defaultOptions);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Server error (${response.status})` };
    }

    if (!response.ok) {
      // If the server says our session is invalid, force a logout and redirect
      if (response.status === 401 && window.location.pathname !== "/coftealoginpageforstaff") {
        clearUserSession("expired");
        window.location.href = "/coftealoginpageforstaff";
      }
      const err = new Error(data.error || `API Error: ${response.status}`);
      err.payload = data;
      err.status = response.status;
      throw err;
    }

    // Refresh activity timestamp on successful authenticated action
    if (!isPublic) {
      touchSessionActivity();
    }

    return data;
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    throw error;
  }
}
