import express from "express";
import * as purchasingController from "../controllers/purchasingController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Suppliers
router.get("/suppliers", purchasingController.getSuppliers);
router.get("/price-updates", requireAuth, purchasingController.getSupplierPriceUpdates);
router.post("/suppliers", purchasingController.createSupplier);
router.put("/suppliers/:id", purchasingController.updateSupplier);
router.delete("/suppliers/:id", requireAuth, requireRole("Admin", "Owner"), purchasingController.deleteSupplier);

// Purchase Orders
router.get("/", purchasingController.getPurchaseOrders);
router.post("/", purchasingController.createPurchaseOrder);
router.put("/:id/status", purchasingController.updatePurchaseOrderStatus);
router.patch("/:id/status", purchasingController.updatePurchaseOrderStatus);
router.patch("/:id", purchasingController.updatePurchaseOrderStatus);
router.patch("/purchase-orders/:id", purchasingController.updatePurchaseOrderStatus);
router.put("/:id/proposals/respond", requireAuth, purchasingController.respondToSupplierProposal);

// === Supplier Portal Routes ===
// Suppliers can only see their own POs
router.get("/my-orders", requireAuth, requireRole('Supplier'), purchasingController.getSupplierOwnOrders);
// Suppliers can update the status of their own POs (Accept, Decline, To Be Delivered)
router.put("/my-orders/:id/status", requireAuth, requireRole('Supplier'), purchasingController.updateSupplierOrderStatus);
router.patch("/my-orders/:id/status", requireAuth, requireRole('Supplier'), purchasingController.updateSupplierOrderStatus);
router.patch("/my-orders/:id", requireAuth, requireRole('Supplier'), purchasingController.updateSupplierOrderStatus);
// Suppliers submit item-by-item availability, proposed dates, and reasons
router.put("/my-orders/:id/item-responses", requireAuth, requireRole('Supplier'), purchasingController.submitSupplierItemResponses);
// Suppliers can view and update their own catalog pricing
router.get("/my-catalog", requireAuth, requireRole('Supplier'), purchasingController.getSupplierOwnCatalog);
router.put("/my-catalog/prices", requireAuth, requireRole('Supplier'), purchasingController.updateSupplierOwnCatalog);

export default router;
