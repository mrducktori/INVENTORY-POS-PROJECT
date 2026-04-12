const API_BASE = "http://localhost:5000/api";

export const getRecipes = async () => {
  const res = await fetch(`${API_BASE}/recipes`);
  if (!res.ok) throw new Error("Failed to fetch recipes");
  return res.json();
};

export const getRecipesByProduct = async (product_id) => {
  const res = await fetch(`${API_BASE}/recipes/product/${product_id}`);
  if (!res.ok) throw new Error("Failed to fetch recipes");
  return res.json();
};

export const createRecipe = async (recipe) => {
  const res = await fetch(`${API_BASE}/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe)
  });
  if (!res.ok) throw new Error("Failed to create recipe");
  return res.json();
};

export const updateRecipe = async (id, recipe) => {
  const res = await fetch(`${API_BASE}/recipes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe)
  });
  if (!res.ok) throw new Error("Failed to update recipe");
  return res.json();
};

export const deleteRecipe = async (id) => {
  const res = await fetch(`${API_BASE}/recipes/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete recipe");
  return res.json();
};
