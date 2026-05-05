import React, { useState, useCallback, useMemo } from 'react';
import { getInventoryStatusReport } from '../../api/reportsApi';
import { getAllProducts } from '../../api/productsApi';
import { getAuditLogs } from '../../api/auditApi';
import { downloadCSV, printReport } from './reportUtils';
import './Reports.css';

// ─── Date helpers ─────────────────────────────────────────────────────────────
const getPeriodStart = (period) => {
  const now = new Date();
  if (period === 'daily')   { now.setHours(0,0,0,0); return now.toISOString(); }
  if (period === 'weekly')  { now.setDate(now.getDate() - 6); now.setHours(0,0,0,0); return now.toISOString(); }
  if (period === 'monthly') { now.setDate(1); now.setHours(0,0,0,0); return now.toISOString(); }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const StockMovementReport = () => {
  const [period, setPeriod]   = useState('weekly');
  const [rows, setRows]       = useState([]);
  const [receipts, setReceipts] = useState([]); // audit log stock-received events
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [search, setSearch]   = useState('');
  const [activeView, setActiveView] = useState('receipts'); // 'receipts' | 'snapshot'

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = getPeriodStart(period);
      const endDate   = new Date().toISOString().replace('T', 'T').slice(0, 19);

      const [ingData, prodData, rawAudit, prodAudit] = await Promise.all([
        getInventoryStatusReport(),
        getAllProducts(),
        getAuditLogs({ action: 'RAW_MATERIAL_STOCK_RECEIVED', start_date: startDate, end_date: endDate }),
        getAuditLogs({ action: 'PRODUCT_STOCK_RECEIVED', start_date: startDate, end_date: endDate })
      ]);

      // 1. Build inventory snapshot (Ingredients + Trackable Products)
      const ingredientRows = (ingData || [])
        .filter(i => !i.is_archived)
        .map(i => ({
          id:           i.id,
          name:         i.name,
          type:         'Ingredient',
          unit:         i.unit,
          currentStock: parseFloat(i.stock_quantity) || 0,
          lowAlert:     parseFloat(i.low_stock_alert) || 0,
          status:       parseFloat(i.stock_quantity) <= 0 ? 'Out of Stock' :
                        parseFloat(i.stock_quantity) <= parseFloat(i.low_stock_alert) ? 'Critical' :
                        parseFloat(i.stock_quantity) <= parseFloat(i.low_stock_alert) * 1.5 ? 'Low' : 'Healthy',
        }));

      const productRows = (prodData || [])
        .filter(p => p.track_stock && !p.is_archived)
        .map(p => ({
          id:           p.id,
          name:         p.name,
          type:         'Product',
          unit:         'pcs',
          currentStock: parseFloat(p.stock_quantity) || 0,
          lowAlert:     parseFloat(p.low_stock_threshold) || 0,
          status:       parseFloat(p.stock_quantity) <= 0 ? 'Out of Stock' :
                        parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold) ? 'Critical' :
                        parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold) * 1.5 ? 'Low' : 'Healthy',
        }));

      const snapshot = [...ingredientRows, ...productRows].sort((a, b) => a.name.localeCompare(b.name));

      // 2. Parse audit log receipts
      const combinedAudit = [...(rawAudit || []), ...(prodAudit || [])];
      const parsedReceipts = combinedAudit.map(log => {
        let details = {};
        try { details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {}); } catch {}
        return {
          id:            log.id,
          timestamp:     log.created_at,
          name:          details.name || '—',
          type:          log.action.includes('PRODUCT') ? 'Product' : 'Ingredient',
          unit:          details.unit || (log.action.includes('PRODUCT') ? 'pcs' : '—'),
          quantityAdded: parseFloat(details.quantity_added) || 0,
          newStock:      parseFloat(details.new_stock) || 0,
          recordedBy:    log.users?.name || 'System',
        };
      }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setRows(snapshot);
      setReceipts(parsedReceipts);
      setFetched(true);
    } catch (err) {
      console.error('Stock movement error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const filteredSnapshot = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(s) || r.type.toLowerCase().includes(s));
  }, [rows, search]);

  const filteredReceipts = useMemo(() => {
    if (!search) return receipts;
    const s = search.toLowerCase();
    return receipts.filter(r => r.name.toLowerCase().includes(s) || r.type.toLowerCase().includes(s));
  }, [receipts, search]);

  const totalReceived   = receipts.reduce((s, r) => s + r.quantityAdded, 0);
  const criticalCount   = rows.filter(r => r.status === 'Critical' || r.status === 'Out of Stock').length;
  const periodLabel     = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';

  const handleExport = () => {
    const exportRows = [
      ['STOCK MOVEMENT REPORT'],
      [`Period: ${periodLabel}`],
      [`Date Generated: ${new Date().toLocaleDateString('en-PH')}`],
      [],
      ['STOCK RECEIVED LOG'],
      ['Date & Time', 'Item Type', 'Item Name', 'Quantity Added', 'Unit', 'New Total Stock', 'Recorded By'],
      ...receipts.map(r => [
        new Date(r.timestamp).toLocaleString('en-PH'),
        r.type,
        r.name,
        r.quantityAdded,
        r.unit,
        r.newStock,
        r.recordedBy
      ]),
      [],
      ['CURRENT INVENTORY SNAPSHOT'],
      ['Item Type', 'Item Name', 'Current Stock', 'Unit', 'Low Alert Level', 'Status'],
      ...rows.map(r => [r.type, r.name, r.currentStock, r.unit, r.lowAlert, r.status])
    ];
    downloadCSV(exportRows, `Stock_Movement_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const receiptRows = receipts.map(r =>
      `<tr>
        <td style="font-size:11px;color:#777">${new Date(r.timestamp).toLocaleString('en-PH')}</td>
        <td style="font-size:10px;color:#888">${r.type}</td>
        <td><strong>${r.name}</strong></td>
        <td style="text-align:right">+${r.quantityAdded} ${r.unit}</td>
        <td style="text-align:right">${r.newStock} ${r.unit}</td>
        <td>${r.recordedBy}</td>
      </tr>`
    ).join('');
    const snapshotRows = rows.map(r => {
      const color = r.status === 'Healthy' ? '#2e7d32' : r.status === 'Low' ? '#e65100' : '#c62828';
      return `<tr><td><small>${r.type}</small></td><td>${r.name}</td><td style="text-align:right">${r.currentStock} ${r.unit}</td><td style="text-align:right">${r.lowAlert} ${r.unit}</td><td style="color:${color};font-weight:bold">${r.status}</td></tr>`;
    }).join('');
    const html = `
      <h1>Stock Movement Report — ${periodLabel}</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Stock Receipts (${periodLabel})</div><div class="kpi-value">${receipts.length}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Qty Received</div><div class="kpi-value">${totalReceived.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Critical / Out of Stock</div><div class="kpi-value">${criticalCount}</div></div>
      </div>
      <h2>Stock Received Log (${periodLabel})</h2>
      ${receipts.length > 0 ? `<table>
        <thead><tr><th>Date & Time</th><th>Type</th><th>Item</th><th style="text-align:right">Added</th><th style="text-align:right">New Total</th><th>Recorded By</th></tr></thead>
        <tbody>${receiptRows}</tbody>
      </table>` : '<p style="color:#888;font-style:italic">No stock received during this period.</p>'}
      <h2>Current Inventory Snapshot</h2>
      <table>
        <thead><tr><th>Type</th><th>Item</th><th style="text-align:right">Current Stock</th><th style="text-align:right">Alert Level</th><th>Status</th></tr></thead>
        <tbody>${snapshotRows}</tbody>
      </table>
    `;
    printReport(`Stock Movement Report — ${periodLabel}`, html);
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
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
          {fetched && (
            <div className="control-group">
              <span className="control-label">Search</span>
              <input
                type="text"
                className="control-input"
                placeholder="Filter by name or type..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
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
          <p>Select a period and click <strong>Generate Report</strong> to view stock movement for all trackable items.</p>
        </div>
      )}

      {loading && <div className="rpt-loading">Loading inventory movement data...</div>}

      {fetched && !loading && (
        <>
          {/* KPI Cards */}
          <div className="rpt-kpi-grid">
            <div className="rpt-kpi-card accent-blue">
              <div className="rpt-kpi-label">Stock Receipts (${periodLabel})</div>
              <div className="rpt-kpi-value">{receipts.length}</div>
              <div className="rpt-kpi-sub">restocking events</div>
            </div>
            <div className="rpt-kpi-card accent-green">
              <div className="rpt-kpi-label">Total Qty Received</div>
              <div className="rpt-kpi-value">{totalReceived.toFixed(2)}</div>
              <div className="rpt-kpi-sub">units added to stock</div>
            </div>
            <div className="rpt-kpi-card accent-red">
              <div className="rpt-kpi-label">Critical / Out of Stock</div>
              <div className="rpt-kpi-value">{criticalCount}</div>
              <div className="rpt-kpi-sub">need immediate attention</div>
            </div>
            <div className="rpt-kpi-card">
              <div className="rpt-kpi-label">Tracked Items</div>
              <div className="rpt-kpi-value">{rows.length}</div>
              <div className="rpt-kpi-sub">ingredients & products</div>
            </div>
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              className={`rpt-btn${activeView === 'receipts' ? ' rpt-btn-primary' : ''}`}
              onClick={() => setActiveView('receipts')}
            >
              Stock Received Log ({receipts.length})
            </button>
            <button
              className={`rpt-btn${activeView === 'snapshot' ? ' rpt-btn-primary' : ''}`}
              onClick={() => setActiveView('snapshot')}
            >
              Current Inventory Snapshot
            </button>
          </div>

          {/* Stock Received Table */}
          {activeView === 'receipts' && (
            <div className="rpt-card">
              <div className="rpt-card-header">
                <h2>Stock Received Log — {periodLabel}</h2>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  includes ingredients & direct-track products
                </span>
              </div>
              <div className="rpt-card-body">
                {filteredReceipts.length > 0 ? (
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Item Name</th>
                        <th style={{ textAlign: 'right' }}>Qty Added</th>
                        <th style={{ textAlign: 'right' }}>New Total</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceipts.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#777' }}>
                            {new Date(r.timestamp).toLocaleString('en-PH')}
                          </td>
                          <td style={{ fontSize: '10px', color: '#888' }}>{r.type.toUpperCase()}</td>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32' }}>
                            +{r.quantityAdded} {r.unit}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {r.newStock} {r.unit}
                          </td>
                          <td style={{ fontSize: 12, color: '#555' }}>{r.recordedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rpt-empty">No receipt logs found for this period.</div>
                )}
              </div>
            </div>
          )}

          {/* Inventory Snapshot Table */}
          {activeView === 'snapshot' && (
            <div className="rpt-card">
              <div className="rpt-card-header">
                <h2>Current Inventory Snapshot ({filteredSnapshot.length} items)</h2>
              </div>
              <div className="rpt-card-body">
                {filteredSnapshot.length > 0 ? (
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Item Name</th>
                        <th style={{ textAlign: 'right' }}>Current Stock</th>
                        <th style={{ textAlign: 'right' }}>Low Alert</th>
                        <th>Unit</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSnapshot.map(row => {
                        const statusColor = {
                          Healthy: '#2e7d32', Low: '#e65100', Critical: '#c62828', 'Out of Stock': '#000'
                        }[row.status] || '#555';
                        const badgeCls = {
                          Healthy: 'rpt-badge-healthy', Low: 'rpt-badge-warning',
                          Critical: 'rpt-badge-critical', 'Out of Stock': 'rpt-badge-critical'
                        }[row.status] || '';
                        return (
                          <tr key={`${row.type}-${row.id}`}>
                            <td style={{ fontSize: '10px', color: '#888' }}>{row.type.toUpperCase()}</td>
                            <td style={{ fontWeight: 600 }}>{row.name}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                              {row.currentStock}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#777' }}>
                              {row.lowAlert}
                            </td>
                            <td style={{ color: '#777', fontSize: 12 }}>{row.unit}</td>
                            <td>
                              <span className={`rpt-badge ${badgeCls}`} style={{ color: statusColor }}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="rpt-empty">No items match your filters.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default StockMovementReport;
