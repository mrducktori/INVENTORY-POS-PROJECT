import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { invalidateUserAuthCache } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── In-memory lockout store 
// { username_lowercase: { attempts: number, lockedUntil: Date|null } }
const loginAttempts = {};
const MAX_ATTEMPTS  = 3;
const LOCK_DURATION = 5 * 60 * 1000; // 5 minutes in ms

function getLockout(username) {
  const key = username.toLowerCase();
  if (!loginAttempts[key]) loginAttempts[key] = { attempts: 0, lockedUntil: null };
  return loginAttempts[key];
}

function resetLockout(username) {
  const key = username.toLowerCase();
  loginAttempts[key] = { attempts: 0, lockedUntil: null };
}

function recordFailedAttempt(username) {
  const record = getLockout(username);
  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = new Date(Date.now() + LOCK_DURATION);
  }
}

// FIX #8: Removed the /test endpoint that publicly dumped all users and password_hash fields.

// LOGIN — Public route (no auth required)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // ── Lockout check ──────────────────────────────────────────────────────────
    const record = getLockout(username);
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      const secondsLeft = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: `Account temporarily locked. Try again in ${secondsLeft} seconds.`,
        locked: true,
        secondsLeft
      });
    }
    // Reset expired lockout so fresh attempts start from 0
    if (record.lockedUntil && record.lockedUntil <= new Date()) {
      resetLockout(username);
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      recordFailedAttempt(username);
      const rec = getLockout(username);
      await logAudit("LOGIN_FAILED", null, { username, reason: "User not found" });
      if (rec.lockedUntil) {
        return res.status(429).json({
          error: `Too many failed attempts. Account locked for 5 minutes.`,
          locked: true,
          secondsLeft: Math.ceil(LOCK_DURATION / 1000)
        });
      }
      return res.status(401).json({
        error: "Invalid username or password",
        attemptsLeft: MAX_ATTEMPTS - rec.attempts
      });
    }

    if (data.status !== "ACTIVE") {
      await logAudit("LOGIN_FAILED", data.id, { username, reason: "Account inactive" });
      return res.status(401).json({ error: "User account is not active" });
    }

    // FIX #9: Removed plaintext password fallback. All passwords MUST be bcrypt hashed.
    if (!data.password_hash || !data.password_hash.startsWith('$2')) {
      await logAudit("LOGIN_FAILED", data.id, { username, reason: "Password not hashed — requires admin reset" });
      return res.status(401).json({ error: "Your account requires a password reset. Please contact an administrator." });
    }

    const isPasswordValid = await bcrypt.compare(password, data.password_hash);

    if (!isPasswordValid) {
      recordFailedAttempt(username);
      const rec = getLockout(username);
      await logAudit("LOGIN_FAILED", data.id, { username, reason: "Wrong password" });
      if (rec.lockedUntil) {
        return res.status(429).json({
          error: `Too many failed attempts. Account locked for 5 minutes.`,
          locked: true,
          secondsLeft: Math.ceil(LOCK_DURATION / 1000)
        });
      }
      return res.status(401).json({
        error: "Invalid username or password",
        attemptsLeft: MAX_ATTEMPTS - rec.attempts
      });
    }

    // Successful login — clear any previous failure record
    resetLockout(username);

    // Single active session: a new login replaces the previous session,
    // which signs out any other device using this account.
    const sessionId = crypto.randomUUID();
    let sessionTracked = false;
    try {
      const { error: sessionError } = await supabase
        .from("users")
        .update({ current_session_id: sessionId })
        .eq("id", data.id);
      if (sessionError) {
        console.warn("Notice: current_session_id update skipped (column or schema cache pending):", sessionError.message);
      } else {
        sessionTracked = true;
      }
    } catch (sErr) {
      console.warn("Notice: session tracking update failed:", sErr.message);
    }

    if (sessionTracked && data.current_session_id) {
      await logAudit("SESSION_REPLACED", data.id, { username: data.username });
    }
    invalidateUserAuthCache(data.id);
    await logAudit("LOGIN", data.id, { username: data.username, role: data.role });

    const {
      password_hash: _password_hash,
      current_session_id: _previousSession,
      ...userWithoutPassword
    } = data;
    
    // Create JWT token (sid ties the token to this specific session)
    const token = jwt.sign(
      { userId: data.id, role: data.role, sid: sessionId },
      process.env.JWT_SECRET || 'fallback-secret-key-change-me',
      { expiresIn: '8h' }
    );
    
    res.json({ token, ...userWithoutPassword });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT — identity comes from the token, never from the request body.
// Always responds 200 so the client can finish signing out locally.
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!token) return res.json({ success: true });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
    } catch {
      return res.json({ success: true });
    }

    // Only clear the session if this token is still the active one,
    // so an old device logging out cannot sign out the newer device.
    const { data } = await supabase
      .from("users")
      .update({ current_session_id: null })
      .eq("id", decoded.userId)
      .eq("current_session_id", decoded.sid)
      .select("id, username, role");

    if (data && data.length > 0) {
      invalidateUserAuthCache(data[0].id);
      await logAudit("LOGOUT", data[0].id, { username: data[0].username, role: data[0].role });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[Logout]", err);
    res.json({ success: true });
  }
});

export default router;
