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
 * Adds a whole number of calendar days to a YYYY-MM-DD Manila date string.
 */
export const addDaysManila = (dateStr, days) => {
  const baseStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim())
    ? String(dateStr).trim()
    : getManilaDateOnly();
  const d = new Date(`${baseStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (parseInt(days, 10) || 0));
  return d.toISOString().split('T')[0];
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

/**
 * Checks if a YYYY-MM-DD or ISO date string is strictly before Manila today
 */
export const isDatePast = (dateStr) => {
  if (!dateStr) return false;
  const today = getManilaDateOnly();
  const dOnly = String(dateStr).split('T')[0];
  return dOnly < today;
};

/**
 * Computes how many calendar days overdue a date is relative to Manila today
 */
export const getDaysOverdue = (dateStr) => {
  if (!dateStr || !isDatePast(dateStr)) return 0;
  const today = getManilaDateOnly();
  const dOnly = String(dateStr).split('T')[0];
  const diffMs = new Date(today + 'T00:00:00') - new Date(dOnly + 'T00:00:00');
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

const toManilaBoundary = (dateInput, timeSuffix) => {
  if (!dateInput) return null;
  let dStr;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    dStr = dateInput.trim();
  } else {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput || '');
      dStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    } catch {
      dStr = getManilaDateOnly();
    }
  }
  return `${dStr}T${timeSuffix}+08:00`;
};

/**
 * Returns an ISO-formatted start of day in Manila timezone (+08:00)
 */
export const toManilaStartOfDay = (dateInput) => toManilaBoundary(dateInput, '00:00:00');

/**
 * Returns an ISO-formatted end of day in Manila timezone (+08:00)
 */
export const toManilaEndOfDay = (dateInput) => toManilaBoundary(dateInput, '23:59:59.999');

/**
 * Computes start and end ISO strings in Manila timezone for period presets
 */
export const getPeriodDateRange = (period = 'weekly') => {
  const mDate = getManilaDate();
  const todayStr = getManilaDateOnly();
  let startStr = todayStr;

  if (period === 'daily') {
    startStr = todayStr;
  } else if (period === 'weekly') {
    mDate.setDate(mDate.getDate() - 6);
    const pad = (n) => String(n).padStart(2, '0');
    startStr = `${mDate.getFullYear()}-${pad(mDate.getMonth() + 1)}-${pad(mDate.getDate())}`;
  } else if (period === 'monthly') {
    const pad = (n) => String(n).padStart(2, '0');
    startStr = `${mDate.getFullYear()}-${pad(mDate.getMonth() + 1)}-01`;
  }

  return {
    startDate: `${startStr}T00:00:00+08:00`,
    endDate: `${todayStr}T23:59:59.999+08:00`
  };
};


