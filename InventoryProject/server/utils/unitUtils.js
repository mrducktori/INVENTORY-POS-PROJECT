// Conversion factors keyed by "FROM>TO".
const FACTORS = { 'ML>L': 1 / 1000, 'L>ML': 1000, 'G>KG': 1 / 1000, 'KG>G': 1000 };
const norm = (u) => (u || '').toUpperCase().trim();

/** True when a recipe in `recipeUnit` can be deducted from stock kept in `stockUnit`. */
export const canConvertUnit = (recipeUnit, stockUnit) => {
  const from = norm(recipeUnit);
  const to = norm(stockUnit);
  return !from || !to || from === to || `${from}>${to}` in FACTORS;
};

/**
 * Converts a recipe quantity into the ingredient's stock unit before deducting stock.
 * Supports ML/L and G/KG; the same unit is a no-op.
 */
export const convertToBaseUnit = (quantity, recipeUnit, stockUnit) => {
  const from = norm(recipeUnit);
  const to = norm(stockUnit);
  const qty = parseFloat(quantity) || 0;

  if (!from || !to || from === to) return qty;
  const factor = FACTORS[`${from}>${to}`];
  if (factor !== undefined) return qty * factor;

  // Recipes are validated on save (canConvertUnit); this only catches legacy rows.
  console.warn(`[unitUtils] No conversion path from "${from}" → "${to}". Using raw value.`);
  return qty;
};
