import React, { useState, useEffect } from 'react';
import '../styles/Inventory.css';
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
    { label: 'Total Sales Today', value: stats ? `₱${stats.totalRevenueToday.toFixed(2)}` : '—' },
    { label: 'Active Products', value: stats?.activeProducts ?? '—' },
    { label: 'Low Stock Items', value: stats?.lowStockItems ?? '—' },
    { label: 'Transactions Today', value: stats?.transactionsToday ?? '—' },
    { label: 'Items Sold Today', value: stats?.itemsSoldToday ?? '—' },
  ];

  const quickLinks = [
    { label: 'Open POS', value: 'POS', desc: 'Start a new transaction' },
    { label: 'Products', value: 'Products', desc: 'Browse all products' },
    { label: 'Low Stock Alerts', value: 'LowStockAlerts', desc: 'Check low-stock items' },
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
          <div className="stat-card" key={s.label}>
            <div className="value">{loading ? '...' : s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><h2>Quick Navigation</h2></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {quickLinks.map(link => (
              <button
                key={link.value}
                onClick={() => onNavigate(link.value)}
                style={{
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '3px',
                  padding: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#000', marginBottom: '4px' }}>{link.label}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>{link.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
