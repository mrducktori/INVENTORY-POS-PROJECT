import React, { useState } from 'react';
import SalesPerformanceReport from './SalesPerformanceReport';
import InventoryStatusReport  from './InventoryStatusReport';
import StockMovementReport    from './StockMovementReport';
import WastageReport          from './WastageReport';

const TABS = [
  {
    id:    'sales',
    label: 'Sales Performance',
    desc:  'Revenue, staff performance, and top products',
  },
  {
    id:    'inventory',
    label: 'Inventory Status',
    desc:  'Current stock levels and health overview',
  },
  {
    id:    'movement',
    label: 'Stock Movement',
    desc:  'Consumption and stock changes over time',
  },
  {
    id:    'wastage',
    label: 'Wastage & Loss',
    desc:  'Wasted materials and estimated cost impact',
  },
];

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales');

  const currentTab = TABS.find(t => t.id === activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'sales':     return <SalesPerformanceReport />;
      case 'inventory': return <InventoryStatusReport />;
      case 'movement':  return <StockMovementReport />;
      case 'wastage':   return <WastageReport />;
      default:          return null;
    }
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full flex flex-col h-full">
      {/* Page Header */}
      <div className="mb-6 shrink-0">
        <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Reports &amp; Analytics</h1>
        <p className="m-0 mt-1 text-sm text-gray-500 font-medium">
          {currentTab?.desc} — generate, filter, export, or print.
        </p>
      </div>

      {/* Tab Navigation */}
      <nav className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`reports-tab-${tab.id}`}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-[10px] ${
              activeTab === tab.id 
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active Report */}
      <div className="flex-1 flex flex-col min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default Reports;
