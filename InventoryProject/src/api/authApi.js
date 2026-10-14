// Authentication API endpoints
import { apiCall } from "./client.js";
import {
  getCurrentUser,
  touchSessionActivity,
  clearUserSession,
  USER_STORAGE_KEY,
  EXPIRED_MSG_KEY
} from "../utils/authUtils.js";

// Re-export getCurrentUser for existing consumers
export { getCurrentUser };

/**
 * Login with username and password.
 * Propagates lockout fields (locked, secondsLeft, attemptsLeft) on the thrown Error
 * so the UI can show a proper countdown without inspecting raw HTTP responses.
 */
export async function loginUser(username, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error || "Login failed");
    err.locked      = data.locked      ?? false;
    err.secondsLeft = data.secondsLeft ?? 0;
    err.attemptsLeft = data.attemptsLeft ?? null;
    throw err;
  }
  return data;
}

/**
 * Logout user — notifies server for audit log, then clears localStorage session
 */
export async function logoutUser() {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
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
    clearUserSession();
  }
}

/**
 * Save user to local storage and activate session activity timestamp
 */
export function saveUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  touchSessionActivity();
  try {
    sessionStorage.removeItem(EXPIRED_MSG_KEY);
  } catch {
    // Ignore storage errors
  }
}
