import { supabase } from '../config/supabaseClient.js';

let cachedArchiveMap = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

export const invalidateArchiveMap = () => {
  cachedArchiveMap = null;
  lastCacheTime = 0;
};

/**
 * Returns maps of latest archived_at ISO timestamps for products, ingredients, and users
 * based on audit logs.
 */
export const getArchiveTimestampsMap = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedArchiveMap && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedArchiveMap;
  }

  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('action, details, created_at')
      .in('action', ['PRODUCT_ARCHIVED', 'RAW_MATERIAL_ARCHIVED', 'USER_STATUS_CHANGED'])
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;

    const products = {};
    const ingredients = {};
    const users = {};

    for (const log of logs || []) {
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      if (!details) continue;

      if (log.action === 'PRODUCT_ARCHIVED' && details.product_id && !products[details.product_id]) {
        products[details.product_id] = log.created_at;
      }
      if (log.action === 'RAW_MATERIAL_ARCHIVED' && details.ingredient_id && !ingredients[details.ingredient_id]) {
        ingredients[details.ingredient_id] = log.created_at;
      }
      if (
        log.action === 'USER_STATUS_CHANGED' &&
        details.target_user_id &&
        details.new_status === 'INACTIVE' &&
        !users[details.target_user_id]
      ) {
        users[details.target_user_id] = log.created_at;
      }
    }

    cachedArchiveMap = { products, ingredients, users };
    lastCacheTime = now;
    return cachedArchiveMap;
  } catch (err) {
    console.error('Error fetching archive timestamps map:', err);
    return cachedArchiveMap || { products: {}, ingredients: {}, users: {} };
  }
};

/**
 * Calculate days elapsed since archived_at date.
 */
export const getDaysSinceArchived = (archivedAt) => {
  if (!archivedAt) return 0;
  const diffMs = Date.now() - new Date(archivedAt).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
};
