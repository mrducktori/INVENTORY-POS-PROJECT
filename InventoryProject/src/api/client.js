// Centralized API client for all backend calls
const API_BASE_URL = "http://localhost:5000/api";

/**
 * Returns the currently logged-in user's ID from localStorage.
 * Returns null if no session exists (e.g. on the login page).
 */
function getSessionUserId() {
  try {
    const userJson = localStorage.getItem("user");
    return userJson ? JSON.parse(userJson)?.id : null;
  } catch {
    return null;
  }
}

/**
 * Centralized fetch function with error handling.
 * Automatically injects x-user-id header so the backend auth middleware
 * can validate the session on every protected request.
 */
export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Endpoints that run outside a session — skip the auth header
  const PUBLIC_ENDPOINTS = ["/auth/login", "/auth/logout", "/pos/products"];
  const isPublic = PUBLIC_ENDPOINTS.some(p => endpoint.startsWith(p));

  const userId = isPublic ? null : getSessionUserId();

  const defaultOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      // Merge any headers the caller explicitly passed
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(url, defaultOptions);
    const data = await response.json();

    if (!response.ok) {
      // If the server says our session is invalid, force a logout
      // Prevent infinite redirect if we are already on the login page ("/")
      if (response.status === 401 && window.location.pathname !== "/") {
        localStorage.removeItem("user");
        window.location.href = "/";
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    throw error;
  }
}

