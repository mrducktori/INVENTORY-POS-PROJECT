import { useState, useEffect } from 'react';
import { getDashboardStats } from '../../api/dashboardApi';

// ---------------------------------------------------------------------------
// useDashboardStats
// Custom hook that encapsulates ALL data-fetching and transformation logic
// for the Dashboard. The JSX layer (components) should ONLY call this hook
// and render the values it returns ΓÇö no business logic in JSX.
// ---------------------------------------------------------------------------

const COLORS = ['#1e40af', '#991b1b', '#166534', '#6b21a8', '#9a3412', '#115e59'];

/**
 * Derives unique category names from the 7-day sales trend data.
 * @param {Array} salesTrend - Array of day objects with a `categories` field.
 * @returns {string[]} Sorted list of unique category names.
 */
const deriveTrendCategories = (salesTrend) => {
  if (!salesTrend) return [];
  return Array.from(
    new Set(salesTrend.flatMap((day) => Object.keys(day.categories || {})))
  );
};

/**
 * Shapes the salesTrend data for a multi-line Recharts LineChart.
 * When 'All' is selected, each category becomes its own data key on each day.
 * When a specific category is selected, it returns a single `revenue` key.
 * @param {Array} salesTrend
 * @param {string} activeCategory
 * @returns {Array} Chart-ready data array.
 */
const buildTrendChartData = (salesTrend, activeCategory, allCategories = []) => {
  if (!salesTrend) return [];

  if (activeCategory !== 'All') {
    return salesTrend.map((day) => ({
      date: day.date,
      revenue: (day.categories && day.categories[activeCategory]) || 0,
    }));
  }

  return salesTrend.map((day) => {
    const dataPoint = { date: day.date, revenue: day.revenue || 0 };
    
    // Initialize all known categories to 0 so Recharts always has a continuous path
    allCategories.forEach((cat) => {
      dataPoint[cat] = 0;
    });

    if (day.categories) {
      Object.keys(day.categories).forEach((cat) => {
        dataPoint[cat] = day.categories[cat] || 0;
      });
    }
    return dataPoint;
  });
};

/**
 * Sorts a list of products by their `value` (units sold) field.
 * @param {Array} products
 * @param {boolean} ascending
 * @returns {Array} Sorted copy of the products array.
 */
const sortProducts = (products, ascending) => {
  if (!products) return [];
  return [...products].sort((a, b) =>
    ascending ? a.value - b.value : b.value - a.value
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const useDashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortCategorySalesAsc, setSortCategorySalesAsc] = useState(false);
  const [isTrendExpanded, setIsTrendExpanded] = useState(false);
  const [activeTrendCategory, setActiveTrendCategory] = useState('All');
  const [trendPeriod, setTrendPeriod] = useState('7d'); // '7d' | '14d' | '30d' | 'month' | 'custom'
  const [trendStartDate, setTrendStartDate] = useState('');
  const [trendEndDate, setTrendEndDate] = useState('');
  const [trendStats, setTrendStats] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [isLowStockExpanded, setIsLowStockExpanded] = useState(false);
  const [topSalesPeriod, setTopSalesPeriod] = useState('day'); // 'day' | 'week' | 'month'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats(topSalesPeriod, startDate, endDate);
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [topSalesPeriod, startDate, endDate]); // re-fetch whenever the period or dates change

  const canReuseOverviewTrend =
    trendPeriod === '7d' &&
    !trendStartDate &&
    !trendEndDate &&
    (topSalesPeriod === 'day' || topSalesPeriod === 'week') &&
    !startDate &&
    !endDate &&
    Boolean(stats?.salesTrend);

  useEffect(() => {
    if (!isTrendExpanded) return;
    if (canReuseOverviewTrend) {
      setTrendLoading(false);
      return;
    }
    if (trendPeriod === 'custom' && !trendStartDate && !trendEndDate) {
      return;
    }

    let cancelled = false;
    const fetchTrendStats = async () => {
      try {
        setTrendLoading(true);
        const data = await getDashboardStats(
          trendPeriod === 'custom' ? 'custom' : trendPeriod,
          trendStartDate,
          trendEndDate
        );
        if (!cancelled) setTrendStats(data);
      } catch (err) {
        console.error('Failed to load category trend breakdown:', err);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    };

    fetchTrendStats();
    return () => {
      cancelled = true;
    };
  }, [isTrendExpanded, trendPeriod, trendStartDate, trendEndDate, canReuseOverviewTrend]);

  // --- Derived / computed values ---

  const activeSalesTrend = canReuseOverviewTrend
    ? stats.salesTrend
    : (trendStats?.salesTrend || stats?.salesTrend || []);

  const trendCategories = Array.from(
    new Set([
      ...deriveTrendCategories(stats?.salesTrend),
      ...deriveTrendCategories(activeSalesTrend),
    ])
  );

  const trendCategoryTotals = trendCategories.reduce((acc, cat) => {
    acc[cat] = activeSalesTrend.reduce(
      (sum, day) => sum + ((day.categories && day.categories[cat]) || 0),
      0
    );
    return acc;
  }, {});

  const trendChartData = buildTrendChartData(
    activeSalesTrend,
    activeTrendCategory,
    trendCategories
  );

  const getSortedCategoryProducts = (products) =>
    sortProducts(products, sortCategorySalesAsc);

  const toggleLowStock = () => setIsLowStockExpanded((prev) => !prev);

  const kpiCards = [
    {
      label: 'Sales Transactions',
      value: stats?.transactionsToday ?? '0',
      color: 'black',
    },
    {
      label: 'Avg Sale',
      value:
        stats?.avgTransactionValue !== undefined
          ? `₱${stats.avgTransactionValue.toFixed(2)}`
          : '₱0.00',
      color: 'black',
    },
    {
      label: 'Low Stock Items',
      value: stats?.lowStockItems ?? '0',
      color: (stats?.lowStockItems || 0) > 0 ? 'red' : 'black',
      clickable: true,
      onClick: toggleLowStock,
    },
  ];

  return {
    // Raw state
    stats,
    loading,
    // UI state
    isTrendExpanded,
    activeTrendCategory,
    trendPeriod,
    trendStartDate,
    trendEndDate,
    trendLoading,
    sortCategorySalesAsc,
    isLowStockExpanded,
    topSalesPeriod,
    startDate,
    endDate,
    // Actions (state setters)
    setIsTrendExpanded,
    setActiveTrendCategory,
    setTrendPeriod,
    setTrendStartDate,
    setTrendEndDate,
    setSortCategorySalesAsc,
    setTopSalesPeriod,
    setStartDate,
    setEndDate,
    toggleLowStock,
    // Derived data ready for components
    kpiCards,
    trendCategories,
    trendCategoryTotals,
    trendChartData,
    getSortedCategoryProducts,
    COLORS,
  };
};

export default useDashboardStats;
