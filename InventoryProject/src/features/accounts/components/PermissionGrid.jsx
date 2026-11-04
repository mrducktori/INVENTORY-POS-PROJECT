import React from 'react';
import { PERMISSION_GROUPS } from '../../../utils/permissions';

const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const Checkbox = ({ checked, partial = false }) => (
  <span
    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
      checked || partial ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300'
    }`}
  >
    {checked && <CheckIcon />}
    {!checked && partial && <span className="w-2 h-0.5 bg-white rounded" />}
  </span>
);

/**
 * PermissionGrid - grouped page-access checkboxes for Staff / Custom accounts.
 */
const PermissionGrid = ({ value = [], onChange, disabled = false }) => {
  const toggle = (key) => {
    if (disabled) return;
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  const toggleGroup = (group) => {
    if (disabled) return;
    const keys = group.pages.map((p) => p.key);
    const allOn = keys.every((k) => value.includes(k));
    onChange(allOn ? value.filter((k) => !keys.includes(k)) : [...new Set([...value, ...keys])]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {PERMISSION_GROUPS.map((group) => {
        const keys = group.pages.map((p) => p.key);
        const count = keys.filter((k) => value.includes(k)).length;
        const allOn = count === keys.length;

        return (
          <div key={group.label} className="border border-zinc-200 rounded-xl bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              disabled={disabled}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-left cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2.5">
                <Checkbox checked={allOn} partial={count > 0 && !allOn} />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">{group.label}</span>
              </span>
              <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
                {count}/{keys.length}
              </span>
            </button>
            <div className="p-2 flex flex-col">
              {group.pages.map((page) => {
                const checked = value.includes(page.key);
                return (
                  <button
                    key={page.key}
                    type="button"
                    onClick={() => toggle(page.key)}
                    disabled={disabled}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      checked ? 'text-zinc-900 font-semibold' : 'text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <Checkbox checked={checked} />
                    {page.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PermissionGrid;

