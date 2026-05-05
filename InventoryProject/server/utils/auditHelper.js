import { supabase } from '../config/supabaseClient.js';

// A fallback system UUID used when no real user is known (e.g. failed login attempts).
// This should be a user that exists in your `users` table, OR the DB column must allow NULL.
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'; // your admin user

/**
 * Write a single audit log entry.
 * @param {string} action  - Short action label e.g. "LOGIN", "PRODUCT_CREATED"
 * @param {string|null} userId - ID of the user performing the action
 * @param {object} details - Any extra info to attach (name, category, changes, etc.)
 */
export async function logAudit(action, userId, details = {}) {
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      action,
      user_id: userId || SYSTEM_USER_ID,
      details
    }]);
    if (error) {
      console.error('[AUDIT] Insert failed:', error.message, '| Action:', action);
    }
  } catch (err) {
    // Never crash the main request because of a failed audit write
    console.error('[AUDIT] Exception writing log:', err.message);
  }
}
