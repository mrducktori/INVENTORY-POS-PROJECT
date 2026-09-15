import express from "express";
import * as purchasingController from "../controllers/purchasingController.js";

const router = express.Router();

// Suppliers
router.get("/suppliers", purchasingController.getSuppliers);
router.post("/suppliers", purchasingController.createSupplier);

// Purchase Orders
router.get("/", purchasingController.getPurchaseOrders);
router.post("/", purchasingController.createPurchaseOrder);
router.put("/:id/status", purchasingController.updatePurchaseOrderStatus);

export default router;
