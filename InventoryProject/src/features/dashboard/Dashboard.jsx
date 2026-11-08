import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { clearUserSession } from '../../utils/authUtils';

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
import { canAccess, getUserPermissions } from '../../utils/permissions';

const Dashboard = () => {
  const user = getCurrentUser() || {};
  const getDefaultTab = () => {
    if (user.role === 'Supplier') return 'SupplierPortal';
    if (user.role === 'Admin' || user.role === 'Owner') return 'Dashboard';
    const allowed = getUserPermissions(user);
    if (allowed.includes('POS')) return 'POS';
    return allowed[0] || 'POS';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab);

  // Monitor account active status and session validity in real time
  useEffect(() => {
    if (!user?.id) return;

    // 1. Supabase Realtime channel listener for this specific user
    const channel = supabase
      .channel(`user_status_monitor_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const updated = payload.new;
          if (updated && (updated.status === 'INACTIVE' || updated.current_session_id === null)) {
            clearUserSession('deactivated');
            window.location.href = '/coftealoginpageforstaff';
          }
        }
      )
      .subscribe();

    // 2. Periodic heartbeat fallback check (every 10 seconds)
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('status, current_session_id')
          .eq('id', user.id)
          .single();
        if (!error && data && (data.status === 'INACTIVE' || data.current_session_id === null)) {
          clearUserSession('deactivated');
          window.location.href = '/coftealoginpageforstaff';
        }
      } catch {
        // ignore transient network errors
      }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id]);

  const isAuthorized = (tab) => canAccess(user, tab);

  const renderContent = () => {
    if (!isAuthorized(activeTab)) {
      const fallback = getDefaultTab();
      if (fallback !== activeTab && isAuthorized(fallback)) {
        setTimeout(() => setActiveTab(fallback), 0);
        return null;
      }
      return (
        <div className="p-8 flex-1 bg-gray-50">
          <h2 className="text-lg font-bold text-zinc-900 m-0">No pages assigned</h2>
          <p className="text-sm text-zinc-500 mt-1 m-0">Ask an administrator to grant access to this account.</p>
        </div>
      );
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
          <div key={activeTab} className="tab-pane-transition min-h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
