// Authentication API endpoints
import { apiCall } from "./client.js";

/**
 * Login with username and password
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>} User object
 */
export async function loginUser(username, password) {
  return apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

/**
 * Logout user (clears local storage)
 */
export function logoutUser() {
  localStorage.removeItem("user");
}

/**
 * Get current logged-in user from storage
 * @returns {Object|null} User object or null
 */
export function getCurrentUser() {
  const userJson = localStorage.getItem("user");
  return userJson ? JSON.parse(userJson) : null;
}

/**
 * Save user to local storage
 * @param {Object} user User object to save
 */
export function saveUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}
