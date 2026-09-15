import React, { useState } from 'react';

import Navbar from '../../components/Navbar';
import DashboardOverview from './DashboardOverview';
import POS from '../pos/POS';

// Inventory System
import Products from '../inventory/Products';
import ManageProducts from '../inventory/ManageProducts';

// Inventory Stock
import StockReceived from '../inventory/StockReceived';
import RawMaterialTracker from '../inventory/RawMaterialTracker';
import ManageRawMaterials from '../inventory/ManageRawMaterials';
import LowStockAlerts from '../inventory/LowStockAlerts';
import ProductStockTracker from '../inventory/ProductStockTracker';
import PurchaseOrders from '../inventory/PurchaseOrders';

// Logs & Reports
import AuditLogs from '../logs/AuditLogs';
import TransactionLogs from '../logs/TransactionLogs';
import SalesReceiptJournal from '../logs/SalesReceiptJournal';
import SalesSummaryReport from '../logs/SalesSummaryReport';

// Account Management
import AccountManager from '../accounts/AccountManager';

// Report Broken Items (Staff)
import ReportWastage from '../wastage/ReportWastage';

// Analytics
import DemandForecasting from '../analytics/DemandForecasting';

// Reports Module
import Reports from '../reports/Reports';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState(user.role === 'Staff' ? 'POS' : 'Dashboard');

  const isAuthorized = (tab) => {
    // Owner-exclusive tabs
    const ownerOnly = ['TransactionLogs'];
    if (ownerOnly.includes(tab)) return user.role === 'Owner';

    if (user.role === 'Admin' || user.role === 'Owner') return true;
    
    // Staff restricted tabs
    const staffAllowed = ['POS', 'Products', 'RawMaterialTracker', 'ProductStockTracker', 'StockReceived', 'ReportWastage'];
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

      // Inventory Stock
      case 'RawMaterialTracker': return <RawMaterialTracker />;
      case 'ProductStockTracker': return <ProductStockTracker />;
      case 'ManageRawMaterials': return <ManageRawMaterials />;
      case 'StockReceived':     return <StockReceived />;
      case 'LowStockAlerts':    return <LowStockAlerts />;
      case 'PurchaseOrders':    return <PurchaseOrders />;

      // Logs & Reports
      case 'AuditLogs':         return <AuditLogs />;
      case 'TransactionLogs':   return <TransactionLogs />;
      case 'SalesReceiptJournal': return <SalesReceiptJournal />;
      case 'SalesSummaryReport': return <SalesSummaryReport />;

      // Account Management
      case 'AccountManager':    return <AccountManager />;

      // Analytics
      case 'Forecasting':       return <DemandForecasting />;

      // Reports Module
      case 'Reports':           return <Reports />;


      default:
        return (
          <div className="p-10 text-center text-[#999]">
            <h2>Page not found</h2>
            <p>The selected tab "{activeTab}" does not have a component yet.</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-screen bg-white text-gray-900 font-sans flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-gray-50 scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
