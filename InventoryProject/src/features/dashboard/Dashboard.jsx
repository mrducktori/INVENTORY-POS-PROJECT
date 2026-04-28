import React, { useState } from 'react';
import './Dashboard.css';

import Navbar from '../../components/Navbar';
import DashboardOverview from './DashboardOverview';
import POS from '../pos/POS';

// Inventory System
import Products from '../inventory/Products';
import ManageProducts from '../inventory/ManageProducts';
import RequestProduct from '../requests/RequestProduct';
import ViewRequests from '../requests/ViewRequests';

// Inventory Stock
import StockReceived from '../inventory/StockReceived';
import RawMaterialTracker from '../inventory/RawMaterialTracker';
import ManageRawMaterials from '../inventory/ManageRawMaterials';
import LowStockAlerts from '../inventory/LowStockAlerts';

// Logs & Reports
import AuditLogs from '../logs/AuditLogs';
import TransactionLogs from '../logs/TransactionLogs';
import SalesReceiptJournal from '../logs/SalesReceiptJournal';
import SalesSummaryReport from '../logs/SalesSummaryReport';

// Account Management
import AccountManager from '../accounts/AccountManager';
import EmployeeTracker from '../accounts/EmployeeTracker';

// Report Broken Items (Staff)
import ReportWastage from '../wastage/ReportWastage';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState(user.role === 'Staff' ? 'POS' : 'Dashboard');

  const isAuthorized = (tab) => {
    if (user.role === 'Admin' || user.role === 'Owner') return true;
    
    // Staff restricted tabs
    const staffAllowed = ['POS', 'Products', 'RawMaterialTracker', 'StockReceived', 'ReportWastage'];
    return staffAllowed.includes(tab);
  };

  const renderContent = () => {
    if (!isAuthorized(activeTab)) {
      setActiveTab('POS');
      return <POS />;
    }

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
