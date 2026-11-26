import { apiCall } from './client.js';
import { getCurrentUser } from '../utils/authUtils.js';

const getActorId = () => getCurrentUser()?.id || null;

export const getUsers = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.role) params.append('role', filters.role);
  if (filters.status) params.append('status', filters.status);
  return apiCall(`/users?${params.toString()}`);
};

export const createUser = async (user) => {
  return apiCall('/users', {
    method: 'POST',
    body: JSON.stringify({ ...user, created_by: getActorId() })
  });
};

export const updateUser = async (id, userData) => {
  return apiCall(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...userData, updated_by: getActorId() })
  });
};

export const updateUserStatus = async (id, status, confirmPassword) => {
  return apiCall(`/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, changed_by: getActorId(), confirm_password: confirmPassword })
  });
};

export const deleteUser = async (id, confirmPassword) => {
  return apiCall(`/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm_password: confirmPassword })
  });
};

export const saveNavPrefs = async (hiddenSections) => {
  return apiCall('/users/me/nav-prefs', {
    method: 'PUT',
    body: JSON.stringify({ hidden_nav_sections: hiddenSections })
  });
};

export const getEmployeeShifts = async (date) => {
  const params = date ? `?date=${date}` : '';
  return apiCall(`/users/shifts${params}`);
};
