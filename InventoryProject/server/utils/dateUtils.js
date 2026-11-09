/**
 * Date Utilities for Philippine Timezone (Asia/Manila)
 */

/**
 * Returns a Date object adjusted to Manila time
 */
export const getManilaDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
};

/**
 * Returns an ISO string with +08:00 offset representing current Manila time
 */
export const getManilaISOString = () => {
  const now = getManilaDate();
  const pad = (n) => String(n).padStart(2, '0');
  
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const sec = pad(now.getSeconds());
  
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}+08:00`;
};

/**
 * Returns YYYY-MM-DD string for Manila today
 */
export const getManilaDateOnly = () => {
  const d = getManilaDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Formats any date string to local string
 */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila'
  });
};

/**
 * Returns an ISO-formatted start of day in Manila timezone (+08:00)
 * Example: "2026-10-23" -> "2026-10-23T00:00:00+08:00"
 * Handles both plain YYYY-MM-DD and full ISO strings with timezone
 */
export const toManilaStartOfDay = (dateInput) => {
  if (!dateInput) return null;
  let dStr;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    dStr = dateInput.trim();
  } else {
    try {
      dStr = new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    } catch {
      dStr = getManilaDateOnly();
    }
  }
  return `${dStr}T00:00:00+08:00`;
};

/**
 * Returns an ISO-formatted end of day in Manila timezone (+08:00)
 * Example: "2026-10-23" -> "2026-10-23T23:59:59.999+08:00"
 * Handles both plain YYYY-MM-DD and full ISO strings with timezone
 */
export const toManilaEndOfDay = (dateInput) => {
  if (!dateInput) return null;
  let dStr;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    dStr = dateInput.trim();
  } else {
    try {
      dStr = new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    } catch {
      dStr = getManilaDateOnly();
    }
  }
  return `${dStr}T23:59:59.999+08:00`;
};

