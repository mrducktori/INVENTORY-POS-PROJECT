import React from 'react';
import './DashboardOverview.css';

import { getCurrentUser } from '../../api/authApi';
import useDashboardStats from './useDashboardStats';

import RevenueSnapshot from './components/RevenueSnapshot';
import StatCards from './components/StatCards';
import TopSalesGrid from './components/TopSalesGrid';
import LowStockAlerts from './components/LowStockAlerts';
import ExpandedTrendChart from './components/ExpandedTrendChart';
import QuickActions from './components/QuickActions';

// ---------------------------------------------------------------------------
// DashboardOverview
// Orchestration layer only. All business logic lives in `useDashboardStats`.
// All rendering logic lives in the sub-components imported above.
// This file should read like a table of contents for the dashboard.
// ---------------------------------------------------------------------------

const DashboardOverview = ({ onNavigate }) => {
  const user = getCurrentUser();

  const {
    stats,
    loading,
    isTrendExpanded,
    activeTrendCategory,
    sortCategorySalesAsc,
    setIsTrendExpanded,
    setActiveTrendCategory,
    setSortCategorySalesAsc,
    kpiCards,
    trendCategories,
    trendChartData,
    getSortedCategoryProducts,
    COLORS,
  } = useDashboardStats();

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Dashboard Overview</h1>
        <p>
          Welcome back, {user?.name || user?.username || 'User'}. Real-time
          analytics for your business.
        </p>
      </div>

      {/* Total Revenue + Mini Sparkline */}
      <RevenueSnapshot
        stats={stats}
        loading={loading}
        isTrendExpanded={isTrendExpanded}
        onExpand={() => setIsTrendExpanded(true)}
      />

      {/* Expanded Trend Chart (appears directly below the snapshot on click) */}
      {isTrendExpanded && (
        <ExpandedTrendChart
          loading={loading}
          trendChartData={trendChartData}
          trendCategories={trendCategories}
          activeTrendCategory={activeTrendCategory}
          onCategoryChange={setActiveTrendCategory}
          onCollapse={() => setIsTrendExpanded(false)}
          COLORS={COLORS}
        />
      )}

      {/* KPI Cards Row */}
      <StatCards cards={kpiCards} loading={loading} />

      {/* BI Grid: Top Sales + Low Stock side by side */}
      <div className="bi-grid">
        <TopSalesGrid
          loading={loading}
          topProductsByCategory={stats?.topProductsByCategory}
          sortAsc={sortCategorySalesAsc}
          onToggleSort={() => setSortCategorySalesAsc((prev) => !prev)}
          getSortedProducts={getSortedCategoryProducts}
        />

        <LowStockAlerts
          loading={loading}
          lowStockDetails={stats?.lowStockDetails}
        />
      </div>

      {/* Role-based quick navigation */}
      <QuickActions onNavigate={onNavigate} userRole={user?.role} />
    </div>
  );
};

export default DashboardOverview;
