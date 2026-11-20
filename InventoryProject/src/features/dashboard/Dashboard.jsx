import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { supabase } from '../../config/supabaseClient';
import { clearUserSession, getCurrentUser } from '../../utils/authUtils';
import { canAccess, getUserPermissions } from '../../utils/permissions';

import Navbar from '../../components/Navbar';
import DashboardOverview from './DashboardOverview';
import AdminNotificationPopup from './components/AdminNotificationPopup';
import ErrorBoundary from '../../components/shared/ErrorBoundary';

// Lazy-load secondary dashboard modules so initial bundle load is fast and light
const POS = lazy(() => import('../pos/POS'));
const Products = lazy(() => import('../inventory/Products'));
const ManageProducts = lazy(() => import('../inventory/ManageProducts'));
const RawMaterialTracker = lazy(() => import('../inventory/RawMaterialTracker'));
const ManageRawMaterials = lazy(() => import('../inventory/ManageRawMaterials'));
const LowStockAlerts = lazy(() => import('../inventory/LowStockAlerts'));
const ProductStockTracker = lazy(() => import('../inventory/ProductStockTracker'));
const StockReceived = lazy(() => import('../inventory/StockReceived'));
const PurchaseOrders = lazy(() => import('../inventory/PurchaseOrders'));
const ManageSuppliers = lazy(() => import('../inventory/ManageSuppliers'));
const AuditLogs = lazy(() => import('../logs/AuditLogs'));
const AdminLogs = lazy(() => import('../logs/AdminLogs'));
const TransactionLogs = lazy(() => import('../logs/TransactionLogs'));
const SalesReceiptJournal = lazy(() => import('../logs/SalesReceiptJournal'));
const SalesSummaryReport = lazy(() => import('../logs/SalesSummaryReport'));
const AccountManager = lazy(() => import('../accounts/AccountManager'));
const EmployeeTracker = lazy(() => import('../accounts/EmployeeTracker'));
const ReportWastage = lazy(() => import('../wastage/ReportWastage'));
const RequestProduct = lazy(() => import('../requests/RequestProduct'));
const ViewRequests = lazy(() => import('../requests/ViewRequests'));
const DemandForecasting = lazy(() => import('../analytics/DemandForecasting'));
const Reports = lazy(() => import('../reports/Reports'));
const CMSDashboard = lazy(() => import('../cms/CMSDashboard'));
const SupplierPortal = lazy(() => import('../inventory/SupplierPortal'));

