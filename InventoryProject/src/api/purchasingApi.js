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

export async function deleteSupplier(id) {
  return apiCall(`/purchasing/suppliers/${id}`, {
    method: "DELETE"
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

export async function updatePurchaseOrderStatus(id, status, items_received = [], expected_date = null, reason = null) {
  return apiCall(`/purchasing/purchase-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ 
      status, 
      items_received, 
      expected_date, 
      reason,
      declineReason: reason, 
      decline_reason: reason,
      cancellationReason: reason,
      cancellation_reason: reason
    })
  });
}

export async function reschedulePurchaseOrder(id, newExpectedDate, reason = null) {
  return apiCall(`/purchasing/purchase-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      expected_date: newExpectedDate,
      reschedule_reason: reason,
      reason
    })
  });
}

export async function patchPurchaseOrder(id, payload) {
  return apiCall(`/purchasing/purchase-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

// === Supplier Portal ===
export async function getSupplierOwnOrders() {
  return apiCall("/purchasing/my-orders", {
    method: "GET"
  });
}

export async function updateSupplierOrderStatus(id, status, expected_date = null, declineReason = null) {
  return apiCall(`/purchasing/purchase-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ 
      status, 
      expected_date, 
      declineReason, 
      decline_reason: declineReason 
    })
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


export async function getSupplierOwnCatalog() {
  return apiCall("/purchasing/my-catalog", {
    method: "GET"
  });
}

export async function updateSupplierOwnCatalog(items) {
  return apiCall("/purchasing/my-catalog/prices", {
    method: "PUT",
    body: JSON.stringify({ items })
  });
}
