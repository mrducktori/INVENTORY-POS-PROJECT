import React, { useState, useEffect, useCallback } from 'react';
import SalesPerformanceReport from './SalesPerformanceReport';
import InventoryStatusReport from './InventoryStatusReport';
import StockMovementReport from './StockMovementReport';
import WastageReport from './WastageReport';

const TABS = [
  {
    id: 'sales',
    label: 'Sales Performance',
    desc: 'Revenue, staff performance, and top products',
  },
  {
    id: 'inventory',
    label: 'Inventory Status',
    desc: 'Current stock levels and health overview',
  },
  {
    id: 'movement',
    label: 'Stock Movement',
    desc: 'Consumption and stock changes over time',
  },
  {
    id: 'wastage',
    label: 'Wastage & Loss',
    desc: 'Wasted materials and estimated cost impact',
  },
];

const Reports = () => {
  const getInitialTab = () => {
    // The URL hash sub-route (e.g. #Reports/wastage) wins over the saved tab.
    if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
      const sub = window.location.hash.split('/')[1];
      if (TABS.some((t) => t.id === sub)) return sub;
    }
    try {
      const saved = localStorage.getItem('coftea_reports_active_tab');
      if (saved && TABS.some((t) => t.id === saved)) return saved;
    } catch {
      // ignore
    }
    return 'sales';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem('coftea_reports_active_tab', tabId);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#Reports/${tabId}`);
      }
    } catch {
      // ignore
    }
  }, []);

  // Keep the URL hash and localStorage in sync with the active tab.
  useEffect(() => {
    try {
      localStorage.setItem('coftea_reports_active_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#Reports/${activeTab}`);
      }
    } catch {
      // ignore
    }
  }, [activeTab]);

  const currentTab = TABS.find((t) => t.id === activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'sales':
        return <SalesPerformanceReport />;
      case 'inventory':
        return <InventoryStatusReport />;
      case 'movement':
        return <StockMovementReport />;
      case 'wastage':
        return <WastageReport />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8 pb-24 bg-gray-50 w-full flex flex-col min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight m-0">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            {currentTab?.desc} — generate, filter, export, or print.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`reports-tab-${tab.id}`}
            type="button"
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-zinc-900 text-white shadow-2xs font-bold'
                : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default Reports;
