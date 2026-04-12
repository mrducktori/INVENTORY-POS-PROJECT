const API_BASE = "http://localhost:5000/api";

export const reportWastage = async (wastage) => {
  const res = await fetch(`${API_BASE}/wastage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wastage)
  });
  if (!res.ok) throw new Error("Failed to report wastage");
  return res.json();
};

export const getWastageHistory = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.ingredient_id) params.append("ingredient_id", filters.ingredient_id);
  if (filters.reported_by) params.append("reported_by", filters.reported_by);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);

  const res = await fetch(`${API_BASE}/wastage?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch wastage history");
  return res.json();
};

export const getWastageStats = async () => {
  const res = await fetch(`${API_BASE}/wastage/stats`);
  if (!res.ok) throw new Error("Failed to fetch wastage stats");
  return res.json();
};
