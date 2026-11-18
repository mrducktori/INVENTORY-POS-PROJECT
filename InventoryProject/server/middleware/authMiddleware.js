import { supabase } from '../config/supabaseClient.js';
import { logAudit } from '../utils/auditHelper.js';
import jwt from 'jsonwebtoken';

// Short-lived in-memory cache so bursts of parallel requests from the same page load
// do not trigger 8-12 redundant database round-trips to `users` for the same JWT.
const userAuthCache = new Map();
const AUTH_CACHE_TTL_MS = 20 * 1000; // 20 seconds
let hasCurrentSessionIdCol = true;

// Server-side activity tracker: maps userId -> last active timestamp (ms)
export const SESSION_INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const userLastActivityMap = new Map();
let lastReapCheckAt = 0;
let reapInFlight = null;

export const touchUserServerActivity = (userId) => {
  if (!userId) return;
  userLastActivityMap.set(String(userId), Date.now());
};

export const getUserServerActivity = (userId) => {
  if (!userId) return null;
  return userLastActivityMap.get(String(userId)) || null;
};

export const clearUserServerActivity = (userId) => {
  if (!userId) return;
  userLastActivityMap.delete(String(userId));
};

export const invalidateUserAuthCache = (userId) => {
  if (!userId) {
    userAuthCache.clear();
    return;
  }
  userAuthCache.delete(String(userId));
};

/**
 * Checks all users who currently have an active `current_session_id` and automatically
 * logs out any session whose last activity exceeded SESSION_INACTIVITY_TIMEOUT_MS,
 * clearing `current_session_id = null` and writing a LOGOUT (Inactivity timeout) audit log.
 */
export const reapInactiveUserSessions = async (force = false) => {
  if (!hasCurrentSessionIdCol) return;
  const now = Date.now();
  if (!force && now - lastReapCheckAt < 30000) return;
  if (reapInFlight) return reapInFlight;

  lastReapCheckAt = now;
  reapInFlight = (async () => {
    try {
      const { data: onlineUsers, error } = await supabase
        .from('users')
        .select('id, name, username, role, current_session_id')
        .not('current_session_id', 'is', null);

      if (error || !onlineUsers || onlineUsers.length === 0) return;

      for (const u of onlineUsers) {
        const uid = String(u.id);
        let lastActiveMs = userLastActivityMap.get(uid);

        // If the server restarted or hasn't seen this user in memory yet, check their latest audit_logs entry
        if (!lastActiveMs) {
          const { data: latestLogs } = await supabase
            .from('audit_logs')
            .select('created_at')
            .eq('user_id', u.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (latestLogs && latestLogs.length > 0 && latestLogs[0].created_at) {
            lastActiveMs = new Date(latestLogs[0].created_at).getTime();
            userLastActivityMap.set(uid, lastActiveMs);
          } else {
            // No audit log history found — treat as expired
            lastActiveMs = 0;
          }
        }

        if (now - lastActiveMs > SESSION_INACTIVITY_TIMEOUT_MS) {
          const { data: cleared } = await supabase
            .from('users')
            .update({ current_session_id: null })
            .eq('id', u.id)
            .eq('current_session_id', u.current_session_id)
            .select('id, username, role');

          clearUserServerActivity(uid);
          invalidateUserAuthCache(uid);

          if (cleared && cleared.length > 0) {
            await logAudit('LOGOUT', u.id, {
              username: u.username,
              role: u.role,
              reason: 'Inactivity timeout'
            });
          }
        }
      }
    } catch (err) {
      console.warn('[SessionReaper] Failed to check inactive sessions:', err.message);
    } finally {
      reapInFlight = null;
    }
  })();

  return reapInFlight;
};

// Periodic background check every 60 seconds so stale sessions are reaped even when idle
setInterval(() => {
  reapInactiveUserSessions(false);
}, 60000).unref?.();

/**
 * Returns the configured JWT signing secret or throws if missing.
 * Evaluated at call time so ESM import hoisting does not precede dotenv loading.
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not configured.');
  }
  return secret;
};

/**
 * requireAuth — Validates the JWT token in the Authorization header.
 * Attaches the validated user object to req.user.
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const cacheKey = String(decoded.userId);
    const now = Date.now();
    const cached = userAuthCache.get(cacheKey);

    let data = null;
    let error = null;

    if (cached && now - cached.timestamp < AUTH_CACHE_TTL_MS) {
      data = cached.data;
    } else {
      const selectCols = hasCurrentSessionIdCol
        ? 'id, name, username, role, status, current_session_id'
        : 'id, name, username, role, status';

      const queryRes = await supabase
        .from('users')
        .select(selectCols)
        .eq('id', decoded.userId)
        .single();

      data = queryRes.data;
      error = queryRes.error;

      // Fallback if current_session_id is not yet in PostgREST schema cache
      if (error && error.message && error.message.includes('current_session_id')) {
        hasCurrentSessionIdCol = false;
        const fallback = await supabase
          .from('users')
          .select('id, name, username, role, status')
          .eq('id', decoded.userId)
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data) {
        userAuthCache.set(cacheKey, { data, timestamp: now });
      }
    }

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid session. Please log in again.' });
    }

    if (data.status !== 'ACTIVE') {
      userAuthCache.delete(cacheKey);
      return res.status(403).json({
        error: 'Your account has been deactivated. Contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Single active session & inactivity enforcement when current_session_id column exists
    if (data.current_session_id !== undefined) {
      if (data.current_session_id === null && decoded.sid) {
        userAuthCache.delete(cacheKey);
        return res.status(401).json({
          error: 'Your session timed out due to inactivity. Please log in again.',
          code: 'SESSION_EXPIRED'
        });
      }
      if (data.current_session_id !== null && (!decoded.sid || decoded.sid !== data.current_session_id)) {
        return res.status(401).json({
          error: 'Your account was signed in on another device.',
          code: 'SESSION_REPLACED'
        });
      }
    }

    if (req.method !== 'GET') {
      touchUserServerActivity(decoded.userId);
    }

    const { current_session_id: _sid, ...user } = data;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
};

/**
 * requireRole(...roles) — Checks that req.user has one of the allowed roles.
 * Must be used AFTER requireAuth.
 *
 * Usage: router.post('/', requireAuth, requireRole('Admin', 'Owner'), handler)
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
    });
  }
  next();
};
