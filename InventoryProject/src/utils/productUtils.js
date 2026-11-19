// Filter products by category and search term
export const filterProducts = (products, category, searchTerm = "", knownCategories = null) => {
  const defaultMainCategories = ["COFFEE", "FRAPPE", "MILK TEA", "FRUIT DRINKS", "PASTRIES", "PASTRY", "PROMO"];
  const rawList = Array.isArray(knownCategories) && knownCategories.length > 0
    ? knownCategories
    : defaultMainCategories;

  const knownSet = new Set();
  rawList.forEach((cat) => {
    const upper = String(cat || "").trim().toUpperCase();
    if (upper && upper !== "ALL" && upper !== "OTHERS") {
      knownSet.add(upper);
      if (upper === "PASTRIES") knownSet.add("PASTRY");
    }
  });

  return products.filter(p => {
    const pCat = (p.category || "").toUpperCase();
    const targetCat = String(category || "ALL").toUpperCase();

    let matchCategory;
    if (targetCat === "ALL") {
      matchCategory = true;
    } else if (targetCat === "OTHERS") {
      matchCategory = pCat === "OTHERS" || !knownSet.has(pCat);
    } else if (targetCat === "PASTRIES") {
      matchCategory = (pCat === "PASTRIES" || pCat === "PASTRY");
    } else {
      matchCategory = pCat === targetCat;
    }

    const term = (searchTerm || "").trim().toLowerCase();
    const matchSearch = !term || (p.name || "").toLowerCase().includes(term);
    return matchCategory && matchSearch;
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
};

const LEGACY_DRINK_CATEGORIES = ["COFFEE", "FRAPPE", "MILK TEA", "FRUIT DRINKS"];

export const getProductOptionsAvailability = (product, categorySettings = {}) => {
  if (!product) return { hasSizes: false, hasAddOns: false };
  const catKey = (product.category || "").toUpperCase();
  const hasExplicitSettings = Boolean(categorySettings && categorySettings[catKey]);
  const isLegacyDrink = !hasExplicitSettings && LEGACY_DRINK_CATEGORIES.includes(catKey);
  return {
    hasSizes: Boolean(product.sizes?.length > 0 || isLegacyDrink),
    hasAddOns: Boolean(product.add_ons?.length > 0 || isLegacyDrink)
  };
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

export const normalizeName = (name) => {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const checkDuplicateOrSimilar = (newName, existingItems, excludeId = null) => {
  const normNew = normalizeName(newName);
  if (!normNew) return null;
  
  const newWords = normNew.split(' ');

  for (const item of existingItems) {
    if (excludeId && item.id === excludeId) continue;

    const normExisting = normalizeName(item.name);
    
    if (normNew === normExisting) {
      return { isExactMatch: true, matchName: item.name };
    }
    
    // Substring or subset word matches
    if (normNew.length > 3 && normExisting.length > 3 && (normNew.includes(normExisting) || normExisting.includes(normNew))) {
      return { isExactMatch: false, matchName: item.name };
    }
    
    const existingWords = normExisting.split(' ');
    
    const newContainsAllExisting = existingWords.length > 0 && existingWords.every(w => newWords.includes(w));
    const existingContainsAllNew = newWords.length > 0 && newWords.every(w => existingWords.includes(w));
    
    if (newContainsAllExisting || existingContainsAllNew) {
      return { isExactMatch: false, matchName: item.name };
    }
  }
  
  return null;
};
