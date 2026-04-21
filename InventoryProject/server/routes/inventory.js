import express from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { createLimiter, generalLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.get("/ingredients", generalLimiter, inventoryController.getIngredients);
router.get("/ingredients/:id", generalLimiter, inventoryController.getIngredientById);
router.post("/ingredients", createLimiter, inventoryController.createIngredient);
router.put("/ingredients/:id", createLimiter, inventoryController.updateIngredient);
router.delete("/ingredients/:id", createLimiter, inventoryController.deleteIngredient);
router.post("/ingredients/:id/receive", createLimiter, inventoryController.receiveStock);
router.get("/low-stock-alerts", generalLimiter, inventoryController.getLowStockAlerts);
router.put("/ingredients/:id/archive", createLimiter, inventoryController.archiveIngredient);
router.put("/ingredients/:id/restore", createLimiter, inventoryController.restoreIngredient);


export default router;
