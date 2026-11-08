import React from 'react';

/**
 * InfoTip - Minimalist info indicator ('i' inside a circle)
 * Replaces noisy inline explanatory paragraphs with an unobtrusive hover/focus tooltip.
 */
export const InfoTip = ({ text, children, className = '', position = 'top' }) => {
  const content = text || children;
  if (!content) return null;

  const isBottom = position === 'bottom';

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
      <span
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${
          isBottom ? 'top-full mt-2' : 'bottom-full mb-2'
        } hidden group-hover:block group-focus:block z-50 w-56 sm:w-64 p-2.5 bg-zinc-900 text-white text-[11px] font-normal leading-relaxed rounded-lg shadow-xl border border-zinc-800 text-left whitespace-normal`}
      >
        {content}
        <span
          className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            isBottom ? 'bottom-full -mb-1 border-b-zinc-900' : 'top-full -mt-1 border-t-zinc-900'
          }`}
        />
      </span>
    </span>
  );
};

export default InfoTip;

