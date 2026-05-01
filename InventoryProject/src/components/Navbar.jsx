import React, { useState, useEffect } from 'react';
import { logoutUser, getCurrentUser } from '../api/authApi';

const MENU_CONFIG = {
  Staff: [
    {
      label: 'POS Terminal',
      submenu: [
        { label: 'Sales Console', value: 'POS' },
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
        { label: 'View Stock', value: 'RawMaterialTracker' },
        { label: 'Update Stock', value: 'StockReceived' },
      ]
    },
  ],
  Admin: [
    { label: 'Dashboard Overview', value: 'Dashboard' },
    {
      label: 'Product Management',
      submenu: [
        { label: 'Product List', value: 'Products' },
        { label: 'Manage Recipes', value: 'ManageProducts' },
      ]
    },
    {
      label: 'Inventory Management',
      submenu: [
        { label: 'View Stock', value: 'RawMaterialTracker' },
        { label: 'Material Inventory', value: 'ManageRawMaterials' },
        { label: 'Update Stock', value: 'StockReceived' },
      ]
    },
    {
      label: 'Logs & Reports',
      submenu: [
        { label: 'Audit Logs', value: 'AuditLogs' },
        { label: 'Receipt Journal', value: 'SalesReceiptJournal' },
        { label: 'Summary Report', value: 'SalesSummaryReport' },
      ]
    },
    {
      label: 'Staff & Security',
      submenu: [
        { label: 'Access Control', value: 'AccountManager' },
      ]
    },
  ],
  Owner: [
    { label: 'Dashboard Overview', value: 'Dashboard' },
    {
      label: 'Product Management',
      submenu: [
        { label: 'Product List', value: 'Products' },
        { label: 'Manage Recipes', value: 'ManageProducts' },
      ]
    },
    {
      label: 'Inventory Control',
      submenu: [
        { label: 'Real-time Tracker', value: 'RawMaterialTracker' },
        { label: 'Material Inventory', value: 'ManageRawMaterials' },
        { label: 'Update Stock', value: 'StockReceived' },
      ]
    },
    {
      label: 'Logs & Reports',
      submenu: [  
        { label: 'Audit Logs', value: 'AuditLogs' },
        { label: 'Receipt Journal', value: 'SalesReceiptJournal' },
        { label: 'Summary Report', value: 'SalesSummaryReport' },
      ]
    },
    {
      label: 'Staff & Security',
      submenu: [
        { label: 'Access Control', value: 'AccountManager' },
      ]
    },
  ],
};

const Navbar = ({ activeTab, onTabChange }) => {
  const [userRole, setUserRole] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setUserRole(user.role);
  }, []);

  const handleLogout = () => {
    logoutUser();
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
    <nav className="dashboard-nav">
      <div className="nav-header">
        <div className="nav-logo">Cof/Tea System</div>
        <div className="nav-role">{userRole || 'Staff'}</div>
      </div>

      <ul>
        {menuItems.map((item) => (
          <li key={item.value || item.label}>
            {item.submenu ? (
              <>
                <div
                  className={`menu-item ${effectiveExpanded === item.label ? 'expanded' : ''}`}
                  onClick={() => toggleMenu(item.label)}
                >
                  <span>{item.label}</span>
                  <span className="menu-arrow">▼</span>
                </div>
                {effectiveExpanded === item.label && (
                  <ul className="submenu">
                    {item.submenu.map((sub) => (
                      <li
                        key={sub.value}
                        className={activeTab === sub.value ? 'active' : ''}
                        onClick={() => selectMenuItem(sub.value)}
                      >
                        {sub.label}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div
                className={`menu-item ${activeTab === item.value ? 'active' : ''}`}
                onClick={() => selectMenuItem(item.value)}
              >
                <span>{item.label}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </nav>
  );
};

export default Navbar;
