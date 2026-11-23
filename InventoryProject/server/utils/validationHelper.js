export const LIMITS = {
  NAME_MAX_LEN: 100,
  CATEGORY_MAX_LEN: 50,
  DESC_MAX_LEN: 500,
  PRODUCT_PRICE_MIN: 0.01,
  PRODUCT_PRICE_MAX: 100000,
  ADDON_PRICE_MIN: 0,
  ADDON_PRICE_MAX: 50000,
  STOCK_QTY_MIN: 0,
  STOCK_QTY_MAX: 1000000,
  RECEIVE_QTY_MIN: 0.01,
  RECEIVE_QTY_MAX: 1000000,
  THRESHOLD_MIN: 0,
  THRESHOLD_MAX: 1000000,
  RECIPE_QTY_MIN: 0.001,
  RECIPE_QTY_MAX: 100000,
  CONVERSION_FACTOR_MIN: 0.0001,
  CONVERSION_FACTOR_MAX: 1000000,
  PURCHASE_COST_MIN: 0,
  PURCHASE_COST_MAX: 1000000,
  PO_QTY_MIN: 0.01,
  PO_QTY_MAX: 100000,
  WASTAGE_QTY_MIN: 0.01,
  WASTAGE_QTY_MAX: 1000000
};

/**
 * Validates that a value is a finite number within [min, max].
 * Throws an Error with status 400 when validation fails.
 */
export const validateNumberBound = (value, { label, min, max, allowZero = true }) => {
  const isInvalidTypeOrBlank =
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    typeof value === 'object' ||
    (typeof value === 'string' && value.trim() === '');

  const num = isInvalidTypeOrBlank ? NaN : Number(value);

  if (!Number.isFinite(num) || num < min || num > max || (!allowZero && num === 0)) {
    const err = new Error(`${label} must be between ${min} and ${max.toLocaleString()}.`);
    err.status = 400;
    throw err;
  }

  return num;
};

/**
 * Trims and collapses whitespace in text, enforcing min/max length bounds.
 * Throws an Error with status 400 when validation fails.
 */
export const validateTextLength = (value, { label, min = 1, max = 100, required = true } = {}) => {
  const raw = typeof value === 'string' ? value : (typeof value === 'number' ? String(value) : '');
  const cleaned = raw.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    if (required) {
      const err = new Error(`${label} is required.`);
      err.status = 400;
      throw err;
    }
    return '';
  }

  if (cleaned.length < min) {
    const err = new Error(`${label} must be at least ${min} character${min === 1 ? '' : 's'}.`);
    err.status = 400;
    throw err;
  }

  if (cleaned.length > max) {
    const err = new Error(`${label} must be at most ${max} characters.`);
    err.status = 400;
    throw err;
  }

  return cleaned;
};
