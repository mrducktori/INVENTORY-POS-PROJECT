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
    setStatusTarget({ id, currentStatus });
    setConfirmAction('status');
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <h3 className="m-0 text-xl font-bold text-zinc-900 mb-2">Confirm action</h3>
            <p className="m-0 text-sm text-zinc-500 mb-8">
              {confirmAction === 'save'
                ? `${editingUserId ? 'Save changes to this' : 'Create this'} account?`
                : `${statusTarget?.currentStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'} this account?`}
            </p>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
                onClick={confirmAction === 'save' ? executeSaveUser : executeToggleStatus}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManager;
