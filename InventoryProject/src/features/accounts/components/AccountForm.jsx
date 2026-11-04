import React, { useMemo } from 'react';
import PermissionGrid from './PermissionGrid';
import { STAFF_DEFAULT_PERMISSIONS } from '../../../utils/permissions';

const inputClass =
  'w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all disabled:bg-zinc-100 disabled:text-zinc-500 disabled:cursor-not-allowed';
const labelClass = 'text-[11px] font-bold text-zinc-700 uppercase tracking-wider';

const Field = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className={labelClass}>
      {label}
      {required && <span className="text-zinc-400"> *</span>}
    </label>
    {children}
    {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
  </div>
);

/**
 * AccountForm - create / edit an account, including role and page access.
 */
const AccountForm = ({
  formData,
  setFormData,
  isEditing,
  isSelfOwner,
  isCurrentOwner,
  originalRole,
  suppliers,
  roleTemplates,
  onSubmit,
  onCancel,
}) => {
  const roleOptions = useMemo(() => {
    const opts = ['Staff', 'Custom', 'Admin', 'Supplier'];
    if (isCurrentOwner) opts.push('Owner');
    return opts;
  }, [isCurrentOwner]);

  const update = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    update({ [name]: name === 'username' ? value.replace(/\s/g, '') : value });
  };

  const handleRoleChange = (role) => {
    if (isSelfOwner) return;
    const patch = { role };
    if (role === 'Staff' && formData.role !== 'Staff') patch.permissions = [...STAFF_DEFAULT_PERMISSIONS];
    if (role === 'Custom' && formData.role !== 'Custom') patch.permissions = [];
    update(patch);
  };

  const handleTemplate = (e) => {
    const tpl = roleTemplates.find((t) => t.id === e.target.value);
    if (!tpl) return;
    update({
      role: tpl.role,
      custom_role_name: tpl.role === 'Custom' ? tpl.name : '',
      permissions: [...tpl.permissions],
    });
  };

  const showPermissions = formData.role === 'Staff' || formData.role === 'Custom';
  const ownerTransfer = formData.role === 'Owner' && formData.role !== originalRole;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Role template */}
      {roleTemplates.length > 0 && !isSelfOwner && (
        <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50">
          <Field label="Reuse an existing role" hint="Copies the role and page access. You can still adjust them below.">
            <select className={`${inputClass} cursor-pointer`} value="" onChange={handleTemplate}>
              <option value="">Choose a role template (optional)</option>
              {roleTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.permissions.length} {t.permissions.length === 1 ? 'page' : 'pages'}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full name" required>
          <input type="text" name="name" className={inputClass} placeholder="e.g. Maria Santos" value={formData.name} onChange={handleChange} required />
        </Field>
        <Field label="Username" required>
          <input type="text" name="username" className={inputClass} placeholder="e.g. maria.s" value={formData.username} onChange={handleChange} required autoComplete="off" />
        </Field>
        <Field
          label={isEditing ? 'New password' : 'Password'}
          required={!isEditing}
          hint={isEditing ? 'Leave blank to keep the current password.' : null}
        >
          <input
            type="password"
            name="password"
            className={inputClass}
            placeholder={isEditing ? '••••••••' : 'Minimum 6 characters'}
            value={formData.password}
            onChange={handleChange}
            required={!isEditing}
            minLength={formData.password ? 6 : undefined}
            autoComplete="new-password"
          />
        </Field>
      </div>

      {/* Role */}
      <Field label="Role" required>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {roleOptions.map((role) => {
            const active = formData.role === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleChange(role)}
                disabled={isSelfOwner && !active}
                className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>
        {isSelfOwner && (
          <p className="m-0 text-xs text-zinc-500">Assign the Owner role to another account before changing your own role.</p>
        )}
        {ownerTransfer && (
          <p className="m-0 text-xs font-semibold text-red-600">This transfers ownership. You will become an Admin.</p>
        )}
      </Field>

      {formData.role === 'Custom' && (
        <Field label="Custom role name" required hint="Any job title, e.g. Finance or Shift Lead.">
          <input
            type="text"
            name="custom_role_name"
            className={inputClass}
            placeholder="e.g. Finance"
            value={formData.custom_role_name}
            onChange={handleChange}
            maxLength={40}
            required
          />
        </Field>
      )}

      {formData.role === 'Supplier' && (
        <Field label="Linked supplier" required>
          <select name="supplier_id" className={`${inputClass} cursor-pointer`} value={formData.supplier_id || ''} onChange={handleChange} required>
            <option value="">Select a supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      )}

      {(formData.role === 'Admin' || formData.role === 'Owner') && (
        <div className="px-4 py-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-600">
          {formData.role === 'Owner' ? 'Owners' : 'Admins'} have full access to every page.
        </div>
      )}

      {showPermissions && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Page access</span>
            <span className="text-xs font-semibold text-zinc-500 tabular-nums">
              {formData.permissions.length} selected
            </span>
          </div>
          <PermissionGrid value={formData.permissions} onChange={(permissions) => update({ permissions })} />
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-zinc-100">
        {isEditing && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-white border border-zinc-300 text-zinc-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
        >
          {isEditing ? 'Save Changes' : 'Create Account'}
        </button>
      </div>
    </form>
  );
};

export default AccountForm;

