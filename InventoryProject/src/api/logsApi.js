import { apiCall } from "./client.js";
import { getSalesPerformanceReport } from "./reportsApi.js";

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
  return getSalesPerformanceReport(period, startDate, endDate, year);
}
