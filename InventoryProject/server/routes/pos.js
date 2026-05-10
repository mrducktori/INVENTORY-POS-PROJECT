import express from "express";
import * as posController from "../controllers/posController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route for the landing page visual menu
router.get("/products", posController.getProducts);

// Protected route — only logged-in staff can process sales
router.post("/sale", requireAuth, posController.createSale);

export default router;