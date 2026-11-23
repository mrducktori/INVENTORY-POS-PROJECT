import React, { useState, useEffect, useMemo } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { getCurrentUser } from '../../api/authApi';
import { getManilaDateOnly, addDaysManila } from '../../utils/dateUtils';
import { getActionCategory, formatActionLabel, formatAuditDescription } from '../../utils/auditFormatter';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import InfoTip from '../../components/shared/InfoTip';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Category filter options
const CATEGORY_OPTIONS = [
  { value: '', label: 'All Transactions' },
  { value: 'SALE', label: 'Sales' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Orders' },
  { value: 'RAW_MATERIAL_STOCK', label: 'Stock Received (Raw)' },
  { value: 'PRODUCT_STOCK', label: 'Stock Received (Product)' },
];

const TransactionLogs = () => {
  const [user] = useState(() => getCurrentUser());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const today = getManilaDateOnly();

  const [datePreset, setDatePreset] = useState('TODAY');
  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    action: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user || user.role !== 'Owner') return;
      try {
        setLoading(true);
        const adjustedFilters = {
          ...filters,
          end_date: filters.end_date ? filters.end_date + 'T23:59:59' : undefined,
          limit: 300,
          offset: 0
        };
        const response = await getAuditLogs(adjustedFilters);
        const allLogs = response?.data || response || [];
        
        // Filter out everything except Sales, PO, and Stock Received
        const txLogs = allLogs.filter(log => 
          log.action?.toUpperCase().startsWith('SALE') || 
          log.action?.toUpperCase().startsWith('PURCHASE_ORDER') ||
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
  }, [filters, user]);

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
      setFilters(prev => ({ ...prev, start_date: addDaysManila(todayStr, -6), end_date: todayStr }));
    } else if (preset === 'MONTH') {
      setFilters(prev => ({ ...prev, start_date: todayStr.substring(0, 8) + '01', end_date: todayStr }));
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Safe multi-field search filter (strictly case-insensitive)
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(log => {
        const staffName = String(log.users?.name || log.users?.username || 'System').toLowerCase();
        const actionName = String(log.action || '').toLowerCase();
        const actionLabel = formatActionLabel(log.action).toLowerCase();
        const rawDetailsStr = typeof log.details === 'string'
          ? log.details.toLowerCase()
          : JSON.stringify(log.details || '').toLowerCase();
        const humanDesc = formatAuditDescription(log.action, log.details).toLowerCase();

        return (
          staffName.includes(term) ||
          actionName.includes(term) ||
          actionLabel.includes(term) ||
          rawDetailsStr.includes(term) ||
          humanDesc.includes(term)
        );
      });
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
  }, [logs, searchTerm, sortConfig]);

  // Sliced page rows
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const effectiveTotal = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const startEntry = effectiveTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, effectiveTotal);

  // Stats computed from active dataset
  const stats = useMemo(() => {
    const totalTransactions = logs.length;
    const saleCount = logs.filter(l => l.action?.toUpperCase().startsWith('SALE')).length;
    const poCount = logs.filter(l => l.action?.toUpperCase().startsWith('PURCHASE_ORDER')).length;
    const stockReceivedCount = logs.filter(l => l.action?.toUpperCase().includes('STOCK_RECEIVED')).length;

    return {
      totalTransactions,
      saleCount,
      poCount,
      stockReceivedCount
    };
  }, [logs]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) end = 4;
      else if (currentPage >= totalPages - 2) start = totalPages - 3;
      if (start > 2) pages.push('ellipsis-start');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  if (!user || user.role !== 'Owner') {
    return (
      <div className="p-8 flex-1 bg-white min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 mb-4 shadow-2xs">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-zinc-900 mb-1 tracking-tight">Access Restricted</h2>
        <p className="text-zinc-500 font-medium text-sm max-w-md m-0">Transaction Logs are confidential and exclusively accessible to the system Owner.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 min-h-screen overflow-y-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight m-0">
              Transaction Logs
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-zinc-900 text-white shadow-2xs">
              Owner Confidential
            </span>
          </div>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            Dedicated owner audit trail of register sales, purchase orders, and stock receipts.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Total Transactions
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
            {stats.totalTransactions.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Logged across active scope
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            POS Sales Events
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
            {stats.saleCount.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Completed register receipts
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Purchase Orders
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
            {stats.poCount.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Supplier procurement actions
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Stock Received
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
            {stats.stockReceivedCount.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Warehouse intake records
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Structured Multi-Tier Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          {/* Row 1: Search & Category Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search transactions, staff, items..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-7 py-2 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs sm:text-sm font-semibold bg-white text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-2xs min-w-[160px]"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date Presets & Custom Range */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
                {[
                  { id: 'TODAY', label: 'Today' },
                  { id: '7D', label: '7 Days' },
                  { id: 'MONTH', label: 'This Month' },
                  { id: 'ALL', label: 'All Time' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyDatePreset(p.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      datePreset === p.id
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Inline date range */}
              <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="font-semibold text-zinc-400 uppercase text-[10px]">From</span>
                <input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                  className="bg-transparent border-none text-xs font-medium text-zinc-800 focus:outline-none p-0 cursor-pointer"
                />
                <span className="text-zinc-300">—</span>
                <span className="font-semibold text-zinc-400 uppercase text-[10px]">To</span>
                <input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                  className="bg-transparent border-none text-xs font-medium text-zinc-800 focus:outline-none p-0 cursor-pointer"
                />
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
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors px-2 py-1 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="text-xs text-zinc-400 font-medium">
              {effectiveTotal} {effectiveTotal === 1 ? 'record' : 'records'} match
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={5} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 uppercase text-[11px] font-bold tracking-wider">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 transition-colors select-none"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp</span>
                      <svg className={`w-3.5 h-3.5 ${sortConfig.key === 'created_at' ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={sortConfig.key === 'created_at' && sortConfig.direction === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 transition-colors select-none"
                    onClick={() => handleSort('staff')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Operator</span>
                      <svg className={`w-3.5 h-3.5 ${sortConfig.key === 'staff' ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={sortConfig.key === 'staff' && sortConfig.direction === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Category</th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer hover:text-zinc-900 transition-colors select-none"
                    onClick={() => handleSort('action')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Action</span>
                      <svg className={`w-3.5 h-3.5 ${sortConfig.key === 'action' ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={sortConfig.key === 'action' && sortConfig.direction === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                    </div>
                  </th>
                  <th className="py-3 px-4">Transaction Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => {
                    const cat = getActionCategory(log.action);
                    const userRole = (log.users?.role || '').toLowerCase();
                    return (
                      <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-zinc-600 text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900">{log.users?.name || 'System'}</span>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              userRole === 'owner' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                            }`}>
                              {log.users?.role || 'SYS'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {cat.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            title={log.action}
                            className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200"
                          >
                            {formatActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="m-0 text-zinc-800 whitespace-normal leading-relaxed text-xs sm:text-sm">
                            {formatAuditDescription(log.action, log.details)}
                          </p>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-zinc-400 bg-zinc-50/30">
                      <svg className="w-10 h-10 mb-2 mx-auto text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="font-semibold text-zinc-600 text-sm">No transaction records found</div>
                      <div className="text-xs text-zinc-400 mt-1">Try broadening your date filter or adjusting the search term.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Numbered Pagination */}
        {!loading && effectiveTotal > 0 && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-200/80 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 font-medium">
                Showing <strong className="text-zinc-800 font-bold">{startEntry}–{endEntry}</strong> of <strong className="text-zinc-800 font-bold">{effectiveTotal}</strong> records
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-zinc-200 rounded-md text-zinc-800 font-medium focus:outline-none focus:border-zinc-400 cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium"
                >
                  Prev
                </button>

                {getPageNumbers().map((item, idx) => {
                  if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                    return (
                      <span key={`ell-${idx}`} className="px-1 text-zinc-400">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-[28px] h-7 px-2 rounded-md font-semibold transition-colors cursor-pointer ${
                        currentPage === item
                          ? 'bg-zinc-900 text-white shadow-2xs'
                          : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionLogs;
