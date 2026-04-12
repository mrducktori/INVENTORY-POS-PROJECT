import React, { useState } from 'react';
import '../styles/Dashboard_test.css';
import POS from './POS';
import Navbar from './Navbar';
import StockReceived from './StockReceived';
import RawMaterialTracker from './RawMaterialTracker';
import LowStockAlerts from './LowStockAlerts';
import ReportWastage from './ReportWastage';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('POS');

  return (
    <div className="dashboard-body">
      <div className="dashboard-container">
        <div className="dashboard-content">
          <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="dashboard-main">
            {activeTab === 'POS' && <POS />}
            {activeTab === 'StockReceived' && <StockReceived />}
            {activeTab === 'RawMaterialTracker' && <RawMaterialTracker />}
            {activeTab === 'LowStockAlerts' && <LowStockAlerts />}
            {activeTab === 'ReportWastage' && <ReportWastage />}
            {activeTab === 'Products' && <div className="placeholder">Products Management</div>}
            {activeTab === 'Recipes' && <div className="placeholder">Recipes Management</div>}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;