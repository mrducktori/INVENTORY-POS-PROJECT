import { supabase } from '../config/supabaseClient.js';
import jwt from 'jsonwebtoken';

// Short-lived in-memory cache so bursts of parallel requests from the same page load
// do not trigger 8-12 redundant database round-trips to `users` for the same JWT.
const userAuthCache = new Map();
const AUTH_CACHE_TTL_MS = 20 * 1000; // 20 seconds
let hasCurrentSessionIdCol = true;

export const invalidateUserAuthCache = (userId) => {
  if (!userId) {
    userAuthCache.clear();
    return;
  }
  userAuthCache.delete(String(userId));
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
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

    // Single active session: only enforce when current_session_id column exists
    if (data.current_session_id !== undefined && data.current_session_id !== null) {
      if (!decoded.sid || decoded.sid !== data.current_session_id) {
        return res.status(401).json({
          error: 'Your account was signed in on another device.',
          code: 'SESSION_REPLACED'
        });
      }
    }

    const { current_session_id: _sid, ...user } = data;
    req.user = user;
    next();
  } catch (err) {
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
