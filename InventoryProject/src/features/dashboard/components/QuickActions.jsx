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
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mt-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="m-0 text-sm font-semibold uppercase tracking-wider text-gray-800">Quick Actions</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleLinks.map((link) => (
            <button
              key={link.value}
              onClick={() => onNavigate(link.value)}
              className="group bg-white border border-gray-200 p-6 rounded-lg text-left cursor-pointer transition-all duration-200 flex flex-col gap-2 hover:bg-gray-900 hover:border-gray-900 hover:-translate-y-1 hover:shadow-md active:scale-95"
            >
              <div className="text-sm font-bold text-gray-900 uppercase tracking-wider group-hover:text-white transition-colors">{link.label}</div>
              <div className="text-xs font-medium text-gray-500 group-hover:text-gray-300 transition-colors">{link.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
