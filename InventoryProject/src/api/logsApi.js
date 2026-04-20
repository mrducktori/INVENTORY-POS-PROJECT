import { apiCall } from "./client.js";

export async function getSalesReceipt(saleId) {
  return apiCall(`/sales/${saleId}`, {
    method: "GET"
  });
}

export async function getAuditLogs(filters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('start_date', filters.startDate);
  if (filters.endDate) queryParams.append('end_date', filters.endDate);
  if (filters.user_id) queryParams.append('user_id', filters.user_id);
  if (filters.actionType) queryParams.append('action', filters.actionType);

  return apiCall(`/audit?${queryParams.toString()}`, {
    method: "GET"
  });
}

export async function getDailySalesSummary(date) {
  return apiCall(`/sales/summary/report?period=daily&date=${date}`, {
    method: "GET"
  });
}

export async function getSalesReportByPeriod(startDate, endDate, period = 'daily') {
  return apiCall(`/sales/summary/report?period=${period}`, {
    method: "GET"
  });
}

export async function logAuditActivity(action_type, entity_type, entity_id, details) {
  return apiCall('/audit', {
    method: "POST",
    body: JSON.stringify({ action: action_type, action_type, entity_type, entity_id, details })
  });
}
