import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { getManilaDateOnly } from '../../utils/dateUtils';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';

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
      if (typeof rawDetails === 'string' && !rawDetails.startsWith('{')) return rawDetails;
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
      if (Object.keys(d).length === 0) return (action || '').replace(/_/g, ' ');
      return Object.entries(d)
        .filter(([k]) => !['id', 'product_id', 'ingredient_id', 'new_user_id', 'target_user_id'].includes(k))
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(', ');
  }
};

const PAGE_SIZE_OPTIONS = [50, 100, 200];

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const today = getManilaDateOnly();
  const [datePreset, setDatePreset] = useState('TODAY');
  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    action: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const adjustedFilters = {
          ...filters,
          end_date: filters.end_date ? filters.end_date + 'T23:59:59' : undefined,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize
        };
        const result = await getAuditLogs(adjustedFilters);
        setLogs(result.data || []);
        setTotalCount(result.total || 0);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filters, currentPage, pageSize]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'start_date' || name === 'end_date') {
      setDatePreset('CUSTOM');
    }
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    setCurrentPage(1);
    const todayStr = getManilaDateOnly();
    if (preset === 'ALL') {
      setFilters(prev => ({ ...prev, start_date: '', end_date: '' }));
    } else if (preset === 'TODAY') {
      setFilters(prev => ({ ...prev, start_date: todayStr, end_date: todayStr }));
    } else if (preset === '7D') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setFilters(prev => ({ ...prev, start_date: d.toISOString().split('T')[0], end_date: todayStr }));
    } else if (preset === 'MONTH') {
      setFilters(prev => ({ ...prev, start_date: todayStr.substring(0, 8) + '01', end_date: todayStr }));
    }
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
    
    // Safe multi-field search filter (handles JSONB details objects and formatted descriptions)
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filteredLogs = filteredLogs.filter(log => {
        const staffName = String(log.users?.name || 'System').toLowerCase();
        const actionName = String(log.action_type || log.action || '').toLowerCase();
        const rawDetailsStr = typeof log.details === 'string'
          ? log.details.toLowerCase()
          : JSON.stringify(log.details || '').toLowerCase();
        const humanDesc = formatAuditDescription(log.action, log.details).toLowerCase();

        return (
          staffName.includes(term) ||
          actionName.includes(term) ||
          rawDetailsStr.includes(term) ||
          humanDesc.includes(term)
        );
      });
    }

    // Sort
    filteredLogs.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (sortConfig.key === 'staff') {
        valA = a.users?.name || '';
        valB = b.users?.name || '';
      }

      if (sortConfig.key === 'action_type') {
        valA = a.action_type || a.action || '';
        valB = b.action_type || b.action || '';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredLogs;
  };

  const sortedLogs = getSortedLogs();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startEntry = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Audit Logs</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Track administrative and staff activities across the system.</p>
        </div>
      </div>

      {/* Unified Search & Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Search Input */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Search Logs</label>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Search operator, receipt #, product, PO, or event..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category Filter</label>
            <select
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="SALE">Sales</option>
              <option value="PRODUCT">Products</option>
              <option value="RAW_MATERIAL">Raw Materials</option>
              <option value="RAW_MATERIAL_STOCK">Stock Received</option>
              <option value="PURCHASE_ORDER">Purchase Orders</option>
              <option value="WASTAGE">Wastage</option>
              <option value="USER">Users / Staff</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="LOGIN_FAILED">Failed Logins</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">From</label>
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Quick Period:</span>
            {[
              { id: 'TODAY', label: 'Today' },
              { id: '7D', label: 'Last 7 Days' },
              { id: 'MONTH', label: 'This Month' },
              { id: 'ALL', label: 'All Time' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(searchTerm || filters.action || datePreset !== 'TODAY') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDatePreset('TODAY');
                setFilters({ start_date: today, end_date: today, action: '' });
                setCurrentPage(1);
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('created_at')}>
                    Timestamp {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('staff')}>
                    Operator {sortConfig.key === 'staff' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('action_type')}>
                    Action {sortConfig.key === 'action_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Entity</th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLogs.length > 0 ? (
                  sortedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-sm md:text-base font-bold bg-gray-50 text-gray-700 border border-gray-200">{log.users?.name || 'System'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs md:text-sm font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                          {log.action_type || log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm md:text-base font-semibold text-gray-500">
                          {log.entity_type ? `${log.entity_type} #${log.entity_id || ''}` : '---'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="m-0 text-sm md:text-base font-medium text-gray-800 whitespace-normal">
                          {formatAuditDescription(log.action, log.details)}
                        </p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 bg-gray-50/50">
                      <svg className="w-12 h-12 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      <div className="text-sm md:text-base font-medium">No activity found</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!loading && totalCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm md:text-base text-gray-600 font-medium">
                  Showing <span className="font-bold text-gray-900">{startEntry}–{endEntry}</span> of <span className="font-bold text-gray-900">{totalCount}</span> logs
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base text-gray-500 font-bold uppercase tracking-wider">Per page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm md:text-base font-bold text-gray-900">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
