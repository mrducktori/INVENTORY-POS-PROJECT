import { apiCall } from "./client.js";

// === Suppliers ===
export async function getSuppliers() {
  return apiCall("/purchasing/suppliers", {
    method: "GET"
  });
}

export async function createSupplier(supplierData) {
  return apiCall("/purchasing/suppliers", {
    method: "POST",
    body: JSON.stringify(supplierData)
  });
}

// === Purchase Orders ===
export async function getPurchaseOrders() {
  return apiCall("/purchasing", {
    method: "GET"
  });
}

export async function createPurchaseOrder(poData) {
  return apiCall("/purchasing", {
    method: "POST",
    body: JSON.stringify(poData)
  });
}

export async function updatePurchaseOrderStatus(id, status) {
  return apiCall(`/purchasing/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}
