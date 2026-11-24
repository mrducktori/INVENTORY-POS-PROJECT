import React from 'react';

/**
 * Vector sort indicator for column headers.
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

/** Quiet status chip: neutral text with a small coloured dot. */
const DOT = { red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-emerald-500', gray: 'bg-zinc-400', violet: 'bg-violet-400' };
const Chip = ({ dot, children, title, strong }) => (
  <span title={title} className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${strong ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[dot]}`} />
    {children}
  </span>
);

const aiPctText = (f) => `${f > 1 ? '+' : '-'}${Math.abs(Math.round((f - 1) * 100))}%`;

export const AiAdjustBadge = ({ factor, reason }) => {
  if (factor == null || factor === 1) return null;
  return (
    <span
      title={`AI adjustment ${aiPctText(factor)}${reason ? `: ${reason}` : ''}`}
      className="ml-1.5 text-[10px] font-medium text-zinc-500 align-middle"
    >
      AI {aiPctText(factor)}
    </span>
  );
};

/** Stock status for an ingredient row, from the server's reorder-plan alert. */
export const IngredientAlertBadge = ({ alert, daysOfCover, blockedProducts }) => {
  if (alert === 'CANNOT_MAKE') {
    const names = (blockedProducts || []).map((p) => p.name).join(', ');
    return <Chip dot="red" strong title={`Not enough for one serving of: ${names}`}>Can't make</Chip>;
  }
  if (alert === 'OUT_OF_STOCK') return <Chip dot="red" strong>Out of stock</Chip>;
  if (alert === 'REORDER_NOW') return <Chip dot="red" strong>Order now</Chip>;
  if (alert === 'BELOW_MANUAL_THRESHOLD') return <Chip dot="amber">Running low</Chip>;
  return <Chip dot="green">{daysOfCover == null ? 'OK' : 'Enough stock'}</Chip>;
};


/** Grey pill for ingredients no active product uses, or that are not selling lately. */
export const UsageBadge = ({ usageStatus }) => {
  const label = usageStatus === 'NOT_IN_ANY_RECIPE' ? 'Not used' : usageStatus === 'NO_RECENT_SALES' ? 'Not selling' : null;
  if (!label) return null;
  const title =
    usageStatus === 'NOT_IN_ANY_RECIPE' ? 'No active product uses this ingredient.' : 'Used in a recipe, but those products are not selling lately.';
  return (
    <Chip dot="gray" title={title}>{label}</Chip>
  );
};

const EXPIRY_STYLE = {
  EXPIRED: ['Expired', 'red', true],
  CRITICAL: ['Use today (0-2d)', 'red', true],
  WARNING: ['Use first (3-6d)', 'amber', false],
  WATCH: ['Watch (7-14d)', 'gray', false],
};

export const ExpiryLevelBadge = ({ level, qtyByLevel, unit }) => {
  const style = EXPIRY_STYLE[level];
  if (!style) return null;
  const qty = Number(qtyByLevel?.[level]) || 0;
  const title = qty > 0 ? `${qty.toLocaleString()} ${unit || ''} ${level === 'EXPIRED' ? 'already expired' : 'expiring soon'}`.trim() : style[0];
  return <Chip dot={style[1]} strong={style[2]} title={title}>{style[0]}</Chip>;
};
