// Dashboard stats API - aggregates from existing tables
import { apiCall } from './client.js';

export const getDashboardStats = async () => {
  return apiCall('/dashboard/stats');
};
