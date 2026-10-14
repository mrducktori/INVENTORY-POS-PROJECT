import { supabase } from '../config/supabaseClient.js';
import jwt from 'jsonwebtoken';

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

    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, role, status')
      .eq('id', decoded.userId)
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
