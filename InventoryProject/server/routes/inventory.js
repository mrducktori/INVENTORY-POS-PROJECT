import express from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();
router.use(requireRole("Owner", "Admin", "Staff", "Custom"));

router.get("/ingredients", inventoryController.getIngredients);
router.get("/ingredients/:id", inventoryController.getIngredientById);
router.post("/ingredients", requirePermission("ManageRawMaterials"), inventoryController.createIngredient);
router.put("/ingredients/:id", requirePermission("ManageRawMaterials"), inventoryController.updateIngredient);
router.delete("/ingredients/:id", requireRole("Owner", "Admin"), inventoryController.deleteIngredient);
router.post("/ingredients/:id/receive", requirePermission("StockReceived"), inventoryController.receiveStock);
router.get("/low-stock-alerts", inventoryController.getLowStockAlerts);
router.get("/alerts", inventoryController.getLowStockAlerts);
router.put("/ingredients/:id/archive", requirePermission("ManageRawMaterials"), inventoryController.archiveIngredient);
router.put("/ingredients/:id/restore", requirePermission("ManageRawMaterials"), inventoryController.restoreIngredient);

// Batch tracking, expiration alerts, stocktake & OCR scanning
router.get("/batches", inventoryController.getBatches);
router.get("/expiry-alerts", inventoryController.getExpiryAlerts);
router.get("/stocktake", inventoryController.getStocktakeHistory);
router.post("/stocktake", requireRole("Owner", "Admin", "Custom"), requirePermission("RawMaterialTracker"), inventoryController.performStocktake);
router.post("/ocr-scan", requireRole("Owner", "Admin", "Custom"), requirePermission("StockReceived", "PurchaseOrders"), inventoryController.scanOcrDocument);

// Raw material category management
router.get("/categories", inventoryController.getCategories);
router.post("/categories", requireRole("Owner", "Admin", "Custom"), requirePermission("ManageRawMaterials"), inventoryController.createCategory);
router.put("/categories/:name", requireRole("Owner", "Admin", "Custom"), requirePermission("ManageRawMaterials"), inventoryController.renameCategory);
router.delete("/categories/:name", requireRole("Owner", "Admin", "Custom"), requirePermission("ManageRawMaterials"), inventoryController.deleteCategory);

export default router;
