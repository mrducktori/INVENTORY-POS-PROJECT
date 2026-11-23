import { apiCall } from './client.js';

/** Sales forecast for every product (the single forecast engine). */
export const getForecast = async (horizon = 14) => {
  return apiCall(`/analytics/forecast?horizon=${encodeURIComponent(horizon)}`, { method: 'GET' });
};

/** Owner/Admin: re-run the end-of-day rollup and explanations now. */
export const refreshForecast = async () => {
  return apiCall('/analytics/forecast/refresh', { method: 'POST' });
};

export const getSpecialDates = async () => apiCall('/analytics/special-dates', { method: 'GET' });

export const createSpecialDate = async (payload) =>
  apiCall('/analytics/special-dates', { method: 'POST', body: JSON.stringify(payload) });

export const deleteSpecialDate = async (id) =>
  apiCall(`/analytics/special-dates/${encodeURIComponent(id)}`, { method: 'DELETE' });
