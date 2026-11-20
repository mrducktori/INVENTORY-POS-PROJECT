import express from "express";
import * as posController from "../controllers/posController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route for the landing page visual menu
router.get("/products", posController.getProducts);

// Protected routes — only logged-in cafe staff/admins can access full POS catalog or process sales
router.get("/catalog", requireAuth, requireRole("Owner", "Admin", "Staff", "Custom"), posController.getPosCatalog);
router.post("/sale", requireAuth, requireRole("Owner", "Admin", "Staff", "Custom"), posController.createSale);

export default router;