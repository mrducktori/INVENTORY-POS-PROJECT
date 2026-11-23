import { apiCall } from "./client.js";

export async function getSalesReceipt(saleId) {
  return apiCall(`/sales/${saleId}`, {
    method: "GET"
  });
}

export async function getDailySalesSummary(date) {
  return apiCall(`/sales/summary/report?period=daily&date=${date}`, {
    method: "GET"
  });
}

export async function getSalesReportByPeriod(startDate, endDate, period = 'daily', year = null) {
  const params = new URLSearchParams({ period });
  if (period === 'custom' && startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  }
  if (period === 'yearly' && year) {
    params.set('year', String(year));
  }
  return apiCall(`/sales/summary/report?${params.toString()}`, {
    method: "GET"
  });
}
