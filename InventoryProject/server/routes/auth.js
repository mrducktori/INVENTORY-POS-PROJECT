import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";

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
    await logAudit("LOGIN", data.id, { username: data.username, role: data.role });

    const { password_hash: _password_hash, ...userWithoutPassword } = data;
    
    // Create JWT token
    const token = jwt.sign(
      { userId: data.id, role: data.role },
      process.env.JWT_SECRET || 'fallback-secret-key-change-me',
      { expiresIn: '8h' }
    );
    
    res.json({ token, ...userWithoutPassword });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT — called by frontend before clearing localStorage
router.post("/logout", async (req, res) => {
  try {
    const { user_id, username, role } = req.body;
    await logAudit("LOGOUT", user_id || null, { username, role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
