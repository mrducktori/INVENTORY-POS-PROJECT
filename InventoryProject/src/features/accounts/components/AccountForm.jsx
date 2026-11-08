import React, { useMemo, useState, useEffect } from 'react';
import PermissionGrid from './PermissionGrid';
import PasswordRulesList from './PasswordRulesList';
import { STAFF_DEFAULT_PERMISSIONS } from '../../../utils/permissions';
import { validatePasswordForSubmission } from '../../../utils/passwordRules';

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
    {hint && <div className="m-0 text-xs text-zinc-500">{hint}</div>}
  </div>
);

/**
 * AccountForm - create / edit an account, including password rules and page access.
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    setConfirmPassword('');
    setFormError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [isEditing, formData.username]);

  const roleOptions = useMemo(() => {
    const opts = ['Staff', 'Custom', 'Admin', 'Supplier'];
    if (isCurrentOwner) opts.push('Owner');
    return opts;
  }, [isCurrentOwner]);

  const update = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'password' && formError) {
      setFormError(null);
    }
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

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    const validation = validatePasswordForSubmission(
      formData.password,
      isEditing,
      confirmPassword
    );

    if (!validation.isValid) {
      setFormError(validation.error);
      return;
    }

    onSubmit(e);
  };

  const showPermissions = formData.role === 'Staff' || formData.role === 'Custom';
  const ownerTransfer = formData.role === 'Owner' && formData.role !== originalRole;

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
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
          <input
            type="text"
            name="name"
            className={inputClass}
            placeholder="e.g. Maria Santos"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </Field>
        <Field label="Username" required>
          <input
            type="text"
            name="username"
            className={inputClass}
            placeholder="e.g. maria.s"
            value={formData.username}
            onChange={handleChange}
            required
            autoComplete="off"
          />
        </Field>
        <Field
          label={isEditing ? 'New password' : 'Password'}
          required={!isEditing}
          hint={isEditing ? 'Leave blank to keep the current password.' : null}
        >
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              className={`${inputClass} pr-10`}
              placeholder={isEditing ? 'Leave blank to keep current' : 'At least 8 characters'}
              value={formData.password}
              onChange={handleChange}
              required={!isEditing}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </Field>
        <Field
          label={isEditing ? 'Confirm new password' : 'Confirm password'}
          required={!isEditing || Boolean(formData.password)}
          hint={
            confirmPassword.length > 0 && formData.password ? (
              formData.password === confirmPassword ? (
                <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Passwords match
                </span>
              ) : (
                <span className="text-rose-600 font-medium inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Passwords do not match
                </span>
              )
            ) : null
          }
        >
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              className={`${inputClass} pr-10`}
              placeholder={isEditing ? 'Repeat new password' : 'Confirm password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (formError) setFormError(null);
              }}
              required={!isEditing || Boolean(formData.password)}
              disabled={isEditing && !formData.password}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((p) => !p)}
              tabIndex={-1}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              disabled={isEditing && !formData.password}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-40"
            >
              {showConfirmPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </Field>
      </div>

      {/* Password Requirements Checklist */}
      {(!isEditing || Boolean(formData.password)) && (
        <PasswordRulesList password={formData.password} isEditing={isEditing} />
      )}

      {/* Error Banner */}
      {formError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{formError}</span>
        </div>
      )}

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
