import React from 'react';

// ---------------------------------------------------------------------------
// QuickActions
// Navigation shortcuts at the bottom of the dashboard.
// Role-based access is computed here so the parent stays clean.
// ---------------------------------------------------------------------------

const ALL_LINKS = [
  { label: 'Open POS', value: 'POS', desc: 'New transaction' },
  { label: 'Inventory', value: 'RawMaterialTracker', desc: 'Check stock' },
  { label: 'Reports', value: 'SalesSummaryReport', desc: 'Full reports' },
];

// Modules that Staff role is allowed to access
const STAFF_ALLOWED = ['POS', 'RawMaterialTracker'];

const QuickActions = ({ onNavigate, userRole }) => {
  const visibleLinks =
    userRole === 'Staff'
      ? ALL_LINKS.filter((link) => STAFF_ALLOWED.includes(link.value))
      : ALL_LINKS;

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="card-header">
        <h2>Quick Actions</h2>
      </div>
      <div className="card-body">
        <div className="overview-grid">
          {visibleLinks.map((link) => (
            <button
              key={link.value}
              onClick={() => onNavigate(link.value)}
              className="overview-link-btn"
            >
              <div className="overview-link-title">{link.label}</div>
              <div className="overview-link-desc">{link.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
