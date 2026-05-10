// Reports Module — Centralized API helpers
import { apiCall } from './client.js';

/**
 * Sales Performance Report
 * period: 'daily' | 'weekly' | 'monthly'
 */
export const getSalesPerformanceReport = async (period = 'daily', startDate = '', endDate = '') => {
  let url = `/sales/summary/report?period=${period}`;
  if (period === 'custom' && startDate && endDate) {
    url += `&start_date=${startDate}&end_date=${endDate}`;
  }
  return apiCall(url, { method: 'GET' });
};

/**
 * Sales data filtered by date (used for custom date filtering)
 */
export const getSalesForPeriod = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.date) params.append('date', filters.date);
  if (filters.period) params.append('period', filters.period);
  if (filters.staff_id) params.append('staff_id', filters.staff_id);
  return apiCall(`/sales?${params.toString()}`, { method: 'GET' });
};

/**
 * Top products by sales volume — uses analytics endpoint
 */
export const getTopProductsReport = async () => {
  return apiCall('/analytics/demand-forecast', { method: 'GET' });
};

/**
 * Inventory Status Report — all ingredients with stock details
 */
export const getInventoryStatusReport = async () => {
  return apiCall('/inventory/ingredients', { method: 'GET' });
};

/**
 * Low stock alerts
 */
export const getLowStockReport = async () => {
  return apiCall('/inventory/low-stock-alerts', { method: 'GET' });
};

/**
 * Wastage Report — filterable by date range
 */
export const getWastageReport = async (startDate = '', endDate = '') => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return apiCall(`/wastage?${params.toString()}`, { method: 'GET' });
};

/**
 * Wastage Stats
 */
export const getWastageStats = async () => {
  return apiCall('/wastage/stats', { method: 'GET' });
};

/**
 * Stock Movement — uses sales summary to approximate consumed stock
 */
export const getStockMovementData = async (period = 'weekly') => {
  return apiCall(`/sales/summary/report?period=${period}`, { method: 'GET' });
};

/**
 * Audit logs for stock-receive events
 */
export const getAuditLogs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.action) params.append('action', filters.action);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  return apiCall(`/audit?${params.toString()}`, { method: 'GET' });
};
