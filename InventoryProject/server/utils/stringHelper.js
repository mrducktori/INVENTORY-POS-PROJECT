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
