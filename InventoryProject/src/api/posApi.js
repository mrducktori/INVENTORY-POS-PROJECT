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
  return apiCall("/pos/sale", {
    method: "POST",
    body: JSON.stringify(saleData)
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
