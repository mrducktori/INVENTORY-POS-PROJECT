// Sales & transaction log API
import { apiCall } from './client.js';

export const getSales = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.date) params.append('date', filters.date);
  if (filters.staff_id) params.append('staff_id', filters.staff_id);
  if (filters.period) params.append('period', filters.period);
  return apiCall(`/sales?${params.toString()}`);
};

export const getSalesSummary = async (period = 'day') => {
  return apiCall(`/sales/summary?period=${period}`);
};

export const getSaleById = async (id) => {
  return apiCall(`/sales/${id}`);
};
