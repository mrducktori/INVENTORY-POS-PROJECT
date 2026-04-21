import { apiCall } from './client.js';

export const createRequest = async (request) => {
  return apiCall('/requests', {
    method: 'POST',
    body: JSON.stringify(request)
  });
};

export const getRequests = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.type) params.append('type', filters.type);
  if (filters.requested_by) params.append('requested_by', filters.requested_by);
  return apiCall(`/requests?${params.toString()}`, { method: 'GET' });
};

export const getPendingRequests = async () => {
  return apiCall('/requests/pending', { method: 'GET' });
};

export const getRequestStats = async () => {
  return apiCall('/requests/stats', { method: 'GET' });
};

export const updateRequestStatus = async (id, status) => {
  return apiCall(`/requests/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
};
