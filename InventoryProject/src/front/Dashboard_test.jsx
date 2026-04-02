import React, { useState } from 'react';
import '../CSS/Dashboard_test.css';

const IntegratedDashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="dashboard-container">
      {/* Header stays at the top */}
      <header className="dashboard-header">
        <h2>Dashboard</h2>
      </header>

      <div className="dashboard-content">
        
        {/* Sidebar/Nav on the left */}
        <nav className="dashboard-nav">
          <ul>
            
            <li className={activeTab === 'Overview' ? 'active' : ''} onClick={() => setActiveTab('Overview')}>Overview</li>
            <li className={activeTab === 'Inventory' ? 'active' : ''} onClick={() => setActiveTab('Inventory')}>Inventory</li>
            <li className={activeTab === 'Orders' ? 'active' : ''} onClick={() => setActiveTab('Orders')}>Orders</li>
            <li className={activeTab === 'Suppliers' ? 'active' : ''} onClick={() => setActiveTab('Suppliers')}>Suppliers</li>
            <li className={activeTab === 'Reports' ? 'active' : ''} onClick={() => setActiveTab('Reports')}>Reports</li>
          </ul>
        </nav>

        {/* Dynamic content on the right */}
        <main className="dashboard-main">
          {activeTab === 'Overview' && <div>Overview Content</div>}
          {activeTab === 'Inventory' && <div>Inventory Content</div>}
          {activeTab === 'Orders' && <div>Orders Content</div>}
          {activeTab === 'Suppliers' && <div>Suppliers Content</div>}
          {activeTab === 'Reports' && <div>Reports Content</div>}
        </main>
      </div>
    </div>
  );
};

export default IntegratedDashboard;