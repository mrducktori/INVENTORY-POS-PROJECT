import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { getCurrentUser } from '../../api/authApi';
import { getManilaDateOnly } from '../../utils/dateUtils';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';


// ── Helpers ──────────────────────────────────────────────────

/** Map action string → human-readable category for badges */
const getCategory = (action) => {
  if (!action) return { label: 'System', css: 'system' };
  const a = action.toUpperCase();
  if (a.startsWith('SALE'))                   return { label: 'Sale', css: 'sale' };
  if (a.startsWith('PURCHASE_ORDER'))          return { label: 'Purchase Order', css: 'po' };
  if (a.startsWith('PRODUCT_STOCK'))          return { label: 'Stock (Product)', css: 'stock' };
  if (a.startsWith('RAW_MATERIAL_STOCK'))     return { label: 'Stock (Raw)', css: 'stock' };
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
    case 'PURCHASE_ORDER_CREATED':
      return `Created Purchase Order (PO #${(d.po_id || '').substring(0, 8).toUpperCase()}) — Total: ₱${d.total_amount || 0}.`;
    case 'PURCHASE_ORDER_STATUS_UPDATED':
      return `PO #${(d.po_id || '').substring(0, 8).toUpperCase()} status changed to ${d.new_status}.`;
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
  { value: 'PURCHASE_ORDER',    label: 'Purchase Orders' },
  { value: 'RAW_MATERIAL_STOCK', label: 'Stock Received (Raw)' },
  { value: 'PRODUCT_STOCK',     label: 'Stock Received (Product)' },
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

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user || user.role !== 'Owner') return;
      try {
        setLoading(true);
        const adjustedFilters = {
          ...filters,
          end_date: filters.end_date ? filters.end_date + 'T23:59:59' : undefined
        };
        const response = await getAuditLogs(adjustedFilters);
        // The audit API returns { data: [...], total, limit, offset }
        const allLogs = response?.data || response || [];
        
        // Filter out everything except Sales and PO (Stock Received)
        const txLogs = allLogs.filter(log => 
          log.action?.toUpperCase().startsWith('SALE') || 
          log.action?.toUpperCase().includes('STOCK_RECEIVED')
        );
        
        setLogs(txLogs);
      } catch (error) {
        console.error('Failed to fetch transaction logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    setCurrentPage(1);
  }, [filters, user]);

  // ── Access guard: Owner only ──
  if (!user || user.role !== 'Owner') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 font-medium">Transaction Logs are only accessible to the system Owner. Contact your administrator for access.</p>
      </div>
    );
  }

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
  const rawStockCount = processedLogs.filter(l => l.action?.toUpperCase().startsWith('RAW_MATERIAL_STOCK_RECEIVED')).length;
  const productStockCount = processedLogs.filter(l => l.action?.toUpperCase().startsWith('PRODUCT_STOCK_RECEIVED')).length;

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Transaction Logs</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Owner-level view of all system transactions and activity.</p>
        </div>
        <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm border border-amber-200">
          <span>🔒</span> Owner Access Only
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-2xl font-extrabold text-gray-900">{totalTransactions}</div>
          <div className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider mt-1">Total Records</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-2xl font-extrabold text-blue-700">{saleCount}</div>
          <div className="text-sm md:text-base font-bold text-blue-600 uppercase tracking-wider mt-1">Sales Transactions</div>
        </div>
        <div className="bg-green-50 border border-green-100 p-5 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-2xl font-extrabold text-green-700">{rawStockCount}</div>
          <div className="text-sm md:text-base font-bold text-green-600 uppercase tracking-wider mt-1">Raw Stock (PO)</div>
        </div>
        <div className="bg-purple-50 border border-purple-100 p-5 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-2xl font-extrabold text-purple-700">{productStockCount}</div>
          <div className="text-sm md:text-base font-bold text-purple-600 uppercase tracking-wider mt-1">Product Stock</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider mb-2">Start Date</label>
          <input
            type="date"
            name="start_date"
            value={filters.start_date}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider mb-2">End Date</label>
          <input
            type="date"
            name="end_date"
            value={filters.end_date}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider mb-2">Transaction Type</label>
          <select
            name="action"
            value={filters.action}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by user, action, or details..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('created_at')}>
                    Timestamp {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('staff')}>
                    Operator {sortConfig.key === 'staff' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center">Category</th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('action')}>
                    Action {sortConfig.key === 'action' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-sm md:text-base font-bold text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => {
                  const cat = getCategory(log.action);
                  const userRole = log.users?.role?.toLowerCase() || 'staff';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm md:text-base font-medium text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start">
                          <span className="text-sm md:text-base font-bold text-gray-900">{log.users?.name || 'System'}</span>
                          <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${userRole === 'owner' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'} border`}>
                            {log.users?.role || 'SYS'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-sm md:text-base font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs md:text-sm font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="m-0 text-sm md:text-base font-medium text-gray-800 whitespace-normal">
                          {formatDescription(log.action, log.details)}
                        </p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 bg-gray-50/50">
                    <svg className="w-12 h-12 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <div className="text-sm md:text-base font-medium">No transaction records found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {processedLogs.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
            <div className="text-sm md:text-base font-medium text-gray-500">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, processedLogs.length)} of {processedLogs.length} records
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default TransactionLogs;
