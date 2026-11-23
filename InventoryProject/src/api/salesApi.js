// Sales & transaction log API
import { apiCall } from './client.js';

export const getSales = async (filters = {}, pageSize = 50, page = 1) => {
  const params = new URLSearchParams();
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.category) params.append('category', filters.category);
  if (filters.staff_id) params.append('staff_id', filters.staff_id);
  if (filters.period) params.append('period', filters.period);
  if (filters.year) params.append('year', String(filters.year));
  if (filters.payment_method && filters.payment_method !== 'ALL') {
    params.append('payment_method', filters.payment_method);
  }
  if (filters.discounted) {
    params.append('discounted', 'true');
  }
  if (filters.search && filters.search.trim()) {
    params.append('search', filters.search.trim());
  }
  if (filters.skip_count) {
    params.append('skip_count', 'true');
  }
  // pagination parameters
  const offset = pageSize === 'all' ? 0 : (page - 1) * pageSize;
  params.append('limit', pageSize);
  params.append('offset', offset);
  return apiCall(`/sales?${params.toString()}`);
};

export const getSalesSummary = async (period = 'day') => {
  return apiCall(`/sales/summary?period=${period}`);
};

export const getSaleById = async (id) => {
  return apiCall(`/sales/${id}`);
};
