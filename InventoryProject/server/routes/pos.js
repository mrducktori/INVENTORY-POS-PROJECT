import express from "express";
import * as posController from "../controllers/posController.js";

const router = express.Router();

router.get("/products", posController.getProducts);
router.post("/sale", posController.createSale);

export default router;