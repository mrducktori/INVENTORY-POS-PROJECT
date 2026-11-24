/**
 * Lowercases and strips all non-alphanumeric characters so spacing and punctuation do not matter.
 * Example: "Blue berry" -> "blueberry"
 */
export const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/** Levenshtein edit distance between two strings, used to detect typos. */
const getLevenshteinDistance = (a, b) => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
                   matrix[i - 1][j] + 1) // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const collapseRepeats = (str) => {
  if (!str) return '';
  return str.replace(/(.)\1+/g, '$1');
};

/** Returns the existing name that is too similar to `newName`, or null when none is. */
export const findSimilarName = (newName, existingNames) => {
  const normalizedNew = normalizeName(newName);
  const collapsedNew = collapseRepeats(normalizedNew);
  
  for (const existing of existingNames) {
    const normalizedExisting = normalizeName(existing);
    
    // Same name after normalization ("Blue berry" vs "blueberry").
    if (normalizedNew === normalizedExisting) {
      return existing;
    }
    
    // Same name after collapsing repeated characters ("Blueberryyyyy" vs "Blueberry").
    const collapsedExisting = collapseRepeats(normalizedExisting);
    if (collapsedNew === collapsedExisting) {
      return existing;
    }
    
    // Typos: names under 5 characters must match exactly, 5-7 characters allow 1 edit, 8+ allow 2.
    const distance = getLevenshteinDistance(normalizedNew, normalizedExisting);
    const maxLength = Math.max(normalizedNew.length, normalizedExisting.length);
    
    let maxAllowedDistance = 0;
    if (maxLength >= 5 && maxLength <= 7) maxAllowedDistance = 1;
    if (maxLength > 7) maxAllowedDistance = 2;
    
    if (distance > 0 && distance <= maxAllowedDistance) {
      return existing;
    }
  }
  
  return null;
};

/** Normalizes a category label for case- and whitespace-insensitive comparison. */
const normalizeCategory = (cat) => {
  const cleaned = String(cat ?? '').trim().replace(/\s+/g, ' ');
  return (cleaned || 'GENERAL').toUpperCase();
};

const cleanLowerName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

const isSameNormalizedName = (a, b) => {
  const lowerA = cleanLowerName(a);
  const lowerB = cleanLowerName(b);
  if (!lowerA || !lowerB) return false;
  if (lowerA === lowerB) return true;
  const alphaA = normalizeName(a);
  const alphaB = normalizeName(b);
  return Boolean(alphaA && alphaB && alphaA === alphaB);
};

/**
 * Checks for duplicates by name and category across existing items.
 * Same name and category is a hard block; same name in another category, or a similar name in
 * the same category, is a soft warning.
 */
export const checkCompositeDuplicate = (newName, newCategory, existingItems, excludeId = null) => {
  const candidates = (existingItems || []).filter(
    (item) => item && (excludeId === null || excludeId === undefined || String(item.id) !== String(excludeId))
  );
  // Active items win over archived ones when both match.
  const ordered = [
    ...candidates.filter((item) => !item.is_archived),
    ...candidates.filter((item) => item.is_archived)
  ];

  const targetCat = normalizeCategory(newCategory);

  for (const item of ordered) {
    if (isSameNormalizedName(item.name, newName) && normalizeCategory(item.category) === targetCat) {
      return {
        isHardDuplicate: true,
        isDuplicateWarning: false,
        matchName: item.name,
        matchCategory: item.category || 'GENERAL',
        isArchived: Boolean(item.is_archived)
      };
    }
  }

  for (const item of ordered) {
    if (isSameNormalizedName(item.name, newName)) {
      return {
        isHardDuplicate: false,
        isDuplicateWarning: true,
        reason: 'SAME_NAME_DIFF_CATEGORY',
        matchName: item.name,
        matchCategory: item.category || 'GENERAL',
        isArchived: Boolean(item.is_archived)
      };
    }
  }

  const normAlphaNew = normalizeName(newName);
  if (normAlphaNew) {
    for (const item of ordered) {
      if (!normalizeName(item.name)) continue;
      // Lookalike names only matter inside the same category.
      if (normalizeCategory(item.category) !== targetCat) continue;
      if (findSimilarName(newName, [item.name])) {
        return {
          isHardDuplicate: false,
          isDuplicateWarning: true,
          reason: 'SIMILAR_NAME',
          matchName: item.name,
          matchCategory: item.category || 'GENERAL',
          isArchived: Boolean(item.is_archived)
        };
      }
    }
  }

  return null;
};
