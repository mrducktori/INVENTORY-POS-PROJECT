import React, { useState } from 'react';
import { logoutUser, getCurrentUser } from '../api/authApi';

const MENU_CONFIG = {
  Staff: [
    {
      label: 'POS Terminal',
      submenu: [
        { label: 'Sales Console', value: 'POS' },
        { label: 'Report Wastage', value: 'ReportWastage' },
      ]
    },
    {
      label: 'Product Catalog',
      submenu: [
        { label: 'View Products', value: 'Products' },
      ]
    },  
    {
      label: 'Inventory Management',
      submenu: [
        { label: 'Raw Material Stock', value: 'RawMaterialTracker' },
        { label: 'Product Stock', value: 'ProductStockTracker' },
      ]
    },
  ],
  Admin: [
    { label: 'Dashboard Overview', value: 'Dashboard' },

    {
      label: 'Product Management',
      submenu: [
        { label: 'Product List', value: 'Products' },
        { label: 'Manage Products', value: 'ManageProducts' },
      ]
    },
    {
      label: 'Inventory Control',
      submenu: [
        { label: 'Raw Material Stock', value: 'RawMaterialTracker' },
        { label: 'Product Stock', value: 'ProductStockTracker' },
        { label: 'Material Inventory', value: 'ManageRawMaterials' },

        { label: 'Manage Suppliers', value: 'ManageSuppliers' },
        { label: 'Purchase Orders', value: 'PurchaseOrders' },
      ]
    },
    {
      label: 'Logs & Reports',
      submenu: [
        { label: 'Audit Logs', value: 'AuditLogs' },
        { label: 'Receipt Journal', value: 'SalesReceiptJournal' },

        { label: 'Demand Forecasting', value: 'Forecasting' },
        { label: 'Reports Module', value: 'Reports' },
      ]
    },
    {
      label: 'Staff & Security',
      submenu: [
        { label: 'Access Control', value: 'AccountManager' },
      ]
    },
    {
      label: 'Website Management',
      submenu: [
        { label: 'Public Landing Page', value: 'CMSDashboard' },
      ]
    },
  ],
  Owner: [
    { label: 'Dashboard Overview', value: 'Dashboard' },

    {
      label: 'Product Management',
      submenu: [
        { label: 'Product List', value: 'Products' },
        { label: 'Manage Products', value: 'ManageProducts' },
      ]
    },
    {
      label: 'Inventory Control',
      submenu: [
        { label: 'Raw Material Stock', value: 'RawMaterialTracker' },
        { label: 'Product Stock', value: 'ProductStockTracker' },
        { label: 'Material Inventory', value: 'ManageRawMaterials' },

        { label: 'Manage Suppliers', value: 'ManageSuppliers' },
        { label: 'Purchase Orders', value: 'PurchaseOrders' },
      ]
    },
    {
      label: 'Logs & Reports',
      submenu: [  
        { label: 'Audit Logs', value: 'AuditLogs' },
        { label: 'Transaction Logs', value: 'TransactionLogs', disabled: true },
        { label: 'Receipt Journal', value: 'SalesReceiptJournal' },

        { label: 'Demand Forecasting', value: 'Forecasting' },
        { label: 'Reports Module', value: 'Reports' },
      ]
    },
    {
      label: 'Staff & Security',
      submenu: [
        { label: 'Access Control', value: 'AccountManager' },
      ]
    },
    {
      label: 'Website Management',
      submenu: [
        { label: 'Public Landing Page', value: 'CMSDashboard' },
      ]
    },
  ],
};

const ICONS = {
  'Dashboard Overview': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
  ),
  'Product Management': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  'Product Catalog': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  'Inventory Control': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  'Inventory Management': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  'Logs & Reports': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  'Staff & Security': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  ),
  'POS Terminal': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  ),
  'Default': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  )
};

const Navbar = ({ activeTab, onTabChange }) => {
  const [userRole] = useState(() => getCurrentUser()?.role || null);
  const [expanded, setExpanded] = useState(null);

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/';
  };

  const toggleMenu = (label) => {
    setExpanded(expanded === label ? null : label);
  };

  const selectMenuItem = (value) => {
    onTabChange(value);
  };

  const menuItems = MENU_CONFIG[userRole] || MENU_CONFIG.Staff;

  const getExpandedGroup = () => {
    for (const item of menuItems) {
      if (item.submenu && item.submenu.some(s => s.value === activeTab)) {
        return item.label;
      }
    }
    return null;
  };

  const effectiveExpanded = expanded !== null ? expanded : getExpandedGroup();

  return (
    <nav className="w-64 bg-gray-900 text-white flex flex-col border-r border-gray-800 shrink-0 h-full overflow-hidden">
      <div className="p-5 border-b border-gray-800 bg-black">
        <div className="text-lg font-bold text-white tracking-wide mb-1">Cof/Tea System</div>
        <div className="text-xs uppercase tracking-widest text-gray-400 font-semibold">{userRole || 'Staff'}</div>
      </div>

      <ul className="list-none p-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600">
        {menuItems.map((item) => (
          <li key={item.value || item.label} className="p-0 border-b border-gray-800/50">
            {item.submenu ? (
              <>
                <div
                  className={`px-5 py-3.5 cursor-pointer flex justify-between items-center select-none text-sm transition-colors hover:bg-gray-800 text-gray-300`}
                  onClick={() => toggleMenu(item.label)}
                >
                  <div className="flex items-center gap-3">
                    {ICONS[item.label] || ICONS['Default']}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className={`text-[10px] ml-2 transition-transform duration-200 ${effectiveExpanded === item.label ? 'rotate-180' : ''}`}>▼</span>
                </div>
                {effectiveExpanded === item.label && (
                  <ul className="list-none p-0 m-0 bg-gray-950/50 border-b border-gray-800/50">
                    {item.submenu.map((sub) => {
                      const isActive = activeTab === sub.value;
                      return (
                        <li
                          key={sub.value}
                          className={`py-2.5 pr-5 pl-12 cursor-pointer text-sm transition-colors border-l-2 ${isActive ? 'bg-gray-800 text-white border-white' : 'border-transparent text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'} ${sub.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          onClick={() => !sub.disabled && selectMenuItem(sub.value)}
                          title={sub.disabled ? 'Coming soon' : ''}
                        >
                          {sub.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <div
                className={`px-5 py-3.5 cursor-pointer flex justify-between items-center select-none text-sm transition-colors border-l-2 ${activeTab === item.value ? 'bg-gray-800 text-white border-white' : 'text-gray-300 border-transparent hover:bg-gray-800'}`}
                onClick={() => selectMenuItem(item.value)}
              >
                <div className="flex items-center gap-3">
                  {ICONS[item.label] || ICONS['Default']}
                  <span className="font-medium">{item.label}</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="p-4 border-t border-gray-800">
        <button className="w-full py-2.5 px-4 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 cursor-pointer" onClick={handleLogout}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
