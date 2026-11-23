export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const formatPeso = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
