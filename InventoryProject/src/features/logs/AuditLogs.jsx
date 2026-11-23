import React, { useState, useEffect, useMemo } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { getManilaDateOnly, addDaysManila } from '../../utils/dateUtils';
import { formatActionLabel, formatEntityReference, formatAuditDescription } from '../../utils/auditFormatter';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
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
          limit: 200, // Fetch up to 200 for responsive client-side search & filtering
          offset: 0
        };
        const result = await getAuditLogs(adjustedFilters);
        const list = result?.data || (Array.isArray(result) ? result : []);
        setLogs(list);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filters]);

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
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Safe multi-field search filter (strictly case-insensitive)
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(log => {
        const staffName = String(log.users?.name || log.users?.username || 'System').toLowerCase();
        const actionName = String(log.action_type || log.action || '').toLowerCase();
        const actionLabel = formatActionLabel(log.action_type || log.action).toLowerCase();
        const entityName = String(log.entity_type || '').toLowerCase();
        const entityRef = formatEntityReference(log).toLowerCase();
        const rawDetailsStr = typeof log.details === 'string'
          ? log.details.toLowerCase()
          : JSON.stringify(log.details || '').toLowerCase();
        const humanDesc = formatAuditDescription(log.action, log.details).toLowerCase();

        return (
          staffName.includes(term) ||
          actionName.includes(term) ||
          actionLabel.includes(term) ||
          entityName.includes(term) ||
          entityRef.includes(term) ||
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
      if (sortConfig.key === 'action_type') {
        valA = a.action_type || a.action || '';
        valB = b.action_type || b.action || '';
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

  // Metrics for KPI summary cards
  const metrics = useMemo(() => {
    const todayStr = getManilaDateOnly();
    let todayCount = 0;
    let adminMods = 0;
    let authEvents = 0;

    logs.forEach(l => {
      const logDate = l.created_at ? l.created_at.split('T')[0] : '';
      if (logDate === todayStr) todayCount++;
      const action = String(l.action || '').toUpperCase();
      if (action.startsWith('PRODUCT_') || action.startsWith('RAW_MATERIAL_') || action.startsWith('USER_') || action.includes('SETTINGS')) {
        adminMods++;
      }
      if (action.includes('LOGIN') || action.includes('LOGOUT')) {
        authEvents++;
      }
    });

    return {
      total: logs.length,
      today: todayCount,
      adminMods,
      authEvents
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

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 min-h-screen overflow-y-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight m-0">
            Audit Logs
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            Immutable system activity log, administrative changes, and operator event records.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Total Event Logs
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1">
            {metrics.total.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {metrics.today} recorded today
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Admin Modifications
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
            {metrics.adminMods.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Catalog &amp; configuration adjustments
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Security &amp; Auth Events
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1 font-mono">
            {metrics.authEvents.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Sign-ins, sign-outs &amp; session updates
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Structured Multi-Tier Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          {/* Row 1: Search & Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input with inline SVG and clear button */}
            <div className="relative w-full sm:w-80">
              <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search staff, action, or details..."
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

            {/* Right Controls: Category Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs sm:text-sm font-semibold bg-white text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-2xs min-w-[150px]"
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
          </div>

          {/* Row 2: Date Presets and Custom Range */}
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

        {/* Table Content */}
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
                    className="py-3 px-4 text-center cursor-pointer hover:text-zinc-900 transition-colors select-none"
                    onClick={() => handleSort('staff')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Operator</span>
                      <svg className={`w-3.5 h-3.5 ${sortConfig.key === 'staff' ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={sortConfig.key === 'staff' && sortConfig.direction === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer hover:text-zinc-900 transition-colors select-none"
                    onClick={() => handleSort('action_type')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Action</span>
                      <svg className={`w-3.5 h-3.5 ${sortConfig.key === 'action_type' ? 'text-zinc-900' : 'text-zinc-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={sortConfig.key === 'action_type' && sortConfig.direction === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Entity</th>
                  <th className="py-3 px-4">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-zinc-600 text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {log.users?.name || 'System'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          title={log.action_type || log.action}
                          className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200"
                        >
                          {formatActionLabel(log.action_type || log.action)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-medium text-zinc-600">
                        {formatEntityReference(log)}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="m-0 text-zinc-800 whitespace-normal leading-relaxed text-xs sm:text-sm">
                          {formatAuditDescription(log.action, log.details)}
                        </p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-zinc-400 bg-zinc-50/30">
                      <svg className="w-10 h-10 mb-2 mx-auto text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="font-semibold text-zinc-600 text-sm">No activity records found</div>
                      <div className="text-xs text-zinc-400 mt-1">Try broadening your date range or adjusting the search term.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Unified Numbered Pagination Bar */}
        {!loading && effectiveTotal > 0 && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-200/80 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 font-medium">
                Showing <strong className="text-zinc-800 font-bold">{startEntry}–{endEntry}</strong> of <strong className="text-zinc-800 font-bold">{effectiveTotal}</strong> logs
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

export default AuditLogs;
