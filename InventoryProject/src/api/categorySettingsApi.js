import { apiCall } from './client.js';

export const getCategorySettings = async () => {
  return apiCall('/categories/settings');
};

export const updateCategorySettings = async (category, data) => {
  return apiCall(`/categories/settings/${encodeURIComponent(category)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};
