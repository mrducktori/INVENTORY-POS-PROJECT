import { useState, useCallback, useMemo, useEffect } from 'react';
import { getInventoryStatusReport, getWastageReport } from '../../../api/reportsApi';
import { getAllProducts } from '../../../api/productsApi';
import { getAuditLogs } from '../../../api/auditApi';
import { downloadCSV, printReport } from '../utils/reportUtils';
import { getPeriodDateRange, getManilaDateOnly } from '../../../utils/dateUtils';
import { escapeHtml } from '../../../utils/escapeHtml';

const STATUS_GROUPS = [
  {
    id: 'out',
    label: 'Out of Stock',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    headerBg: 'bg-red-50/70 border-red-200',
  },
  {
    id: 'low',
    label: 'Low Stock / Restock Needed',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
    headerBg: 'bg-amber-50/70 border-amber-200',
  },
  {
    id: 'normal',
    label: 'In Stock',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-gray-100/70 border-gray-200',
  },
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

/**
 * Manages stock movement report fetching, filtering, summary metrics, pagination, CSV export, and printing.
 */
export const useStockMovementReport = () => {
  const [period, setPeriod] = useState('weekly');
  const [rows, setRows] = useState([]); // Inventory snapshot
  const [movements, setMovements] = useState([]); // Inflow, Outflow, Wastage events
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [search, setSearch] = useState('');
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
        getWastageReport(startDate, endDate),
      ]);

      const ingList = ingData || [];
      const prodList = prodData || [];
      const auditList = auditRes?.data || auditRes || [];
      const wastageList = wastageData || [];

      // Create lookup maps for accurate names and units
      const ingredientMap = {};
      ingList.forEach((i) => { ingredientMap[i.id] = i; });

      const productMap = {};
      prodList.forEach((p) => { productMap[p.id] = p; });

      // 1. Build current inventory snapshot (Ingredients + Trackable Products)
      const ingredientRows = ingList
        .filter((i) => !i.is_archived)
        .map((i) => {
          const currentStock = parseFloat(i.stock_quantity) || 0;
          const lowAlert = parseFloat(i.low_stock_alert) || 0;
          const statusKey = getStockStatus(currentStock, lowAlert);
          return {
            id: i.id,
            name: i.name,
            type: 'Ingredient',
            unit: i.unit || 'pcs',
            currentStock,
            lowAlert,
            statusKey,
            status: getStatusLabel(statusKey),
          };
        });

      const productRows = prodList
        .filter((p) => p.track_stock && !p.is_archived)
        .map((p) => {
          const currentStock = parseFloat(p.stock_quantity) || 0;
          const lowAlert = parseFloat(p.low_stock_threshold) || 0;
          const statusKey = getStockStatus(currentStock, lowAlert);
          return {
            id: p.id,
            name: p.name,
            type: 'Product',
            unit: 'pcs',
            currentStock,
            lowAlert,
            statusKey,
            status: getStatusLabel(statusKey),
          };
        });

      const snapshot = [...ingredientRows, ...productRows];

      // 2. Map dedicated records from the wastage table (primary source of truth)
      const directWastageMovements = wastageList.map((w) => {
        const ing = w.ingredients || ingredientMap[w.ingredient_id] || {};
        const qty = parseFloat(w.quantity) || 0;
        const itemName = ing.name || '—';
        const unit = ing.unit || 'pcs';
        const costStr = w.estimated_cost ? ` (Est. ₱${Number(w.estimated_cost).toFixed(2)})` : '';

        return {
          id: `wastage-${w.id}`,
          timestamp: w.created_at,
          action: 'WASTAGE',
          movementType: 'WASTAGE',
          directionLabel: 'Wastage',
          itemType: 'Ingredient',
          name: itemName,
          unit,
          qtyChange: -Math.abs(qty),
          absQty: Math.abs(qty),
          newStock: null,
          reason: w.reason ? `Wastage: ${w.reason}${costStr}` : `Wastage / Loss${costStr}`,
          recordedBy: w.users?.name || 'Staff',
        };
      });

      // 3. Parse comprehensive stock movement audit events (IN, OUT, WASTAGE)
      const parsedAuditMovements = auditList.map((log) => {
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
                reason: 'POS Order',
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
        const newStock = details.new_stock !== undefined
          ? details.new_stock
          : (details.remaining_stock !== undefined ? details.remaining_stock : null);
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
          } else if (details.ingredient_id && ingredientMap[details.ingredient_id]) {
            unit = ingredientMap[details.ingredient_id].unit || unit;
            if (itemName === '—') itemName = ingredientMap[details.ingredient_id].name;
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
          } else if (details.ingredient_id && ingredientMap[details.ingredient_id]) {
            unit = ingredientMap[details.ingredient_id].unit || unit;
            if (itemName === '—') itemName = ingredientMap[details.ingredient_id].name;
          }
        }

        return {
          id: log.id,
          timestamp: log.created_at,
          action: log.action,
          movementType, // 'IN' | 'OUT' | 'WASTAGE'
          directionLabel, // 'Stock In' | 'Stock Out' | 'Wastage'
          itemType, // 'Product' | 'Ingredient'
          name: itemName,
          unit,
          qtyChange: qty,
          absQty: Math.abs(qty),
          newStock,
          reason,
          recordedBy: log.users?.name || 'System',
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
    return movements.filter((m) => {
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
    return rows.filter((r) => {
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
    return STATUS_GROUPS.map((group) => {
      const items = filteredSnapshot
        .filter((r) => r.statusKey === group.id)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      return {
        ...group,
        items,
      };
    }).filter((group) => group.items.length > 0);
  }, [filteredSnapshot]);

  // Metrics
  const summary = useMemo(() => {
    const inflowEvents = movements.filter((m) => m.movementType === 'IN');
    const outflowEvents = movements.filter((m) => m.movementType === 'OUT');
    const wastageEvents = movements.filter((m) => m.movementType === 'WASTAGE');

    const totalStockIn = inflowEvents.reduce((sum, m) => sum + m.absQty, 0);
    const totalStockOut = outflowEvents.reduce((sum, m) => sum + m.absQty, 0);
    const totalWastage = wastageEvents.reduce((sum, m) => sum + m.absQty, 0);
    const netMovement = totalStockIn - totalStockOut - totalWastage;
    const criticalCount = rows.filter((r) => r.statusKey === 'low' || r.statusKey === 'out').length;

    return {
      totalStockIn,
      totalStockOut,
      totalWastage,
      netMovement,
      criticalCount,
      inflowCount: inflowEvents.length,
      outflowCount: outflowEvents.length,
      wastageCount: wastageEvents.length,
    };
  }, [movements, rows]);

  const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';

  const handlePeriodChange = useCallback((newPeriod) => {
    setPeriod(newPeriod);
    setFetched(false);
  }, []);

  const handleMovementItemsPerPageChange = useCallback((val) => {
    setMovementItemsPerPage(val);
    setMovementPage(1);
  }, []);

  // Export CSV (RFC-4180 standard CRLF layout)
  const handleExportCSV = useCallback(() => {
    const { totalStockIn, totalStockOut, totalWastage, netMovement, criticalCount } = summary;
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
      ...movements.map((m) => [
        new Date(m.timestamp).toLocaleString('en-PH'),
        m.directionLabel.toUpperCase(),
        m.itemType,
        m.name,
        m.qtyChange > 0 ? `+${m.qtyChange}` : `${m.qtyChange}`,
        m.unit,
        m.newStock !== null && m.newStock !== undefined ? m.newStock : '—',
        m.reason,
        m.recordedBy,
      ]),
      [],
      ['SECTION 2: CURRENT INVENTORY SNAPSHOT'],
      ['Stock Health Group', 'Item Type', 'Item Name', 'Current Stock', 'Unit', 'Low Alert Level', 'Status'],
      ...groupedSnapshot.flatMap((group) =>
        group.items.map((r) => [
          group.label.toUpperCase(),
          r.type,
          r.name,
          r.currentStock,
          r.unit,
          r.lowAlert,
          r.status,
        ])
      ),
    ];

    downloadCSV(exportRows, `CofTea_Stock_Movement_Report_${period}_${getManilaDateOnly()}.csv`);
  }, [summary, periodLabel, movements, groupedSnapshot, period]);

  // Export PDF / Print (Executive Layout)
  const handlePrint = useCallback(() => {
    const { totalStockIn, totalStockOut, totalWastage, netMovement, criticalCount } = summary;
    const movementRowsHtml = movements.map((m) => {
      const isPos = m.qtyChange > 0;
      const isWaste = m.movementType === 'WASTAGE';
      const badgeClass = isPos ? 'badge-in' : isWaste ? 'badge-waste' : 'badge-out';
      const qtyClass = isPos ? 'num-pos' : 'num-neg';
      const formattedQty = isPos ? `+${m.absQty}` : `-${m.absQty}`;

      return `
        <tr>
          <td style="font-size:10px;color:#4b5563;white-space:nowrap">${new Date(m.timestamp).toLocaleString('en-PH')}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(m.directionLabel)}</span></td>
          <td style="font-size:10px;color:#6b7280">${escapeHtml(m.itemType)}</td>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td class="text-right ${qtyClass}">${formattedQty} ${escapeHtml(m.unit)}</td>
          <td class="text-right" style="font-family:monospace">${m.newStock !== null ? `${m.newStock} ${escapeHtml(m.unit)}` : '—'}</td>
          <td style="font-size:10px;color:#4b5563">${escapeHtml(m.reason)}</td>
          <td style="font-size:10.5px">${escapeHtml(m.recordedBy)}</td>
        </tr>
      `;
    }).join('');

    const snapshotRowsHtml = groupedSnapshot.map((group) => {
      const groupHeader = `
        <tr class="section-header-row">
          <td colspan="6">
            ${escapeHtml(group.label.toUpperCase())} (${group.items.length} ${group.items.length === 1 ? 'item' : 'items'})
          </td>
        </tr>
      `;
      const itemsHtml = group.items.map((r) => {
        const badgeClass = r.statusKey === 'normal' ? 'badge-in' : r.statusKey === 'low' ? 'badge-warning' : 'badge-danger';
        return `
          <tr>
            <td style="color:#6b7280">${escapeHtml(r.type)}</td>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td class="text-right" style="font-weight:bold;font-family:monospace">${escapeHtml(r.currentStock)}</td>
            <td class="text-right" style="color:#6b7280;font-family:monospace">${escapeHtml(r.lowAlert)}</td>
            <td>${escapeHtml(r.unit)}</td>
            <td class="text-right"><span class="badge ${badgeClass}">${escapeHtml(r.status)}</span></td>
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
            <div>Period: <strong>${escapeHtml(periodLabel)}</strong></div>
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
  }, [summary, movements, groupedSnapshot, periodLabel, rows.length]);

  return {
    period,
    handlePeriodChange,
    movements,
    loading,
    fetched,
    search,
    setSearch,
    stockStatusFilter,
    setStockStatusFilter,
    movementTypeFilter,
    setMovementTypeFilter,
    activeView,
    setActiveView,
    movementPage,
    setMovementPage,
    movementItemsPerPage,
    handleMovementItemsPerPageChange,
    fetchReport,
    filteredMovements,
    movementTotalPages,
    paginatedMovements,
    filteredSnapshot,
    groupedSnapshot,
    summary,
    periodLabel,
    handleExportCSV,
    handlePrint,
  };
};
