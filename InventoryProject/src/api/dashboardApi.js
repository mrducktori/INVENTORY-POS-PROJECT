// Dashboard stats API - aggregates from existing tables
import { apiCall } from './client.js';

export const getDashboardStats = async (period = 'day') => {
  return apiCall(`/dashboard/stats?period=${period}`);
};
