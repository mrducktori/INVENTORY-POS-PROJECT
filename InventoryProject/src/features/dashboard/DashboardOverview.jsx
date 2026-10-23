import React from 'react';

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
import NotificationInbox from './components/NotificationInbox';

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
    startDate,
    endDate,
    setStartDate,
    setEndDate,
  } = useDashboardStats();

  const todayFormatted = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila'
  }).format(new Date());

  return (
    <div className="w-full px-6 lg:px-10 py-6 min-h-full space-y-6">
      {/* Header section with operational status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-zinc-900 text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Live Shift
            </span>
            <span className="text-sm font-medium text-zinc-600">
              {todayFormatted}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight m-0">
            Operations & Performance
          </h1>
          <p className="text-base text-zinc-600 mt-1 mb-0">
            Welcome back, <span className="font-bold text-zinc-900">{user?.name || user?.username || 'Staff'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NotificationInbox 
            onNavigate={onNavigate} 
            lowStockItems={stats?.lowStockDetails || stats?.lowStockItemsDetails || []} 
          />

          {user?.role === 'Staff' && (
            <button
              onClick={() => onNavigate('POS')}
              className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Open POS Register →
            </button>
          )}
        </div>
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

      {/* BI Grid: Sales Analytics */}
      <div>
        <TopSalesGrid
          loading={loading}
          topProductsByCategory={stats?.topProductsByCategory}
          sortAsc={sortCategorySalesAsc}
          onToggleSort={() => setSortCategorySalesAsc((prev) => !prev)}
          getSortedProducts={getSortedCategoryProducts}
          period={topSalesPeriod}
          onPeriodChange={setTopSalesPeriod}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      {/* Role-based quick navigation */}
      <QuickActions onNavigate={onNavigate} userRole={user?.role} />
    </div>
  );
};

export default DashboardOverview;
