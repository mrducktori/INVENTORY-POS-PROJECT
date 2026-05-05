// Authentication API endpoints
import { apiCall } from "./client.js";

/**
 * Login with username and password
 */
export async function loginUser(username, password) {
  return apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

/**
 * Logout user — notifies server for audit log, then clears localStorage
 */
export async function logoutUser() {
  try {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      const user = JSON.parse(userJson);
      // Fire-and-forget: tell the server so the audit log is written
      await apiCall("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, username: user.username, role: user.role })
      });
    }
  } catch {
    // Don't block logout if the server call fails
  } finally {
    localStorage.removeItem("user");
  }
}

/**
 * Get current logged-in user from storage
 */
export function getCurrentUser() {
  const userJson = localStorage.getItem("user");
  return userJson ? JSON.parse(userJson) : null;
}

/**
 * Save user to local storage
 */
export function saveUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}
