import React, { useState, useEffect } from 'react';
import { getSalesReportByPeriod } from '../api/logsApi';
import '../styles/Inventory.css';
import '../styles/SalesSummaryReport.css';

const SalesSummaryReport = () => {
  const [period, setPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [period]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await getSalesReportByPeriod(
        null, // startDate handled by period in backend
        null, // endDate
        period
      );
      setSummary(data);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!summary || !summary.staff_data) return;
    
    let csv = `Sales Summary Report (${period.toUpperCase()})\n`;
    csv += `Total Sales,₱${(summary.total_sales || 0).toFixed(2)}\n`;
    csv += `Total Transactions,${summary.total_transactions || 0}\n`;
    csv += `Total Items Sold,${summary.total_items_sold || 0}\n\n`;
    
    csv += `Staff Breakdown\n`;
    csv += `Staff Name,Sales,Transactions,Avg Sale\n`;
    
    summary.staff_data.forEach(p => {
      csv += `"${p.name}",₱${p.total_sales.toFixed(2)},${p.transactions},₱${(p.total_sales / p.transactions).toFixed(2)}\n`;
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
      <div className="page-header summary-header-actions">
        <div>
          <h1>Sales Summary Report</h1>
          <p>Analyze revenue and staff performance over different time periods.</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={loading || !summary}>
          Export to CSV
        </button>
      </div>

      <div className="form-group summary-filter-group">
        <label>Time Period</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="daily">Daily / Today</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {loading ? (
        <div className="summary-loading">Loading report data...</div>
      ) : summary ? (
        <>
          <div className="stats-grid">
            <div className="stat-card stat-card-total">
              <div className="label">Total Sales</div>
              <div className="value">₱{(summary.total_sales || 0).toFixed(2)}</div>
            </div>
            <div className="stat-card stat-card-trans">
              <div className="label">Transactions</div>
              <div className="value">{summary.total_transactions || 0}</div>
            </div>
            <div className="stat-card stat-card-items">
              <div className="label">Items Sold</div>
              <div className="value">{summary.total_items_sold || 0}</div>
            </div>
            <div className="stat-card stat-card-avg">
              <div className="label">Avg Transaction</div>
              <div className="value">
                ₱{summary.total_transactions > 0 
                  ? ((summary.total_sales || 0) / summary.total_transactions).toFixed(2) 
                  : '0.00'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Staff Breakdown</h2>
            </div>
            <div className="card-body">
              {summary.staff_data && summary.staff_data.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Sales</th>
                        <th>Transactions</th>
                        <th>Avg Sale</th>
                        <th>% of Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.staff_data.map(staff => (
                        <tr key={staff.id}>
                          <td>{staff.name}</td>
                          <td>₱{staff.total_sales.toFixed(2)}</td>
                          <td>{staff.transactions}</td>
                          <td>₱{(staff.total_sales / staff.transactions).toFixed(2)}</td>
                          <td>
                            <div className="summary-bar-container">
                              <div className="summary-bar-track">
                                <div className="summary-bar-fill" style={{ width: `${(staff.total_sales / summary.total_sales) * 100}%` }} />
                              </div>
                              <span className="summary-bar-text">
                                {((staff.total_sales / summary.total_sales) * 100).toFixed(1)}%
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
                  <p>No staff sales recorded for this period.</p>
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
