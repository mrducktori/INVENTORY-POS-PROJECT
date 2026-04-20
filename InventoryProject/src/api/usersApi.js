// Users and employee tracking API
import { apiCall } from './client.js';

export const getUsers = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.role) params.append('role', filters.role);
  if (filters.status) params.append('status', filters.status);
  return apiCall(`/users?${params.toString()}`);
};

export const createUser = async (user) => {
  return apiCall('/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
};

export const updateUser = async (id, userData) => {
  return apiCall(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData)
  });
};

export const updateUserStatus = async (id, status) => {
  return apiCall(`/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
};

export const getEmployeeShifts = async (date) => {
  const params = date ? `?date=${date}` : '';
  return apiCall(`/users/shifts${params}`);
};
