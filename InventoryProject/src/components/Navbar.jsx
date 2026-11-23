import React, { useState, useEffect } from 'react';
import { logoutUser, getCurrentUser } from '../api/authApi';
import { useNotifications, EMPTY_LOW_STOCK } from '../features/dashboard/hooks/useNotifications';
import { getCmsMap } from '../api/cmsApi';
import NotificationInbox from '../features/dashboard/components/NotificationInbox';
import { PERMISSION_GROUPS, getUserPermissions, usesPagePermissions, getRoleLabel, canStocktake } from '../utils/permissions';

const MENU_CONFIG = {
  Supplier: [
    { label: 'Supplier Portal', value: 'SupplierPortal' },
  ],
  Admin: [
    { label: 'Dashboard Overview', value: 'Dashboard' },
    {
      label: 'POS & Register',
      submenu: [
        { label: 'Cashier Register', value: 'POS' },
        { label: 'Order Queue / KDS', value: 'POS/KDS' },
        { label: 'Void & Refund', value: 'POS/VOIDS' },
        { label: 'Shift X / Z Reading', value: 'POS/SHIFTS' },
        { label: 'Promos & QR Setup', value: 'POS/SETUP' },
      ]
    },
    {
      label: 'Products & Recipes',
      submenu: [
        { label: 'Menu Catalog', value: 'Products' },
        { label: 'Add & Modify Products', value: 'ManageProducts' },
        { label: 'Categories & Cup Sizes', value: 'ManageProducts/CATEGORIES' },
      ]
    },
    {
      label: 'Inventory & Batches',
      submenu: [
        { label: 'Raw Material Batches', value: 'RawMaterialTracker' },
        { label: 'Physical Stocktake', value: 'RawMaterialTracker/STOCKTAKE' },
        { label: 'Low-Stock & Expiry Alerts', value: 'LowStockAlerts' },
        { label: 'Receive Stock & OCR', value: 'StockReceived' },
        { label: 'Manage Raw Materials', value: 'ManageRawMaterials' },
        { label: 'Direct Product Stock', value: 'ProductStockTracker' },
        { label: 'Report Wastage', value: 'ReportWastage' },
      ]
    },
    {
      label: 'Purchasing & Suppliers',
      submenu: [
        { label: 'Purchase Orders', value: 'PurchaseOrders' },
        { label: 'Manage Suppliers', value: 'ManageSuppliers' },
      ]
    },
    {
      label: 'Analytics & Reports',
      submenu: [
        { label: 'AI Demand Forecasting', value: 'Forecasting' },
        { label: 'Sales Summary (D/W/M/Y)', value: 'SalesSummaryReport' },
        { label: 'Reports & Exports', value: 'Reports' },
        { label: 'Receipt Journal', value: 'SalesReceiptJournal' },
        { label: 'Audit Logs', value: 'AuditLogs' },
      ]
    },
    {
      label: 'Staff & Security',
      submenu: [
        { label: 'User Accounts', value: 'AccountManager' },
        { label: 'Manager Approval PINs', value: 'AccountManager/PINS' },
        { label: 'Staff Shift Logs', value: 'EmployeeTracker' },
      ]
    },
    {
      label: 'Website Management',
      submenu: [
        { label: 'Content Manager (CMS)', value: 'CMSDashboard' },
      ]
    },
  ],
};

MENU_CONFIG.Owner = MENU_CONFIG.Admin.map((item) =>
  item.label === 'Analytics & Reports'
    ? { ...item, submenu: [...item.submenu, { label: 'Transaction Logs', value: 'TransactionLogs' }] }
    : item
);

const ICONS = {
  'Dashboard Overview': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
  ),
  'POS & Register': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  ),
  'Products & Recipes': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  'Inventory & Batches': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
  ),
  'Purchasing & Suppliers': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
  ),
  'Analytics & Reports': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  'Staff & Security': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  ),
  'Website Management': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
  ),
  'Supplier Portal': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
  ),
  'Default': (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  )
};

const EXPANDED_PAGE_LINKS = {
  POS: [
    { label: 'Cashier Register', value: 'POS' },
    { label: 'Order Queue / KDS', value: 'POS/KDS' },
    { label: 'Void & Refund', value: 'POS/VOIDS' },
    { label: 'Shift X / Z Reading', value: 'POS/SHIFTS' },
  ],
  ManageProducts: [
    { label: 'Add & Modify Products', value: 'ManageProducts' },
    { label: 'Categories & Cup Sizes', value: 'ManageProducts/CATEGORIES' },
  ],
  RawMaterialTracker: [
    { label: 'Raw Material Batches', value: 'RawMaterialTracker' },
    { label: 'Physical Stocktake', value: 'RawMaterialTracker/STOCKTAKE' },
  ],
};

