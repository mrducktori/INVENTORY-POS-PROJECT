import express from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireRole("Owner", "Admin", "Staff", "Custom"));

router.get("/ingredients", inventoryController.getIngredients);
router.get("/ingredients/:id", inventoryController.getIngredientById);
router.post("/ingredients", inventoryController.createIngredient);
router.put("/ingredients/:id", inventoryController.updateIngredient);
router.delete("/ingredients/:id", requireRole("Owner", "Admin"), inventoryController.deleteIngredient);
router.post("/ingredients/:id/receive", inventoryController.receiveStock);
router.get("/low-stock-alerts", inventoryController.getLowStockAlerts);
router.get("/alerts", inventoryController.getLowStockAlerts);
router.put("/ingredients/:id/archive", inventoryController.archiveIngredient);
router.put("/ingredients/:id/restore", inventoryController.restoreIngredient);

// Batch tracking, expiration alerts, stocktake & OCR scanning
router.get("/batches", inventoryController.getBatches);
router.get("/expiry-alerts", inventoryController.getExpiryAlerts);
router.get("/stocktake", inventoryController.getStocktakeHistory);
router.post("/stocktake", requireRole("Owner", "Admin", "Custom"), inventoryController.performStocktake);
router.post("/ocr-scan", inventoryController.scanOcrDocument);

// Raw material category management
router.get("/categories", inventoryController.getCategories);
router.post("/categories", requireRole("Owner", "Admin", "Custom"), inventoryController.createCategory);
router.put("/categories/:name", requireRole("Owner", "Admin", "Custom"), inventoryController.renameCategory);
router.delete("/categories/:name", requireRole("Owner", "Admin", "Custom"), inventoryController.deleteCategory);

export default router;
