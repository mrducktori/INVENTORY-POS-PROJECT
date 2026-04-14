import React, { useState, useEffect } from 'react';
import { logoutUser, getCurrentUser } from '../api/authApi';

const MENU_CONFIG = {
  Staff: [
    { label: 'Dashboard', value: 'Dashboard' },
    {
      label: 'Point of Sale',
      submenu: [
        { label: 'POS System', value: 'POS' },
        { label: 'Report Broken Items', value: 'ReportWastage' },
      ]
    },
    {
      label: 'Inventory System',
      submenu: [
        { label: 'Products Display', value: 'Products' },
        { label: 'Request Product Modification', value: 'RequestProduct' },
      ]
    },
    {
      label: 'Inventory Stock',
      submenu: [
        { label: 'Raw Material Tracker', value: 'RawMaterialTracker' },
        { label: 'Stock Received', value: 'StockReceived' },
        { label: 'Low Stock Alerts', value: 'LowStockAlerts' },
      ]
    },
  ],
  Admin: [
    { label: 'Dashboard', value: 'Dashboard' },
    {
      label: 'Point of Sale',
      submenu: [
        { label: 'POS System', value: 'POS' },
      ]
    },
    {
      label: 'Inventory System',
      submenu: [
        { label: 'Products Display', value: 'Products' },
        { label: 'Add / Archive Product', value: 'ManageProducts' },
        { label: 'Modify Recipe & Price', value: 'ModifyProduct' },
        { label: 'Request Tracker', value: 'ViewRequests' },
      ]
    },
    {
      label: 'Inventory Stock',
      submenu: [
        { label: 'Raw Material Tracker', value: 'RawMaterialTracker' },
        { label: 'Update Stock', value: 'StockReceived' },
        { label: 'Low Stock Alerts', value: 'LowStockAlerts' },
      ]
    },
    {
      label: 'Logs & Reports',
      submenu: [
        { label: 'Admin Logs', value: 'AdminLogs' },
        { label: 'Sales Summary Report', value: 'SalesSummaryReport' },
      ]
    },
    {
      label: 'Account Management',
      submenu: [
        { label: 'Account Manager', value: 'AccountManager' },
      ]
    },
  ],
  Owner: [
    { label: 'Dashboard', value: 'Dashboard' },
    {
      label: 'Point of Sale',
      submenu: [
        { label: 'POS System', value: 'POS' },
      ]
    },
    {
      label: 'Inventory System',
      submenu: [
        { label: 'Products Display', value: 'Products' },
        { label: 'Add / Archive Product', value: 'ManageProducts' },
        { label: 'Modify Recipe & Price', value: 'ModifyProduct' },
        { label: 'Request Tracker', value: 'ViewRequests' },
      ]
    },
    {
      label: 'Inventory Stock',
      submenu: [
        { label: 'Raw Material Tracker', value: 'RawMaterialTracker' },
        { label: 'Update Stock', value: 'StockReceived' },
        { label: 'Low Stock Alerts', value: 'LowStockAlerts' },
      ]
    },
    {
      label: 'Logs & Reports',
      submenu: [
        { label: 'Admin Logs', value: 'AdminLogs' },
        { label: 'Transaction Logs', value: 'TransactionLogs' },
        { label: 'Sales Summary Report', value: 'SalesSummaryReport' },
      ]
    },
    {
      label: 'Account Management',
      submenu: [
        { label: 'Account Manager', value: 'AccountManager' },
        { label: 'Employee Tracker', value: 'EmployeeTracker' },
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
