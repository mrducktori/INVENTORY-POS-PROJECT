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

/** Thousands separators + at most 2 decimals (1131.429 -> 1,131.43). */
export const formatQty = (val) =>
  Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * Suggested order in whole purchase units (you buy 8 bottles, not 7,208 g).
 * suggested_order_qty is in the stock unit; conversion_factor = stock units per purchase unit.
 */
export const suggestedPurchase = (item, sup) => {
  const conversionFactor = Number(sup?.default_conversion_factor) > 0 ? Number(sup.default_conversion_factor) : 1;
  const stockQty = Number(item.suggested_order_qty) || 0;
  const qty = stockQty > 0 ? Math.ceil(stockQty / conversionFactor) : 0;
  const unit = sup?.default_purchase_unit || item.purchase_unit || item.unit;
  return {
    qty,
    conversionFactor,
    unit,
    totalStock: qty * conversionFactor,
    // Factor 1 with a different unit (e.g. "kg") means no pack size was set: the PO would be in grams but priced per kg.
    needsSetup: conversionFactor === 1 && String(unit).trim().toLowerCase() !== String(item.unit).trim().toLowerCase(),
  };
};
