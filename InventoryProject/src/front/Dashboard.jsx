import React, { useState } from 'react';
import '../styles/Dashboard.css';

import Navbar from './Navbar';
import DashboardOverview from './DashboardOverview';
import POS from './POS';

// Inventory System
import Products from './Products';
import ManageProducts from './ManageProducts';
import ModifyProduct from './ModifyProduct';
import RequestProduct from './RequestProduct';
import ViewRequests from './ViewRequests';

// Inventory Stock
import StockReceived from './StockReceived';
import RawMaterialTracker from './RawMaterialTracker';
import LowStockAlerts from './LowStockAlerts';

// Logs & Reports
import AdminLogs from './AdminLogs';
import TransactionLogs from './TransactionLogs';
import SalesSummaryReport from './SalesSummaryReport';

// Account Management
import AccountManager from './AccountManager';
import EmployeeTracker from './EmployeeTracker';

// Report Broken Items (Staff)
import ReportWastage from './ReportWastage';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':         return <DashboardOverview onNavigate={setActiveTab} />;
      case 'POS':               return <POS />;
      case 'ReportWastage':     return <ReportWastage />;

      // Inventory System
      case 'Products':          return <Products />;
      case 'ManageProducts':    return <ManageProducts />;
      case 'ModifyProduct':     return <ModifyProduct />;
      case 'RequestProduct':    return <RequestProduct />;
      case 'ViewRequests':      return <ViewRequests />;

      // Inventory Stock
      case 'RawMaterialTracker': return <RawMaterialTracker />;
      case 'StockReceived':     return <StockReceived />;
      case 'LowStockAlerts':    return <LowStockAlerts />;

      // Logs & Reports
      case 'AdminLogs':         return <AdminLogs />;
      case 'TransactionLogs':   return <TransactionLogs />;
      case 'SalesSummaryReport': return <SalesSummaryReport />;

      // Account Management
      case 'AccountManager':    return <AccountManager />;
      case 'EmployeeTracker':   return <EmployeeTracker />;

      default:
        return (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            <h2>Page not found</h2>
            <p>The selected tab "{activeTab}" does not have a component yet.</p>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-body">
      <div className="dashboard-container">
        <div className="dashboard-content">
          <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="dashboard-main">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;