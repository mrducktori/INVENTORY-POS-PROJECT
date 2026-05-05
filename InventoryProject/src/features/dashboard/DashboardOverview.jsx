import React from 'react';
import './DashboardOverview.css';

import { getCurrentUser } from '../../api/authApi';
import useDashboardStats from './useDashboardStats';

import RevenueSnapshot from './components/RevenueSnapshot';
import StatCards from './components/StatCards';
import TopSalesGrid from './components/TopSalesGrid';
import LowStockAlerts from './components/LowStockAlerts';
import ExpandedLowStock from './components/ExpandedLowStock';
import ExpandedTrendChart from './components/ExpandedTrendChart';
import QuickActions from './components/QuickActions';
import PredictiveInsights from './components/PredictiveInsights';

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
    isLowStockExpanded,
    toggleLowStock,
    kpiCards,
    trendCategories,
    trendChartData,
    getSortedCategoryProducts,
    COLORS,
    topSalesPeriod,
    setTopSalesPeriod,
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

      {/* Expanded Trend Chart */}
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
      <StatCards 
        cards={kpiCards} 
        loading={loading} 
      />

      {/* Expanded Low Stock Panel */}
      {isLowStockExpanded && (
        <ExpandedLowStock
          loading={loading}
          lowStockDetails={stats?.lowStockDetails || []}
          onCollapse={toggleLowStock}
        />
      )}

      {/* Predictive Analytics Section */}
      <PredictiveInsights />

      {/* BI Grid: Now primarily for Sales Analytics */}
      <div className="bi-grid" style={{ gridTemplateColumns: '1fr' }}>
        <TopSalesGrid
          loading={loading}
          topProductsByCategory={stats?.topProductsByCategory}
          sortAsc={sortCategorySalesAsc}
          onToggleSort={() => setSortCategorySalesAsc((prev) => !prev)}
          getSortedProducts={getSortedCategoryProducts}
          period={topSalesPeriod}
          onPeriodChange={setTopSalesPeriod}
        />
      </div>

      {/* Role-based quick navigation */}
      <QuickActions onNavigate={onNavigate} userRole={user?.role} />
    </div>
  );
};

export default DashboardOverview;
