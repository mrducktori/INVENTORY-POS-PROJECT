import React from 'react';
import { getCurrentUser } from '../../../utils/authUtils';
import { canAccess, usesPagePermissions } from '../../../utils/permissions';

const ALL_LINKS = [
  {
    label: 'Open POS Register',
    value: 'POS',
    desc: 'Enter walk-in sales & orders',
    staffOnly: true,
  },
  {
    label: 'Manage Products',
    value: 'ManageProducts',
    desc: 'Update drinks, pricing & menu',
    adminOnly: true,
  },
  {
    label: 'Raw Material Stock',
    value: 'RawMaterialTracker',
    desc: 'Check beans, syrups & supplies',
  },
  {
    label: 'Sales & Audit Reports',
    value: 'SalesSummaryReport',
    desc: 'View daily totals and end-of-day summary',
  },
];

const QuickActions = ({ onNavigate, userRole }) => {
  const currentUser = getCurrentUser();
  const visibleLinks = ALL_LINKS.filter((link) => {
    // Staff already get "Open POS Register" as the header button.
    if (link.value === 'POS' && userRole === 'Staff') return false;
    // Staff / Custom accounts: show only shortcuts to pages they can open
    if (usesPagePermissions(currentUser)) return canAccess(currentUser, link.value);
    if (link.staffOnly && userRole !== 'Staff') return false;
    if (link.adminOnly && userRole === 'Staff') return false;
    if (userRole === 'Staff') return ['POS', 'RawMaterialTracker'].includes(link.value);
    return true;
  });

  return (
    <div>
      <div className="stagger-in grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleLinks.map((link) => (
          <button
            key={link.value}
            type="button"
            onClick={() => onNavigate(link.value)}
            className="group px-4 py-3 rounded-lg border border-zinc-200 hover:border-zinc-400 bg-transparent hover:bg-white text-left cursor-pointer transition-all duration-200 flex items-center justify-between hover:shadow-sm"
          >
            <div>
              <div className="text-sm font-semibold text-zinc-800 group-hover:text-black">
                {link.label}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {link.desc}
              </div>
            </div>

            <span className="text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition-all text-base ml-3 shrink-0">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
