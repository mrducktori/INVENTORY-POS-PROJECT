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
export const convertToBaseUnit = (quantity, recipeUnit, stockUnit) => {
  const from = (recipeUnit || '').toUpperCase().trim();
  const to   = (stockUnit  || '').toUpperCase().trim();
  const qty  = parseFloat(quantity) || 0;

  if (from === to) return qty;

  // Volume
  if (from === 'ML' && to === 'L')  return qty / 1000;
  if (from === 'L'  && to === 'ML') return qty * 1000;

  // Weight
  if (from === 'G'  && to === 'KG') return qty / 1000;
  if (from === 'KG' && to === 'G')  return qty * 1000;

  console.warn(`[unitUtils] No conversion path from "${from}" → "${to}". Using raw value.`);
  return qty;
};
