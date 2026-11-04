import React from 'react';

/**
 * InfoTip - Minimalist info indicator ('i' inside a circle)
 * Replaces noisy inline explanatory paragraphs with an unobtrusive hover/focus tooltip.
 */
export const InfoTip = ({ text, children, className = '' }) => {
  const content = text || children;
  if (!content) return null;

  return (
    <span 
      className={`relative inline-flex items-center group cursor-help align-middle select-none ${className}`} 
      tabIndex={0} 
      role="tooltip"
      aria-label={typeof content === 'string' ? content : 'Information'}
    >
      <svg 
        className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus:block z-50 w-56 sm:w-64 p-2 bg-zinc-900 text-white text-[11px] font-medium leading-relaxed rounded-lg shadow-xl border border-zinc-800 text-left">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900" />
      </span>
    </span>
  );
};

export default InfoTip;

