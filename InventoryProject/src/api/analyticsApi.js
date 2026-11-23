import { apiCall } from './client.js';

export const getDemandForecast = async (refresh = false) => {
  return apiCall(`/analytics/demand-forecast${refresh ? '?refresh=true' : ''}`, { method: 'GET' });
};

/**
 * Fetches real ingredient depletion forecasts, burn rates, and restock PO recommendations.
 */
export const getIngredientDepletionForecast = async (refresh = false) => {
  return apiCall(`/analytics/ingredient-forecast${refresh ? '?refresh=true' : ''}`, { method: 'GET' });
};

/**
 * Requests an AI-driven stock and demand forecast for a target product and month.
 * Adapted from classmate's AI_API_StockForecastingService architecture.
 * @param {Object} param0 - { productId, year, month }
 */
export const getAIForecast = async ({ productId, year, month }) => {
  return apiCall('/analytics/ai-forecast', {
    method: 'POST',
    body: JSON.stringify({ productId, year, month })
  });
};

