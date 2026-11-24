import React from 'react';

// Controlled by Navbar, which applies the `dark` class on <html>; index.css does the recoloring.
const ThemeToggle = ({ dark, onToggle, collapsed = false }) => {
  return (
    <button
      type="button"
      title={collapsed ? (dark ? 'Light mode' : 'Dark mode') : undefined}
      aria-pressed={dark}
      onClick={onToggle}
      className={`w-full mb-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-zinc-800 ${
        collapsed ? 'p-3' : 'py-3 px-4'
      }`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        {dark
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />}
      </svg>
      {!collapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
};

export default ThemeToggle;
