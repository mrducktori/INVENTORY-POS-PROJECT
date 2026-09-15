import React from 'react';

// ---------------------------------------------------------------------------
// StatCards
// Renders the top-row KPI stat cards (e.g. Sales Transactions, Avg Sale,
// Low Stock Items). Receives pre-computed card config from the hook.
// ---------------------------------------------------------------------------

const StatCards = ({ cards, loading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {cards.map((card) => {
        const borderColorClass = 
          card.color === 'green' ? 'border-t-gray-900' :
          card.color === 'red' ? 'border-t-red-500' :
          card.color === 'blue' ? 'border-t-blue-500' :
          card.color === 'purple' ? 'border-t-indigo-500' :
          card.color === 'orange' ? 'border-t-orange-500' : 'border-t-gray-900';

        return (
          <div
            key={card.label}
            className={`bg-white border border-gray-200 border-t-4 rounded-xl p-6 flex flex-col justify-center transition-all duration-200 shadow-sm ${borderColorClass} ${card.clickable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md' : ''}`}
            onClick={card.onClick}
          >
            <div className="text-3xl font-bold text-gray-900 mb-1">{loading ? '...' : card.value}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</div>
            {card.clickable && <div className="text-[10px] uppercase text-gray-400 mt-3 font-medium tracking-wider">View Details →</div>}
          </div>
        );
      })}
    </div>
  );
};

export default StatCards;
