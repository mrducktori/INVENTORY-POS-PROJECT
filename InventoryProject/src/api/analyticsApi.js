import { apiCall } from './client.js';

/**
 * Fetches predictive inventory depletion data from the backend.
 */
export const getInventoryDepletion = async () => {
  return apiCall('/analytics/inventory-depletion', { method: 'GET' });
};

export const getDemandForecast = async () => {
  return apiCall('/analytics/demand-forecast', { method: 'GET' });
};
