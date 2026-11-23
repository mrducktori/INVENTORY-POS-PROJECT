import React from 'react';

import { getCurrentUser } from '../../api/authApi';
import useDashboardStats from './hooks/useDashboardStats';

import RevenueSnapshot from './components/RevenueSnapshot';
import StatCards from './components/StatCards';
import TopSalesGrid from './components/TopSalesGrid';
import ExpandedLowStock from './components/ExpandedLowStock';
import ExpandedTrendChart from './components/ExpandedTrendChart';
import QuickActions from './components/QuickActions';
import PredictiveInsights from './components/PredictiveInsights';
import NotificationInbox from './components/NotificationInbox';

const SectionLabel = ({ children }) => (
  <h2 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{children}</h2>
);

const DashboardOverview = ({ onNavigate }) => {
  const user = getCurrentUser();

  const {
    stats,
    loading,
    isTrendExpanded,
    activeTrendCategory,
    trendPeriod,
    trendStartDate,
    trendEndDate,
    trendLoading,
    sortCategorySalesAsc,
    setIsTrendExpanded,
    setActiveTrendCategory,
    setTrendPeriod,
    setTrendStartDate,
    setTrendEndDate,
    setSortCategorySalesAsc,
    isLowStockExpanded,
    toggleLowStock,
    kpiCards,
    trendCategories,
    trendCategoryTotals,
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
    <div className="w-full px-6 lg:px-10 py-6 min-h-full space-y-8">
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
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight m-0">
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
            user={user}
          />

          {user?.role === 'Staff' && (
            <button
              onClick={() => onNavigate('POS')}
              className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">Open POS Register <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
            </button>
          )}
        </div>
      </div>

      {/* Level 1: the headline number */}
      <section>
        <SectionLabel>Today</SectionLabel>
        <RevenueSnapshot
          stats={stats}
          loading={loading}
          isTrendExpanded={isTrendExpanded}
          onExpand={() => setIsTrendExpanded(true)}
        />
      </section>

      {/* Expanded Trend Chart */}
      {isTrendExpanded && (
        <ExpandedTrendChart
          loading={loading || trendLoading}
          trendChartData={trendChartData}
          trendCategories={trendCategories}
          trendCategoryTotals={trendCategoryTotals}
          activeTrendCategory={activeTrendCategory}
          onCategoryChange={setActiveTrendCategory}
          trendPeriod={trendPeriod}
          onPeriodChange={setTrendPeriod}
          trendStartDate={trendStartDate}
          trendEndDate={trendEndDate}
          onStartDateChange={setTrendStartDate}
          onEndDateChange={setTrendEndDate}
          onCollapse={() => setIsTrendExpanded(false)}
          COLORS={COLORS}
        />
      )}

      {/* Level 2: supporting counters */}
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

      {/* Level 3: what to act on */}
      <section>
        <SectionLabel>Needs attention</SectionLabel>
        <PredictiveInsights onNavigate={onNavigate} />
      </section>

      {/* Level 4: reference detail */}
      <section>
        <SectionLabel>Sales breakdown</SectionLabel>
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
      </section>

      {/* Level 5: quiet shortcuts */}
      <section>
        <SectionLabel>Shortcuts</SectionLabel>
        <QuickActions onNavigate={onNavigate} userRole={user?.role} />
      </section>
    </div>
  );
};

export default DashboardOverview;
