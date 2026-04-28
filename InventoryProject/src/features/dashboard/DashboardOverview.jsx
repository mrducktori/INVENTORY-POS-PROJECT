import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

import './DashboardOverview.css';
import { getCurrentUser } from '../../api/authApi';
import { getDashboardStats } from '../../api/dashboardApi';
import { formatQuantity } from '../../utils/productUtils';

const COLORS = ['#000000', '#333333', '#666666', '#999999', '#CCCCCC'];

const DashboardOverview = ({ onNavigate }) => {
  const user = getCurrentUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  const statCards = [
    { label: 'Transactions', value: stats?.transactionsToday ?? '0', color: 'black' },
    { label: 'Avg Sale', value: stats ? `₱${stats.avgTransactionValue.toFixed(2)}` : '₱0.00', color: 'black' },
    { 
      label: 'Low Stock', 
      value: stats?.lowStockItems ?? '0', 
      color: (stats?.lowStockItems || 0) > 0 ? 'red' : 'black',
      clickable: true,
      onClick: () => setShowLowStockModal(true)
    },
  ];

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Business Intelligence Overview</h1>
        <p>Welcome back, {user?.name || user?.username || 'User'}. Real-time analytics for your business.</p>
      </div>

      <div className="revenue-snapshot-card">
        <div className="revenue-info">
          <div className="label">Total Revenue (Today)</div>
          <div className="value">₱{stats?.totalRevenueToday.toFixed(2) || '0.00'}</div>
          <div className="trend-label">7-Day Sales Trend</div>
        </div>
        <div className="revenue-mini-chart">
          {loading ? <div className="loading">...</div> : (
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={stats?.salesTrend || []}>
                <Line type="monotone" dataKey="revenue" stroke="#000" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map(s => (
          <div 
            className={`stat-card border-${s.color} ${s.clickable ? 'clickable' : ''}`} 
            key={s.label}
            onClick={s.onClick}
          >
            <div className="value">{loading ? '...' : s.value}</div>
            <div className="label">{s.label}</div>
            {s.clickable && <div className="click-hint">View Details</div>}
          </div>
        ))}
      </div>

      {/* Low Stock Details Modal */}
      {showLowStockModal && (
        <div className="alert-modal-overlay" onClick={() => setShowLowStockModal(false)}>
          <div className="alert-modal animate-pop-in" onClick={e => e.stopPropagation()}>
            <div className="alert-modal-header">
              <h3>Low Stock Alert</h3>
            </div>
            <div className="alert-modal-body">
              {loading ? (
                <p className="loading">Loading details...</p>
              ) : (
                <>
                  <p>The following items are below their safety threshold:</p>
                  <ul className="low-stock-list">
                    {stats?.lowStockDetails?.length > 0 ? (
                      stats.lowStockDetails.map(item => (
                        <li key={item.name}>
                          <span className="item-name">{item.name}</span>
                          <span className="item-qty">{formatQuantity(item.stock, item.unit)}</span>
                        </li>
                      ))
                    ) : (
                      <li style={{ textAlign: 'center', color: '#666', borderBottom: 'none', padding: '20px 0' }}>
                        All items are above threshold levels.
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
            <div className="alert-modal-footer">
              <button className="btn btn-primary" onClick={() => setShowLowStockModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="bi-grid">
        {/* Sales Trend Line Chart */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>Sales Trend (Last 7 Days)</h3>
          </div>
          <div className="chart-body">
            {loading ? <div className="loading">Loading chart...</div> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats?.salesTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', color: '#fff', border: 'none' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#000" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products Bar Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Top 5 Products</h3>
          </div>
          <div className="chart-body">
            {loading ? <div className="loading">Loading chart...</div> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.topProducts || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip cursor={{fill: '#f5f5f5'}} />
                  <Bar dataKey="value" fill="#000">
                    {(stats?.topProducts || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Distribution Pie Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Sales by Category</h3>
          </div>
          <div className="chart-body">
            {loading ? <div className="loading">Loading chart...</div> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats?.categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#000"
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {(stats?.categoryData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h2>Quick Actions</h2></div>
        <div className="card-body">
          <div className="overview-grid">
            {[
              { label: 'Open POS', value: 'POS', desc: 'New transaction' },
              { label: 'Inventory', value: 'RawMaterialTracker', desc: 'Check stock' },
              { label: 'Reports', value: 'SalesSummaryReport', desc: 'Full reports' }
            ].filter(link => {
              // Only show if the user's role has access to this value
              // Admin/Owner see all, Staff is restricted
              if (user.role !== 'Staff') return true;
              return ['POS', 'RawMaterialTracker'].includes(link.value);
            }).map(link => (
              <button key={link.value} onClick={() => onNavigate(link.value)} className="overview-link-btn">
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
