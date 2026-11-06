import React, { useState, useRef, useEffect } from 'react';

/**
 * ColumnVisibilityDropdown
 * Matches the reference design (image 9):
 * - "Columns" title with red "Reset" link
 * - Checkboxes list with custom toggle
 * - Deep dark green "Apply columns" button
 */
const ColumnVisibilityDropdown = ({
  columns = [],
  visibleColumns = {},
  onChange = () => {},
  defaultVisible = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(visibleColumns);
  const dropdownRef = useRef(null);

  // Sync draft when opened or visibleColumns change
  useEffect(() => {
    if (isOpen) {
      setDraft(visibleColumns);
    }
  }, [isOpen, visibleColumns]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = (colId) => {
    setDraft((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  const handleApply = () => {
    onChange(draft);
    setIsOpen(false);
  };

  const handleReset = () => {
    const fallback =
      defaultVisible ||
      columns.reduce((acc, col) => {
        acc[col.id] = true;
        return acc;
      }, {});
    setDraft(fallback);
    onChange(fallback);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* 3-Bar / Column icon button matching reference image 7 & 8 */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Customize columns"
        aria-label="Customize columns"
        className={`h-10 w-10 flex items-center justify-center rounded-lg border transition-all cursor-pointer select-none ${
          isOpen
            ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-2xs'
        }`}
      >
        {/* 3 vertical bars icon (|||) matching reference */}
        <svg className="w-5 h-5 text-zinc-600" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="4" width="3" height="16" rx="1.5" />
          <rect x="10.5" y="4" width="3" height="16" rx="1.5" />
          <rect x="16" y="4" width="3" height="16" rx="1.5" />
        </svg>
      </button>

      {/* Popover Dropdown matching Reference Image 9 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-zinc-200 z-50 p-4 animate-[modalPopIn_0.15s_ease-out]">
          {/* Header: "Columns" + "Reset" */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-100">
            <span className="text-base font-bold text-zinc-900 tracking-tight">
              Columns
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              Reset
            </button>
          </div>

          {/* Column Checkboxes List */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 select-none">
            {columns.map((col) => {
              const isChecked = draft[col.id] !== false;
              return (
                <label
                  key={col.id}
                  className="flex items-center gap-3 px-1 py-1 rounded hover:bg-zinc-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(col.id)}
                    className="w-4 h-4 rounded text-zinc-900 border-zinc-400 focus:ring-0 cursor-pointer accent-zinc-800"
                  />
                  <span
                    className={`text-xs md:text-sm font-medium ${
                      isChecked ? 'text-zinc-900' : 'text-zinc-400'
                    }`}
                  >
                    {col.label}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Action Button: Dark green "Apply columns" button from image 9 */}
          <div className="pt-3 mt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={handleApply}
              className="w-auto px-4 py-2 bg-[#123826] hover:bg-[#0d271a] text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Apply columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityDropdown;
