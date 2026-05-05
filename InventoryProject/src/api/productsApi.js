// Products management API (admin/owner actions)
import { apiCall } from './client.js';
import { getCurrentUser } from '../utils/authUtils.js';

const getUserId = () => getCurrentUser()?.id || null;

export const getAllProducts = async () => {
  return apiCall('/products');
};

export const createProduct = async (product) => {
  return apiCall('/products', {
    method: 'POST',
    body: JSON.stringify({ ...product, user_id: getUserId() })
  });
};

export const updateProduct = async (id, data) => {
  return apiCall(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, user_id: getUserId() })
  });
};

export const archiveProduct = async (id) => {
  return apiCall(`/products/${id}/archive`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getUserId() })
  });
};

export const restoreProduct = async (id) => {
  return apiCall(`/products/${id}/restore`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getUserId() })
  });
};

export const receiveProductStock = async (id, quantity) => {
  return apiCall(`/products/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ quantity, user_id: getUserId() })
  });
};
