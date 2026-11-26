// Own sizes if the product has any, else the category's sizes.
export const getEffectiveSizes = (ownSizes, categorySettings, categoryName) => {
  if (Array.isArray(ownSizes) && ownSizes.length > 0) return ownSizes;
  const target = String(categoryName || '').trim().toUpperCase();
  const cs = (categorySettings || []).find((c) => String(c?.category || '').trim().toUpperCase() === target);
  return Array.isArray(cs?.sizes) ? cs.sizes : [];
};

export const isBaseSize = (sizes, idx) =>
  sizes[idx]?.is_base || (!sizes.some((s) => s.is_base) && idx === 0);
