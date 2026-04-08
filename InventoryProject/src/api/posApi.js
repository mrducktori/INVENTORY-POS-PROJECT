// Point of Sale API endpoints
import { apiCall } from "./client.js";

/**
 * Fetch all available products
 * @returns {Promise<Array>} Array of product objects
 */
export async function getProducts() {
  return apiCall("/pos/products", {
    method: "GET"
  });
}

/**
 * Create a new sale/transaction
 * @param {Object} saleData Sale information (items, total, etc.)
 * @returns {Promise<Object>} Sale confirmation object
 */
export async function createSale(saleData) {
  return apiCall("/pos/sale", {
    method: "POST",
    body: JSON.stringify(saleData)
  });
}

/**
 * Get inventory items (if available)
 * @returns {Promise<Array>} Array of inventory items
 */
export async function getInventory() {
  return apiCall("/pos/inventory", {
    method: "GET"
  });
}

/**
 * Update inventory item quantity
 * @param {string} itemId Product ID
 * @param {number} quantity New quantity
 * @returns {Promise<Object>} Updated item object
 */
export async function updateInventory(itemId, quantity) {
  return apiCall("/pos/inventory", {
    method: "PUT",
    body: JSON.stringify({ itemId, quantity })
  });
}
