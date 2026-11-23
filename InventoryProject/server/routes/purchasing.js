import express from "express";
import * as purchasingController from "../controllers/purchasingController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();
const requireCafeRole = requireRole("Owner", "Admin", "Staff", "Custom");

// Suppliers
router.get("/suppliers", requireAuth, requireCafeRole, purchasingController.getSuppliers);
router.get("/price-updates", requireAuth, requireCafeRole, purchasingController.getSupplierPriceUpdates);
router.post("/suppliers", requireAuth, requireCafeRole, requirePermission("ManageSuppliers"), purchasingController.createSupplier);
router.post("/suppliers/:id/acknowledge-prices", requireAuth, requireRole("Owner", "Admin", "Custom"), requirePermission("ManageSuppliers"), purchasingController.acknowledgeSupplierPriceUpdates);
router.put("/suppliers/:id", requireAuth, requireCafeRole, requirePermission("ManageSuppliers"), purchasingController.updateSupplier);
router.put("/suppliers/:id/archive", requireAuth, requireRole("Owner", "Admin", "Custom"), requirePermission("ManageSuppliers"), purchasingController.archiveSupplier);
router.put("/suppliers/:id/restore", requireAuth, requireRole("Owner", "Admin", "Custom"), requirePermission("ManageSuppliers"), purchasingController.restoreSupplier);
router.delete("/suppliers/:id", requireAuth, requireRole("Admin", "Owner"), purchasingController.deleteSupplier);

// Purchase Orders
router.get("/", requireAuth, requireCafeRole, purchasingController.getPurchaseOrders);
router.post("/", requireAuth, requireCafeRole, requirePermission("PurchaseOrders", "Forecasting"), purchasingController.createPurchaseOrder);
router.put("/:id/status", requireAuth, requireCafeRole, requirePermission("PurchaseOrders"), purchasingController.updatePurchaseOrderStatus);
router.patch("/:id/status", requireAuth, requireCafeRole, requirePermission("PurchaseOrders"), purchasingController.updatePurchaseOrderStatus);
router.patch("/:id", requireAuth, requireCafeRole, requirePermission("PurchaseOrders"), purchasingController.updatePurchaseOrderStatus);
router.patch("/purchase-orders/:id", requireAuth, requireCafeRole, requirePermission("PurchaseOrders"), purchasingController.updatePurchaseOrderStatus);
router.put("/:id/proposals/respond", requireAuth, requireCafeRole, requirePermission("PurchaseOrders"), purchasingController.respondToSupplierProposal);

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
