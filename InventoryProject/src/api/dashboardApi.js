import { apiCall } from './client.js';

const inFlightRequests = new Map();

export const getDashboardStats = async (period = 'day', startDate = '', endDate = '') => {
  const params = new URLSearchParams();
  if (period) params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const queryKey = params.toString();

  // Share one in-flight request between simultaneous callers (Navbar and DashboardOverview on load).
  if (inFlightRequests.has(queryKey)) {
    return inFlightRequests.get(queryKey);
  }

  const reqPromise = apiCall(`/dashboard/stats?${queryKey}`).finally(() => {
    inFlightRequests.delete(queryKey);
  });

  inFlightRequests.set(queryKey, reqPromise);
  return reqPromise;
};
