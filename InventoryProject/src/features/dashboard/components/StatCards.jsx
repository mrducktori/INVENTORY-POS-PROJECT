import React from 'react';

// ---------------------------------------------------------------------------
// StatCards
// Renders the top-row KPI stat cards (e.g. Sales Transactions, Avg Sale,
// Low Stock Items). Receives pre-computed card config from the hook.
// ---------------------------------------------------------------------------

const StatCards = ({ cards, loading }) => {
  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`stat-card border-${card.color} ${card.clickable ? 'clickable' : ''}`}
          onClick={card.onClick}
        >
          <div className="value">{loading ? '...' : card.value}</div>
          <div className="label">{card.label}</div>
          {card.clickable && <div className="click-hint">View Details</div>}
        </div>
      ))}
    </div>
  );
};

export default StatCards;
