import { apiCall } from './client.js';

export const reportWastage = async (wastage) => {
  return apiCall('/wastage', {
    method: 'POST',
    body: JSON.stringify(wastage)
  });
};

export const getWastageHistory = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.ingredient_id) params.append('ingredient_id', filters.ingredient_id);
  if (filters.reported_by) params.append('reported_by', filters.reported_by);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  return apiCall(`/wastage?${params.toString()}`, { method: 'GET' });
};

export const getWastageStats = async () => {
  return apiCall('/wastage/stats', { method: 'GET' });
};
