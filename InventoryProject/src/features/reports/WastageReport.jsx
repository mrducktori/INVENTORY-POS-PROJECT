import React, { useState, useCallback, useMemo } from 'react';
import { getWastageReport, getWastageStats } from '../../api/reportsApi';
import { downloadCSV, printReport } from './reportUtils';
import './Reports.css';

// ─── Reason badge colors ──────────────────────────────────────────────────────
const reasonBadgeStyle = (reason) => {
  const map = {
    'Expired':   { background: '#ffebee', color: '#c62828', border: '1px solid #c62828' },
    'Spilled':   { background: '#fff8e1', color: '#e65100', border: '1px solid #e65100' },
    'Damaged':   { background: '#fff8e1', color: '#e65100', border: '1px solid #e65100' },
    'Overcooked':{ background: '#f3e5f5', color: '#6a1b9a', border: '1px solid #6a1b9a' },
    'Other':     { background: '#f5f5f5', color: '#555', border: '1px solid #ccc' },
  };
  return map[reason] || map['Other'];
};

// ─── Main Component ───────────────────────────────────────────────────────────
const WastageReport = () => {
  const [entries, setEntries] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [reasonFilter, setReasonFilter] = useState('ALL');
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('created_at');
  const [sortDir, setSortDir]   = useState('desc');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const [wastageData, statsData] = await Promise.all([
        getWastageReport(startDate, endDate),
        getWastageStats()
      ]);
      setEntries(wastageData || []);
      setStats(statsData || null);
      setFetched(true);
    } catch (err) {
      console.error('Wastage report error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const arrow = key => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  // Unique reasons for filter dropdown
  const reasons = useMemo(() => {
    const set = new Set(entries.map(e => e.reason).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter(e => {
        const matchSearch = !search ||
          (e.ingredients?.name || e.ingredient_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (e.reason || '').toLowerCase().includes(search.toLowerCase()) ||
          (e.users?.name || e.reported_by_name || '').toLowerCase().includes(search.toLowerCase());
        const matchReason = reasonFilter === 'ALL' || e.reason === reasonFilter;
        return matchSearch && matchReason;
      })
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (sortKey === 'created_at') {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        }
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [entries, search, reasonFilter, sortKey, sortDir]);

  // Summary aggregations
  const totalQuantity = filtered.reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
  const totalCost     = filtered.reduce((s, e) => s + (parseFloat(e.estimated_cost) || 0), 0);

  // Group by reason for breakdown
  const byReason = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      const r = e.reason || 'Unknown';
      if (!map[r]) map[r] = { count: 0, cost: 0 };
      map[r].count++;
      map[r].cost += parseFloat(e.estimated_cost) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [entries]);

  const handleExport = () => {
    const dateRange = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : 'All Time';
    const exportRows = [
      ['WASTAGE & LOSS REPORT'],
      [`Date Range: ${dateRange}`],
      [`Date Generated: ${new Date().toLocaleDateString('en-PH')}`],
      [],
      ['SUMMARY'],
      ['Total Wastage Events', filtered.length],
      ['Total Quantity Wasted', totalQuantity.toFixed(2)],
      ['Total Estimated Cost Loss (PHP)', `₱${totalCost.toFixed(2)}`],
      [],
      ['WASTAGE LOG'],
      ['Date & Time', 'Ingredient Name', 'Quantity Wasted', 'Unit', 'Reason', 'Estimated Cost Loss (PHP)', 'Reported By'],
      ...filtered.map(e => [
        new Date(e.created_at).toLocaleString('en-PH'),
        e.ingredients?.name || e.ingredient_name || '—',
        parseFloat(e.quantity || 0).toFixed(2),
        e.ingredients?.unit || e.unit || '—',
        e.reason || '—',
        `₱${parseFloat(e.estimated_cost || 0).toFixed(2)}`,
        e.users?.name || e.reported_by_name || '—'
      ])
    ];
    downloadCSV(exportRows, `Wastage_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : 'All Time';
    const tableRows = filtered.map(e => `
      <tr>
        <td style="font-size:11px;color:#777">${new Date(e.created_at).toLocaleString('en-PH')}</td>
        <td><strong>${e.ingredients?.name || e.ingredient_name || '—'}</strong></td>
        <td style="text-align:right">${parseFloat(e.quantity || 0).toFixed(2)} ${e.ingredients?.unit || e.unit || ''}</td>
        <td>${e.reason || '—'}</td>
        <td style="text-align:right;color:#c62828;font-weight:bold">₱${parseFloat(e.estimated_cost || 0).toFixed(2)}</td>
        <td>${e.users?.name || e.reported_by_name || '—'}</td>
      </tr>`).join('');
    const reasonRows = byReason.map(([reason, data]) =>
      `<tr><td>${reason}</td><td style="text-align:center">${data.count}</td><td style="text-align:right">₱${data.cost.toFixed(2)}</td></tr>`
    ).join('');
    const html = `
      <h1>Wastage & Loss Report</h1>
      <p class="subtitle">Period: ${dateRange} &nbsp;&bull;&nbsp; Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Total Events</div><div class="kpi-value">${filtered.length}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Cost Loss</div><div class="kpi-value">₱${totalCost.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Qty Wasted</div><div class="kpi-value">${totalQuantity.toFixed(2)}</div></div>
      </div>
      <h2>Breakdown by Reason</h2>
      <table><thead><tr><th>Reason</th><th>Events</th><th>Cost Loss</th></tr></thead>
      <tbody>${reasonRows}</tbody></table>
      <h2>Wastage Log (${filtered.length} records)</h2>
      <table>
        <thead><tr><th>Date & Time</th><th>Ingredient</th><th style="text-align:right">Qty</th><th>Reason</th><th style="text-align:right">Cost Loss</th><th>Reported By</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    printReport('Wastage & Loss Report', html);
  };

  return (
    <>
      {/* Controls */}
      <div className="report-controls">
        <div className="report-controls-left">
          <div className="control-group">
            <span className="control-label">Start Date</span>
            <input
              type="date"
              className="control-input"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setFetched(false); }}
              style={{ minWidth: 150 }}
            />
          </div>
          <div className="control-group">
            <span className="control-label">End Date</span>
            <input
              type="date"
              className="control-input"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setFetched(false); }}
              style={{ minWidth: 150 }}
            />
          </div>
          {fetched && (
            <>
              <div className="control-group">
                <span className="control-label">Reason</span>
                <select className="control-select" value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}>
                  {reasons.map(r => <option key={r} value={r}>{r === 'ALL' ? 'All Reasons' : r}</option>)}
                </select>
              </div>
              <div className="control-group">
                <span className="control-label">Search</span>
                <input
                  type="text"
                  className="control-input"
                  placeholder="Item, reason, staff..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="report-controls-right">
          <button className="rpt-btn" onClick={handleExport} disabled={!fetched || loading}>
            Export CSV
          </button>
          <button className="rpt-btn rpt-btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : fetched ? 'Refresh' : 'Generate Report'}
          </button>
          <button className="rpt-btn" onClick={handlePrint} disabled={!fetched}>
            Print
          </button>
        </div>
      </div>

      {!fetched && !loading && (
        <div className="rpt-empty">
          <div className="rpt-empty-title">Ready to Generate</div>
          <p>Optionally set a date range, then click <strong>Generate Report</strong> to view wastage data.</p>
        </div>
      )}

      {loading && <div className="rpt-loading">Loading wastage records...</div>}

      {fetched && !loading && (
        <>
          {/* KPI Cards */}
          <div className="rpt-kpi-grid">
            <div className="rpt-kpi-card accent-red">
              <div className="rpt-kpi-label">Total Records</div>
              <div className="rpt-kpi-value">{filtered.length}</div>
              <div className="rpt-kpi-sub">wastage events</div>
            </div>
            <div className="rpt-kpi-card accent-orange">
              <div className="rpt-kpi-label">Estimated Cost Loss</div>
              <div className="rpt-kpi-value">₱{totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="rpt-kpi-sub">total loss value</div>
            </div>
            <div className="rpt-kpi-card">
              <div className="rpt-kpi-label">Total Quantity Wasted</div>
              <div className="rpt-kpi-value">{totalQuantity.toFixed(2)}</div>
              <div className="rpt-kpi-sub">units lost</div>
            </div>
            <div className="rpt-kpi-card">
              <div className="rpt-kpi-label">Reason Categories</div>
              <div className="rpt-kpi-value">{byReason.length}</div>
              <div className="rpt-kpi-sub">distinct reasons</div>
            </div>
          </div>

          {/* Reason Breakdown */}
          {byReason.length > 0 && (
            <div className="rpt-two-col">
              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h2>Breakdown by Reason</h2>
                </div>
                <div className="rpt-card-body">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th style={{ textAlign: 'center' }}>Events</th>
                        <th style={{ textAlign: 'right' }}>Cost Loss</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byReason.map(([reason, data]) => {
                        const share = filtered.length > 0 ? (data.count / filtered.length) * 100 : 0;
                        return (
                          <tr key={reason}>
                            <td>
                              <span
                                className="rpt-badge"
                                style={reasonBadgeStyle(reason)}
                              >
                                {reason}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{data.count}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                              ₱{data.cost.toFixed(2)}
                            </td>
                            <td>
                              <div className="rpt-bar-row">
                                <div className="rpt-bar-track" style={{ flex: 1 }}>
                                  <div className="rpt-bar-fill red" style={{ width: `${share}%` }} />
                                </div>
                                <span className="rpt-bar-pct">{share.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stats from /wastage/stats */}
              {stats && (
                <div className="rpt-card">
                  <div className="rpt-card-header">
                    <h2>Overall Statistics</h2>
                  </div>
                  <div style={{ padding: 20 }}>
                    {Object.entries(stats).map(([k, v]) => (
                      <div key={k} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid #f0f0f0',
                        fontSize: 13
                      }}>
                        <span style={{ color: '#666', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                          {k === 'wastageByIngredient' 
                            ? Object.keys(v).length + ' items' 
                            : (typeof v === 'number' && k.toLowerCase().includes('cost'))
                              ? `₱${parseFloat(v).toFixed(2)}`
                              : v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Wastage Table */}
          <div className="rpt-card">
            <div className="rpt-card-header">
              <h2>Wastage Log ({filtered.length} records)</h2>
            </div>
            <div className="rpt-card-body">
              {filtered.length > 0 ? (
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('created_at')}>Date & Time{arrow('created_at')}</th>
                      <th onClick={() => handleSort('ingredient_name')}>Ingredient{arrow('ingredient_name')}</th>
                      <th style={{ textAlign: 'right' }} onClick={() => handleSort('quantity')}>
                        Qty{arrow('quantity')}
                      </th>
                      <th>Unit</th>
                      <th onClick={() => handleSort('reason')}>Reason{arrow('reason')}</th>
                      <th style={{ textAlign: 'right' }} onClick={() => handleSort('estimated_cost')}>
                        Loss Value{arrow('estimated_cost')}
                      </th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, i) => (
                      <tr key={e.id || i}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#777' }}>
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {e.ingredients?.name || e.ingredient_name || '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          {parseFloat(e.quantity || 0).toFixed(2)}
                        </td>
                        <td style={{ color: '#777', fontSize: 12 }}>
                          {e.ingredients?.unit || e.unit || '—'}
                        </td>
                        <td>
                          {e.reason
                            ? <span className="rpt-badge" style={reasonBadgeStyle(e.reason)}>{e.reason}</span>
                            : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 700 }}>
                          ₱{parseFloat(e.estimated_cost || 0).toFixed(2)}
                        </td>
                        <td style={{ fontSize: 12, color: '#555' }}>
                          {e.users?.name || e.reported_by_name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rpt-empty">
                  <div className="rpt-empty-title">No Records Found</div>
                  <p>No wastage events match your current filters.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default WastageReport;
