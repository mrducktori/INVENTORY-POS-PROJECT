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

export async function updateSupplier(id, supplierData) {
  return apiCall(`/purchasing/suppliers/${id}`, {
    method: "PUT",
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

export async function updatePurchaseOrderStatus(id, status, items_received = []) {
  return apiCall(`/purchasing/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, items_received })
  });
}

// === Supplier Portal ===
export async function getSupplierOwnOrders() {
  return apiCall("/purchasing/my-orders", {
    method: "GET"
  });
}

export async function updateSupplierOrderStatus(id, status, expected_date = null) {
  return apiCall(`/purchasing/my-orders/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, expected_date })
  });
}

export async function submitSupplierItemResponses(id, items) {
  return apiCall(`/purchasing/my-orders/${id}/item-responses`, {
    method: "PUT",
    body: JSON.stringify({ items })
  });
}

export async function respondToSupplierProposal(id, itemId, decision, splitIntoBackorder = true) {
  return apiCall(`/purchasing/${id}/proposals/respond`, {
    method: "PUT",
    body: JSON.stringify({ item_id: itemId, decision, split_into_backorder: splitIntoBackorder })
  });
}

