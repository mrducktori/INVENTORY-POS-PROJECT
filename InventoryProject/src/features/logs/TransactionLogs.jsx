import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { getCurrentUser } from '../../api/authApi';
import { getManilaDateOnly } from '../../utils/dateUtils';

import './TransactionLogs.css';

// ── Helpers ──────────────────────────────────────────────────

/** Map action string → human-readable category for badges */
const getCategory = (action) => {
  if (!action) return { label: 'System', css: 'system' };
  const a = action.toUpperCase();
  if (a.startsWith('SALE'))                   return { label: 'Sale', css: 'sale' };
  if (a.startsWith('PRODUCT_STOCK'))          return { label: 'Stock', css: 'stock' };
  if (a.startsWith('PRODUCT'))                return { label: 'Product', css: 'product' };
  if (a.startsWith('RAW_MATERIAL_STOCK'))     return { label: 'Stock', css: 'stock' };
  if (a.startsWith('RAW_MATERIAL'))           return { label: 'Raw Material', css: 'raw-material' };
  if (a === 'WASTAGE')                        return { label: 'Wastage', css: 'wastage' };
  if (a.startsWith('USER'))                   return { label: 'User', css: 'user' };
  if (a.startsWith('LOGIN') || a === 'LOGOUT' || a === 'LOGIN_FAILED') return { label: 'Auth', css: 'auth' };
  if (a.startsWith('CATEGORY'))              return { label: 'Category', css: 'category' };
  return { label: 'System', css: 'system' };
};

/** Format audit details into a readable sentence */
const formatDescription = (action, rawDetails) => {
  let d;
  try {
    d = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : (rawDetails || {});
  } catch { d = {}; }

  switch (action) {
    case 'SALE':
    case 'SALE_CANCELLED':
    case 'SALE_COMPLETED': {
      if (typeof rawDetails === 'string' && !rawDetails.startsWith('{')) return rawDetails;
      if (d.items && Array.isArray(d.items)) {
        const itemNames = d.items.map(i => `${i.qty}x ${i.name}`).join(', ');
        return `Receipt #${d.receipt_number || 'N/A'} — Total: ₱${d.total} (${itemNames})`;
      }
      return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' | ');
    }
    case 'WASTAGE':
      return `Reported wastage of ${d.quantity} units for ${d.ingredient_name || 'Ingredient ID: ' + d.ingredient_id}. Reason: ${d.reason}.`;
    case 'LOGIN':
      return `${d.username || 'Unknown'} (${d.role || '?'}) logged in.`;
    case 'LOGOUT':
      return `${d.username || 'Unknown'} (${d.role || '?'}) logged out.`;
    case 'LOGIN_FAILED':
      return `Failed login for "${d.username || 'unknown'}". Reason: ${d.reason || 'Unknown'}.`;
    case 'PRODUCT_CREATED':
      return `Created product "${d.name}" — ${d.category} @ ₱${d.price}.`;
    case 'PRODUCT_UPDATED':
      return `Updated product "${d.name}" — ${d.category}, ₱${d.price}.`;
    case 'PRODUCT_ARCHIVED':
      return `Archived product "${d.name}".`;
    case 'PRODUCT_RESTORED':
      return `Restored product "${d.name}".`;
    case 'PRODUCT_STOCK_RECEIVED':
      return `Received ${d.quantity_added} units of "${d.name}". New stock: ${d.new_stock}.`;
    case 'RAW_MATERIAL_CREATED':
      return `Added raw material "${d.name}" (${d.unit}).`;
    case 'RAW_MATERIAL_UPDATED':
      return `Updated raw material "${d.name}" — ${d.unit}, alert: ${d.low_stock_alert}.`;
    case 'RAW_MATERIAL_DELETED':
      return `Deleted raw material "${d.name}".`;
    case 'RAW_MATERIAL_ARCHIVED':
      return `Archived raw material "${d.name}".`;
    case 'RAW_MATERIAL_RESTORED':
      return `Restored raw material "${d.name}".`;
    case 'RAW_MATERIAL_STOCK_RECEIVED':
      return `Received ${d.quantity_added} ${d.unit || ''} of "${d.name}". New stock: ${d.new_stock} ${d.unit || ''}.`;
    case 'USER_CREATED':
      return `Created account for "${d.name}" (${d.username}) — Role: ${d.role}.`;
    case 'USER_UPDATED':
      return `Updated account "${d.username}" — name: ${d.name}, role: ${d.role}.`;
    case 'USER_STATUS_CHANGED':
      return `Changed status of "${d.name}" to ${d.new_status}.`;
    case 'CATEGORY_SETTINGS_UPDATED':
      return `Updated category settings for ${d.category}.`;
    default:
      if (Object.keys(d).length === 0) return action.replace(/_/g, ' ');
      return Object.entries(d)
        .filter(([k]) => !['id', 'product_id', 'ingredient_id', 'new_user_id', 'target_user_id'].includes(k))
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
        .join(', ');
  }
};

const ITEMS_PER_PAGE = 50;

// ── Category filter options (mirrors the audit_logs action types) ──
const CATEGORY_OPTIONS = [
  { value: '',                  label: 'All Transactions' },
  { value: 'SALE',              label: 'Sales' },
  { value: 'PRODUCT',           label: 'Products' },
  { value: 'RAW_MATERIAL',      label: 'Raw Materials' },
  { value: 'RAW_MATERIAL_STOCK', label: 'Stock Received (Raw)' },
  { value: 'PRODUCT_STOCK',     label: 'Stock Received (Product)' },
  { value: 'WASTAGE',           label: 'Wastage' },
  { value: 'USER',              label: 'Users / Staff' },
  { value: 'LOGIN',             label: 'Logins' },
  { value: 'LOGOUT',            label: 'Logouts' },
  { value: 'LOGIN_FAILED',      label: 'Failed Logins' },
  { value: 'CATEGORY',          label: 'Category Settings' },
];

