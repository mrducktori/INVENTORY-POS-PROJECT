import React, { useState } from 'react';

import Navbar from '../../components/Navbar';
import DashboardOverview from './DashboardOverview';
import POS from '../pos/POS';

// Inventory System
import Products from '../inventory/Products';
import ManageProducts from '../inventory/ManageProducts';

// Inventory Stock

import RawMaterialTracker from '../inventory/RawMaterialTracker';
import ManageRawMaterials from '../inventory/ManageRawMaterials';
import LowStockAlerts from '../inventory/LowStockAlerts';
import ProductStockTracker from '../inventory/ProductStockTracker';
import PurchaseOrders from '../inventory/PurchaseOrders';
import ManageSuppliers from '../inventory/ManageSuppliers';

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

// Content Management
import CMSDashboard from '../cms/CMSDashboard';

// Supplier Portal
import SupplierPortal from '../inventory/SupplierPortal';
import { getCurrentUser } from '../../utils/authUtils';

const Dashboard = () => {
  const user = getCurrentUser() || {};
  const [activeTab, setActiveTab] = useState(
    user.role === 'Supplier' ? 'SupplierPortal' : 
    (user.role === 'Staff' ? 'POS' : 'Dashboard')
  );

  const isAuthorized = (tab) => {
    // Owner-exclusive tabs
    const ownerOnly = ['TransactionLogs'];
    if (ownerOnly.includes(tab)) return user.role === 'Owner';

    if (user.role === 'Admin' || user.role === 'Owner') return true;
    
    if (user.role === 'Supplier') return tab === 'SupplierPortal';

    // Staff restricted tabs
    const staffAllowed = ['POS', 'Products', 'RawMaterialTracker', 'ProductStockTracker', 'ReportWastage'];
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

      case 'LowStockAlerts':    return <LowStockAlerts />;
      case 'PurchaseOrders':    return <PurchaseOrders />;
      case 'ManageSuppliers':   return <ManageSuppliers />;

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

      // Content Management
      // Content Management
      case 'CMSDashboard':      return <CMSDashboard />;

      // Supplier Portal
      case 'SupplierPortal':    return <SupplierPortal />;

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
    <div className="w-full h-screen bg-[#f8fafc] text-zinc-900 font-sans flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] scrollbar-thin scrollbar-thumb-zinc-300 hover:scrollbar-thumb-zinc-400">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
