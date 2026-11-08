import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, createUser, updateUser, updateUserStatus } from '../../api/usersApi';
import { getCurrentUser } from '../../api/authApi';
import { STAFF_DEFAULT_PERMISSIONS } from '../../utils/permissions';
import AccountForm from './components/AccountForm';
import UsersTable from './components/UsersTable';

const EMPTY_FORM = {
  name: '',
  username: '',
  password: '',
  role: 'Staff',
  supplier_id: '',
  custom_role_name: '',
  permissions: [...STAFF_DEFAULT_PERMISSIONS],
};

const AccountManager = () => {
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [view, setView] = useState('list'); // 'list' | 'form'

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingUserId, setEditingUserId] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'save' or 'status'
  const [statusTarget, setStatusTarget] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { getSuppliers } = await import('../../api/purchasingApi.js');
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  // 5-second countdown timer for archiving online accounts
  useEffect(() => {
    if (!showConfirmModal || confirmAction !== 'status' || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showConfirmModal, confirmAction, countdown]);

  const flash = (type, text, ms = 3500) => {
    setMessage({ type, text });
    if (ms) setTimeout(() => setMessage(null), ms);
  };

  // Role templates: default Staff access + every distinct custom role in use
  const roleTemplates = useMemo(() => {
    const templates = [{ id: 'staff-default', name: 'Staff (default)', role: 'Staff', permissions: STAFF_DEFAULT_PERMISSIONS }];
    const seen = new Set();
    users.forEach((u) => {
      if (u.role !== 'Custom' || !u.custom_role_name || !Array.isArray(u.permissions)) return;
      const key = u.custom_role_name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      templates.push({ id: `custom:${key}`, name: u.custom_role_name, role: 'Custom', permissions: u.permissions });
    });
    return templates;
  }, [users]);

  const editingUser = users.find((u) => u.id === editingUserId);
  const isSelfOwner = editingUserId === currentUser?.id && currentUser?.role === 'Owner';

  const handleSaveUser = (e) => {
    e.preventDefault();
    if (formData.role === 'Custom' && formData.permissions.length === 0) {
      flash('error', 'Select at least one page for this custom role.');
      return;
    }
    setConfirmAction('save');
    setShowConfirmModal(true);
  };

  const buildPayload = () => {
    const payload = {
      name: formData.name.trim(),
      username: formData.username,
      password: formData.password,
      role: formData.role,
    };
    if (formData.role === 'Supplier') payload.supplier_id = formData.supplier_id;
    if (formData.role === 'Staff' || formData.role === 'Custom') payload.permissions = formData.permissions;
    if (formData.role === 'Custom') payload.custom_role_name = formData.custom_role_name.trim();
    return payload;
  };

  const executeSaveUser = async () => {
    setShowConfirmModal(false);
    try {
      const payload = buildPayload();
      if (editingUserId) {
        const updatedUser = await updateUser(editingUserId, payload);
        flash('success', 'Account updated successfully.');

        // If editing own account, update local storage
        if (currentUser && currentUser.id === editingUserId) {
          localStorage.setItem('user', JSON.stringify({
            ...currentUser,
            name: updatedUser.name,
            username: updatedUser.username,
            role: updatedUser.role,
            permissions: updatedUser.permissions,
            custom_role_name: updatedUser.custom_role_name,
          }));
        }
      } else {
        await createUser(payload);
        flash('success', 'Account created successfully.');
      }

      if (formData.role === 'Owner' && formData.role !== editingUser?.role) {
        // Ownership transferred: demote locally so the UI updates
        if (currentUser && currentUser.role === 'Owner') {
          localStorage.setItem('user', JSON.stringify({ ...currentUser, role: 'Admin' }));
        }
        setTimeout(() => window.location.reload(), 1500);
      } else {
        resetForm();
        fetchUsers();
      }
    } catch (err) {
      flash('error', `Error ${editingUserId ? 'updating' : 'creating'} account: ${err.message}`, 6000);
    }
  };

  const handleEditClick = (user) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      supplier_id: user.supplier_id || '',
      custom_role_name: user.custom_role_name || '',
      permissions: Array.isArray(user.permissions) && user.permissions.length
        ? [...user.permissions]
        : user.role === 'Staff' ? [...STAFF_DEFAULT_PERMISSIONS] : [],
    });
    setView('form');
  };

  const resetForm = () => {
    setEditingUserId(null);
    setFormData({ ...EMPTY_FORM, permissions: [...STAFF_DEFAULT_PERMISSIONS] });
    setView('list');
  };

  const startCreate = () => {
    setEditingUserId(null);
    setFormData({ ...EMPTY_FORM, permissions: [...STAFF_DEFAULT_PERMISSIONS] });
    setView('form');
  };

  const handleToggleStatusClick = (id, currentStatus) => {
    const targetUser = users.find((u) => u.id === id);
    const isOnline = Boolean(targetUser?.current_session_id);
    setStatusTarget({ id, currentStatus, isOnline, user: targetUser });
    setConfirmAction('status');
    if (currentStatus === 'ACTIVE' && isOnline) {
      setCountdown(5);
    } else {
      setCountdown(0);
    }
    setShowConfirmModal(true);
  };

  const executeToggleStatus = async () => {
    setShowConfirmModal(false);
    if (!statusTarget) return;

    try {
      const newStatus = statusTarget.currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateUserStatus(statusTarget.id, newStatus);
      fetchUsers();
    } catch (err) {
      flash('error', 'Error updating account status: ' + err.message);
    }
  };

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Access Control</h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            {users.length} accounts &middot; {activeCount} active
          </p>
        </div>
        <div className="inline-flex p-1 bg-white border border-zinc-200 rounded-xl">
          {[
            { id: 'list', label: 'Accounts' },
            { id: 'form', label: editingUserId ? 'Edit Account' : 'Create Account' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => (t.id === 'list' ? resetForm() : view !== 'form' && startCreate())}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                view === t.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 mb-5 rounded-lg text-sm font-semibold border ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {view === 'list' ? (
        <UsersTable
          users={users}
          loading={loading}
          currentUser={currentUser}
          onEdit={handleEditClick}
          onToggleStatus={handleToggleStatusClick}
        />
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl max-w-5xl">
          <div className="px-6 py-5 border-b border-zinc-100">
            <h2 className="m-0 text-lg font-bold text-zinc-900">
              {editingUserId ? `Edit ${editingUser?.name || 'account'}` : 'New account'}
            </h2>
          </div>
          <div className="p-6">
            <AccountForm
              formData={formData}
              setFormData={setFormData}
              isEditing={!!editingUserId}
              isSelfOwner={isSelfOwner}
              isCurrentOwner={currentUser?.role === 'Owner'}
              originalRole={editingUser?.role}
              suppliers={suppliers}
              roleTemplates={roleTemplates}
              onSubmit={handleSaveUser}
              onCancel={resetForm}
            />
          </div>
        </div>
      )}

      {/* Confirmation / Warning Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-[slideUp_0.3s_ease-out]">
            {confirmAction === 'status' && statusTarget?.isOnline && statusTarget?.currentStatus === 'ACTIVE' ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="m-0 text-lg font-black text-zinc-900">Account is Currently Online</h3>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active Session Detected
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 font-medium leading-relaxed mb-6">
                  <strong>Warning:</strong> User <span className="font-bold underline">{statusTarget.user?.name}</span> (@{statusTarget.user?.username}) is currently logged in and actively working. Archiving this account will terminate their active session and <strong>immediately force them to log out</strong>.
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                    onClick={() => {
                      setShowConfirmModal(false);
                      setCountdown(0);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={countdown > 0}
                    className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
                    onClick={executeToggleStatus}
                  >
                    {countdown > 0 ? `Archive & Terminate (${countdown}s)` : 'Confirm Archive & Force Logout'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="m-0 text-xl font-bold text-zinc-900 mb-2">Confirm action</h3>
                <p className="m-0 text-sm text-zinc-500 mb-8">
                  {confirmAction === 'save'
                    ? `${editingUserId ? 'Save changes to this' : 'Create this'} account?`
                    : `${statusTarget?.currentStatus === 'ACTIVE' ? 'Archive and deactivate' : 'Restore'} this account?`}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                    onClick={() => setShowConfirmModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
                    onClick={confirmAction === 'save' ? executeSaveUser : executeToggleStatus}
                  >
                    Proceed
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManager;
