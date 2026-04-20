import React, { useState } from 'react';
import '../styles/Dashboard.css';

import Navbar from './Navbar';
import DashboardOverview from './DashboardOverview';
import POS from './POS';

// Inventory System
import Products from './Products';
import ManageProducts from './ManageProducts';
import RequestProduct from './RequestProduct';
import ViewRequests from './ViewRequests';

// Inventory Stock
import StockReceived from './StockReceived';
import RawMaterialTracker from './RawMaterialTracker';
import ManageRawMaterials from './ManageRawMaterials';
import LowStockAlerts from './LowStockAlerts';

// Logs & Reports
import AuditLogs from './AuditLogs';
import TransactionLogs from './TransactionLogs';
import SalesReceiptJournal from './SalesReceiptJournal';
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
      case 'RequestProduct':    return <RequestProduct />;
      case 'ViewRequests':      return <ViewRequests />;

      // Inventory Stock
      case 'RawMaterialTracker': return <RawMaterialTracker />;
      case 'ManageRawMaterials': return <ManageRawMaterials />;
      case 'StockReceived':     return <StockReceived />;
      case 'LowStockAlerts':    return <LowStockAlerts />;

      // Logs & Reports
      case 'AuditLogs':         return <AuditLogs />;
      case 'TransactionLogs':   return <TransactionLogs />;
      case 'SalesReceiptJournal': return <SalesReceiptJournal />;
      case 'SalesSummaryReport': return <SalesSummaryReport />;

      // Account Management
      case 'AccountManager':    return <AccountManager />;
      case 'EmployeeTracker':   return <EmployeeTracker />;

      default:
        return (
          <div className="dashboard-not-found">
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