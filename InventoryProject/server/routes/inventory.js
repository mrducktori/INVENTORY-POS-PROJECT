import express from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireRole("Owner", "Admin", "Staff", "Custom"));

router.get("/ingredients", inventoryController.getIngredients);
router.get("/ingredients/:id", inventoryController.getIngredientById);
router.post("/ingredients", inventoryController.createIngredient);
router.put("/ingredients/:id", inventoryController.updateIngredient);
router.delete("/ingredients/:id", inventoryController.deleteIngredient);
router.post("/ingredients/:id/receive", inventoryController.receiveStock);
router.get("/low-stock-alerts", inventoryController.getLowStockAlerts);
router.get("/alerts", inventoryController.getLowStockAlerts);
router.put("/ingredients/:id/archive", inventoryController.archiveIngredient);
router.put("/ingredients/:id/restore", inventoryController.restoreIngredient);


export default router;
