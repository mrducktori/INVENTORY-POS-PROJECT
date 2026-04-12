const API_BASE = "http://localhost:5000/api";

export const getIngredients = async () => {
  const res = await fetch(`${API_BASE}/inventory/ingredients`);
  if (!res.ok) throw new Error("Failed to fetch ingredients");
  return res.json();
};

export const getIngredient = async (id) => {
  const res = await fetch(`${API_BASE}/inventory/ingredients/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ingredient");
  return res.json();
};

export const createIngredient = async (ingredient) => {
  const res = await fetch(`${API_BASE}/inventory/ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ingredient)
  });
  if (!res.ok) throw new Error("Failed to create ingredient");
  return res.json();
};

export const updateIngredient = async (id, ingredient) => {
  const res = await fetch(`${API_BASE}/inventory/ingredients/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ingredient)
  });
  if (!res.ok) throw new Error("Failed to update ingredient");
  return res.json();
};

export const deleteIngredient = async (id) => {
  const res = await fetch(`${API_BASE}/inventory/ingredients/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete ingredient");
  return res.json();
};

export const receiveStock = async (id, quantity) => {
  const res = await fetch(`${API_BASE}/inventory/ingredients/${id}/receive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity })
  });
  if (!res.ok) throw new Error("Failed to receive stock");
  return res.json();
};

export const getLowStockAlerts = async () => {
  const res = await fetch(`${API_BASE}/inventory/low-stock-alerts`);
  if (!res.ok) throw new Error("Failed to fetch low stock alerts");
  return res.json();
};
