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
export const IngredientAlertBadge = ({ alert, daysOfCover }) => {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border';
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
