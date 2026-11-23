// Point of Sale API endpoints
import { apiCall } from "./client.js";

/**
 * Fetch all available products (public landing page)
 * @returns {Promise<Array>} Array of product objects
 */
export async function getProducts() {
  return apiCall("/pos/products", {
    method: "GET"
  });
}

/**
 * Fetch full authenticated POS catalog (products, recipes, ingredients)
 * @returns {Promise<{ products: Array, recipes: Array, ingredients: Array }>}
 */
export async function getPosCatalog() {
  return apiCall("/pos/catalog", {
    method: "GET"
  });
}

/**
 * Create a new sale/transaction
 * @param {Object} saleData Sale information (items, total, etc.)
 * @returns {Promise<Object>} Sale confirmation object
 */
export async function createSale(saleData) {
  try {
    return await apiCall("/pos/sale", {
      method: "POST",
      body: JSON.stringify(saleData)
    });
  } catch (err) {
    if (err?.message?.startsWith("Network problem.")) {
      throw new Error("Network problem. Check the connection and tap Pay again — the same receipt will be used.", { cause: err });
    }
    throw err;
  }
}

export async function createPaymentIntent({ provider, amount }) {
  return apiCall("/pos/payment-intent", {
    method: "POST",
    body: JSON.stringify({ provider, amount })
  });
}

export async function voidOrRefundSale(saleId, payload) {
  return apiCall(`/pos/sales/${encodeURIComponent(saleId)}/void`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getManagerPinStatus() {
  return apiCall("/pos/pins", {
    method: "GET"
  });
}

export async function setManagerPin(payload) {
  return apiCall("/pos/pin", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getPosSettings() {
  return apiCall("/pos/settings", {
    method: "GET"
  });
}

export async function updatePosSettings(payload) {
  return apiCall("/pos/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function getCurrentShift() {
  return apiCall("/pos/shifts/current", {
    method: "GET"
  });
}

export async function openShift(payload) {
  return apiCall("/pos/shifts/open", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getXReading(shiftId = "") {
  const query = shiftId ? `?shift_id=${encodeURIComponent(shiftId)}` : "";
  return apiCall(`/pos/shifts/x-reading${query}`, {
    method: "GET"
  });
}

export async function closeShiftZReading(payload) {
  return apiCall("/pos/shifts/close-z", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getShiftHistory() {
  return apiCall("/pos/shifts/history", {
    method: "GET"
  });
}

export async function getKdsQueue({ station = "ALL", includeServed = false } = {}) {
  const params = new URLSearchParams();
  if (station && station !== "ALL") params.append("station", station);
  if (includeServed) params.append("include_served", "true");
  const qs = params.toString();
  return apiCall(`/pos/kds${qs ? `?${qs}` : ""}`, {
    method: "GET"
  });
}

export async function updateKdsTicketStatus(ticketId, status) {
  return apiCall(`/pos/kds/${encodeURIComponent(ticketId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

/**
 * Get inventory items (raw materials)
 * @returns {Promise<Array>} Array of inventory items
 */
export async function getInventory() {
  return apiCall("/inventory/ingredients", {
    method: "GET"
  });
}

/**
 * Receive/add inventory item quantity
 * @param {string} itemId Ingredient ID
 * @param {number} quantity Quantity to add
 * @returns {Promise<Object>} Updated item object
 */
export async function updateInventory(itemId, quantity) {
  return apiCall(`/inventory/ingredients/${itemId}/receive`, {
    method: "POST",
    body: JSON.stringify({ quantity })
  });
}

/** Straw-type extra supplies for the quick action */
export async function getExtraSupplies() {
  return apiCall("/pos/extra-supplies", { method: "GET" });
}

/** Give one extra supply (not a sale) */
export async function useExtraSupply({ ingredient_id, quantity = 1, note }) {
  return apiCall("/pos/extra-supplies/use", {
    method: "POST",
    body: JSON.stringify({ ingredient_id, quantity, note })
  });
}
