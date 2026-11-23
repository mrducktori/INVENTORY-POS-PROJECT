export const INPUT_LIMITS = {
  NAME_MAX_LEN: 100,
  CATEGORY_MAX_LEN: 50,
  DESC_MAX_LEN: 500,
  PRODUCT_PRICE_MIN: 0.01,
  PRODUCT_PRICE_MAX: 100000,
  ADDON_PRICE_MAX: 50000,
  STOCK_QTY_MAX: 1000000,
  RECEIVE_QTY_MIN: 0.01,
  RECEIVE_QTY_MAX: 1000000,
  THRESHOLD_MAX: 1000000,
  RECIPE_QTY_MIN: 0.001,
  RECIPE_QTY_MAX: 100000,
  CONVERSION_FACTOR_MIN: 0.0001,
  CONVERSION_FACTOR_MAX: 1000000,
  PURCHASE_COST_MAX: 1000000,
  PO_QTY_MIN: 1,
  PO_QTY_MAX: 100000,
  WASTAGE_QTY_MIN: 0.01,
  WASTAGE_QTY_MAX: 1000000,
  SHELF_LIFE_DAYS_MIN: 1,
  SHELF_LIFE_DAYS_MAX: 3650,
  BATCH_CODE_MAX_LEN: 60,
  STOCKTAKE_COUNT_MIN: 0,
  STOCKTAKE_COUNT_MAX: 1000000
};

/**
 * Validate a numeric input against inclusive [min, max] bounds.
 * Returns { valid, error, numericValue }.
 */
export const validateAmountInput = (value, { label = 'Value', min = 0, max = 100000 } = {}) => {
  if (value === '' || value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return {
      valid: false,
      error: `${label} is required.`,
      numericValue: NaN
    };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return {
      valid: false,
      error: `${label} must be a valid number.`,
      numericValue: NaN
    };
  }

  if (numericValue < min || numericValue > max) {
    return {
      valid: false,
      error: `${label} must be between ${min} and ${max.toLocaleString()}.`,
      numericValue
    };
  }

  return {
    valid: true,
    error: '',
    numericValue
  };
};

/**
 * Clamp a numeric input value into inclusive [min, max], preserving empty string while typing.
 */
export const clampNumberInput = (rawValue, min, max) => {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return '';
  }
  const num = Number(rawValue);
  if (!Number.isFinite(num)) {
    return min;
  }
  return Math.min(max, Math.max(min, num));
};
