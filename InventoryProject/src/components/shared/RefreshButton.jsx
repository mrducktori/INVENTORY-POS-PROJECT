import React, { useState } from 'react';

/**
 * Small "Refresh" button for pages with tables. `onRefresh` may be sync or async; the icon spins
 * until it settles (or while the parent passes loading=true), so double-clicks are ignored.
 */
const RefreshButton = ({ onRefresh, loading = false, disabled = false, disabledReason = '', label = 'Refresh', className = '' }) => {
  const [busy, setBusy] = useState(false);
  const spinning = busy || loading;
  const blocked = disabled && !spinning;

  const handleClick = async () => {
    if (spinning || disabled) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning || disabled}
      title={blocked && disabledReason ? disabledReason : 'Reload the latest data'}
      className={`inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {label}
      {blocked && disabledReason && (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">{disabledReason}</span>
      )}
    </button>
  );
};

export default RefreshButton;
