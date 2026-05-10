// Authentication API endpoints
import { apiCall } from "./client.js";

/**
 * Login with username and password
 */
/**
 * Login with username and password.
 * Propagates lockout fields (locked, secondsLeft, attemptsLeft) on the thrown Error
 * so the UI can show a proper countdown without inspecting raw HTTP responses.
 */
export async function loginUser(username, password) {
  const response = await fetch("http://localhost:5000/api/auth/login", {
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
