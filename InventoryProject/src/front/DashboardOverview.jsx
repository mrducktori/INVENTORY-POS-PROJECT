import React, { useState, useEffect } from 'react';
import '../styles/Inventory.css';
import '../styles/DashboardOverview.css';
import { getCurrentUser } from '../api/authApi';
import { getDashboardStats } from '../api/dashboardApi';
import { getProducts } from '../api/posApi';

const DashboardOverview = ({ onNavigate }) => {
  const user = getCurrentUser();
  const role = user?.role || 'Staff';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };



  const statCards = [
    { label: 'Total Revenue', value: stats ? `₱${stats.totalRevenueToday.toFixed(2)}` : '₱0.00', color: 'green' },
    { label: 'Low Stock', value: stats?.lowStockItems ?? '0', color: stats?.lowStockItems > 0 ? 'red' : 'green' },
    { label: 'Products', value: stats?.activeProducts ?? '0', color: 'blue' },
    { label: 'Transactions', value: stats?.transactionsToday ?? '0', color: 'purple' },
    { label: 'Items Sold', value: stats?.itemsSoldToday ?? '0', color: 'orange' },
  ];



  const quickLinks = [
    { label: 'Open POS', value: 'POS', desc: 'Start a new transaction' },
    { label: 'Products', value: 'Products', desc: 'Browse all products' },
    { label: 'Stock Received', value: 'StockReceived', desc: 'Update inventory levels' },
    { label: 'Raw Material Tracker', value: 'RawMaterialTracker', desc: 'Track ingredient levels' },
  ];




  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name || user?.username || 'User'}. Here is your overview for today.</p>
      </div>

      <div className="stats-grid">
        {statCards.map(s => (
          <div 
            className={`stat-card border-${s.color}`} 
            key={s.label}
          >
            <div className="value">{loading ? '...' : s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><h2>Quick Navigation</h2></div>
        <div className="card-body">
          <div className="overview-grid">
            {quickLinks.map(link => (
              <button
                key={link.value}
                onClick={() => onNavigate(link.value)}
                className="overview-link-btn"
              >
                <div className="overview-link-title">{link.label}</div>
                <div className="overview-link-desc">{link.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>


  );
};

export default DashboardOverview;
