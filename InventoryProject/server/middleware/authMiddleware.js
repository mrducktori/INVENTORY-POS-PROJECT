import { supabase } from '../config/supabaseClient.js';

/**
 * requireAuth — Validates the x-user-id header against the users table.
 * Falls back to req.body.user_id for backward compatibility with existing frontend calls.
 * Attaches the validated user object to req.user.
 */
export const requireAuth = async (req, res, next) => {
  // Accept from header (preferred) or body (legacy fallback)
  const userId = req.headers['x-user-id'] || req.body?.user_id || req.body?.staff_id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, role, status')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid session. Please log in again.' });
    }

    if (data.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
    }

    req.user = data;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication check failed.' });
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
