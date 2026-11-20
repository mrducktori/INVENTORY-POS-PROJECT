import React, { useState, useEffect, useRef } from 'react';
import { useNotifications, getRelativeTimeString } from '../hooks/useNotifications';

const BADGE_STYLES = {
  danger: 'bg-rose-100 text-rose-800 border-rose-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  info: 'bg-sky-100 text-sky-800 border-sky-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  neutral: 'bg-zinc-100 text-zinc-800 border-zinc-200',
};

const ICON_BG = {
  danger: 'bg-rose-50 text-rose-600 border-rose-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  info: 'bg-sky-50 text-sky-600 border-sky-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  neutral: 'bg-zinc-50 text-zinc-600 border-zinc-200',
};

const NotificationInbox = ({ onNavigate, lowStockItems = [], variant = 'default', user = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'PO' | 'STOCK' | 'SUPPLIER'
  const drawerRef = useRef(null);

  const {
    notifications,
    unreadCount,
    criticalCount,
    loading,
    currentUser,
    canViewStock,
    canViewPOs,
    canViewSuppliers,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    clearReadNotifications
  } = useNotifications(lowStockItems, user);

  const isSupplier = String(currentUser?.role || '').toLowerCase() === 'supplier';

  const dangerCount = notifications.filter((n) => n.badgeVariant === 'danger').length;
  const stockCount = notifications.filter((n) => n.category === 'STOCK').length;
  const poCount = notifications.filter((n) => n.category === 'PO').length;
  const supplierCount = notifications.filter((n) => n.category === 'SUPPLIER').length;

  const poPendingCount = notifications.filter((n) => n.type === 'PO_PENDING').length;
  const poProposalCount = notifications.filter((n) => n.type === 'PO_POSTPONED').length;
  const poActiveCount = notifications.filter(
    (n) => n.type === 'PO_ACCEPTED' || n.type === 'PO_DELIVERING' || n.type === 'PO_PARTIAL'
  ).length;
  const poCancelledCount = notifications.filter((n) => n.type === 'PO_CANCELLED').length;
  const poDeclinedCount = notifications.filter((n) => n.type === 'PO_DECLINED').length;

  const filterPills = [
    { key: 'ALL', label: 'All', count: notifications.length },
    { key: 'UNREAD', label: 'Unread', count: unreadCount },
    ...(isSupplier
      ? [
          { key: 'PO_PENDING', label: 'Pending', count: poPendingCount },
          ...(poProposalCount > 0 ? [{ key: 'PO_PROPOSALS', label: 'Proposals', count: poProposalCount }] : []),
          { key: 'PO_ACTIVE', label: 'Active', count: poActiveCount },
          ...(poCancelledCount > 0 ? [{ key: 'PO_CANCELLED', label: 'Cancelled', count: poCancelledCount }] : []),
          ...(poDeclinedCount > 0 ? [{ key: 'PO_DECLINED', label: 'Declined', count: poDeclinedCount }] : [])
        ]
      : [
          { key: 'CRITICAL', label: 'Critical', count: dangerCount },
          ...(canViewStock ? [{ key: 'STOCK', label: 'Stock Alerts', count: stockCount }] : []),
          ...(canViewPOs ? [{ key: 'PO', label: 'PO Updates', count: poCount }] : []),
          ...(canViewSuppliers && supplierCount > 0
            ? [{ key: 'SUPPLIER', label: 'Price Updates', count: supplierCount }]
            : [])
        ])
  ];

  // Tab safety on role/permission switches (derived during render)
  const effectiveTab = filterPills.some((pill) => pill.key === activeTab) ? activeTab : 'ALL';

  // Close drawer on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Tab filtered items
  const filteredNotifications = notifications.filter((item) => {
    switch (effectiveTab) {
      case 'UNREAD':
        return !item.isRead;
      case 'CRITICAL':
        return item.badgeVariant === 'danger';
      case 'STOCK':
        return item.category === 'STOCK';
      case 'PO':
        return item.category === 'PO';
      case 'SUPPLIER':
        return item.category === 'SUPPLIER';
      case 'PO_PENDING':
        return item.type === 'PO_PENDING';
      case 'PO_PROPOSALS':
        return item.type === 'PO_POSTPONED';
      case 'PO_ACTIVE':
        return item.type === 'PO_ACCEPTED' || item.type === 'PO_DELIVERING' || item.type === 'PO_PARTIAL';
      case 'PO_CANCELLED':
        return item.type === 'PO_CANCELLED';
      case 'PO_DECLINED':
        return item.type === 'PO_DECLINED';
      default:
        return true;
    }
  });

  const handleActionClick = (n) => {
    markAsRead(n.id);
    setIsOpen(false);
    if (onNavigate && n.actionTab) {
      onNavigate(n.actionTab);
    }
  };

  const renderIcon = (type) => {
    switch (type) {
      case 'PO_ACCEPTED':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'PO_DECLINED':
      case 'PO_CANCELLED':
      case 'STOCK_OUT':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'PO_PENDING':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        );
      case 'PO_POSTPONED':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'PO_DELIVERING':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        );
      case 'PO_PARTIAL':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'SUPPLIER_PRICE_UPDATE':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'STOCK_LOW':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  return (
    <>
      {/* Header Trigger Button */}
      {variant === 'navbar' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer select-none flex items-center justify-center shrink-0 border border-transparent hover:border-zinc-800"
          title="Notifications & Alerts"
          aria-label="View notifications and inbox"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-zinc-800 text-sm font-bold shadow-xs hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98] transition-all cursor-pointer select-none"
          aria-label="View notifications and inbox"
        >
          <span className="relative flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
            )}
          </span>
          
          <span className="hidden sm:inline">Inbox & Alerts</span>

          {unreadCount > 0 ? (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-black rounded-full bg-rose-600 text-white tabular-nums shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>
      )}

      {/* Slide-over Drawer & Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
            <div
              ref={drawerRef}
              className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-extrabold text-zinc-900 m-0 tracking-tight leading-none">
                          Notifications
                        </h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {currentUser?.role === 'Owner'
                            ? 'Executive'
                            : currentUser?.role === 'Admin'
                            ? 'Admin'
                            : currentUser?.role === 'Staff'
                            ? 'Staff'
                            : currentUser?.role === 'Supplier'
                            ? 'Supplier'
                            : currentUser?.custom_role_name || 'Custom'}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 font-medium">
                        {currentUser?.role === 'Staff'
                          ? 'Operational stock alerts & raw material levels'
                          : currentUser?.role === 'Supplier'
                          ? 'Assigned purchase orders and delivery tracking'
                          : 'Live inventory stock & purchase order updates'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                    aria-label="Close notification drawer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Subheader action row */}
                <div className="flex items-center justify-between pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-700">
                      {unreadCount} Unread
                    </span>
                    {criticalCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                        {criticalCount} Critical
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-zinc-700 hover:text-black font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 overflow-x-auto pb-1 scrollbar-none">
                  {filterPills.map((pill) => (
                    <button
                      key={pill.key}
                      onClick={() => setActiveTab(pill.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        effectiveTab === pill.key
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {pill.label} ({pill.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
                {loading && notifications.length === 0 ? (
                  <div className="space-y-3 py-2 animate-pulse">
                    <div className="h-14 bg-zinc-200/70 rounded-xl"></div>
                    <div className="h-14 bg-zinc-200/70 rounded-xl"></div>
                    <div className="h-14 bg-zinc-200/70 rounded-xl"></div>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-zinc-800 m-0">All caught up!</h3>
                    <p className="text-xs text-zinc-500 max-w-xs mt-1 mb-0">
                      {effectiveTab === 'UNREAD'
                        ? 'You have zero unread notifications. Great job keeping on top of operations!'
                        : 'No alerts found in this section right now.'}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const badgeClass = BADGE_STYLES[n.badgeVariant] || BADGE_STYLES.neutral;
                    const iconClass = ICON_BG[n.badgeVariant] || ICON_BG.neutral;

                    return (
                      <div
                        key={n.id}
                        className={`relative rounded-xl border p-4 transition-all duration-200 ${
                          !n.isRead
                            ? 'bg-white border-zinc-300 shadow-sm'
                            : 'bg-zinc-50/70 border-zinc-200/80 hover:bg-white'
                        }`}
                      >
                        {/* Unread indicator dot */}
                        {!n.isRead && (
                          <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-50"></span>
                        )}

                        <div className="flex items-start gap-3">
                          {/* Type Icon */}
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconClass}`}
                          >
                            {renderIcon(n.type, n.badgeVariant)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeClass}`}
                              >
                                {n.badgeText}
                              </span>
                              <span className="text-xs text-zinc-400 font-medium">
                                {getRelativeTimeString(n.timestamp)}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-zinc-900 m-0 tracking-tight leading-snug">
                              {n.title}
                            </h4>

                            <p className="text-xs text-zinc-600 mt-1 mb-0 leading-relaxed">
                              {n.message}
                            </p>

                            {/* Actions row */}
                            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-gray-100">
                              {n.actionTab ? (
                                <button
                                  onClick={() => handleActionClick(n)}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 hover:text-blue-600 cursor-pointer transition-colors"
                                >
                                  <span>{n.actionLabel || 'View Details'}</span>
                                  <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </button>
                              ) : (
                                <span className="text-[11px] text-zinc-400 font-medium">Informational</span>
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => (n.isRead ? markAsUnread(n.id) : markAsRead(n.id))}
                                  className="px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 rounded transition-colors cursor-pointer"
                                  title={n.isRead ? 'Mark as unread' : 'Mark as read'}
                                >
                                  {n.isRead ? 'Mark Unread' : 'Mark Read'}
                                </button>
                                <button
                                  onClick={() => dismissNotification(n.id)}
                                  className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Dismiss notification"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-medium">Live Supabase Sync Active</span>
                </div>

                {notifications.some((n) => n.isRead) && (
                  <button
                    onClick={clearReadNotifications}
                    className="font-bold text-zinc-600 hover:text-zinc-900 hover:underline cursor-pointer"
                  >
                    Clear Read
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationInbox;
