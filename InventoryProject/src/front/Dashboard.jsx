import React, { useState } from 'react';
import '../CSS/Dashboard_test.css';
import POS from './POS';
import { logoutUser } from '../api/authApi';

const IntegratedDashboard = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const handleLogout = () => {
    logoutUser();
    window.location.href = '/';
  };

  return (
    <body className="dashboard-body">
      <div className="dashboard-container">
        <div className="dashboard-content">
          
          {/* Sidebar/Nav on the left */}
          <nav className="dashboard-nav">
            <ul>
              <li className={activeTab === 'Dashboard' ? 'active' : ''} onClick={() => setActiveTab('Dashboard')}>Dashboard</li>
              <li className={activeTab === 'POS' ? 'active' : ''} onClick={() => setActiveTab('POS')}>Point of Sale</li>
              <li className={activeTab === 'Inventory' ? 'active' : ''} onClick={() => setActiveTab('Inventory')}>Inventory</li>
              <li className={activeTab === 'Suppliers' ? 'active' : ''} onClick={() => setActiveTab('Suppliers')}>Suppliers</li>
              <li className={activeTab === 'Reports' ? 'active' : ''} onClick={() => setActiveTab('Reports')}>Reports</li>
            </ul>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </nav>

          {/* Temporary content on the right */}
          <main className="dashboard-main">
            {activeTab === 'Dashboard' && <div>Dashboard Content</div>}
            {activeTab === 'POS' && <POS />}
            {activeTab === 'Inventory' && <div>Inventory Content</div>}
            {activeTab === 'Suppliers' && <div>Suppliers Content</div>}
            {activeTab === 'Reports' && <div>Reports Content</div>}
          </main>
        </div>
      </div>
    </body>
  );
};

export default IntegratedDashboard;