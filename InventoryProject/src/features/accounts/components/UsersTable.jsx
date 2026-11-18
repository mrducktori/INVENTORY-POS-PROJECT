import React, { useMemo, useState } from 'react';
import { getRoleLabel, getUserPermissions } from '../../../utils/permissions';
import Pagination from '../../../components/shared/Pagination';

const ROLE_FILTERS = ['All', 'Owner', 'Admin', 'Staff', 'Custom', 'Supplier', 'Archived'];

const accessSummary = (user) => {
  if (user.role === 'Owner' || user.role === 'Admin') return 'Full access';
  if (user.role === 'Supplier') return 'Supplier portal';
  const count = getUserPermissions(user).length;
  const base = `${count} ${count === 1 ? 'page' : 'pages'}`;
  return user.role === 'Staff' && !(user.permissions && user.permissions.length) ? `${base} (default)` : base;
};

/**
 * UsersTable - searchable list of accounts with edit / status actions.
 * Separates active and archived accounts cleanly and provides a 30-day delete option.
 */
const UsersTable = ({ users, loading, currentUser, onEdit, onToggleStatus, onDeleteUser }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const archivedAccountsList = useMemo(() => {
    return users.filter((u) => u.status === 'INACTIVE');
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      // Role & Status filtering
      if (roleFilter === 'Archived') {
        if (u.status !== 'INACTIVE') return false;
      } else {
        // Main view only includes active accounts
        if (u.status !== 'ACTIVE') return false;
        if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      }

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
    <div className="w-full">
      {/* Main Table Card */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
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
            {ROLE_FILTERS.map((r) => {
              const isSelected = roleFilter === r;
              const isArchivedTab = r === 'Archived';
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRoleFilter(r); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? isArchivedTab
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                        : 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                      : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {r}
                  {isArchivedTab && archivedAccountsList.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {archivedAccountsList.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading accounts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-400">
            {roleFilter === 'Archived' ? 'No archived accounts.' : 'No active accounts found.'}
          </div>
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
                  const isSelf = u.id === currentUser?.id;
                  const active = u.status === 'ACTIVE';
                  const daysArchived = u.days_since_archived ?? 0;
                  const isEligibleForDelete = daysArchived >= 30;
                  const daysRemaining = Math.max(1, 30 - daysArchived);
                  const canManage = !protectedOwner && !isSelf && (currentUser?.role === 'Owner' || (currentUser?.role === 'Admin' && u.role !== 'Admin'));

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
                            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                            {active ? 'Active' : 'Archived'}
                          </span>
                          {active ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              u.current_session_id
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.current_session_id ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                              {u.current_session_id ? 'Online' : 'Offline'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">
                              {daysArchived}d ago
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {protectedOwner ? (
                          <span className="text-xs text-zinc-400 font-semibold">Owner protected</span>
                        ) : (
                          <div className="flex justify-end items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(u)}
                              className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            {canManage && (
                              active ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleStatus(u.id, u.status)}
                                  className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer bg-white text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  Archive
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onToggleStatus(u.id, u.status)}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer bg-zinc-900 text-white border-zinc-900 hover:bg-black"
                                  >
                                    Restore
                                  </button>
                                  {onDeleteUser && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteUser(u)}
                                      disabled={!isEligibleForDelete}
                                      className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                        isEligibleForDelete
                                          ? 'bg-red-600 hover:bg-red-700 text-white'
                                          : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                                      }`}
                                      title={
                                        isEligibleForDelete
                                          ? 'Permanently delete this account'
                                          : `Can be deleted after 30 days (${daysRemaining} days remaining)`
                                      }
                                    >
                                      {isEligibleForDelete ? 'Delete' : `Delete (${daysRemaining}d)`}
                                    </button>
                                  )}
                                </div>
                              )
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

      {/* Dedicated Archived Accounts Section */}
      {archivedAccountsList.length > 0 && (
        <div className="mt-8 mb-6 bg-zinc-950 text-white rounded-2xl p-6 border border-zinc-800 shadow-xl w-full">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight m-0">Archived Accounts</h3>
              <p className="text-xs text-zinc-400 m-0 mt-0.5">
                Archived accounts cannot log in or access the system until restored.
              </p>
            </div>
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-lg">
              {archivedAccountsList.length} {archivedAccountsList.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {archivedAccountsList.map((u) => {
              const daysArchived = u.days_since_archived ?? 0;
              const isEligible = daysArchived >= 30;
              const daysRemaining = Math.max(1, 30 - daysArchived);
              const protectedOwner = u.role === 'Owner' && currentUser?.role !== 'Owner';
              const isSelf = u.id === currentUser?.id;
              const canManage = !protectedOwner && !isSelf && (currentUser?.role === 'Owner' || (currentUser?.role === 'Admin' && u.role !== 'Admin'));

              return (
                <div key={u.id} className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-sm hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center justify-center text-sm font-black shrink-0">
                      {(u.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-zinc-100 truncate">{u.name}</div>
                      <div className="text-xs text-zinc-400 truncate">@{u.username} • {getRoleLabel(u)}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Archived {daysArchived}d ago
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(u.id, u.status)}
                          className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                        >
                          Restore
                        </button>
                        {onDeleteUser && (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(u)}
                            disabled={!isEligible}
                            className={`px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                              isEligible
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-60'
                            }`}
                            title={
                              isEligible
                                ? 'Permanently delete this account'
                                : `Can be permanently deleted after 30 days (${daysRemaining} day(s) remaining)`
                            }
                          >
                            {isEligible ? 'Delete' : `${daysRemaining}d`}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-zinc-500">Protected</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTable;
