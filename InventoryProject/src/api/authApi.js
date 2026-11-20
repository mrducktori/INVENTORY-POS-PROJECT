// Authentication API endpoints
import { apiCall, API_BASE_URL } from "./client.js";
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
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }
  const parsed = data && typeof data === "object" && !Array.isArray(data) ? data : null;
  if (!response.ok) {
    const err = new Error(parsed?.error || rawText.trim() || "Login failed");
    err.locked       = parsed?.locked       ?? false;
    err.secondsLeft  = parsed?.secondsLeft  ?? 0;
    err.attemptsLeft = parsed?.attemptsLeft ?? null;
    throw err;
  }
  if (!parsed) {
    throw new Error("Invalid login response from server");
  }
  return parsed;
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

/**
 * Lightweight heartbeat to notify the server that the current user is actively interacting.
 */
export async function pingUserActivity() {
  try {
    await apiCall("/auth/activity", { method: "POST" });
  } catch {
    // Ignore transient network errors
  }
}
