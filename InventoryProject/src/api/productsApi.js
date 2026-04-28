// Products management API (admin/owner actions)
import { apiCall } from './client.js';

export const getAllProducts = async () => {
  return apiCall('/products');
};

export const createProduct = async (product) => {
  return apiCall('/products', {
    method: 'POST',
    body: JSON.stringify(product)
  });
};

export const updateProduct = async (id, data) => {
  return apiCall(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const archiveProduct = async (id) => {
  return apiCall(`/products/${id}/archive`, {
    method: 'PUT'
  });
};

export const restoreProduct = async (id) => {
  return apiCall(`/products/${id}/restore`, {
    method: 'PUT'
  });
};

export const receiveProductStock = async (id, quantity) => {
  return apiCall(`/products/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ quantity })
  });
};
