import React, { useState, useCallback, useMemo } from 'react';
import { getInventoryStatusReport } from '../../api/reportsApi';
import { getAllProducts } from '../../api/productsApi';
import { getAuditLogs } from '../../api/auditApi';
import { downloadCSV, printReport } from './reportUtils';

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

      const [ingData, prodData, rawAuditRes, prodAuditRes] = await Promise.all([
        getInventoryStatusReport(),
        getAllProducts(),
        getAuditLogs({ action: 'RAW_MATERIAL_STOCK_RECEIVED', start_date: startDate, end_date: endDate, limit: 500 }),
        getAuditLogs({ action: 'PRODUCT_STOCK_RECEIVED', start_date: startDate, end_date: endDate, limit: 500 })
      ]);

      const rawAudit = rawAuditRes?.data || rawAuditRes || [];
      const prodAudit = prodAuditRes?.data || prodAuditRes || [];

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
                        parseFloat(i.stock_quantity) <= parseFloat(i.low_stock_alert) ? 'Restock Needed' :
                        parseFloat(i.stock_quantity) <= parseFloat(i.low_stock_alert) * 1.5 ? 'Low Stock' : 'In Stock',
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
                        parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold) ? 'Restock Needed' :
                        parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold) * 1.5 ? 'Low Stock' : 'In Stock',
        }));

      const snapshot = [...ingredientRows, ...productRows].sort((a, b) => a.name.localeCompare(b.name));

      // 2. Parse audit log receipts
      const combinedAudit = [...(rawAudit || []), ...(prodAudit || [])];
      const parsedReceipts = combinedAudit.map(log => {
        let details = {};
        try { details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {}); } catch { /* ignore error */ }
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
  const criticalCount   = rows.filter(r => r.status === 'Restock Needed' || r.status === 'Out of Stock').length;
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
      const color = r.status === 'In Stock' ? '#2e7d32' : r.status === 'Low Stock' ? '#e65100' : '#c62828';
      return `<tr><td><small>${r.type}</small></td><td>${r.name}</td><td style="text-align:right">${r.currentStock} ${r.unit}</td><td style="text-align:right">${r.lowAlert} ${r.unit}</td><td style="color:${color};font-weight:bold">${r.status}</td></tr>`;
    }).join('');
    const html = `
      <h1>Stock Movement Report — ${periodLabel}</h1>
      <p class="subtitle">Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Stock Receipts (${periodLabel})</div><div class="kpi-value">${receipts.length}</div></div>
        <div class="kpi-box"><div class="kpi-label">Total Qty Received</div><div class="kpi-value">${totalReceived.toFixed(2)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Restock Needed / Out of Stock</div><div class="kpi-value">${criticalCount}</div></div>
      </div>
      <h2>Stock Received Log (${periodLabel})</h2>
      ${receipts.length > 0 ? `<table>
        <thead><tr><th>Date & Time</th><th>Type</th><th>Item</th><th style="text-align:right">Added</th><th style="text-align:right">New Total</th><th>Recorded By</th></tr></thead>
        <tbody>${receiptRows}</tbody>
      </table>` : '<p style="color:#888;font-style:italic">No stock received during this period.</p>'}
      <h2>Current Inventory Snapshot</h2>
      <table>
        <thead><tr><th>Type</th><th>Item</th><th style="text-align:right">Current Stock</th><th style="text-align:right">Low Alert</th><th>Status</th></tr></thead>
        <tbody>${snapshotRows}</tbody>
      </table>
    `;
    printReport(html);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Period</span>
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
              value={period}
              onChange={e => { setPeriod(e.target.value); setFetched(false); }}
            >
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
          {fetched && (
            <div className="flex items-center gap-3">
              <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Search</span>
              <input
                type="text"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-48 lg:w-64"
                placeholder="Filter by name or type..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm" 
            onClick={handleExport} 
            disabled={!fetched || loading}
          >
            Export CSV
          </button>
          <button 
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
            onClick={fetchReport} 
            disabled={loading}
          >
            {loading ? 'Loading...' : fetched ? 'Refresh Data' : 'Generate Report'}
          </button>
          <button 
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm" 
            onClick={handlePrint} 
            disabled={!fetched}
          >
            Print
          </button>
        </div>
      </div>

      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 border-dashed rounded-xl h-64">
          <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <div className="text-lg font-bold text-gray-900 mb-1">Ready to Generate</div>
          <p className="m-0 text-sm md:text-base">Select a period and click <strong className="text-gray-900">Generate Report</strong> to view stock movement for all trackable items.</p>
        </div>
      )}

      {loading && (
        <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 rounded-xl h-64 animate-pulse">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
          <p className="m-0 font-medium">Loading inventory movement data...</p>
        </div>
      )}

      {fetched && !loading && (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-blue-500">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Stock Receipts ({periodLabel})</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{receipts.length}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">restocking events</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-green-500">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Total Qty Received</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{totalReceived.toFixed(2)}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">units added to stock</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-red-500">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Restock Needed / Out of Stock</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{criticalCount}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">need immediate attention</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-t-4 border-t-gray-900">
              <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mb-2">Tracked Items</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">{rows.length}</div>
              <div className="text-sm md:text-base font-medium text-gray-400">ingredients & products</div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider transition-colors ${activeView === 'receipts' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setActiveView('receipts')}
            >
              Stock Received Log ({receipts.length})
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider transition-colors ${activeView === 'snapshot' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setActiveView('snapshot')}
            >
              Current Inventory Snapshot
            </button>
          </div>

          {/* Stock Received Table */}
          {activeView === 'receipts' && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-baseline">
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Stock Received Log — {periodLabel}</h2>
                <span className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider">
                  includes ingredients & direct-track products
                </span>
              </div>
              <div className="p-0">
                {filteredReceipts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Qty Added</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">New Total</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredReceipts.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm md:text-base font-medium font-mono text-gray-500">
                              {new Date(r.timestamp).toLocaleString('en-PH')}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs md:text-sm font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                {r.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm md:text-base font-bold text-gray-900">{r.name}</td>
                            <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-green-700 text-right">
                              +{r.quantityAdded} {r.unit}
                            </td>
                            <td className="px-6 py-4 text-sm md:text-base font-medium font-mono text-gray-900 text-right">
                              {r.newStock} {r.unit}
                            </td>
                            <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-600">{r.recordedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 font-medium bg-gray-50/50">No receipt logs found for this period.</div>
                )}
              </div>
            </div>
          )}

          {/* Inventory Snapshot Table */}
          {activeView === 'snapshot' && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Current Inventory Snapshot ({filteredSnapshot.length} items)</h2>
              </div>
              <div className="p-0">
                {filteredSnapshot.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Current Stock</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Low Alert</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                          <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredSnapshot.map(row => {
                          const badgeCls = {
                            'In Stock': 'bg-green-50 text-green-700 border-green-200', 'Low Stock': 'bg-orange-50 text-orange-700 border-orange-200',
                            'Restock Needed': 'bg-red-50 text-red-700 border-red-200', 'Out of Stock': 'bg-black text-white border-black'
                          }[row.status] || 'bg-gray-50 text-gray-700 border-gray-200';
                          
                          return (
                            <tr key={`${row.type}-${row.id}`} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="inline-flex px-2 py-0.5 rounded text-xs md:text-sm font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                  {row.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm md:text-base font-bold text-gray-900">{row.name}</td>
                              <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-gray-900 text-right">
                                {row.currentStock}
                              </td>
                              <td className="px-6 py-4 text-sm md:text-base font-medium font-mono text-gray-400 text-right">
                                {row.lowAlert}
                              </td>
                              <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-500">{row.unit}</td>
                              <td className="px-6 py-4 text-right">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider border ${badgeCls}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 font-medium bg-gray-50/50">No items match your filters.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockMovementReport;
