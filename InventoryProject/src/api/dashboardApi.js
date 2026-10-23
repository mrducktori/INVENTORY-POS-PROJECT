// Dashboard stats API - aggregates from existing tables
import { apiCall } from './client.js';

export const getDashboardStats = async (period = 'day', startDate = '', endDate = '') => {
  const params = new URLSearchParams();
  if (period) params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return apiCall(`/dashboard/stats?${params.toString()}`);
};
