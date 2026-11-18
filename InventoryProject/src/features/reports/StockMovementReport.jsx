import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getInventoryStatusReport, getWastageReport } from '../../api/reportsApi';
import { getAllProducts } from '../../api/productsApi';
import { getAuditLogs } from '../../api/auditApi';
import { downloadCSV, printReport } from './reportUtils';
import { getPeriodDateRange } from '../../utils/dateUtils';
import InfoTip from '../../components/shared/InfoTip';
import { TableSkeleton, StatCardsSkeleton } from '../../components/shared/SkeletonLoader';
import Pagination from '../../components/shared/Pagination';

// ─── Status Groups & Helpers for Snapshot ───────────────────────────────────────
const STATUS_GROUPS = [
  {
    id: 'out',
    label: 'Out of Stock',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    headerBg: 'bg-red-50/70 border-red-200',
    icon: (
      <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  {
    id: 'low',
    label: 'Low Stock / Restock Needed',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
    headerBg: 'bg-amber-50/70 border-amber-200',
    icon: (
      <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'normal',
    label: 'In Stock',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-gray-100/70 border-gray-200',
    icon: (
      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
];

const getStockStatus = (current, alert_level) => {
  const qty = Number(current) || 0;
  const alert = Number(alert_level) || 0;
  if (qty <= 0) return 'out';
  if (alert > 0 && qty <= alert * 1.5) return 'low';
  return 'normal';
};

const getStatusLabel = (statusKey) => {
  if (statusKey === 'out') return 'Out of Stock';
  if (statusKey === 'low') return 'Low Stock / Restock Needed';
  return 'In Stock';
};

// ─── Main Component ───────────────────────────────────────────────────────────
const StockMovementReport = () => {
  const [period, setPeriod]       = useState('weekly');
  const [rows, setRows]           = useState([]); // Inventory snapshot
  const [movements, setMovements] = useState([]); // Inflow, Outflow, Wastage events
  const [loading, setLoading]     = useState(false);
  const [fetched, setFetched]     = useState(false);
  const [search, setSearch]       = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL'); // 'ALL' | 'IN' | 'OUT' | 'WASTAGE'
  const [activeView, setActiveView] = useState('movements'); // 'movements' | 'snapshot'
  const [movementPage, setMovementPage] = useState(1);
  const [movementItemsPerPage, setMovementItemsPerPage] = useState(25);

  useEffect(() => {
    setMovementPage(1);
  }, [period, movementTypeFilter, search]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDateRange(period);

      // Fetch all stock-related movement actions in single call
      const stockActions = 'RAW_MATERIAL_STOCK_RECEIVED,PRODUCT_STOCK_RECEIVED,INGREDIENT_DEDUCTED,PRODUCT_DEDUCTED,WASTAGE';

      const [ingData, prodData, auditRes, wastageData] = await Promise.all([
        getInventoryStatusReport(),
        getAllProducts(),
        getAuditLogs({ action: stockActions, start_date: startDate, end_date: endDate, limit: 2000 }),
        getWastageReport(startDate, endDate)
      ]);

      const ingList = ingData || [];
      const prodList = prodData || [];
      const auditList = auditRes?.data || auditRes || [];
      const wastageList = wastageData || [];

      // Create lookup maps for accurate names and units
      const ingredientMap = {};
      ingList.forEach(i => { ingredientMap[i.id] = i; });

      const productMap = {};
      prodList.forEach(p => { productMap[p.id] = p; });

      // 1. Build current inventory snapshot (Ingredients + Trackable Products)
      const ingredientRows = ingList
        .filter(i => !i.is_archived)
        .map(i => {
          const currentStock = parseFloat(i.stock_quantity) || 0;
          const lowAlert = parseFloat(i.low_stock_alert) || 0;
          const statusKey = getStockStatus(currentStock, lowAlert);
          return {
            id:           i.id,
            name:         i.name,
            type:         'Ingredient',
            unit:         i.unit || 'pcs',
            currentStock,
            lowAlert,
            statusKey,
            status:       getStatusLabel(statusKey)
          };
        });

      const productRows = prodList
        .filter(p => p.track_stock && !p.is_archived)
        .map(p => {
          const currentStock = parseFloat(p.stock_quantity) || 0;
          const lowAlert = parseFloat(p.low_stock_threshold) || 0;
          const statusKey = getStockStatus(currentStock, lowAlert);
          return {
            id:           p.id,
            name:         p.name,
            type:         'Product',
            unit:         'pcs',
            currentStock,
            lowAlert,
            statusKey,
            status:       getStatusLabel(statusKey)
          };
        });

      const snapshot = [...ingredientRows, ...productRows];

      // 2. Map dedicated records from the wastage table (primary source of truth)
      const directWastageMovements = wastageList.map(w => {
        const ing = w.ingredients || ingredientMap[w.ingredient_id] || {};
        const qty = parseFloat(w.quantity) || 0;
        const itemName = ing.name || '—';
        const unit = ing.unit || 'pcs';
        const costStr = w.estimated_cost ? ` (Est. ₱${Number(w.estimated_cost).toFixed(2)})` : '';

        return {
          id:             `wastage-${w.id}`,
          timestamp:      w.created_at,
          action:         'WASTAGE',
          movementType:   'WASTAGE',
          directionLabel: 'Wastage',
          itemType:       'Ingredient',
          name:           itemName,
          unit,
          qtyChange:      -Math.abs(qty),
          absQty:         Math.abs(qty),
          newStock:       null,
          reason:         w.reason ? `Wastage: ${w.reason}${costStr}` : `Wastage / Loss${costStr}`,
          recordedBy:     w.users?.name || 'Staff'
        };
      });

      // 3. Parse comprehensive stock movement audit events (IN, OUT, WASTAGE)
      const parsedAuditMovements = auditList.map(log => {
        let details;
        if (typeof log.details === 'string') {
          try {
            details = JSON.parse(log.details);
          } catch {
            // Check if string format like "Deducted 1 CHOCOLATE CHIP COOKIE for POS Sale."
            const match = log.details.match(/Deducted\s+(\d+(?:\.\d+)?)\s+(.+?)\s+for POS Sale/i);
            if (match) {
              details = {
                quantity: -parseFloat(match[1]),
                name: match[2].trim(),
                reason: 'POS Order'
              };
            } else {
              details = { note: log.details };
            }
          }
        } else {
          details = log.details || {};
        }

        const action = log.action || '';
        let movementType = 'IN';
        let directionLabel = 'Stock In';
        let itemType = 'Ingredient';
        let itemName = details.name || details.ingredient_name || '—';
        let unit = details.unit || '—';
        let qty = 0;
        let newStock = details.new_stock !== undefined ? details.new_stock : (details.remaining_stock !== undefined ? details.remaining_stock : null);
        let reason = details.reason || details.notes || '—';

        if (action.includes('STOCK_RECEIVED')) {
          movementType = 'IN';
          directionLabel = 'Stock In';
          itemType = action.includes('PRODUCT') ? 'Product' : 'Ingredient';
          qty = Math.abs(parseFloat(details.quantity_added || details.quantity) || 0);
          reason = details.notes || details.reason || 'Restock / Purchase Order';
          if (itemType === 'Product') {
            unit = 'pcs';
            if (itemName === '—' && details.product_id && productMap[details.product_id]) {
              itemName = productMap[details.product_id].name;
            }
          } else {
            if (details.ingredient_id && ingredientMap[details.ingredient_id]) {
              unit = ingredientMap[details.ingredient_id].unit || unit;
              if (itemName === '—') itemName = ingredientMap[details.ingredient_id].name;
            }
          }
        } else if (action === 'WASTAGE') {
          movementType = 'WASTAGE';
          directionLabel = 'Wastage';
          itemType = 'Ingredient';
          qty = -Math.abs(parseFloat(details.quantity) || 0);
          reason = details.reason ? `Wastage: ${details.reason}` : 'Wastage / Loss';
          if (details.ingredient_id && ingredientMap[details.ingredient_id]) {
            unit = ingredientMap[details.ingredient_id].unit || unit;
            if (itemName === '—') itemName = ingredientMap[details.ingredient_id].name;
          }
        } else if (action.includes('DEDUCTED')) {
          movementType = 'OUT';
          directionLabel = 'Stock Out';
          itemType = action.includes('PRODUCT') ? 'Product' : 'Ingredient';
          qty = -Math.abs(parseFloat(details.quantity || details.quantity_deducted) || 1);
          reason = details.sale_id ? `POS Order #${String(details.sale_id).slice(0, 8)}` : (details.reason || 'POS Consumption');
          if (itemType === 'Product') {
            unit = 'pcs';
            if (itemName === '—' && details.product_id && productMap[details.product_id]) {
              itemName = productMap[details.product_id].name;
            }
          } else {
            if (details.ingredient_id && ingredientMap[details.ingredient_id]) {
              unit = ingredientMap[details.ingredient_id].unit || unit;
              if (itemName === '—') itemName = ingredientMap[details.ingredient_id].name;
            }
          }
        }

        return {
          id:             log.id,
          timestamp:      log.created_at,
          action:         log.action,
          movementType,   // 'IN' | 'OUT' | 'WASTAGE'
          directionLabel, // 'Stock In' | 'Stock Out' | 'Wastage'
          itemType,       // 'Product' | 'Ingredient'
          name:           itemName,
          unit,
          qtyChange:      qty,
          absQty:         Math.abs(qty),
          newStock,
          reason,
          recordedBy:     log.users?.name || 'System'
        };
      });

      // 4. Combine and deduplicate movements: prioritize wastage table records over audit log duplicates
      const combined = [...directWastageMovements, ...parsedAuditMovements];
      const seenWastage = new Set();
      const finalMovements = [];

      for (const m of combined) {
        if (m.movementType === 'WASTAGE') {
          const timeMinute = m.timestamp ? new Date(m.timestamp).toISOString().slice(0, 16) : '';
          const key = `${timeMinute}_${String(m.name || '').toLowerCase()}_${m.qtyChange}`;
          if (seenWastage.has(key)) continue;
          seenWastage.add(key);
        }
        finalMovements.push(m);
      }

      finalMovements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setRows(snapshot);
      setMovements(finalMovements);
      setFetched(true);
    } catch (err) {
      console.error('Stock movement error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Auto-fetch default report on initial mount
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const term = (search || '').trim().toLowerCase();
      const matchSearch = !term ? true : (
        String(m.name || '').toLowerCase().includes(term) || 
        String(m.itemType || '').toLowerCase().includes(term) ||
        String(m.reason || '').toLowerCase().includes(term) ||
        String(m.recordedBy || '').toLowerCase().includes(term)
      );
      const matchType = movementTypeFilter === 'ALL' ? true : m.movementType === movementTypeFilter;
      return matchSearch && matchType;
    });
  }, [movements, search, movementTypeFilter]);

  const movementTotalPages = Math.max(1, Math.ceil(filteredMovements.length / movementItemsPerPage));
  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementItemsPerPage;
    return filteredMovements.slice(start, start + movementItemsPerPage);
  }, [filteredMovements, movementPage, movementItemsPerPage]);

  // Filter snapshot
  const filteredSnapshot = useMemo(() => {
    return rows.filter(r => {
      const term = (search || '').trim().toLowerCase();
      const matchSearch = !term ? true : (
        String(r.name || '').toLowerCase().includes(term) || 
        String(r.type || '').toLowerCase().includes(term)
      );
      const matchStatus = stockStatusFilter === 'ALL' ? true : r.statusKey === stockStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [rows, search, stockStatusFilter]);

  // Grouped snapshot with alphabetical sorting inside each status
  const groupedSnapshot = useMemo(() => {
    return STATUS_GROUPS.map(group => {
      const items = filteredSnapshot
        .filter(r => r.statusKey === group.id)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      return {
        ...group,
        items
      };
    }).filter(group => group.items.length > 0);
  }, [filteredSnapshot]);

  // Metrics
  const totalStockIn   = movements.filter(m => m.movementType === 'IN').reduce((sum, m) => sum + m.absQty, 0);
  const totalStockOut  = movements.filter(m => m.movementType === 'OUT').reduce((sum, m) => sum + m.absQty, 0);
  const totalWastage   = movements.filter(m => m.movementType === 'WASTAGE').reduce((sum, m) => sum + m.absQty, 0);
  const netMovement    = totalStockIn - totalStockOut - totalWastage;
  const criticalCount  = rows.filter(r => r.statusKey === 'low' || r.statusKey === 'out').length;
  const periodLabel    = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';

  // ─── Export CSV (RFC-4180 standard CRLF layout) ─────────────────────────────
  const handleExportCSV = () => {
    const exportRows = [
      ['COF/TEA CAFE — STOCK MOVEMENT & INVENTORY REPORT'],
      ['Store Name', 'Cof/Tea Cafe'],
      ['Reporting Period', periodLabel],
      ['Date Generated', new Date().toLocaleString('en-PH')],
      ['Total Inbound Stock (+)', totalStockIn.toFixed(2)],
      ['Total Outbound Stock (-)', totalStockOut.toFixed(2)],
      ['Total Wastage / Loss (-)', totalWastage.toFixed(2)],
      ['Net Stock Movement', netMovement >= 0 ? `+${netMovement.toFixed(2)}` : netMovement.toFixed(2)],
      ['Low Stock / Restock Needed Items', criticalCount],
      [],
      ['SECTION 1: STOCK MOVEMENT AUDIT LOG'],
      ['Date & Time', 'Movement Type', 'Item Type', 'Item Name', 'Quantity Change', 'Unit', 'Remaining Stock', 'Reason / Source', 'Recorded By'],
      ...movements.map(m => [
        new Date(m.timestamp).toLocaleString('en-PH'),
        m.directionLabel.toUpperCase(),
        m.itemType,
        m.name,
        m.qtyChange > 0 ? `+${m.qtyChange}` : `${m.qtyChange}`,
        m.unit,
        m.newStock !== null && m.newStock !== undefined ? m.newStock : '—',
        m.reason,
        m.recordedBy
      ]),
      [],
      ['SECTION 2: CURRENT INVENTORY SNAPSHOT'],
      ['Stock Health Group', 'Item Type', 'Item Name', 'Current Stock', 'Unit', 'Low Alert Level', 'Status'],
      ...groupedSnapshot.flatMap(group => 
        group.items.map(r => [
          group.label.toUpperCase(),
          r.type,
          r.name,
          r.currentStock,
          r.unit,
          r.lowAlert,
          r.status
        ])
      )
    ];

    downloadCSV(exportRows, `CofTea_Stock_Movement_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ─── Export PDF / Print (Executive Layout) ──────────────────────────────────
  const handlePrint = () => {
    const movementRowsHtml = movements.map(m => {
      const isPos = m.qtyChange > 0;
      const isWaste = m.movementType === 'WASTAGE';
      const badgeClass = isPos ? 'badge-in' : isWaste ? 'badge-waste' : 'badge-out';
      const qtyClass = isPos ? 'num-pos' : 'num-neg';
      const formattedQty = isPos ? `+${m.absQty}` : `-${m.absQty}`;

      return `
        <tr>
          <td style="font-size:10px;color:#4b5563;white-space:nowrap">${new Date(m.timestamp).toLocaleString('en-PH')}</td>
          <td><span class="badge ${badgeClass}">${m.directionLabel}</span></td>
          <td style="font-size:10px;color:#6b7280">${m.itemType}</td>
          <td><strong>${m.name}</strong></td>
          <td class="text-right ${qtyClass}">${formattedQty} ${m.unit}</td>
          <td class="text-right" style="font-family:monospace">${m.newStock !== null ? `${m.newStock} ${m.unit}` : '—'}</td>
          <td style="font-size:10px;color:#4b5563">${m.reason}</td>
          <td style="font-size:10.5px">${m.recordedBy}</td>
        </tr>
      `;
    }).join('');

    const snapshotRowsHtml = groupedSnapshot.map(group => {
      const groupHeader = `
        <tr class="section-header-row">
          <td colspan="6">
            ${group.label.toUpperCase()} (${group.items.length} ${group.items.length === 1 ? 'item' : 'items'})
          </td>
        </tr>
      `;
      const itemsHtml = group.items.map(r => {
        const badgeClass = r.statusKey === 'normal' ? 'badge-in' : r.statusKey === 'low' ? 'badge-warning' : 'badge-danger';
        return `
          <tr>
            <td style="color:#6b7280">${r.type}</td>
            <td><strong>${r.name}</strong></td>
            <td class="text-right" style="font-weight:bold;font-family:monospace">${r.currentStock}</td>
            <td class="text-right" style="color:#6b7280;font-family:monospace">${r.lowAlert}</td>
            <td>${r.unit}</td>
            <td class="text-right"><span class="badge ${badgeClass}">${r.status}</span></td>
          </tr>
        `;
      }).join('');
      return groupHeader + itemsHtml;
    }).join('');

    const html = `
      <div class="report-header">
        <div class="brand-meta-row">
          <div>
            <div class="brand-logo-text">COF/TEA CAFE</div>
            <div class="brand-subtitle">Point of Sale &amp; Inventory Management System</div>
          </div>
          <div class="report-timestamp">
            <div>Period: <strong>${periodLabel}</strong></div>
            <div>Generated: <strong>${new Date().toLocaleString('en-PH')}</strong></div>
          </div>
        </div>
        <h1>Stock Movement &amp; Inventory Report</h1>
        <p class="subtitle">Complete audit of inbound stock receipts, sales deductions, wastage logs, and current inventory health.</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box border-in">
          <div class="kpi-label">Total Stock Inbound</div>
          <div class="kpi-value" style="color:#16a34a">+${totalStockIn.toFixed(1)}</div>
          <div class="kpi-sub">restock &amp; received units</div>
        </div>
        <div class="kpi-box border-out">
          <div class="kpi-label">Total Stock Outbound</div>
          <div class="kpi-value" style="color:#dc2626">-${totalStockOut.toFixed(1)}</div>
          <div class="kpi-sub">POS sales consumption</div>
        </div>
        <div class="kpi-box border-alert">
          <div class="kpi-label">Total Wastage / Loss</div>
          <div class="kpi-value" style="color:#d97706">-${totalWastage.toFixed(1)}</div>
          <div class="kpi-sub">spoilage, damage, &amp; expired</div>
        </div>
        <div class="kpi-box border-neutral">
          <div class="kpi-label">Net Movement</div>
          <div class="kpi-value">${netMovement >= 0 ? `+${netMovement.toFixed(1)}` : netMovement.toFixed(1)}</div>
          <div class="kpi-sub">net volume change</div>
        </div>
        <div class="kpi-box border-out">
          <div class="kpi-label">Restock Attention</div>
          <div class="kpi-value" style="color:#dc2626">${criticalCount}</div>
          <div class="kpi-sub">low or out of stock items</div>
        </div>
      </div>

      <h2>
        <span>Stock Movement Audit Log (${movements.length} events)</span>
        <span style="font-size:10px;color:#6b7280;font-weight:normal">Chronological order</span>
      </h2>
      ${movements.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Movement</th>
              <th>Type</th>
              <th>Item Name</th>
              <th class="text-right">Qty Change</th>
              <th class="text-right">Remaining</th>
              <th>Reason / Source</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            ${movementRowsHtml}
          </tbody>
        </table>
      ` : '<p style="color:#6b7280;font-style:italic;margin-bottom:24px">No stock movements recorded during this period.</p>'}

      <h2>
        <span>Current Inventory Snapshot (${rows.length} tracked items)</span>
        <span style="font-size:10px;color:#6b7280;font-weight:normal">Priority grouped</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Item Name</th>
            <th class="text-right">Current Stock</th>
            <th class="text-right">Alert Threshold</th>
            <th>Unit</th>
            <th class="text-right">Stock Health</th>
          </tr>
        </thead>
        <tbody>
          ${snapshotRowsHtml}
        </tbody>
      </table>

      <div class="report-footer">
        <span>Confidential &bull; Cof/Tea Cafe Management Report</span>
        <span>Generated by POS &amp; Inventory System</span>
      </div>
    `;

    printReport(`Stock Movement Report — ${periodLabel}`, html);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls Bar */}
      <div className="bg-white border border-zinc-200/80 shadow-2xs rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Period</span>
            <select
              className="bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs sm:text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-400 cursor-pointer"
              value={period}
              onChange={e => { setPeriod(e.target.value); setFetched(false); }}
            >
              <option value="daily">Today (Daily)</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>

          {fetched && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-60">
                <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  className="w-full pl-9 pr-7 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                  placeholder="Search item, reason, staff..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {activeView === 'movements' && (
                <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      movementTypeFilter === 'ALL' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    All ({movements.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('IN')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      movementTypeFilter === 'IN' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Inflow
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('OUT')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      movementTypeFilter === 'OUT' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Outflow
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('WASTAGE')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      movementTypeFilter === 'WASTAGE' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Wastage
                  </button>
                </div>
              )}

              {activeView === 'snapshot' && (
                <select
                  className="bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs sm:text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-400 cursor-pointer"
                  value={stockStatusFilter}
                  onChange={e => setStockStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="OUT">Out of Stock Only</option>
                  <option value="LOW">Low Stock / Restock Needed</option>
                  <option value="NORMAL">In Stock Only</option>
                </select>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs" 
            onClick={handleExportCSV} 
            disabled={!fetched || loading}
            title="Download CSV spreadsheet"
          >
            Export CSV
          </button>
          <button 
            type="button"
            className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer" 
            onClick={fetchReport} 
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button 
            type="button"
            className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs" 
            onClick={handlePrint} 
            disabled={!fetched || loading}
            title="Print or save as PDF"
          >
            Print
          </button>
        </div>
      </div>

      {/* Initial / Changed State */}
      {!fetched && !loading && (
        <div className="p-12 flex flex-col items-center justify-center text-zinc-500 bg-white border border-zinc-200/80 border-dashed rounded-2xl h-64 text-center">
          <svg className="w-12 h-12 mb-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div className="text-base font-bold text-zinc-900 mb-1">Period Selection Changed</div>
          <p className="m-0 text-xs sm:text-sm text-zinc-500 max-w-sm">
            Selected period: <strong className="text-zinc-900 font-semibold">{periodLabel}</strong>. Click <strong className="text-zinc-900 font-semibold">Generate Report</strong> to inspect stock inflow, outflow, and wastage.
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardsSkeleton count={5} />
          <TableSkeleton rows={8} cols={5} />
        </div>
      )}

      {/* Results View */}
      {fetched && !loading && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stock Inflow (+)</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
                +{totalStockIn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-400 mt-1">{movements.filter(m => m.movementType === 'IN').length} receipts</div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stock Outflow (-)</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
                -{totalStockOut.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-400 mt-1">{movements.filter(m => m.movementType === 'OUT').length} deductions</div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Wastage / Loss (-)</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
                -{totalWastage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-400 mt-1">{movements.filter(m => m.movementType === 'WASTAGE').length} write-offs</div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Net Movement</div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
                {netMovement >= 0 ? `+${netMovement.toFixed(2)}` : netMovement.toFixed(2)}
              </div>
              <div className="text-xs text-zinc-400 mt-1">volume delta</div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Restock Attention</div>
              <div className="text-2xl font-bold text-red-600 tabular-nums mt-1 font-mono">
                {criticalCount}
              </div>
              <div className="text-xs text-zinc-400 mt-1">items need restock</div>
            </div>
          </div>

          {/* Section View Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'movements' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
              }`}
              onClick={() => setActiveView('movements')}
            >
              Stock Movement Log ({filteredMovements.length})
            </button>
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'snapshot' ? 'bg-zinc-900 text-white shadow-2xs font-bold' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
              }`}
              onClick={() => setActiveView('snapshot')}
            >
              Current Inventory Snapshot ({filteredSnapshot.length})
            </button>
          </div>

          {/* VIEW 1: Stock Movement Log */}
          {activeView === 'movements' && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-lg sm:text-xl font-black text-gray-900 tracking-tight border-none p-0">
                    Stock Movement Audit Log — {periodLabel}
                  </h2>
                  <p className="m-0 text-xs sm:text-sm text-gray-600 font-medium mt-0.5">
                    Records of inventory additions, POS drink deductions, and wastage reports
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-200/80 px-3 py-1 rounded-full uppercase tracking-wide">
                  {filteredMovements.length} matching entries
                </span>
              </div>

              <div className="p-0">
                {filteredMovements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                          <th className="px-6 py-4">Date &amp; Time</th>
                          <th className="px-6 py-4">Movement</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Item Name</th>
                          <th className="px-6 py-4 text-right">Quantity Change</th>
                          <th className="px-6 py-4 text-right">Remaining Stock</th>
                          <th className="px-6 py-4">Reason / Source</th>
                          <th className="px-6 py-4">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedMovements.map(m => {
                          const isPos = m.qtyChange > 0;
                          const isWaste = m.movementType === 'WASTAGE';

                          return (
                            <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4 text-sm font-mono text-gray-600 font-medium">
                                {new Date(m.timestamp).toLocaleString('en-PH')}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                                  isPos 
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                    : isWaste 
                                    ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                    : 'bg-red-50 text-red-800 border-red-300'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isPos ? 'bg-emerald-600' : isWaste ? 'bg-amber-600' : 'bg-red-600'}`}></span>
                                  <span>{m.directionLabel}</span>
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-800 border border-gray-300">
                                  {m.itemType}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-base font-black text-gray-900">{m.name}</td>
                              <td className="px-6 py-4 text-base font-black font-mono text-right">
                                <span className={isPos ? 'text-emerald-700' : 'text-red-700'}>
                                  {isPos ? `+${m.absQty}` : `-${m.absQty}`} {m.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-base font-bold font-mono text-gray-800 text-right">
                                {m.newStock !== null && m.newStock !== undefined ? `${m.newStock} ${m.unit}` : '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                                {m.reason}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 font-bold">{m.recordedBy}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <Pagination
                      currentPage={movementPage}
                      totalPages={movementTotalPages}
                      totalItems={filteredMovements.length}
                      itemsPerPage={movementItemsPerPage}
                      onPageChange={setMovementPage}
                      onItemsPerPageChange={(val) => {
                        setMovementItemsPerPage(val);
                        setMovementPage(1);
                      }}
                      itemsPerPageOptions={[10, 25, 50, 100]}
                    />
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-600 font-bold bg-gray-50/50">
                    No stock movements matched your filter criteria for {periodLabel}.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: Current Inventory Snapshot */}
          {activeView === 'snapshot' && (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-lg sm:text-xl font-black text-gray-900 tracking-tight border-none p-0">
                    Current Inventory Snapshot ({filteredSnapshot.length} items)
                  </h2>
                  <p className="m-0 text-xs sm:text-sm text-gray-600 font-medium mt-0.5">
                    Priority Grouped: Out of Stock &rarr; Low Stock / Restock Needed &rarr; In Stock
                  </p>
                </div>
              </div>

              <div className="p-0">
                {groupedSnapshot.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Item Name</th>
                          <th className="px-6 py-4 text-right">Current Stock</th>
                          <th className="px-6 py-4 text-right">Low Alert Level</th>
                          <th className="px-6 py-4">Unit</th>
                          <th className="px-6 py-4 text-right">Stock Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupedSnapshot.map(group => (
                          <React.Fragment key={group.id}>
                            <tr className={`${group.headerBg} border-y`}>
                              <td colSpan={6} className="px-6 py-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    {group.icon}
                                    <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900">
                                      {group.label}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-xs ${group.badgeClass}`}>
                                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {group.items.map(row => (
                              <tr key={`${row.type}-${row.id}`} className="hover:bg-gray-50/60 transition-colors">
                                <td className="px-6 py-4">
                                  <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-800 border border-gray-300">
                                    {row.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-base font-black text-gray-900">{row.name}</td>
                                <td className="px-6 py-4 text-base font-black font-mono text-gray-900 text-right">
                                  {row.currentStock}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold font-mono text-gray-600 text-right">
                                  {row.lowAlert}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-700">{row.unit}</td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${group.badgeClass}`}>
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-600 font-bold bg-gray-50/50">
                    No items match your filter criteria.
                  </div>
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
