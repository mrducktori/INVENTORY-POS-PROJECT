import React, { useState } from 'react';
import SalesPerformanceReport from './SalesPerformanceReport';
import InventoryStatusReport  from './InventoryStatusReport';
import StockMovementReport    from './StockMovementReport';
import WastageReport          from './WastageReport';
import './Reports.css';

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
    <div className="reports-wrapper">
      {/* Page Header */}
      <div className="reports-page-header">
        <h1>Reports &amp; Analytics</h1>
        <p>
          {currentTab?.desc} — generate, filter, export, or print.
        </p>
      </div>

      {/* Tab Navigation */}
      <nav className="reports-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`reports-tab-${tab.id}`}
            className={`reports-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active Report */}
      {renderContent()}
    </div>
  );
};

export default Reports;
