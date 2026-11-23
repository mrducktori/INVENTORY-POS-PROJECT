import React from 'react';

/**
 * Clean vector sort indicator (Strictly NO emojis per Rule 16).
 */
export const SortIcon = ({ active, direction, className = '' }) => {
  if (!active) {
    return (
      <svg
        className={`w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }
  if (direction === 'asc') {
    return (
      <svg
        className={`w-3.5 h-3.5 text-zinc-900 transition-colors shrink-0 ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    );
  }
  return (
    <svg
      className={`w-3.5 h-3.5 text-zinc-900 transition-colors shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
};

/** Small marker shown only when the AI nudged a forecast (aiFactor !== 1). */
const aiPctText = (f) => `${f > 1 ? '+' : '-'}${Math.abs(Math.round((f - 1) * 100))}%`;

export const AiAdjustBadge = ({ factor, reason }) => {
  if (factor == null || factor === 1) return null;
  return (
    <span
      title={`AI adjustment ${aiPctText(factor)}${reason ? `: ${reason}` : ''}`}
      className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-violet-50 text-violet-700 border-violet-200 align-middle"
    >
      AI {aiPctText(factor)}
    </span>
  );
};

/**
 * Stock status for an ingredient row, from the server's reorder-plan alert.
 */
export const IngredientAlertBadge = ({ alert, daysOfCover, blockedProducts }) => {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border';
  if (alert === 'CANNOT_MAKE') {
    const names = (blockedProducts || []).map((p) => p.name).join(', ');
    return (
      <span title={`Not enough for one serving of: ${names}`} className={`${base} bg-orange-50 text-red-700 border-red-200`}>
        Can't make
      </span>
    );
  }
  if (alert === 'OUT_OF_STOCK') {
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Out of stock</span>;
  }
  if (alert === 'REORDER_NOW') {
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Order now</span>;
  }
  if (alert === 'BELOW_MANUAL_THRESHOLD') {
    return <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>Running low</span>;
  }
  return (
    <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>
      {daysOfCover == null ? 'OK' : 'Enough stock'}
    </span>
  );
};

const smallPill = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border';

/** Grey pill for ingredients no active product uses, or that are not selling lately. */
export const UsageBadge = ({ usageStatus }) => {
  const label = usageStatus === 'NOT_IN_ANY_RECIPE' ? 'Not used' : usageStatus === 'NO_RECENT_SALES' ? 'Not selling' : null;
  if (!label) return null;
  const title =
    usageStatus === 'NOT_IN_ANY_RECIPE' ? 'No active product uses this ingredient.' : 'Used in a recipe, but those products are not selling lately.';
  return (
    <span title={title} className={`${smallPill} bg-zinc-100 text-zinc-600 border-zinc-200`}>
      {label}
    </span>
  );
};

const EXPIRY_STYLE = {
  EXPIRED: ['Expired', 'bg-red-100 text-red-900 border-red-300'],
  CRITICAL: ['Use today (0-2d)', 'bg-red-50 text-red-700 border-red-200'],
  WARNING: ['Use first (3-6d)', 'bg-orange-50 text-orange-700 border-orange-200'],
  WATCH: ['Watch (7-14d)', 'bg-yellow-50 text-yellow-800 border-yellow-200'],
};

export const ExpiryLevelBadge = ({ level, qtyByLevel, unit }) => {
  const style = EXPIRY_STYLE[level];
  if (!style) return null;
  const qty = Number(qtyByLevel?.[level]) || 0;
  return (
    <span title={qty > 0 ? `${qty.toLocaleString()} ${unit || ''} ${level === 'EXPIRED' ? 'already expired' : 'expiring soon'}`.trim() : style[0]} className={`${smallPill} ${style[1]}`}>
      {style[0]}
    </span>
  );
};
