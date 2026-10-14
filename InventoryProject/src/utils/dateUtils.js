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
 * Safely parses any date string from Supabase (which may be UTC without a 'Z' suffix)
 * into a proper Date object.
 */
export const parseUTCDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  let str = String(dateStr).trim();
  if (str.includes('T') || str.includes(' ')) {
    const timePart = str.split(/[T ]/)[1];
    if (timePart && !str.endsWith('Z') && !timePart.includes('+') && !timePart.includes('-')) {
      str = str.replace(' ', 'T') + 'Z';
    }
  }
  return new Date(str);
};

/**
 * Formats any date string to local Manila date string (e.g. Oct 7, 2026, 3:00 PM)
 */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = parseUTCDate(dateStr);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila'
  });
};

/**
 * Formats date and time with explicit Asia/Manila timezone
 */
export const formatDisplayDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = parseUTCDate(dateStr);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila'
  });
};

