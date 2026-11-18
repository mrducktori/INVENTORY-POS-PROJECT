import React, { useMemo, useState } from 'react';
import { getRoleLabel, getUserPermissions } from '../../../utils/permissions';
import Pagination from '../../../components/shared/Pagination';

const ROLE_FILTERS = ['All', 'Owner', 'Admin', 'Staff', 'Custom', 'Supplier'];

const accessSummary = (user) => {
  if (user.role === 'Owner' || user.role === 'Admin') return 'Full access';
  if (user.role === 'Supplier') return 'Supplier portal';
  const count = getUserPermissions(user).length;
  const base = `${count} ${count === 1 ? 'page' : 'pages'}`;
  return user.role === 'Staff' && !(user.permissions && user.permissions.length) ? `${base} (default)` : base;
};

/**
 * UsersTable - searchable list of accounts with edit / status actions.
 */
const UsersTable = ({ users, loading, currentUser, onEdit, onToggleStatus }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      if (!term) return true;
      return [u.name, u.username, getRoleLabel(u)].some((v) => (v || '').toLowerCase().includes(term));
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative md:w-72">
          <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search name, username or role"
            className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRoleFilter(r); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                roleFilter === r ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-zinc-500">Loading accounts...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-zinc-400">No accounts found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                {['Name', 'Role', 'Access', 'Status', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider ${i === 4 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paginatedUsers.map((u) => {
                const protectedOwner = u.role === 'Owner' && currentUser?.role !== 'Owner';
                const active = u.status === 'ACTIVE';
                return (
                  <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-zinc-900">{u.name}</div>
                          <div className="text-xs text-zinc-500">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded">
                        {getRoleLabel(u)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-600">{accessSummary(u)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                          {active ? 'Active' : 'Archived'}
                        </span>
                        {active && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            u.current_session_id
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.current_session_id ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                            {u.current_session_id ? 'Online' : 'Offline'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {protectedOwner ? (
                        <span className="text-xs text-zinc-400 font-semibold">Owner protected</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(u)}
                            className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => onToggleStatus(u.id, u.status)}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                                active ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-zinc-900 text-white border-zinc-900 hover:bg-black'
                              }`}
                            >
                              {active ? 'Archive' : 'Restore'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              itemsPerPageOptions={[10, 20, 50]}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default UsersTable;

