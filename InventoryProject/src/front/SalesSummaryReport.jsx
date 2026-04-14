import React, { useState, useEffect } from 'react';
import { getSalesSummary } from '../api/salesApi';
import '../styles/Inventory.css';

const SalesSummaryReport = () => {
  const [period, setPeriod] = useState('day'); // 'day', 'week', 'month'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [period]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await getSalesSummary(period);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Basic CSV export
    if (!summary) return;
    
    let csv = `Sales Summary Report (${period.toUpperCase()})\n`;
    csv += `Total Revenue,₱${summary.totalRevenue.toFixed(2)}\n`;
    csv += `Total Transactions,${summary.totalTransactions}\n\n`;
    
    csv += `Top Selling Products\n`;
    csv += `Product Name,Quantity Sold,Revenue\n`;
    
    summary.topProducts.forEach(p => {
      csv += `"${p.name}",${p.qty},₱${p.revenue.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Sales_Summary_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="inventory-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Sales Summary Report</h1>
          <p>Analyze revenue and top-selling products over different time periods.</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={loading || !summary}>
          Export to CSV
        </button>
      </div>

      <div className="form-group" style={{ maxWidth: '200px', marginBottom: '20px' }}>
        <label>Time Period</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="day">Today</option>
          <option value="week">Past 7 Days</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {loading ? (
        <p>Loading report data...</p>
      ) : summary ? (
        <>
          <div className="stats-grid">
            <div className="stat-card" style={{ borderTop: '4px solid #000' }}>
              <div className="label">Total Gross Revenue</div>
              <div className="value">₱{summary.totalRevenue.toFixed(2)}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '4px solid #333' }}>
              <div className="label">Total Transactions</div>
              <div className="value">{summary.totalTransactions}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '4px solid #666' }}>
              <div className="label">Average Order Value</div>
              <div className="value">
                ₱{summary.totalTransactions > 0 
                  ? (summary.totalRevenue / summary.totalTransactions).toFixed(2) 
                  : '0.00'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Top Selling Products</h2>
            </div>
            <div className="card-body">
              {summary.topProducts.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Product Name</th>
                        <th>Quantity Sold</th>
                        <th>Revenue Generated</th>
                        <th>% of Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topProducts.map((p, idx) => (
                        <tr key={p.name}>
                          <td><strong>#{idx + 1}</strong></td>
                          <td>{p.name}</td>
                          <td>{p.qty}</td>
                          <td>₱{p.revenue.toFixed(2)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ flex: 1, height: '6px', background: '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ 
                                  height: '100%', 
                                  background: '#000', 
                                  width: `${(p.revenue / summary.totalRevenue) * 100}%` 
                                }} />
                              </div>
                              <span style={{ fontSize: '11px', width: '40px' }}>
                                {((p.revenue / summary.totalRevenue) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No sales recorded for this period.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state"><p>Could not generate report.</p></div>
      )}
    </div>
  );
};

export default SalesSummaryReport;
