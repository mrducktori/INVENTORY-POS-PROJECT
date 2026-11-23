// Real per-base-unit cost of an ingredient, or null when none is recorded (never invent one).
export const resolveUnitCost = (ing) => {
  if (!ing) return null;
  const purchaseCost = parseFloat(ing.cost_per_purchase_unit);
  const conv = parseFloat(ing.conversion_factor) || 1;
  if (purchaseCost > 0 && conv > 0) return Math.round((purchaseCost / conv) * 10000) / 10000;
  const explicit = parseFloat(ing.unit_cost);
  if (explicit > 0) return Math.round(explicit * 10000) / 10000;
  return null;
};

const PAGE = 1000;

// Pages through a PostgREST query past the 1000-row cap. Pass a factory so each page gets a fresh builder
// (it needs a stable .order() to page reliably).
export const fetchAllRows = async (buildQuery) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
};
