import React, { useState, useCallback, useMemo } from 'react';
import {
  getSalesPerformanceReport,
  getTopProductsReport
} from '../../api/reportsApi';
import { downloadCSV, printReport } from './reportUtils';
import './Reports.css';

// ─── Mini Bar chart (SVG sparkline) ──────────────────────────────────────────
const TrendBars = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="rpt-trend-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '180px', padding: '40px 20px 20px' }}>
      {data.map((d, i) => {
        const height = (d.value / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 60px', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, fontFamily: 'monospace' }}>₱{d.value.toLocaleString()}</span>
            <div
              style={{ 
                width: '30px', 
                height: `${Math.max(4, height)}%`, 
                background: '#000', 
                borderRadius: '2px 2px 0 0',
                transition: 'height 0.5s ease'
              }}
              title={`${d.label}: ₱${d.value.toFixed(2)}`}
            />
            <span style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', maxWidth: '60px', overflow: 'hidden' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SalesPerformanceReport = () => {
  const [period, setPeriod]   = useState('daily');
  const [summary, setSummary] = useState(null);
  const [topItems, setTopItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [sortKey, setSortKey] = useState('total_sales');
  const [sortDir, setSortDir] = useState('desc');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, forecastData] = await Promise.all([
        getSalesPerformanceReport(period),
        getTopProductsReport()
      ]);
      setSummary(summaryData);
      setTopItems(forecastData || []);
      setFetched(true);
    } catch (err) {
      console.error('Sales report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const sortedStaff = useMemo(() => {
    if (!summary?.staff_data) return [];
    return [...summary.staff_data].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [summary, sortKey, sortDir]);

  const sortedProducts = useMemo(() => {
    return [...topItems].sort((a, b) => (b.predictedNext7Days || 0) - (a.predictedNext7Days || 0));
  }, [topItems]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  // Build trend data from staff performance (approximate visualization)
  const trendData = sortedStaff.slice(0, 10).map(s => ({
    label: (s.name || '').split(' ')[0],
    value: s.total_sales || 0
  }));

  const totalSales = summary?.total_sales || 0;
  const totalTx    = summary?.total_transactions || 0;
  const avgTicket  = totalTx > 0 ? totalSales / totalTx : 0;
  const totalItems = summary?.total_items_sold || 0;

  // Payment method breakdown from staff data (approximated from top product forecast)
  const paymentMethods = useMemo(() => {
    if (!summary?.payment_breakdown) return null;
    return summary.payment_breakdown;
  }, [summary]);

  const handleExport = () => {
    if (!summary) return;
    const date = new Date().toLocaleDateString('en-PH');
    const time = new Date().toLocaleTimeString('en-PH');
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';

    const rows = [
      [`SALES REPORT — ${periodLabel.toUpperCase()}`],
      [`Date Generated: ${date} ${time}`],
      [],
      ['SUMMARY'],
      ['Total Revenue (PHP)', `₱${totalSales.toFixed(2)}`],
      ['Total Number of Orders', totalTx],
      ['Average Order Value (PHP)', `₱${avgTicket.toFixed(2)}`],
      ['Total Items Sold', totalItems],
      [],
      ['STAFF PERFORMANCE'],
      ['Staff Name', 'Total Sales (PHP)', 'Number of Orders', 'Average per Order (PHP)', 'Share of Total Sales'],
      ...sortedStaff.map(s => [
        s.name,
        `₱${(s.total_sales || 0).toFixed(2)}`,
        s.transactions,
        `₱${((s.total_sales || 0) / (s.transactions || 1)).toFixed(2)}`,
        `${((s.total_sales / (totalSales || 1)) * 100).toFixed(1)}%`
      ]),
    ];
    downloadCSV(rows, `Sales_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';
    const staffRows = sortedStaff.map((s, i) => {
      const avg = s.transactions > 0 ? s.total_sales / s.transactions : 0;
      const share = totalSales > 0 ? (s.total_sales / totalSales) * 100 : 0;
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>₱${(s.total_sales || 0).toFixed(2)}</td>
        <td style="text-align:center">${s.transactions}</td>
        <td>₱${avg.toFixed(2)}</td>
        <td>${share.toFixed(1)}%</td>
      </tr>`;
    }).join('');

    const html = `
      <h1>Sales Report — ${periodLabel}</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Total Revenue</div><div class="kpi-value">₱${totalSales.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Orders</div><div class="kpi-value">${totalTx}</div></div>
        <div class="kpi-box"><div class="kpi-label">Avg Order Value</div><div class="kpi-value">₱${avgTicket.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Items Sold</div><div class="kpi-value">${totalItems}</div></div>
      </div>
      <h2>Staff Performance</h2>
      <table>
        <thead><tr><th>#</th><th>Staff Name</th><th>Total Sales</th><th>Orders</th><th>Avg Per Order</th><th>Share</th></tr></thead>
        <tbody>${staffRows || '<tr><td colspan="6">No staff data for this period.</td></tr>'}</tbody>
      </table>
    `;
    printReport(`Sales Report — ${periodLabel}`, html);
  };

  return (
    <>
      {/* Controls */}
      <div className="report-controls">
        <div className="report-controls-left">
          <div className="control-group">
            <span className="control-label">Period</span>
            <select
              className="control-select"
              value={period}
              onChange={e => { setPeriod(e.target.value); setFetched(false); }}
            >
              <option value="daily">Today (Daily)</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
        </div>
        <div className="report-controls-right">
          <button className="rpt-btn" onClick={handleExport} disabled={!fetched || loading}>
            Export CSV
          </button>
          <button className="rpt-btn rpt-btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button className="rpt-btn" onClick={handlePrint} disabled={!fetched}>
            Print
          </button>
        </div>
      </div>

      {/* Prompt when not yet fetched */}
      {!fetched && !loading && (
        <div className="rpt-empty">
          <div className="rpt-empty-title">Ready to Generate</div>
          <p>Select a period and click <strong>Generate Report</strong> to load data.</p>
        </div>
      )}

      {loading && <div className="rpt-loading">Compiling sales data...</div>}

      {fetched && !loading && summary && (
        <>
          {/* KPI Cards */}
          <div className="rpt-kpi-grid">
            <div className="rpt-kpi-card accent-blue">
              <div className="rpt-kpi-label">Gross Revenue</div>
              <div className="rpt-kpi-value">₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="rpt-kpi-sub">{period} total</div>
            </div>
            <div className="rpt-kpi-card accent-green">
              <div className="rpt-kpi-label">Total Transactions</div>
              <div className="rpt-kpi-value">{totalTx.toLocaleString()}</div>
              <div className="rpt-kpi-sub">sales recorded</div>
            </div>
            <div className="rpt-kpi-card">
              <div className="rpt-kpi-label">Average Ticket</div>
              <div className="rpt-kpi-value">₱{avgTicket.toFixed(2)}</div>
              <div className="rpt-kpi-sub">per transaction</div>
            </div>
            <div className="rpt-kpi-card accent-purple">
              <div className="rpt-kpi-label">Items Sold</div>
              <div className="rpt-kpi-value">{totalItems.toLocaleString()}</div>
              <div className="rpt-kpi-sub">units dispatched</div>
            </div>
          </div>

          {/* Revenue by Staff (Trend Bars) */}
          {trendData.length > 0 && (
            <div className="rpt-card">
              <div className="rpt-card-header">
                <h2>Revenue by Operator</h2>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {period} view
                </span>
              </div>
              <TrendBars data={trendData} />
            </div>
          )}

          {/* Staff Performance Table */}
          <div className="rpt-card">
            <div className="rpt-card-header">
              <h2>Personnel Performance Breakdown</h2>
            </div>
            <div className="rpt-card-body">
              {sortedStaff.length > 0 ? (
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th onClick={() => handleSort('name')}>Operator{sortArrow('name')}</th>
                      <th onClick={() => handleSort('total_sales')}>Total Sales{sortArrow('total_sales')}</th>
                      <th onClick={() => handleSort('transactions')} style={{ textAlign: 'center' }}>
                        Transactions{sortArrow('transactions')}
                      </th>
                      <th style={{ textAlign: 'center' }}>Avg Per Sale</th>
                      <th style={{ minWidth: '180px' }}>Market Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStaff.map((staff, i) => {
                      const share = totalSales > 0 ? (staff.total_sales / totalSales) * 100 : 0;
                      const avg   = staff.transactions > 0 ? staff.total_sales / staff.transactions : 0;
                      return (
                        <tr key={staff.id}>
                          <td>
                            <span className={`rpt-rank ${i < 3 ? `rank-${i + 1}` : 'rank-other'}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>{staff.name}</td>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>
                            ₱{(staff.total_sales || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 900 }}>{staff.transactions}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', color: '#777' }}>
                            ₱{avg.toFixed(2)}
                          </td>
                          <td>
                            <div className="rpt-bar-row">
                              <div className="rpt-bar-track" style={{ flex: 1 }}>
                                <div className="rpt-bar-fill" style={{ width: `${share}%` }} />
                              </div>
                              <span className="rpt-bar-pct">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="rpt-empty">No staff activity for this period.</div>
              )}
            </div>
          </div>

          {/* Top Products Table */}
          {sortedProducts.length > 0 && (
            <div className="rpt-card">
              <div className="rpt-card-header">
                <h2>Top Products by Demand</h2>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Based on 30-day forecast
                </span>
              </div>
              <div className="rpt-card-body">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Daily Avg</th>
                      <th>7-Day Forecast</th>
                      <th>Growth</th>
                      <th>Confidence</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((p, i) => {
                      const growth = parseFloat(p.growthRate || 0);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className={`rpt-rank ${i < 3 ? `rank-${i + 1}` : 'rank-other'}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{p.name}</td>
                          <td style={{ color: '#777', fontSize: 12 }}>{p.category}</td>
                          <td style={{ fontFamily: 'monospace' }}>{p.avgDailySales}</td>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{p.predictedNext7Days} units</td>
                          <td>
                            <span className={`rpt-badge ${growth >= 0 ? 'rpt-badge-up' : 'rpt-badge-down'}`}>
                              {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
                            </span>
                          </td>
                          <td>
                            <div className="rpt-bar-row">
                              <div className="rpt-bar-track" style={{ width: 60 }}>
                                <div className="rpt-bar-fill blue" style={{ width: `${p.confidence}%` }} />
                              </div>
                              <span className="rpt-bar-pct">{p.confidence}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`rpt-badge ${p.stockoutRisk === 'Low' ? 'rpt-badge-healthy' : 'rpt-badge-critical'}`}>
                              {p.stockoutRisk}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {fetched && !loading && !summary && (
        <div className="rpt-empty">
          <div className="rpt-empty-title">No Data</div>
          <p>No sales data found for the selected period.</p>
        </div>
      )}
    </>
  );
};

export default SalesPerformanceReport;
