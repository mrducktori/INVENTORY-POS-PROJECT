// Filter products by category and search term
export const filterProducts = (products, category, searchTerm = "") => {
  const mainCategories = ["COFFEE", "FRAPPE", "MILK TEA", "PASTRIES", "PASTRY", "PROMO"];
  
  return products.filter(p => {
    const pCat = (p.category || "").toUpperCase();
    const targetCat = category.toUpperCase();
    
    let matchCategory = false;
    if (targetCat === "ALL") {
      matchCategory = true;
    } else if (targetCat === "OTHERS") {
      matchCategory = !mainCategories.includes(pCat);
    } else if (targetCat === "PASTRIES") {
      matchCategory = (pCat === "PASTRIES" || pCat === "PASTRY");
    } else {
      matchCategory = pCat === targetCat;
    }

    const matchSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });
};

// Format quantity to handle ML→L and G→KG display conversions
export const formatQuantity = (qty, unit) => {
  const numQty = parseFloat(qty) || 0;
  const upperUnit = (unit || "").toUpperCase();

  if (upperUnit === 'L' && numQty < 1 && numQty > 0) {
    return `${parseFloat((numQty * 1000).toFixed(2))} ML`;
  }
  if (upperUnit === 'KG' && numQty < 1 && numQty > 0) {
    return `${parseFloat((numQty * 1000).toFixed(2))} G`;
  }

  return `${parseFloat(numQty.toFixed(4))} ${upperUnit}`;
};

/**
 * Convert a recipe quantity into the ingredient's base storage unit.
 *
 * Examples:
 *   convertToBaseUnit(15, 'ML', 'L')   → 0.015
 *   convertToBaseUnit(200, 'G', 'KG')  → 0.2
 *   convertToBaseUnit(2, 'PCS', 'PCS') → 2
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

  console.warn(`convertToBaseUnit: no path from "${from}" → "${to}". Using raw value.`);
  return qty;
};
