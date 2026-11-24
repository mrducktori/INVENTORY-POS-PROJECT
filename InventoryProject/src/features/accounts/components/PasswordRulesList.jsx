import React from 'react';
import { evaluatePassword } from '../../../utils/passwordRules';

/**
 * PasswordRulesList - live password strength bar and checklist of the security rules.
 */
const PasswordRulesList = ({ password = '', isEditing = false }) => {
  const { results, metCount, total, isValid, strengthLabel, strengthColor, barColor } =
    evaluatePassword(password);

  const hasTyped = Boolean(password && password.length > 0);

  // If editing and nothing typed yet, show an informational note
  if (isEditing && !hasTyped) {
    return (
      <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
        Leave blank to keep the current password. If entering a new password, all security requirements below will apply.
      </div>
    );
  }

  const pct = Math.round((metCount / total) * 100);

  return (
    <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
          Password Requirements
        </span>
        <div className="flex items-center gap-2">
          {hasTyped && (
            <span className={`text-xs font-semibold ${strengthColor}`}>
              {strengthLabel}
            </span>
          )}
          <span className="text-xs font-semibold tabular-nums text-zinc-500">
            {metCount}/{total} met
          </span>
        </div>
      </div>

      <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {results.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center gap-2 transition-colors ${
              rule.met ? 'text-emerald-700 font-medium' : 'text-zinc-500'
            }`}
          >
            {rule.met ? (
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              </span>
            )}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>

      {isValid && (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 pt-1 border-t border-zinc-200/70">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>All security requirements satisfied.</span>
        </div>
      )}
    </div>
  );
};

export default PasswordRulesList;
