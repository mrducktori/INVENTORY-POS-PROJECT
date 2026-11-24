import React from 'react';

const ICONS = {
  'Sales Transactions': (
    <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  'Avg Sale': (
    <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  'Low Stock Items': (
    <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
};

const StatCards = ({ cards, loading }) => {
  return (
    <div className="stagger-in grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => {
        const isLowStock = card.label === 'Low Stock Items';
        const lowStockCount = parseInt(card.value, 10) || 0;
        const hasLowStockAlert = isLowStock && lowStockCount > 0;

        return (
          <div
            key={card.label}
            onClick={card.onClick}
            className={`hover-lift bg-white border rounded-xl p-4 md:p-5 flex flex-col justify-between transition-all duration-200 shadow-xs ${
              card.clickable
                ? 'cursor-pointer hover:border-zinc-500 hover:shadow-md'
                : 'hover:border-zinc-300'
            } ${hasLowStockAlert ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'}`}
          >
            <div className="mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {card.label}
              </span>
            </div>

            <div className="mb-3">
              <span className="text-3xl font-bold text-zinc-900 tracking-tight tabular-nums">
                {loading ? '---' : card.value}
              </span>
            </div>

            <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
              {isLowStock ? (
                hasLowStockAlert ? (
                  <span className="inline-flex items-center gap-2 font-bold text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Immediate reorder needed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Stock levels healthy
                  </span>
                )
              ) : card.label === 'Avg Sale' ? (
                <span className="text-zinc-500 font-medium">Per completed transaction</span>
              ) : (
                <span className="text-zinc-500 font-medium">Today's register count</span>
              )}

              {card.clickable && (
                <span className="font-bold text-zinc-900 hover:text-black underline underline-offset-4">
                  <span className="inline-flex items-center gap-1">View Items <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatCards;