// Builds a sidebar menu from a Staff/Custom account's page permissions
const buildPermissionMenu = (user) => {
  const allowed = getUserPermissions(user);
  return PERMISSION_GROUPS
    .map((group) => {
      const permittedPages = group.pages.filter((p) => allowed.includes(p.key));
      if (permittedPages.length === 0) return null;

      const expandedItems = permittedPages
        .flatMap((p) => EXPANDED_PAGE_LINKS[p.key] || [{ label: p.label, value: p.key }])
        .filter((l) => l.value !== 'RawMaterialTracker/STOCKTAKE' || canStocktake(user));

      if (group.pages.length === 1 && expandedItems.length === 1) {
        return { label: group.label, value: expandedItems[0].value };
      }
      return { label: group.label, submenu: expandedItems };
    })
    .filter(Boolean);
};

const Navbar = ({ activeTab, onTabChange }) => {
  const [currentUser] = useState(() => getCurrentUser());
  const userRole = currentUser?.role || null;
  const [expanded, setExpanded] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('coftea_navbar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { unreadCount } = useNotifications(EMPTY_LOW_STOCK, currentUser);
  const [brandInfo, setBrandInfo] = useState({
    name: 'CofTea Cafe',
    logo: ''
  });

  useEffect(() => {
    let isMounted = true;
    const loadBrand = (force = false) => {
      getCmsMap(force)
        .then((map) => {
          if (!isMounted || !map) return;
          const brand = map.brand_logo;
          if (brand) {
            setBrandInfo({
              name: brand.title || 'CofTea Cafe',
              logo: brand.image_url || ''
            });
          }
        })
        .catch(() => {});
    };
    loadBrand(false);
    const handleCmsUpdate = () => loadBrand(true);
    window.addEventListener('cms:updated', handleCmsUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('cms:updated', handleCmsUpdate);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  const toggleDesktopCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('coftea_navbar_collapsed', String(next));
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/';
  };

  const toggleMenu = (label, collapsedMode = false) => {
    if (collapsedMode) {
      setIsCollapsed(false);
      try {
        localStorage.setItem('coftea_navbar_collapsed', 'false');
      } catch {
        // ignore
      }
      setExpanded(label);
      return;
    }
    setExpanded(expanded === label ? null : label);
  };

  const selectMenuItem = (value) => {
    onTabChange(value);
    setIsMobileOpen(false);
  };

  const menuItems = usesPagePermissions(currentUser)
    ? buildPermissionMenu(currentUser)
    : (MENU_CONFIG[userRole] || []);

  const getExpandedGroup = () => {
    for (const item of menuItems) {
      if (item.submenu && item.submenu.some(s => s.value === activeTab)) {
        return item.label;
      }
    }
    return null;
  };

  const effectiveExpanded = expanded !== null ? expanded : getExpandedGroup();

  const renderNavList = (collapsed = false) => (
    <ul className="list-none p-2.5 flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 m-0">
      {menuItems.map((item) => {
        const hasActiveChild = item.submenu?.some((s) => s.value === activeTab);
        const isGroupOpen = !collapsed && effectiveExpanded === item.label;

        return (
          <li key={item.value || item.label} className="p-0">
            {item.submenu ? (
              <>
                <div
                  title={collapsed ? item.label : undefined}
                  className={`rounded-xl cursor-pointer flex items-center text-sm font-bold tracking-wide transition-all duration-200 ${
                    collapsed
                      ? 'justify-center p-3'
                      : 'px-3.5 py-3 justify-between'
                  } ${
                    hasActiveChild && collapsed
                      ? 'bg-zinc-800 text-white shadow-xs'
                      : 'hover:bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                  onClick={() => toggleMenu(item.label, collapsed)}
                >
                  <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 overflow-hidden'}`}>
                    {ICONS[item.label] || ICONS['Default']}
                    <span
                      className={`truncate transition-all duration-200 ${
                        collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {!collapsed && (
                    <svg
                      className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${
                        isGroupOpen ? 'rotate-180 text-white' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>

                {/* Smooth collapsible submenu accordion */}
                <div
                  className={`grid transition-all duration-250 ease-out ${
                    isGroupOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <ul className="list-none p-0.5 m-0 space-y-1 pl-4 border-l border-zinc-800/80 ml-4">
                      {item.submenu.map((sub) => {
                        const isActive = activeTab === sub.value;
                        return (
                          <li
                            key={sub.value}
                            className={`py-2 px-3 rounded-lg cursor-pointer text-sm transition-colors flex items-center justify-between ${
                              isActive
                                ? 'bg-zinc-800 text-white font-bold shadow-xs'
                                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'
                            } ${sub.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                            onClick={() => !sub.disabled && selectMenuItem(sub.value)}
                            title={sub.disabled ? 'Coming soon' : ''}
                          >
                            <span className="truncate">{sub.label}</span>
                            {isActive && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <div
                title={collapsed ? item.label : undefined}
                className={`rounded-xl cursor-pointer flex items-center text-sm font-bold tracking-wide transition-all duration-200 ${
                  collapsed ? 'justify-center p-3 relative' : 'px-3.5 py-3 justify-between'
                } ${
                  activeTab === item.value
                    ? 'bg-zinc-800 text-white shadow-xs font-bold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
                onClick={() => selectMenuItem(item.value)}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 overflow-hidden'}`}>
                  {ICONS[item.label] || ICONS['Default']}
                  <span
                    className={`truncate transition-all duration-200 ${
                      collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {!collapsed ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {item.value === 'Dashboard' && unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white tabular-nums shadow-xs">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {activeTab === item.value && <span className="w-2 h-2 rounded-full bg-white"></span>}
                  </div>
                ) : (
                  item.value === 'Dashboard' && unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-zinc-950" />
                  )
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile / Tablet Top Header Bar (< lg) */}
      <header className="lg:hidden bg-zinc-950 text-white border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0 select-none z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={brandInfo.logo || "/favicon.svg"}
              alt="Logo"
              className="w-7 h-7 rounded-lg object-contain bg-white p-0.5 border border-white/20 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-white tracking-wide truncate">
                {brandInfo.name}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold truncate">
                {userRole ? `${getRoleLabel(currentUser)} Portal` : 'Staff Console'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationInbox onNavigate={selectMenuItem} variant="navbar" user={currentUser} />
        </div>
      </header>

      {/* Mobile Slide-Over Backdrop (< lg) */}
      <div
        className={`lg:hidden fixed inset-0 z-[9990] bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Mobile Slide-Over Sidebar Drawer (< lg) */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-[9995] w-72 max-w-[85vw] bg-zinc-950 text-white flex flex-col border-r border-zinc-800 shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-zinc-800 bg-black flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={brandInfo.logo || "/favicon.svg"}
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-white/20 shrink-0 shadow-xs"
            />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-white tracking-wide truncate">
                {brandInfo.name}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold truncate">
                {userRole ? `${getRoleLabel(currentUser)} Portal` : 'Staff Console'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation menu"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {renderNavList(false)}

        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <button
            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-zinc-800"
            onClick={handleLogout}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout Session</span>
          </button>
        </div>
      </aside>

      {/* Desktop Smooth Collapsible Sidebar (>= lg) */}
      <nav
        className={`hidden lg:flex bg-zinc-950 text-white flex-col border-r border-zinc-800 shrink-0 h-full overflow-hidden select-none transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isCollapsed ? 'w-20' : 'w-68'
        }`}
      >
        {/* Brand header */}
        <div className={`border-b border-zinc-800 bg-black transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-4'}`}>
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2.5 justify-center' : 'justify-between gap-2'}`}>
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 overflow-hidden'}`}>
              <img
                src={brandInfo.logo || "/favicon.svg"}
                alt="Logo"
                className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-white/20 shrink-0 shadow-xs"
              />
              {!isCollapsed && (
                <span className="text-sm font-extrabold text-white tracking-wide truncate">
                  {brandInfo.name}
                </span>
              )}
            </div>

            <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1.5' : 'gap-1'} shrink-0`}>
              <NotificationInbox
                onNavigate={selectMenuItem}
                variant="navbar"
                user={currentUser}
              />
              <button
                type="button"
                onClick={toggleDesktopCollapse}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mt-1.5 pl-0.5 truncate">
              {userRole ? `${getRoleLabel(currentUser)} Portal` : 'Staff Console'}
            </div>
          )}
        </div>

        {/* Nav list */}
        {renderNavList(isCollapsed)}

        {/* Logout button */}
        <div className={`border-t border-zinc-800 bg-zinc-950 ${isCollapsed ? 'p-2.5' : 'p-4'}`}>
          <button
            title={isCollapsed ? 'Logout Session' : undefined}
            className={`w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-zinc-800 ${
              isCollapsed ? 'p-3' : 'py-3 px-4'
            }`}
            onClick={handleLogout}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span>Logout Session</span>}
          </button>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
