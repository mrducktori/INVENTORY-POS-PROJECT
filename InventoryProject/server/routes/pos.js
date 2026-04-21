import express from "express";
import * as posController from "../controllers/posController.js";
import { createLimiter, generalLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.get("/products", generalLimiter, posController.getProducts);
router.post("/sale", createLimiter, posController.createSale);

export default router;