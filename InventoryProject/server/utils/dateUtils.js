/**
 * Returns a Date whose local-time fields show Manila wall-clock time. Use it only to read
 * those fields; its epoch value is shifted and must not be used as an instant.
 */
export const getManilaDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
};

/** Returns the current Manila time as an ISO string with a +08:00 offset. */
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

export const getManilaDateOnly = () => {
  const d = getManilaDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Formats a date for display in Manila time, or an em dash when empty. */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila'
  });
};

/** Returns YYYY-MM-DD in Asia/Manila for a Date or date-like value. */
export const getManilaDateString = (dateInput = new Date()) => {
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(parsed.getTime())) {
    return getManilaDateOnly();
  }
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
};

/**
 * Returns the start of a Manila day as an ISO string with +08:00.
 * Accepts plain YYYY-MM-DD or a full ISO string.
 * Example: "2026-10-23" -> "2026-10-23T00:00:00.000+08:00"
 */
export const toManilaStartOfDay = (dateInput) => {
  if (!dateInput) return null;
  const trimmed = typeof dateInput === 'string' ? dateInput.trim() : '';
  const dStr = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : getManilaDateString(dateInput);
  return `${dStr}T00:00:00.000+08:00`;
};

/**
 * Returns the end of a Manila day as an ISO string with +08:00.
 * Accepts plain YYYY-MM-DD or a full ISO string.
 * Example: "2026-10-23" -> "2026-10-23T23:59:59.999+08:00"
 */
export const toManilaEndOfDay = (dateInput) => {
  if (!dateInput) return null;
  const trimmed = typeof dateInput === 'string' ? dateInput.trim() : '';
  const dStr = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : getManilaDateString(dateInput);
  return `${dStr}T23:59:59.999+08:00`;
};

export const getStartOfDay = toManilaStartOfDay;
export const getEndOfDay = toManilaEndOfDay;

