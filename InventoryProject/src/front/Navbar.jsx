import React, { useState, useEffect } from 'react';
import '../styles/navbar.css';
import { logoutUser, getCurrentUser } from '../api/authApi';

const INVENTORY_ITEMS = {
  Staff: [
    { label: 'Stock Received', value: 'StockReceived' },
    { label: 'Raw Material Tracker', value: 'RawMaterialTracker' },
    { label: 'Low Stock Alerts', value: 'LowStockAlerts' },
    { label: 'Report Wastage', value: 'ReportWastage' }
  ],
  Admin: [
    { label: 'Stock Received', value: 'StockReceived' },
    { label: 'Raw Material Tracker', value: 'RawMaterialTracker' },
    { label: 'Low Stock Alerts', value: 'LowStockAlerts' },
    { label: 'Report Wastage', value: 'ReportWastage' },
    { label: 'Products', value: 'Products' },
    { label: 'Recipes', value: 'Recipes' }
  ],
  Owner: [
    { label: 'Stock Received', value: 'StockReceived' },
    { label: 'Raw Material Tracker', value: 'RawMaterialTracker' },
    { label: 'Low Stock Alerts', value: 'LowStockAlerts' },
    { label: 'Report Wastage', value: 'ReportWastage' },
    { label: 'Products', value: 'Products' },
    { label: 'Recipes', value: 'Recipes' }
  ]
};

const OTHER_ITEMS = {
  Staff: [],
  Admin: [
    { label: 'View Requests', value: 'ViewRequests' },
    { label: 'Audit Logs', value: 'AuditLogs' },
    { label: 'Reports', value: 'Reports' }
  ],
  Owner: [
    { label: 'View Requests', value: 'ViewRequests' },
    { label: 'Audit Logs', value: 'AuditLogs' },
    { label: 'Reports', value: 'Reports' },
    { label: 'Manage Accounts', value: 'ManageAccounts' }
  ]
};

const Navbar = ({ activeTab, onTabChange }) => {
  const [userRole, setUserRole] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUserRole(user.role);
    }
  }, []);

  const handleLogout = () => {
    logoutUser();
    window.location.href = '/';
  };

  const toggleMenu = (name) => {
    setExpanded(expanded === name ? null : name);
  };

  const selectMenuItem = (value) => {
    onTabChange(value);
    setExpanded(null);
  };

  const buildMenuItems = () => {
    const role = userRole || 'Staff';
    const otherItems = OTHER_ITEMS[role] || [];
    return [
      { label: 'Dashboard', value: 'Dashboard' },
      { label: 'Point of Sale', value: 'POS' },
      {
        label: 'Inventory',
        submenu: INVENTORY_ITEMS[role] || INVENTORY_ITEMS.Staff
      },
      { label: 'Request Product', value: 'RequestProduct' },
      ...otherItems
    ];
  };

  const menuItems = buildMenuItems();

  return (
    <nav className="dashboard-nav">
      <div className="nav-header">
        <h3>{userRole}</h3>
      </div>
      <ul>
        {menuItems.map((item) => (
          <li key={item.value || item.label}>
            {item.submenu ? (
              <>
                <div
                  className={`menu-item ${expanded === item.label ? 'expanded' : ''}`}
                  onClick={() => toggleMenu(item.label)}
                >
                  <span>{item.label}</span>
                  <span className="menu-arrow">▼</span>
                </div>
                {expanded === item.label && (
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
