import { apiCall } from './client.js';

export const getRecipes = async () => {
  return apiCall('/recipes', { method: 'GET' });
};

export const getRecipesByProduct = async (product_id) => {
  return apiCall(`/recipes/product/${product_id}`, { method: 'GET' });
};

export const createRecipe = async (recipe) => {
  return apiCall('/recipes', {
    method: 'POST',
    body: JSON.stringify(recipe)
  });
};

export const updateRecipe = async (id, recipe) => {
  return apiCall(`/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(recipe)
  });
};

export const deleteRecipe = async (id) => {
  return apiCall(`/recipes/${id}`, { method: 'DELETE' });
};
