import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('sales');

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
    <div className="p-4 md:p-8 pb-24 bg-white w-full flex flex-col min-h-screen space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight m-0">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            {currentTab?.desc} — generate, filter, export, or print.
          </p>
        </div>
      </div>

      {/* Modern Executive Pill Tab Navigation */}
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
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Report Container */}
      <div className="flex-1 flex flex-col min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default Reports;
