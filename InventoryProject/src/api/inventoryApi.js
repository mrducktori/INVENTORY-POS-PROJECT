import { apiCall } from './client.js';

export const getIngredients = async () => {
  return apiCall('/inventory/ingredients', { method: 'GET' });
};

export const getIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}`, { method: 'GET' });
};

export const createIngredient = async (ingredient) => {
  return apiCall('/inventory/ingredients', {
    method: 'POST',
    body: JSON.stringify(ingredient)
  });
};

export const updateIngredient = async (id, ingredient) => {
  return apiCall(`/inventory/ingredients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(ingredient)
  });
};

export const deleteIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}`, { method: 'DELETE' });
};

export const receiveStock = async (id, quantity) => {
  return apiCall(`/inventory/ingredients/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ quantity })
  });
};

export const getLowStockAlerts = async () => {
  return apiCall('/inventory/low-stock-alerts', { method: 'GET' });
};

export const archiveIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}/archive`, { method: 'PUT' });
};

export const restoreIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}/restore`, { method: 'PUT' });
};