// ── Main Component ──────────────────────────────────────────

const TransactionLogs = () => {
  const [user] = useState(() => getCurrentUser());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const today = getManilaDateOnly();

  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    action: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);

  // ── Access guard: Owner only ──
  if (!user || user.role !== 'Owner') {
    return (
      <div className="txlog-access-denied">
        <div className="denied-icon">🔒</div>
        <h2>Access Restricted</h2>
        <p>Transaction Logs are only accessible to the system Owner. Contact your administrator for access.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchLogs();
    setCurrentPage(1);
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const adjustedFilters = {
        ...filters,
        end_date: filters.end_date ? filters.end_date + 'T23:59:59' : undefined
      };
      const data = await getAuditLogs(adjustedFilters);
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch transaction logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ── Filtering + sorting + pagination ──
  const getProcessedLogs = () => {
    let result = [...logs];

    // Local search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log =>
        (log.users?.name || '').toLowerCase().includes(term) ||
        (log.action || '').toLowerCase().includes(term) ||
        (log.details || '').toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'staff') {
        valA = a.users?.name || '';
        valB = b.users?.name || '';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  };

  const processedLogs = getProcessedLogs();
  const totalPages = Math.max(1, Math.ceil(processedLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = processedLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── Stats ──
  const totalTransactions = processedLogs.length;
  const saleCount = processedLogs.filter(l => l.action?.toUpperCase().startsWith('SALE')).length;
  const stockCount = processedLogs.filter(l => l.action?.toUpperCase().includes('STOCK_RECEIVED')).length;
  const wastageCount = processedLogs.filter(l => l.action?.toUpperCase() === 'WASTAGE').length;

  return (
    <div className="txlog-container">
      {/* Header */}
      <div className="txlog-header">
        <div className="txlog-header-left">
          <h1>Transaction Logs</h1>
          <p>Owner-level view of all system transactions and activity.</p>
        </div>
        <div className="txlog-owner-badge">
          <span className="lock-icon">🔒</span>
          Owner Access Only
        </div>
      </div>

      {/* Stat Cards */}
      <div className="txlog-stats">
        <div className="txlog-stat-card">
          <div className="txlog-stat-value">{totalTransactions}</div>
          <div className="txlog-stat-label">Total Records</div>
        </div>
        <div className="txlog-stat-card">
          <div className="txlog-stat-value">{saleCount}</div>
          <div className="txlog-stat-label">Sales Transactions</div>
        </div>
        <div className="txlog-stat-card">
          <div className="txlog-stat-value">{stockCount}</div>
          <div className="txlog-stat-label">Stock Received</div>
        </div>
        <div className="txlog-stat-card">
          <div className="txlog-stat-value">{wastageCount}</div>
          <div className="txlog-stat-label">Wastage Reports</div>
        </div>
      </div>

      {/* Filters */}
      <div className="txlog-filters">
        <div className="txlog-filter-group">
          <label className="txlog-filter-label">Start Date</label>
          <input
            type="date"
            name="start_date"
            value={filters.start_date}
            onChange={handleFilterChange}
            className="txlog-filter-input"
          />
        </div>
        <div className="txlog-filter-group">
          <label className="txlog-filter-label">End Date</label>
          <input
            type="date"
            name="end_date"
            value={filters.end_date}
            onChange={handleFilterChange}
            className="txlog-filter-input"
          />
        </div>
        <div className="txlog-filter-group">
          <label className="txlog-filter-label">Transaction Type</label>
          <select
            name="action"
            value={filters.action}
            onChange={handleFilterChange}
            className="txlog-filter-select"
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="txlog-filter-group">
          <label className="txlog-filter-label">Search</label>
          <input
            type="text"
            placeholder="Search by user, action, or details..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="txlog-filter-input"
          />
        </div>
      </div>

      {/* Table */}
      <div className="txlog-table-card">
        <div className="txlog-table-wrapper">
          <table className="txlog-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('created_at')}>
                  Timestamp {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('staff')}>
                  Operator {sortConfig.key === 'staff' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ textAlign: 'center' }}>Category</th>
                <th onClick={() => handleSort('action')} style={{ textAlign: 'center' }}>
                  Action {sortConfig.key === 'action' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="txlog-loading-row">
                    <div className="txlog-loading-text">Synchronizing transaction ledger...</div>
                  </td>
                </tr>
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => {
                  const cat = getCategory(log.action);
                  const userRole = log.users?.role?.toLowerCase() || 'staff';
                  return (
                    <tr key={log.id}>
                      <td className="txlog-timestamp">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span className="txlog-operator">{log.users?.name || 'System'}</span>
                        <span className={`txlog-role-tag ${userRole}`}>
                          {log.users?.role || 'SYS'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`txlog-category-badge ${cat.css}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="txlog-category-badge system">
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <p className="txlog-details-text">
                          {formatDescription(log.action, log.details)}
                        </p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="txlog-empty-row">
                    <div className="txlog-empty-text">No transaction records found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {processedLogs.length > ITEMS_PER_PAGE && (
          <div className="txlog-pagination">
            <div className="txlog-page-info">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, processedLogs.length)} of {processedLogs.length} records
            </div>
            <div className="txlog-page-controls">
              <button
                className="txlog-page-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <button
                className="txlog-page-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionLogs;
