import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { getManilaDateOnly } from '../../utils/dateUtils';

import './AuditLogs.css';

// Converts raw action + details into a human-readable sentence
const formatAuditDescription = (action, rawDetails) => {
  let d;
  try {
    d = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : (rawDetails || {});
  } catch { d = {}; }

  switch (action) {
    // Sales
    case 'SALE':
    case 'SALE_CANCELLED':
    case 'SALE_COMPLETED': {
      if (typeof rawDetails === 'string') return rawDetails;
      if (d.items && Array.isArray(d.items)) {
        const itemNames = d.items.map(i => `${i.qty}x ${i.name}`).join(', ');
        return `Receipt #${d.receipt_number || 'N/A'} — Total: ₱${d.total} (${itemNames})`;
      }
      return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' | ');
    }

    // Wastage
    case 'WASTAGE':
      return `Reported wastage of ${d.quantity} units for ${d.ingredient_name || 'Ingredient ID: ' + d.ingredient_id}. Reason: ${d.reason}.`;

    // Auth
    case 'LOGIN':
      return `${d.username || 'Unknown user'} (${d.role || 'Unknown role'}) logged in successfully.`;
    case 'LOGOUT':
      return `${d.username || 'Unknown user'} (${d.role || 'Unknown role'}) logged out.`;
    case 'LOGIN_FAILED':
      return `Failed login attempt for "${d.username || 'unknown'}". Reason: ${d.reason || 'Unknown'}.`;

    // Products
    case 'PRODUCT_CREATED':
      return `Created product "${d.name}" under ${d.category} at ₱${d.price}.`;
    case 'PRODUCT_UPDATED':
      return `Updated product "${d.name}" — category: ${d.category}, price: ₱${d.price}.`;
    case 'PRODUCT_ARCHIVED':
      return `Archived product "${d.name}".`;
    case 'PRODUCT_RESTORED':
      return `Restored product "${d.name}" back to active.`;
    case 'PRODUCT_STOCK_RECEIVED':
      return `Received ${d.quantity_added} units of product "${d.name}". New stock: ${d.new_stock} units.`;

    // Raw Materials
    case 'RAW_MATERIAL_CREATED':
      return `Added new raw material "${d.name}" (Unit: ${d.unit}).`;
    case 'RAW_MATERIAL_UPDATED':
      return `Updated raw material "${d.name}" — unit: ${d.unit}, low stock alert: ${d.low_stock_alert}.`;
    case 'RAW_MATERIAL_DELETED':
      return `Deleted raw material "${d.name}".`;
    case 'RAW_MATERIAL_ARCHIVED':
      return `Archived raw material "${d.name}".`;
    case 'RAW_MATERIAL_RESTORED':
      return `Restored raw material "${d.name}" back to active.`;
    case 'RAW_MATERIAL_STOCK_RECEIVED':
      return `Received ${d.quantity_added} ${d.unit || ''} of "${d.name}". New stock: ${d.new_stock} ${d.unit || ''}.`;

    // Users
    case 'USER_CREATED':
      return `Created account for "${d.name}" (${d.username}) with role ${d.role}.`;
    case 'USER_UPDATED':
      return `Updated account "${d.username}" — name: ${d.name}, role: ${d.role}.`;
    case 'USER_STATUS_CHANGED':
      return `Changed status of "${d.name}" to ${d.new_status}.`;

    // Category Settings
    case 'CATEGORY_SETTINGS_UPDATED':
      return `Updated global category settings for ${d.category}.`;

    // Fallback — format nicely but still readable
    default:
      if (Object.keys(d).length === 0) return action.replace(/_/g, ' ');
      return Object.entries(d)
        .filter(([k]) => !['id', 'product_id', 'ingredient_id', 'new_user_id', 'target_user_id'].includes(k))
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
        .join(', ');
  }
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const today = getManilaDateOnly();
  const [filters, setFilters] = useState({
    start_date: today, // Default to Today
    end_date: today,
    action: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // Extend end_date to end of that day so full-timestamp rows are included
      const adjustedFilters = {
        ...filters,
        end_date: filters.end_date ? filters.end_date + 'T23:59:59' : undefined
      };
      const data = await getAuditLogs(adjustedFilters);
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedLogs = () => {
    let filteredLogs = [...logs];
    
    // Local search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        (log.users?.name || '').toLowerCase().includes(term) ||
        (log.details || '').toLowerCase().includes(term)
      );
    }

    // Sort
    filteredLogs.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      // Handle nested staff name
      if (sortConfig.key === 'staff') {
        valA = a.users?.name || '';
        valB = b.users?.name || '';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredLogs;
  };

  const sortedLogs = getSortedLogs();

  return (
    <div className="audit-logs-container">
      <div className="audit-logs-header">
        <h1>Audit Logs</h1>
        <p>Track administrative and staff activities across the system.</p>
      </div>

      <div className="audit-filters-card">
        <div className="filter-group">
          <label className="filter-label">Start Date</label>
          <input 
            type="date" 
            name="start_date" 
            value={filters.start_date} 
            onChange={handleFilterChange} 
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">End Date</label>
          <input 
            type="date" 
            name="end_date" 
            value={filters.end_date} 
            onChange={handleFilterChange} 
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Category Filter</label>
          <select 
            name="action" 
            value={filters.action} 
            onChange={handleFilterChange}
            className="filter-select"
          >
                      <option value="">All Categories</option>
            <option value="SALE">Sales</option>
            <option value="PRODUCT">Products</option>
            <option value="RAW_MATERIAL">Raw Materials</option>
            <option value="RAW_MATERIAL_STOCK">Stock Received</option>
            <option value="WASTAGE">Wastage</option>
            <option value="USER">Users / Staff</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="LOGIN_FAILED">Failed Logins</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Global Search</label>
          <input 
            type="text" 
            placeholder="Search details..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="filter-input"
          />
        </div>
      </div>

      <div className="audit-table-card">
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('created_at')}>
                  Timestamp {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('staff')} style={{ textAlign: 'center' }}>
                  Operator {sortConfig.key === 'staff' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('action_type')} style={{ textAlign: 'center' }}>
                  Action {sortConfig.key === 'action_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ textAlign: 'center' }}>Entity</th>
                <th>Event Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="audit-loading-row">
                    <div className="audit-loading-text">Synchronizing...</div>
                  </td>
                </tr>
              ) : sortedLogs.length > 0 ? (
                sortedLogs.map(log => (
                  <tr key={log.id}>
                    <td className="log-timestamp">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="log-operator">{log.users?.name || 'System'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="log-action-badge">
                        {log.action_type || log.action}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="log-entity-tag">
                        {log.entity_type ? `${log.entity_type} #${log.entity_id || ''}` : '---'}
                      </span>
                    </td>
                    <td>
                      <p className="log-details-text">
                        {formatAuditDescription(log.action, log.details)}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="audit-empty-row">
                    <div className="audit-empty-text">No activity found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
