import React, { useState, useEffect } from 'react';
import { getSalesReportByPeriod } from '../../api/logsApi';

import './SalesSummaryReport.css';

const SalesSummaryReport = () => {
  const [period, setPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSales, setStaffSales] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [period]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await getSalesReportByPeriod(null, null, period);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffDetails = async (staff) => {
    setSelectedStaff(staff);
    setDetailsLoading(true);
    try {
      const { getSales } = await import('../../api/salesApi');
      const data = await getSales({ staff_id: staff.id, period });
      setStaffSales(data || []);
    } catch (err) {
      console.error('Failed to load staff details:', err);
    } finally {
      setDetailsLoading(false);
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
    <div className="report-container">
      <div className="report-header-flex">
        <div className="report-title">
          <h1>Sales Summary Report</h1>
          <p>Analyze revenue and performance. Click on a staff member to view detailed logs.</p>
        </div>
        <button 
          className="export-btn" 
          onClick={handleExport} 
          disabled={loading || !summary}
        >
          Export Analytics (CSV)
        </button>
      </div>

      <div className="period-selector">
        <label className="period-label">Analysis Period</label>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="period-select"
        >
          <option value="daily">Daily / Today</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {loading ? (
        <div className="audit-loading-row">
          <div className="audit-loading-text">Compiling Report Data...</div>
        </div>
      ) : summary ? (
        <div className="space-y-10">
          <div className="summary-grid">
            <div className="summary-card border-blue">
              <p className="summary-card-label">Gross Revenue</p>
              <p className="summary-card-value">₱{(summary.total_sales || 0).toFixed(2)}</p>
            </div>
            <div className="summary-card border-green">
              <p className="summary-card-label">Volume</p>
              <p className="summary-card-value">{summary.total_transactions || 0}</p>
            </div>
            <div className="summary-card">
              <p className="summary-card-label">Items Dispatched</p>
              <p className="summary-card-value">{summary.total_items_sold || 0}</p>
            </div>
            <div className="summary-card border-purple">
              <p className="summary-card-label">Average Ticket</p>
              <p className="summary-card-value">
                ₱{summary.total_transactions > 0 
                  ? ((summary.total_sales || 0) / summary.total_transactions).toFixed(2) 
                  : '0.00'}
              </p>
            </div>
          </div>

          <div className="performance-card">
            <div className="performance-header">
              <h2>Personnel Performance Breakdown</h2>
            </div>
            <div>
              {summary.staff_data && summary.staff_data.length > 0 ? (
                <div className="audit-table-wrapper">
                  <table className="performance-table">
                    <thead>
                      <tr>
                        <th>Operator</th>
                        <th>Total Sales</th>
                        <th style={{ textAlign: 'center' }}>Transactions</th>
                        <th style={{ textAlign: 'center' }}>Avg Trans</th>
                        <th>Market Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.staff_data.map(staff => (
                        <tr 
                          key={staff.id} 
                          onClick={() => fetchStaffDetails(staff)}
                          className="performance-row"
                        >
                          <td><span className="operator-name">{staff.name}</span></td>
                          <td><span className="sales-value">₱{staff.total_sales.toFixed(2)}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: '900' }}>{staff.transactions}</td>
                          <td style={{ textAlign: 'center', color: '#777', fontFamily: 'monospace' }}>₱{(staff.total_sales / staff.transactions).toFixed(2)}</td>
                          <td>
                            <div className="share-flex">
                              <div className="share-track">
                                <div 
                                  className="share-fill" 
                                  style={{ width: `${(staff.total_sales / summary.total_sales) * 100}%` }} 
                                />
                              </div>
                              <span className="share-percent">
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
                <div className="audit-empty-row">
                  <div className="audit-empty-text">No personnel activity recorded</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="audit-empty-row" style={{ color: '#c62828' }}>
          <div className="audit-empty-text" style={{ borderColor: '#ffcdd2' }}>Data compilation failed</div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedStaff && (
        <div className="audit-modal-overlay" onClick={() => setSelectedStaff(null)}>
          <div className="audit-modal-content" onClick={e => e.stopPropagation()}>
            <div className="audit-modal-header">
              <h2 className="audit-modal-title">Sales Audit: {selectedStaff.name}</h2>
              <button className="audit-modal-close" onClick={() => setSelectedStaff(null)}>✕</button>
            </div>
            
            <div className="audit-modal-body">
              {detailsLoading ? (
                <div className="audit-loading-row">
                  <div className="audit-loading-text">Loading audit history...</div>
                </div>
              ) : (
                <div className="audit-table-wrapper">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th style={{ textAlign: 'center' }}>Time</th>
                        <th>Manifest</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'center' }}>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffSales.map(sale => (
                        <tr key={sale.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#aaa', fontSize: '11px' }}>
                            #{sale.receipt_number || sale.id.substring(0,8).toUpperCase()}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#777' }}>
                            {new Date(sale.created_at).toLocaleTimeString()}
                          </td>
                          <td style={{ minWidth: '200px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {sale.sale_items?.map((it, idx) => (
                                <div key={idx} style={{ 
                                  display: 'flex', 
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '4px 0',
                                  borderBottom: idx < (sale.sale_items.length - 1) ? '1px solid #f0f0f0' : 'none'
                                }}>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    fontWeight: '900', 
                                    color: '#000',
                                    background: '#eee',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    minWidth: '24px',
                                    textAlign: 'center'
                                  }}>{it.quantity}</span>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    fontWeight: '700', 
                                    color: '#333', 
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px'
                                  }}>{it.products?.name}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '14px', fontWeight: '900', color: '#000' }}>₱{parseFloat(sale.total_amount).toFixed(2)}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                             <span className="log-action-badge" style={{ background: '#eee', color: '#777' }}>
                               {sale.payment_method}
                             </span>
                          </td>
                        </tr>
                      ))}
                      {staffSales.length === 0 && (
                        <tr>
                          <td colSpan="5" className="audit-empty-row">
                            <div className="audit-empty-text">No records found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="audit-modal-footer">
              <button 
                className="export-btn" 
                onClick={() => setSelectedStaff(null)}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesSummaryReport;
