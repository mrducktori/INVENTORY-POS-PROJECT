import React, { useState, useEffect, useMemo } from 'react';
import { getAuditLogs } from '../../api/auditApi';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await getAuditLogs({ action: filterAction, limit: 100 });
      const list = Array.isArray(data) ? data : (data?.data || []);
      setLogs(list);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter(log => {
      const user = String(log.users?.name || log.users?.username || 'System').toLowerCase();
      const action = String(log.action || '').toLowerCase();
      const details = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || '').toLowerCase();
      return user.includes(term) || action.includes(term) || details.includes(term);
    });
  }, [logs, searchTerm]);

  return (
    <div className="p-4 md:p-8 flex-1 bg-white min-h-screen overflow-y-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight m-0">
            System Audit Trail
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            Comprehensive audit records of administrative actions and configuration events.
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search user, action, details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-7 py-2 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by action code..."
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 border border-zinc-200 rounded-lg text-xs sm:text-sm bg-white text-zinc-800 focus:outline-none focus:border-zinc-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={4} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 uppercase text-[11px] font-bold tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4 text-center">Action</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-zinc-600 text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-zinc-900 block">{log.users?.name || 'Unknown'}</span>
                        <span className="text-[10px] text-zinc-400 font-medium">({log.users?.role || 'System'})</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-600 max-w-xl truncate">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '—')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-12 text-center text-zinc-400 bg-zinc-50/30">
                      <div className="font-semibold text-zinc-600 text-sm">No activity found</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
