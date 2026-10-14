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
  const [isLowStockExpanded, setIsLowStockExpanded] = useState(false);
  const [topSalesPeriod, setTopSalesPeriod] = useState('day'); // 'day' | 'week' | 'month'

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats(topSalesPeriod);
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [topSalesPeriod]); // re-fetch whenever the period changes

  // --- Derived / computed values ---

  const trendCategories = deriveTrendCategories(stats?.salesTrend);

  const trendChartData = buildTrendChartData(
    stats?.salesTrend,
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
    sortCategorySalesAsc,
    isLowStockExpanded,
    topSalesPeriod,
    // Actions (state setters)
    setIsTrendExpanded,
    setActiveTrendCategory,
    setSortCategorySalesAsc,
    setTopSalesPeriod,
    toggleLowStock,
    // Derived data ready for components
    kpiCards,
    trendCategories,
    trendChartData,
    getSortedCategoryProducts,
    COLORS,
  };
};

export default useDashboardStats;
