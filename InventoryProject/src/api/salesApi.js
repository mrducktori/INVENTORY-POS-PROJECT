// Sales & transaction log API
import { apiCall } from './client.js';

export const getSales = async (filters = {}, pageSize = 50, page = 1) => {
  const params = new URLSearchParams();
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.category) params.append('category', filters.category);
  // pagination parameters
  params.append('limit', pageSize);
  params.append('offset', (page - 1) * pageSize);
  return apiCall(`/sales?${params.toString()}`);
};

export const getSalesSummary = async (period = 'day') => {
  return apiCall(`/sales/summary?period=${period}`);
};

export const getSaleById = async (id) => {
  return apiCall(`/sales/${id}`);
};
