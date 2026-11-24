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

const SUBTAB_PARENTS = new Set(['POS', 'RawMaterialTracker', 'ManageProducts', 'AccountManager']);

const resolveInitialRoute = (user, defaultTab) => {
  if (typeof window !== 'undefined' && window.location.hash) {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    const [hashTab, hashSub = null] = rawHash.split('/');
    if (hashTab && canAccess(user, rawHash)) {
      return {
        tab: hashTab,
        subTab: SUBTAB_PARENTS.has(hashTab) && hashSub ? hashSub : null
      };
    }
  }
  try {
    const saved = localStorage.getItem('coftea_active_tab');
    if (saved) {
      const [savedTab, savedSub = null] = saved.split('/');
      if (savedTab && canAccess(user, saved)) {
        return {
          tab: savedTab,
          subTab: SUBTAB_PARENTS.has(savedTab) && savedSub ? savedSub : null
        };
      }
    }
  } catch {
    // Storage can be unavailable; fall back to the default tab.
  }
  return { tab: defaultTab, subTab: null };
};

const Dashboard = () => {
  const user = useMemo(() => getCurrentUser() || {}, []);
  const getDefaultTab = useCallback(() => {
    if (user.role === 'Supplier') return 'SupplierPortal';
    if (user.role === 'Admin' || user.role === 'Owner') return 'Dashboard';
    const allowed = getUserPermissions(user);
    if (allowed.includes('POS')) return 'POS';
    return allowed[0] || 'POS';
  }, [user]);

  const initialRoute = useMemo(() => resolveInitialRoute(user, getDefaultTab()), [user, getDefaultTab]);
  const [activeTab, setActiveTab] = useState(initialRoute.tab);
  const [activeSubTab, setActiveSubTab] = useState(initialRoute.subTab);

  const isAuthorized = useCallback((tab) => canAccess(user, tab), [user]);
  const defaultTab = getDefaultTab();
  const effectiveTab = isAuthorized(activeTab)
    ? activeTab
    : (isAuthorized(defaultTab) ? defaultTab : null);
  const effectiveSubTab =
    effectiveTab && SUBTAB_PARENTS.has(effectiveTab) && activeSubTab && isAuthorized(`${effectiveTab}/${activeSubTab}`)
      ? activeSubTab
      : null;

  const handleTabChange = useCallback((newTab) => {
    const [rawBase, rawSub = null] = String(newTab || '').split('/');
    const targetBase = isAuthorized(rawBase) ? rawBase : getDefaultTab();
    const targetSub =
      rawBase === targetBase &&
      SUBTAB_PARENTS.has(targetBase) &&
      rawSub &&
      isAuthorized(`${targetBase}/${rawSub}`)
        ? rawSub
        : null;

    setActiveTab(targetBase);
    setActiveSubTab(targetSub);

    const routeString = targetSub ? `${targetBase}/${targetSub}` : targetBase;
    try {
      localStorage.setItem('coftea_active_tab', routeString);
      if (typeof window !== 'undefined') {
        const currentHash = window.location.hash.replace(/^#\/?/, '');
        if (targetBase === 'Reports') {
          if (!currentHash.startsWith('Reports')) {
            window.history.replaceState(null, '', '#Reports');
          }
        } else if (currentHash !== routeString) {
          window.history.replaceState(null, '', `#${routeString}`);
        }
      }
    } catch {
      // Storage or history can be unavailable; the tab still works.
    }
  }, [isAuthorized, getDefaultTab]);

  useEffect(() => {
    if (!effectiveTab) return;
    const routeString = effectiveSubTab ? `${effectiveTab}/${effectiveSubTab}` : effectiveTab;
    if (typeof window !== 'undefined') {
      const currentRaw = window.location.hash.replace(/^#\/?/, '');
      const currentMain = currentRaw.split('/')[0];
      if (effectiveTab === 'Reports') {
        if (currentMain !== 'Reports') {
          window.history.replaceState(null, '', '#Reports');
        }
      } else if (currentRaw !== routeString) {
        window.history.replaceState(null, '', `#${routeString}`);
      }
    }
    try {
      localStorage.setItem('coftea_active_tab', routeString);
    } catch { /* ignore storage errors */ }
  }, [effectiveTab, effectiveSubTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      const [hashTab, hashSub = null] = rawHash.split('/');
      const nextSub = SUBTAB_PARENTS.has(hashTab) ? hashSub : null;
      if (hashTab && canAccess(user, rawHash) && (hashTab !== effectiveTab || nextSub !== effectiveSubTab)) {
        setActiveTab(hashTab);
        setActiveSubTab(nextSub);
        try {
          localStorage.setItem('coftea_active_tab', nextSub ? `${hashTab}/${nextSub}` : hashTab);
        } catch { /* ignore storage errors */ }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [effectiveTab, effectiveSubTab, user]);

  // Monitor account active status and session validity in real time
  useEffect(() => {
    if (!user?.id) return;

    // Realtime listener for status changes on this user.
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

    // Heartbeat fallback in case a realtime event is missed (skipped while the tab is hidden).
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
        // A failed heartbeat is retried on the next tick.
      }
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id]);

  const handleSubTabChange = useCallback(
    (sub) => {
      if (!effectiveTab) return;
      handleTabChange(sub ? `${effectiveTab}/${sub}` : effectiveTab);
    },
    [effectiveTab, handleTabChange]
  );

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
      case 'POS':               return <POS subTab={effectiveSubTab} onSubTabChange={handleSubTabChange} />;
      case 'ReportWastage':     return <ReportWastage />;

      case 'Products':          return <Products />;
      case 'ManageProducts':    return <ManageProducts subTab={effectiveSubTab} onSubTabChange={handleSubTabChange} />;

      case 'RawMaterialTracker': return <RawMaterialTracker subTab={effectiveSubTab} onSubTabChange={handleSubTabChange} />;
      case 'ProductStockTracker': return <ProductStockTracker />;
      case 'ManageRawMaterials': return <ManageRawMaterials />;
      case 'StockReceived':     return <StockReceived />;

      case 'LowStockAlerts':    return <LowStockAlerts />;
      case 'PurchaseOrders':    return <PurchaseOrders />;
      case 'ManageSuppliers':   return <ManageSuppliers />;

      case 'AuditLogs':         return <AuditLogs />;
      case 'AdminLogs':         return <AdminLogs />;
      case 'TransactionLogs':   return <TransactionLogs />;
      case 'SalesReceiptJournal': return <SalesReceiptJournal />;
      case 'SalesSummaryReport': return <SalesSummaryReport />;

      case 'AccountManager':    return <AccountManager subTab={effectiveSubTab} onSubTabChange={handleSubTabChange} />;
      case 'EmployeeTracker':   return <EmployeeTracker />;
      case 'RequestProduct':    return <RequestProduct />;
      case 'ViewRequests':      return <ViewRequests />;

      case 'Forecasting':       return <DemandForecasting />;

      case 'Reports':           return <Reports />;

      case 'CMSDashboard':      return <CMSDashboard />;

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
  const navActiveTab = effectiveSubTab ? `${displayTab}/${effectiveSubTab}` : displayTab;

  return (
    <div className="w-full h-screen bg-[#f8fafc] text-zinc-900 font-sans flex flex-col">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <Navbar activeTab={navActiveTab} onTabChange={handleTabChange} />
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
