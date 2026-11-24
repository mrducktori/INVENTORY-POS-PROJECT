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
  }).sort((a, b) =>
    (a.is_available === false) - (b.is_available === false) || (a.name || "").localeCompare(b.name || "")
  );
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

  if (from === 'ML' && to === 'L')  return qty / 1000;
  if (from === 'L'  && to === 'ML') return qty * 1000;

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

export const checkDuplicateOrSimilar = (newName, existingItems, excludeId = null, newCategory = null) => {
  const normNew = normalizeName(newName);
  if (!normNew) return null;

  const normNewCat = String(newCategory || 'GENERAL').trim().replace(/\s+/g, ' ').toUpperCase();
  const items = Array.isArray(existingItems) ? existingItems : [];
  const newWords = normNew.split(' ').filter(Boolean);

  // First pass: exact name AND same category -> hard duplicate (never bypassable)
  for (const item of items) {
    if (excludeId != null && String(item.id) === String(excludeId)) continue;

    const normExisting = normalizeName(item.name);
    const normExistingCat = String(item.category || 'GENERAL').trim().replace(/\s+/g, ' ').toUpperCase();
    if (normExisting === normNew && normExistingCat === normNewCat) {
      return {
        isHardDuplicate: true,
        isExactMatch: true,
        matchName: item.name,
        matchCategory: item.category || 'GENERAL'
      };
    }
  }

  // Second pass: exact name in a different category -> soft warning
  for (const item of items) {
    if (excludeId != null && String(item.id) === String(excludeId)) continue;

    const normExisting = normalizeName(item.name);
    if (normExisting === normNew) {
      return {
        isHardDuplicate: false,
        isExactMatch: true,
        isDifferentCategory: true,
        matchName: item.name,
        matchCategory: item.category || 'GENERAL'
      };
    }
  }

  // Third pass: substring or subset word matches -> soft warning
  for (const item of items) {
    if (excludeId != null && String(item.id) === String(excludeId)) continue;

    const normExisting = normalizeName(item.name);
    if (!normExisting) continue;

    // "Blueberry Cheesecake" (Pastries) is not a lookalike of "Blueberry" (Fruit Drinks): only compare names within one category.
    if (newCategory != null && String(item.category || 'GENERAL').trim().replace(/\s+/g, ' ').toUpperCase() !== normNewCat) continue;

    if (normNew.length > 3 && normExisting.length > 3 && (normNew.includes(normExisting) || normExisting.includes(normNew))) {
      return {
        isHardDuplicate: false,
        isExactMatch: false,
        matchName: item.name,
        matchCategory: item.category || 'GENERAL'
      };
    }

    const existingWords = normExisting.split(' ').filter(Boolean);
    const newContainsAllExisting = existingWords.length > 0 && existingWords.every(w => newWords.includes(w));
    const existingContainsAllNew = newWords.length > 0 && newWords.every(w => existingWords.includes(w));

    if (newContainsAllExisting || existingContainsAllNew) {
      return {
        isHardDuplicate: false,
        isExactMatch: false,
        matchName: item.name,
        matchCategory: item.category || 'GENERAL'
      };
    }
  }

  return null;
};
