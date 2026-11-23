import { apiCall } from './client.js';
import { CATEGORIES } from '../utils/constants.js';

export const getCategorySettings = async () => {
  return apiCall('/categories/settings');
};

export const createCategory = async (category, data = {}) => {
  return apiCall('/categories/settings', {
    method: 'POST',
    body: JSON.stringify({
      category,
      sizes: data.sizes || [],
      add_ons: data.add_ons || [],
      ...(data.prep_station ? { prep_station: data.prep_station } : {})
    })
  });
};

export const updateCategorySettings = async (category, data) => {
  return apiCall(`/categories/settings/${encodeURIComponent(category)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const renameCategory = async (oldCategory, newCategory) => {
  return apiCall(`/categories/settings/${encodeURIComponent(oldCategory)}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ newCategory })
  });
};

export const deleteCategory = async (category) => {
  return apiCall(`/categories/settings/${encodeURIComponent(category)}`, {
    method: 'DELETE'
  });
};

export const extractCategoryNames = (settingsRows = []) => {
  const names = new Set();
  (Array.isArray(settingsRows) ? settingsRows : []).forEach((row) => {
    const raw = typeof row === 'string' ? row : row?.category;
    const normalized = String(raw || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (normalized && normalized !== 'ALL' && normalized !== 'OTHERS' && normalized !== 'UNCATEGORIZED') {
      names.add(normalized);
    }
  });

  if (names.size === 0) {
    return CATEGORIES.filter((c) => c !== 'OTHERS');
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
};
