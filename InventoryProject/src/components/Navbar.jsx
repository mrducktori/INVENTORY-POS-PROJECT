import React, { useState } from 'react';
import { logoutUser, getCurrentUser } from '../api/authApi';
import { useNotifications } from '../features/dashboard/useNotifications';

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
  Supplier: [
    { label: 'Supplier Portal', value: 'SupplierPortal' },
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
        { label: 'Content Manager', value: 'CMSDashboard' },
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
        { label: 'Transaction Logs', value: 'TransactionLogs' },
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
        { label: 'Content Manager', value: 'CMSDashboard' },
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
  const { unreadCount } = useNotifications();

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
    <nav className="w-68 bg-zinc-950 text-white flex flex-col border-r border-zinc-800 shrink-0 h-full overflow-hidden select-none">
      {/* Brand header */}
      <div className="p-5 border-b border-zinc-800 bg-black">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white text-zinc-900 flex items-center justify-center font-extrabold text-sm">
            C
          </div>
          <span className="text-base font-extrabold text-white tracking-wide">CofTea Cafe</span>
        </div>
        <div className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mt-1">
          {userRole ? `${userRole} Portal` : 'Staff Console'}
        </div>
      </div>

      {/* Nav list */}
      <ul className="list-none p-3 flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 m-0">
        {menuItems.map((item) => (
          <li key={item.value || item.label} className="p-0">
            {item.submenu ? (
              <>
                <div
                  className="px-3.5 py-3 rounded-xl cursor-pointer flex justify-between items-center text-sm font-bold tracking-wide transition-colors hover:bg-zinc-900 text-zinc-300 hover:text-white"
                  onClick={() => toggleMenu(item.label)}
                >
                  <div className="flex items-center gap-3">
                    {ICONS[item.label] || ICONS['Default']}
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[10px] transition-transform duration-200 ${effectiveExpanded === item.label ? 'rotate-180' : ''}`}>▼</span>
                </div>
                {effectiveExpanded === item.label && (
                  <ul className="list-none p-1 m-0 space-y-1 pl-4">
                    {item.submenu.map((sub) => {
                      const isActive = activeTab === sub.value;
                      return (
                        <li
                          key={sub.value}
                          className={`py-2.5 px-3.5 rounded-lg cursor-pointer text-sm transition-colors flex items-center justify-between ${
                            isActive
                              ? 'bg-zinc-800 text-white font-bold shadow-xs'
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'
                          } ${sub.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          onClick={() => !sub.disabled && selectMenuItem(sub.value)}
                          title={sub.disabled ? 'Coming soon' : ''}
                        >
                          <span>{sub.label}</span>
                          {isActive && <span className="w-2 h-2 rounded-full bg-white"></span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <div
                className={`px-3.5 py-3 rounded-xl cursor-pointer flex justify-between items-center text-sm font-bold tracking-wide transition-colors ${
                  activeTab === item.value 
                    ? 'bg-zinc-800 text-white shadow-xs font-bold' 
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
                onClick={() => selectMenuItem(item.value)}
              >
                <div className="flex items-center gap-3">
                  {ICONS[item.label] || ICONS['Default']}
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.value === 'Dashboard' && unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white tabular-nums shadow-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  {activeTab === item.value && <span className="w-2 h-2 rounded-full bg-white"></span>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Logout button */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        <button 
          className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-zinc-800" 
          onClick={handleLogout}
        >
          Logout Session
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
