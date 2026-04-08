import express from "express";
import { getProducts, createSale } from "../services/posService.js";

const router = express.Router();

router.get("/products", async (req, res) => {
  try {
    const data = await getProducts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sale", async (req, res) => {
  try {
    const sale = await createSale(req.body);
    res.json({ message: "Sale completed", sale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;