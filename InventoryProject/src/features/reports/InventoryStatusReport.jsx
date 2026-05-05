import React, { useState, useCallback, useMemo } from 'react';
import { getInventoryStatusReport } from '../../api/reportsApi';
import { formatQuantity } from '../../utils/productUtils';
import { downloadCSV, printReport } from './reportUtils';
import './Reports.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getStatus = (qty, alert) => {
  if (qty <= 0) return 'out';
  if (qty <= alert) return 'critical';
  if (qty <= alert * 1.5) return 'warning';
  return 'healthy';
};

const getStatusLabel = s => ({ out: 'Out of Stock', critical: 'Critical', warning: 'Warning', healthy: 'Healthy' }[s] || s);
const getBadgeClass = s => `rpt-badge rpt-badge-${s}`;

const getStockPct = (qty, alert) => {
  if (!alert || alert === 0) return 100;
  return Math.min(Math.round((qty / (alert * 2)) * 100), 100);
};

const barColor = s => ({ out: 'red', critical: 'red', warning: 'orange', healthy: 'green' }[s] || '');

// ─── Summary donut-style segmented bar ───────────────────────────────────────
const HealthBar = ({ stats }) => {
  const total = stats.total || 1;
  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', marginTop: 8, gap: 1 }}>
      {stats.healthy > 0 && (
        <div style={{ flex: stats.healthy / total, background: '#2e7d32' }} title={`Healthy: ${stats.healthy}`} />
      )}
      {stats.warning > 0 && (
        <div style={{ flex: stats.warning / total, background: '#e65100' }} title={`Warning: ${stats.warning}`} />
      )}
      {stats.critical > 0 && (
        <div style={{ flex: stats.critical / total, background: '#c62828' }} title={`Critical: ${stats.critical}`} />
      )}
      {stats.out > 0 && (
        <div style={{ flex: stats.out / total, background: '#000' }} title={`Out: ${stats.out}`} />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const InventoryStatusReport = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortKey, setSortKey]         = useState('name');
  const [sortDir, setSortDir]         = useState('asc');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInventoryStatusReport();
      setIngredients((data || []).filter(i => !i.is_archived));
      setFetched(true);
    } catch (err) {
      console.error('Inventory report error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => ({
    total:    ingredients.length,
    healthy:  ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'healthy').length,
    warning:  ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'warning').length,
    critical: ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'critical').length,
    out:      ingredients.filter(i => getStatus(i.stock_quantity, i.low_stock_alert) === 'out').length,
  }), [ingredients]);

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const arrow = key => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  const filtered = useMemo(() => {
    return ingredients
      .filter(i => {
        const s = getStatus(i.stock_quantity, i.low_stock_alert);
        const matchSearch = (i.name || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || s.toUpperCase() === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [ingredients, search, statusFilter, sortKey, sortDir]);

  // Priority list — only critical/warning/out, sorted by urgency
  const priorityList = useMemo(() => {
    return ingredients
      .filter(i => {
        const s = getStatus(i.stock_quantity, i.low_stock_alert);
        return s === 'out' || s === 'critical' || s === 'warning';
      })
      .sort((a, b) => {
        const order = { out: 0, critical: 1, warning: 2 };
        return (order[getStatus(a.stock_quantity, a.low_stock_alert)] || 9)
             - (order[getStatus(b.stock_quantity, b.low_stock_alert)] || 9);
      });
  }, [ingredients]);

  const handleExport = () => {
    const date = new Date().toLocaleDateString('en-PH');
    const rows = [
      ['INVENTORY STATUS REPORT'],
      [`Date Generated: ${date}`],
      [],
      ['SUMMARY'],
      ['Total Ingredients Tracked', stats.total],
      ['Healthy Stock', stats.healthy],
      ['Low / Warning', stats.warning],
      ['Critical', stats.critical],
      ['Out of Stock', stats.out],
      [],
      ['FULL INGREDIENT LIST'],
      ['Ingredient Name', 'Current Stock', 'Unit', 'Low Stock Alert Level', 'Stock Status'],
      ...ingredients.map(i => {
        const s = getStatus(i.stock_quantity, i.low_stock_alert);
        return [
          i.name,
          i.stock_quantity,
          i.unit,
          i.low_stock_alert,
          getStatusLabel(s)
        ];
      })
    ];
    downloadCSV(rows, `Inventory_Status_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const urgentRows = priorityList.map(i => {
      const s = getStatus(i.stock_quantity, i.low_stock_alert);
      return `<tr><td><strong>${i.name}</strong></td><td>${i.stock_quantity} ${i.unit}</td><td>${i.low_stock_alert} ${i.unit}</td><td><span class="badge badge-${s}">${getStatusLabel(s)}</span></td></tr>`;
    }).join('');
    const allRows = ingredients.map(i => {
      const s = getStatus(i.stock_quantity, i.low_stock_alert);
      return `<tr><td>${i.name}</td><td>${i.stock_quantity} ${i.unit}</td><td>${i.low_stock_alert} ${i.unit}</td><td><span class="badge badge-${s}">${getStatusLabel(s)}</span></td></tr>`;
    }).join('');
    const html = `
      <h1>Inventory Status Report</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Total Tracked</div><div class="kpi-value">${stats.total}</div></div>
        <div class="kpi-box"><div class="kpi-label">Healthy</div><div class="kpi-value">${stats.healthy}</div></div>
        <div class="kpi-box"><div class="kpi-label">Warning/Critical</div><div class="kpi-value">${stats.warning + stats.critical}</div></div>
        <div class="kpi-box"><div class="kpi-label">Out of Stock</div><div class="kpi-value">${stats.out}</div></div>
      </div>
      ${priorityList.length > 0 ? `
        <h2>Needs Attention (${priorityList.length} items)</h2>
        <table><thead><tr><th>Ingredient</th><th>Current Stock</th><th>Alert Level</th><th>Status</th></tr></thead>
        <tbody>${urgentRows}</tbody></table>` : ''}
      <h2>Full Inventory List</h2>
      <table><thead><tr><th>Ingredient</th><th>Current Stock</th><th>Alert Level</th><th>Status</th></tr></thead>
      <tbody>${allRows}</tbody></table>
    `;
    printReport('Inventory Status Report', html);
  };

  return (
    <>
      {/* Controls */}
      <div className="report-controls">
        <div className="report-controls-left">
          <div className="control-group">
            <span className="control-label">Search</span>
            <input
              type="text"
              className="control-input"
              placeholder="Filter ingredients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>
          <div className="control-group">
            <span className="control-label">Status Filter</span>
            <select className="control-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="HEALTHY">Healthy Only</option>
              <option value="WARNING">Warning Only</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>
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
          <p>Click <strong>Generate Report</strong> to load current inventory data.</p>
        </div>
      )}

      {loading && <div className="rpt-loading">Scanning inventory...</div>}

      {fetched && !loading && (
        <>
          {/* KPI Cards */}
          <div className="rpt-kpi-grid">
            <div className="rpt-kpi-card">
              <div className="rpt-kpi-label">Total Ingredients</div>
              <div className="rpt-kpi-value">{stats.total}</div>
              <div className="rpt-kpi-sub">active items tracked</div>
            </div>
            <div className="rpt-kpi-card accent-green">
              <div className="rpt-kpi-label">Healthy Stock</div>
              <div className="rpt-kpi-value">{stats.healthy}</div>
              <div className="rpt-kpi-sub">above safe threshold</div>
            </div>
            <div className="rpt-kpi-card accent-orange">
              <div className="rpt-kpi-label">Warning / Critical</div>
              <div className="rpt-kpi-value">{stats.warning + stats.critical}</div>
              <div className="rpt-kpi-sub">need attention</div>
            </div>
            <div className="rpt-kpi-card accent-red">
              <div className="rpt-kpi-label">Out of Stock</div>
              <div className="rpt-kpi-value">{stats.out}</div>
              <div className="rpt-kpi-sub">immediate restock needed</div>
            </div>
          </div>

          {/* Health Overview Bar */}
          {stats.total > 0 && (
            <div className="rpt-card" style={{ marginBottom: 20 }}>
              <div className="rpt-card-header">
                <h2>Stock Health Overview</h2>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Healthy · Warning · Critical · Out
                </span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  {[
                    { label: 'Healthy', val: stats.healthy, color: '#2e7d32' },
                    { label: 'Warning', val: stats.warning, color: '#e65100' },
                    { label: 'Critical', val: stats.critical, color: '#c62828' },
                    { label: 'Out of Stock', val: stats.out, color: '#000' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <HealthBar stats={stats} />
              </div>
            </div>
          )}

          {/* Priority Attention List */}
          {priorityList.length > 0 && (
            <div className="rpt-card">
              <div className="rpt-card-header" style={{ background: '#c62828' }}>
                <h2>Priority Attention Required ({priorityList.length} items)</h2>
              </div>
              <div className="rpt-card-body">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Current Stock</th>
                      <th>Alert Level</th>
                      <th>Unit</th>
                      <th>Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityList.map(ing => {
                      const s = getStatus(ing.stock_quantity, ing.low_stock_alert);
                      const pct = getStockPct(ing.stock_quantity, ing.low_stock_alert);
                      return (
                        <tr key={ing.id}>
                          <td style={{ fontWeight: 700 }}>{ing.name}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{ing.stock_quantity}</td>
                          <td style={{ fontFamily: 'monospace', color: '#777' }}>{ing.low_stock_alert}</td>
                          <td style={{ color: '#777', fontSize: 12 }}>{ing.unit}</td>
                          <td style={{ minWidth: 120 }}>
                            <div className="rpt-bar-row">
                              <div className="rpt-bar-track" style={{ flex: 1 }}>
                                <div className={`rpt-bar-fill ${barColor(s)}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="rpt-bar-pct">{pct}%</span>
                            </div>
                          </td>
                          <td><span className={getBadgeClass(s)}>{getStatusLabel(s)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full Inventory Table */}
          <div className="rpt-card">
            <div className="rpt-card-header">
              <h2>Full Inventory Table ({filtered.length} items)</h2>
            </div>
            <div className="rpt-card-body">
              {filtered.length > 0 ? (
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('name')}>Ingredient{arrow('name')}</th>
                      <th onClick={() => handleSort('stock_quantity')}>Current Stock{arrow('stock_quantity')}</th>
                      <th onClick={() => handleSort('low_stock_alert')}>Alert Level{arrow('low_stock_alert')}</th>
                      <th>Unit</th>
                      <th style={{ minWidth: 140 }}>Level</th>
                      <th onClick={() => handleSort('stock_quantity')}>Status{arrow('stock_quantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(ing => {
                      const s   = getStatus(ing.stock_quantity, ing.low_stock_alert);
                      const pct = getStockPct(ing.stock_quantity, ing.low_stock_alert);
                      return (
                        <tr key={ing.id}>
                          <td style={{ fontWeight: 600 }}>{ing.name}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{ing.stock_quantity}</td>
                          <td style={{ fontFamily: 'monospace', color: '#777' }}>{ing.low_stock_alert}</td>
                          <td style={{ color: '#777', fontSize: 12 }}>{ing.unit}</td>
                          <td>
                            <div className="rpt-bar-row">
                              <div className="rpt-bar-track" style={{ flex: 1 }}>
                                <div className={`rpt-bar-fill ${barColor(s)}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="rpt-bar-pct">{pct}%</span>
                            </div>
                          </td>
                          <td><span className={getBadgeClass(s)}>{getStatusLabel(s)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="rpt-empty">No ingredients match your filters.</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default InventoryStatusReport;
