/**
 * unitUtils.js — Server-side unit conversion helpers
 *
 * Converts a recipe quantity from its recipe_unit into the
 * ingredient's storage unit before deducting from stock.
 *
 * Supported conversions:
 *   Volume : ML ↔ L
 *   Weight : G  ↔ KG
 *   Same unit → no-op
 */

/**
 * @param {number} quantity   - Amount used per recipe item
 * @param {string} recipeUnit - Unit the recipe quantity is expressed in  (e.g. "ML")
 * @param {string} stockUnit  - Unit the ingredient stock is stored in     (e.g. "L")
 * @returns {number}          - Equivalent quantity in stockUnit
 */
const FACTORS = { 'ML>L': 1 / 1000, 'L>ML': 1000, 'G>KG': 1 / 1000, 'KG>G': 1000 };
const norm = (u) => (u || '').toUpperCase().trim();

/** True when a recipe in `recipeUnit` can be deducted from stock kept in `stockUnit`. */
export const canConvertUnit = (recipeUnit, stockUnit) => {
  const from = norm(recipeUnit);
  const to = norm(stockUnit);
  return !from || !to || from === to || `${from}>${to}` in FACTORS;
};

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
