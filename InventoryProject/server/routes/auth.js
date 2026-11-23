import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  getJwtSecret,
  invalidateUserAuthCache,
  touchUserServerActivity,
  getUserServerActivity,
  clearUserServerActivity,
  reapInactiveUserSessions,
  requireAuth,
  SESSION_INACTIVITY_TIMEOUT_MS
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── In-memory lockout store, keyed by `${ip}|${username_lowercase}` so one IP cannot lock the owner out for everyone.
// Map<string, { attempts: number, lockedUntil: number|null, last: number }>
const loginAttempts = new Map();
const MAX_ATTEMPTS  = 3;
const LOCK_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const MAX_TRACKED   = 1000;
// Compared against when the user is missing/unverifiable so response timing does not reveal account existence.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

function getLockout(key) {
  const now = Date.now();
  if (loginAttempts.size > MAX_TRACKED) {
    for (const [k, v] of loginAttempts) {
      if (now - v.last > LOCK_DURATION) loginAttempts.delete(k);
    }
  }
  let record = loginAttempts.get(key);
  if (!record) {
    record = { attempts: 0, lockedUntil: null, last: now };
    loginAttempts.set(key, record);
  }
  return record;
}

function resetLockout(key) {
  loginAttempts.delete(key);
}

function recordFailedAttempt(key) {
  const record = getLockout(key);
  record.attempts += 1;
  record.last = Date.now();
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION;
  }
}

// FIX #8: Removed the /test endpoint that publicly dumped all users and password_hash fields.

// LOGIN — Public route (no auth required)
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const key = `${req.ip}|${username.toLowerCase()}`;

    // ── Lockout check ──────────────────────────────────────────────────────────
    const record = getLockout(key);
    if (record.lockedUntil && record.lockedUntil > Date.now()) {
      const secondsLeft = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: `Account temporarily locked. Try again in ${secondsLeft} seconds.`,
        locked: true,
        secondsLeft
      });
    }
    // Reset expired lockout so fresh attempts start from 0
    if (record.lockedUntil && record.lockedUntil <= Date.now()) {
      resetLockout(key);
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[login] user lookup failed:", error);
      return res.status(503).json({ error: "Service temporarily unavailable. Please retry." });
    }

    // FIX #9: No plaintext fallback. Only bcrypt hashes are verifiable; anything else compares against the dummy hash.
    const hashOk = !!data && typeof data.password_hash === "string" && data.password_hash.startsWith("$2");
    const passwordMatches = await bcrypt.compare(password, hashOk ? data.password_hash : DUMMY_HASH);

    const failReason = !data ? "User not found"
      : !hashOk ? "Password not hashed — requires admin reset"
      : !passwordMatches ? "Wrong password"
      : data.status !== "ACTIVE" ? "Account inactive"
      : null;

    if (failReason) {
      recordFailedAttempt(key);
      const rec = getLockout(key);
      void logAudit("LOGIN_FAILED", data?.id ?? null, { username, reason: failReason });
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
    resetLockout(key);

    // Check only this user's previous session activity without blocking login on a full-table reap scan
    let hadActiveSession = false;
    if (data.current_session_id) {
      let lastActiveMs = getUserServerActivity(data.id);
      if (!lastActiveMs) {
        const { data: latestLogs } = await supabase
          .from("audit_logs")
          .select("created_at")
          .eq("user_id", data.id)
          .order("created_at", { ascending: false })
          .limit(1);
        lastActiveMs = latestLogs?.[0]?.created_at
          ? new Date(latestLogs[0].created_at).getTime()
          : 0;
      }
      hadActiveSession = Date.now() - lastActiveMs <= SESSION_INACTIVITY_TIMEOUT_MS;
    }

    // Trigger periodic stale-session reaper in background without delaying login
    void reapInactiveUserSessions(false);

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

    if (sessionTracked && hadActiveSession) {
      void logAudit("SESSION_REPLACED", data.id, { username: data.username });
    }
    touchUserServerActivity(data.id);
    invalidateUserAuthCache(data.id);
    void logAudit("LOGIN", data.id, { username: data.username, role: data.role });

    const {
      password_hash: _password_hash,
      current_session_id: _previousSession,
      ...userWithoutPassword
    } = data;
    
    // Create JWT token (sid ties the token to this specific session)
    const token = jwt.sign(
      { userId: data.id, role: data.role, sid: sessionId },
      getJwtSecret(),
      { expiresIn: '8h' }
    );
    
    res.json({ token, ...userWithoutPassword });

  } catch (err) {
    console.error("[login] error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ACTIVITY — Lightweight heartbeat that updates the user's server-side last-active timestamp.
// requireAuth validates session id/status so a replaced or deactivated session cannot stay "active".
router.post("/activity", requireAuth, (req, res) => {
  touchUserServerActivity(req.user.id);
  res.json({ ok: true });
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
      // Allow ignoreExpiration so an inactivity-expired token still clears current_session_id and logs out cleanly
      decoded = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true });
    } catch {
      return res.json({ success: true });
    }

    const isInactivity = req.body?.reason === "inactivity";

    // Only clear the session if this token is still the active one,
    // so an old device logging out cannot sign out the newer device.
    const { data } = await supabase
      .from("users")
      .update({ current_session_id: null })
      .eq("id", decoded.userId)
      .eq("current_session_id", decoded.sid)
      .select("id, username, role");

    if (data && data.length > 0) {
      clearUserServerActivity(data[0].id);
      invalidateUserAuthCache(data[0].id);
      await logAudit("LOGOUT", data[0].id, {
        username: data[0].username,
        role: data[0].role,
        ...(isInactivity ? { reason: "Inactivity timeout" } : {})
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[Logout]", err);
    res.json({ success: true });
  }
});

export default router;
