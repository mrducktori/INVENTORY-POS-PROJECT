/**
 * Password Security Rules & Evaluation Utility
 * Standardized across Account Creation & Management.
 */

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (pwd) => typeof pwd === 'string' && pwd.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter (A–Z)',
    test: (pwd) => typeof pwd === 'string' && /[A-Z]/.test(pwd),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter (a–z)',
    test: (pwd) => typeof pwd === 'string' && /[a-z]/.test(pwd),
  },
  {
    id: 'number',
    label: 'At least one number (0–9)',
    test: (pwd) => typeof pwd === 'string' && /[0-9]/.test(pwd),
  },
  {
    id: 'special',
    label: 'At least one special symbol (!@#$%^&*)',
    test: (pwd) => typeof pwd === 'string' && /[^A-Za-z0-9]/.test(pwd),
  },
];

/**
 * Evaluate a password string against all security rules.
 */
export function evaluatePassword(password = '') {
  const pwd = password || '';
  const results = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(pwd),
  }));

  const metCount = results.filter((r) => r.met).length;
  const total = PASSWORD_RULES.length;
  const isValid = metCount === total;

  let strengthLabel = 'Too weak';
  let strengthColor = 'text-zinc-500';
  let barColor = 'bg-zinc-300';

  if (metCount >= 5) {
    strengthLabel = 'Strong';
    strengthColor = 'text-emerald-600';
    barColor = 'bg-emerald-500';
  } else if (metCount >= 4) {
    strengthLabel = 'Good';
    strengthColor = 'text-blue-600';
    barColor = 'bg-blue-500';
  } else if (metCount >= 2) {
    strengthLabel = 'Moderate';
    strengthColor = 'text-amber-600';
    barColor = 'bg-amber-500';
  } else if (metCount >= 1) {
    strengthLabel = 'Weak';
    strengthColor = 'text-rose-600';
    barColor = 'bg-rose-500';
  }

  return {
    results,
    metCount,
    total,
    isValid,
    strengthLabel,
    strengthColor,
    barColor,
  };
}

/**
 * Validates password and confirm password for submission.
 * Returns { isValid: boolean, error?: string }
 */
export function validatePasswordForSubmission(password, isEditing = false, confirmPassword = undefined) {
  const pwd = typeof password === 'string' ? password.trim() : '';

  if (isEditing && !pwd) {
    // Left blank while editing means keep existing password
    return { isValid: true };
  }

  if (!isEditing && !pwd) {
    return { isValid: false, error: 'Password is required when creating an account.' };
  }

  const evaluation = evaluatePassword(pwd);
  if (!evaluation.isValid) {
    return {
      isValid: false,
      error: 'Password does not meet all security requirements. Please verify the checklist below.',
    };
  }

  if (confirmPassword !== undefined && pwd !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match. Please re-enter to confirm.' };
  }

  return { isValid: true };
}