const Dashboard = () => {
  const user = useMemo(() => getCurrentUser() || {}, []);
  const getDefaultTab = useCallback(() => {
    if (user.role === 'Supplier') return 'SupplierPortal';
    if (user.role === 'Admin' || user.role === 'Owner') return 'Dashboard';
    const allowed = getUserPermissions(user);
    if (allowed.includes('POS')) return 'POS';
    return allowed[0] || 'POS';
  }, [user]);

  const getInitialTab = useCallback(() => {
    // 1. Check URL hash first (e.g. #Reports or #Reports/wastage)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashTab = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (hashTab && canAccess(user, hashTab)) {
        return hashTab;
      }
    }
    // 2. Check localStorage
    try {
      const savedTab = localStorage.getItem('coftea_active_tab');
      if (savedTab && canAccess(user, savedTab)) {
        return savedTab;
      }
    } catch {
      // ignore
    }
    return getDefaultTab();
  }, [user, getDefaultTab]);

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const isAuthorized = useCallback((tab) => canAccess(user, tab), [user]);
  const defaultTab = getDefaultTab();
  const effectiveTab = isAuthorized(activeTab)
    ? activeTab
    : (isAuthorized(defaultTab) ? defaultTab : null);

  const handleTabChange = useCallback((newTab) => {
    const targetTab = isAuthorized(newTab) ? newTab : getDefaultTab();
    setActiveTab(targetTab);
    try {
      localStorage.setItem('coftea_active_tab', targetTab);
      if (typeof window !== 'undefined') {
        const currentHash = window.location.hash.replace(/^#\/?/, '');
        if (!currentHash.startsWith(targetTab)) {
          window.history.replaceState(null, '', `#${targetTab}`);
        }
      }
    } catch {
      // ignore
    }
  }, [isAuthorized, getDefaultTab]);

  // Sync state with URL hash and localStorage on tab changes
  useEffect(() => {
    if (!effectiveTab) return;
    if (typeof window !== 'undefined') {
      const currentMain = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (currentMain !== effectiveTab) {
        window.history.replaceState(null, '', `#${effectiveTab}`);
      }
    }
    try {
      localStorage.setItem('coftea_active_tab', effectiveTab);
    } catch { /* ignore storage errors */ }
  }, [effectiveTab]);

  // Handle browser Back / Forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hashTab = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (hashTab && hashTab !== effectiveTab && canAccess(user, hashTab)) {
        setActiveTab(hashTab);
        try {
          localStorage.setItem('coftea_active_tab', hashTab);
        } catch { /* ignore storage errors */ }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [effectiveTab, user]);

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
            clearUserSession(updated.status === 'INACTIVE' ? 'deactivated' : 'expired');
            window.location.href = '/coftealoginpageforstaff';
          }
        }
      )
      .subscribe();

    // 2. Periodic heartbeat fallback check (every 60 seconds when tab is visible)
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('status, current_session_id')
          .eq('id', user.id)
          .single();
        if (!error && data && (data.status === 'INACTIVE' || data.current_session_id === null)) {
          clearUserSession(data.status === 'INACTIVE' ? 'deactivated' : 'expired');
          window.location.href = '/coftealoginpageforstaff';
        }
      } catch {
        // ignore transient network errors
      }
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id]);

  const renderContent = () => {
    if (!effectiveTab) {
      return (
        <div className="p-8 flex-1 bg-gray-50">
          <h2 className="text-lg font-bold text-zinc-900 m-0">No pages assigned</h2>
          <p className="text-sm text-zinc-500 mt-1 m-0">Ask an administrator to grant access to this account.</p>
        </div>
      );
    }

    switch (effectiveTab) {
      case 'Dashboard':         return <DashboardOverview onNavigate={handleTabChange} />;
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
      case 'ManageSuppliers':   return <ManageSuppliers />;

      // Logs & Reports
      case 'AuditLogs':         return <AuditLogs />;
      case 'AdminLogs':         return <AdminLogs />;
      case 'TransactionLogs':   return <TransactionLogs />;
      case 'SalesReceiptJournal': return <SalesReceiptJournal />;
      case 'SalesSummaryReport': return <SalesSummaryReport />;

      // Account Management & Staff Requests
      case 'AccountManager':    return <AccountManager />;
      case 'EmployeeTracker':   return <EmployeeTracker />;
      case 'RequestProduct':    return <RequestProduct />;
      case 'ViewRequests':      return <ViewRequests />;

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

  const displayTab = effectiveTab || activeTab;

  return (
    <div className="w-full h-screen bg-[#f8fafc] text-zinc-900 font-sans flex flex-col">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <Navbar activeTab={displayTab} onTabChange={handleTabChange} />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] scrollbar-thin scrollbar-thumb-zinc-300 hover:scrollbar-thumb-zinc-400">
          <div key={displayTab} className="tab-pane-transition min-h-full">
            <ErrorBoundary key={displayTab} level="tab">
              <Suspense
                fallback={
                  <div className="p-8 space-y-4">
                    <div className="h-8 w-56 bg-zinc-200/80 rounded-lg animate-pulse" />
                    <div className="h-4 w-80 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-64 w-full bg-white border border-zinc-200 rounded-2xl animate-pulse mt-6" />
                  </div>
                }
              >
                {renderContent()}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <AdminNotificationPopup user={user} onNavigate={handleTabChange} />
    </div>
  );
};

export default Dashboard;
