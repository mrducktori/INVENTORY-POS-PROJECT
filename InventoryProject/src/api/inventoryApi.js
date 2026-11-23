import { apiCall } from './client.js';
import { getCurrentUser } from '../utils/authUtils.js';

const getUserId = () => getCurrentUser()?.id || null;

export const getIngredients = async ({ includeArchived = false } = {}) => {
  const query = includeArchived ? '?include_archived=true' : '';
  return apiCall(`/inventory/ingredients${query}`, { method: 'GET' });
};

export const getIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}`, { method: 'GET' });
};

export const createIngredient = async (ingredient) => {
  return apiCall('/inventory/ingredients', {
    method: 'POST',
    body: JSON.stringify({ ...ingredient, user_id: getUserId() })
  });
};

export const updateIngredient = async (id, ingredient) => {
  return apiCall(`/inventory/ingredients/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...ingredient, user_id: getUserId() })
  });
};

export const deleteIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: getUserId() })
  });
};

export const receiveStock = async (id, quantity, options = {}) => {
  return apiCall(`/inventory/ingredients/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({
      quantity,
      expiry_date: options.expiry_date || null,
      batch_code: options.batch_code || null,
      notes: options.notes || null,
      user_id: getUserId()
    })
  });
};

export const getInventoryBatches = async (ingredientId = '') => {
  const query = ingredientId ? `?ingredient_id=${encodeURIComponent(ingredientId)}` : '';
  return apiCall(`/inventory/batches${query}`, { method: 'GET' });
};

export const getExpiryAlerts = async () => {
  return apiCall('/inventory/expiry-alerts', { method: 'GET' });
};

export const getStocktakeHistory = async () => {
  return apiCall('/inventory/stocktake', { method: 'GET' });
};

export const submitStocktake = async (payload) => {
  return apiCall('/inventory/stocktake', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const getLowStockAlerts = async () => {
  return apiCall('/inventory/low-stock-alerts', { method: 'GET' });
};

export const archiveIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}/archive`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getUserId() })
  });
};

export const restoreIngredient = async (id) => {
  return apiCall(`/inventory/ingredients/${id}/restore`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getUserId() })
  });
};

export const getRawMaterialCategories = async () => {
  return apiCall('/inventory/categories', { method: 'GET' });
};

export const createRawMaterialCategory = async (category) => {
  return apiCall('/inventory/categories', {
    method: 'POST',
    body: JSON.stringify({ category })
  });
};

export const renameRawMaterialCategory = async (oldName, newName) => {
  return apiCall(`/inventory/categories/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    body: JSON.stringify({ new_name: newName })
  });
};

export const deleteRawMaterialCategory = async (name) => {
  return apiCall(`/inventory/categories/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
};
