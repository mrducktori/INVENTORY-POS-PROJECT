/**
 * Normalizes a string by converting it to lowercase and removing all non-alphanumeric characters.
 * E.g., "Blue berry" -> "blueberry", "Blueberryy" -> "blueberryy"
 */
export const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching to detect typos.
 */
export const getLevenshteinDistance = (a, b) => {
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

export const collapseRepeats = (str) => {
  if (!str) return '';
  return str.replace(/(.)\1+/g, '$1');
};

/**
 * Checks if a new name is too similar to any of the existing names.
 * Returns the existing name if a match is found, otherwise null.
 */
export const findSimilarName = (newName, existingNames) => {
  const normalizedNew = normalizeName(newName);
  const collapsedNew = collapseRepeats(normalizedNew);
  
  for (const existing of existingNames) {
    const normalizedExisting = normalizeName(existing);
    
    // 1. Exact match after normalization (handles spacing and casing: "Blue berry" vs "blueberry")
    if (normalizedNew === normalizedExisting) {
      return existing;
    }
    
    // 2. Exact match after collapsing repeated characters (handles "Blueberryyyyy" vs "Blueberry")
    const collapsedExisting = collapseRepeats(normalizedExisting);
    if (collapsedNew === collapsedExisting) {
      return existing;
    }
    
    // 3. Levenshtein distance for typos (e.g. "Blueberryy" vs "Blueberry")
    // If the words are reasonably long, allow a typo of 1-2 characters
    const distance = getLevenshteinDistance(normalizedNew, normalizedExisting);
    const maxLength = Math.max(normalizedNew.length, normalizedExisting.length);
    
    // Allow 1 typo for words of length 5-7, 2 typos for 8+
    let maxAllowedDistance = 0;
    if (maxLength >= 5 && maxLength <= 7) maxAllowedDistance = 1;
    if (maxLength > 7) maxAllowedDistance = 2;
    
    if (distance > 0 && distance <= maxAllowedDistance) {
      return existing;
    }
  }
  
  return null;
};

/**
 * Normalizes a category label for case- and whitespace-insensitive comparison.
 */
export const normalizeCategory = (cat) => {
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
 * Checks for composite (name + category) duplicates across existing items.
 * Pass 1: Same normalized name + same normalized category -> hard block.
 * Pass 2: Same normalized name in a different category -> soft warning.
 * Pass 3: Fuzzy-similar name -> soft warning.
 */
export const checkCompositeDuplicate = (newName, newCategory, existingItems, excludeId = null) => {
  const candidates = (existingItems || []).filter(
    (item) => item && (excludeId === null || excludeId === undefined || String(item.id) !== String(excludeId))
  );
  // Prefer active items over archived items if both happen to exist
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
