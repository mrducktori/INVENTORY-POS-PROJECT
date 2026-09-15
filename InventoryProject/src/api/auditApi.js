// Audit logs API
import { apiCall } from './client.js';

export const getAuditLogs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.user_id) params.append('user_id', filters.user_id);
  if (filters.action) params.append('action', filters.action);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  return apiCall(`/audit?${params.toString()}`);
};

export const createAuditLog = async (log) => {
  return apiCall('/audit', {
    method: 'POST',
    body: JSON.stringify(log)
  });
};
