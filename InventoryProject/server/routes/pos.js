import express from "express";
import * as posController from "../controllers/posController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();
// Role alone is not enough: a Custom user must also hold the POS page permission.
const requireCafeRole = [requireRole("Owner", "Admin", "Staff", "Custom"), requirePermission("POS")];

// Public route for the landing page visual menu
router.get("/products", posController.getProducts);

// Protected routes — only logged-in cafe staff/admins can access full POS catalog or process sales
router.get("/catalog", requireAuth, requireCafeRole, posController.getPosCatalog);
router.post("/sale", requireAuth, requireCafeRole, posController.createSale);
router.post("/payment-intent", requireAuth, requireCafeRole, posController.createPaymentIntent);

// Store POS Settings (Promos, Discount Presets, E-Wallet QR Accounts, Take-Out Packaging)
router.get("/settings", requireAuth, requireCafeRole, posController.getPosSettings);
router.put("/settings", requireAuth, requireRole("Owner", "Admin"), posController.updatePosSettings);

// Void / Return / Refund & Manager PIN Management
router.post("/sales/:id/void", requireAuth, requireCafeRole, posController.voidOrRefundSale);
router.get("/pins", requireAuth, requireRole("Owner", "Admin"), posController.getManagerPinStatus);
router.post("/pin", requireAuth, requireRole("Owner", "Admin"), posController.setManagerPin);

// Shift Management (X-Reading & Z-Reading)
router.get("/shifts/current", requireAuth, requireCafeRole, posController.getCurrentShift);
router.post("/shifts/open", requireAuth, requireCafeRole, posController.openShift);
router.get("/shifts/x-reading", requireAuth, requireCafeRole, posController.getXReading);
router.post("/shifts/close-z", requireAuth, requireCafeRole, posController.closeShiftZReading);
router.get("/shifts/history", requireAuth, requireCafeRole, posController.getShiftHistory);

// Extra supplies (e.g. replacement straw): stock-only, not part of a sale
router.get("/extra-supplies", requireAuth, requireCafeRole, posController.getExtraSupplies);
router.post("/extra-supplies/use", requireAuth, requireCafeRole, posController.useExtraSupply);

// Kitchen / Barista Display System (KDS)
router.get("/kds", requireAuth, requireCafeRole, posController.getKdsQueue);
router.put("/kds/:id/status", requireAuth, requireCafeRole, posController.updateKdsTicketStatus);
router.patch("/kds/:id/status", requireAuth, requireCafeRole, posController.updateKdsTicketStatus);

export default router;