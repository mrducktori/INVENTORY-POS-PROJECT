/**
 * Formats a numeric value as Philippine Peso currency (₱1,234.56).
 * @param {number|string} val
 * @returns {string}
 */
export const formatCurrency = (val) => {
  return `₱${Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
