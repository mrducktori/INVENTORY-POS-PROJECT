import express from "express";
import * as inventoryService from "../services/inventoryService.js";

const router = express.Router();

// Get all ingredients
router.get("/ingredients", async (req, res) => {
  try {
    const ingredients = await inventoryService.getIngredients();
    res.json(ingredients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single ingredient
router.get("/ingredients/:id", async (req, res) => {
  try {
    const ingredient = await inventoryService.getIngredientById(req.params.id);
    res.json(ingredient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create ingredient
router.post("/ingredients", async (req, res) => {
  try {
    const ingredient = await inventoryService.createIngredient(req.body);
    res.status(201).json(ingredient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update ingredient
router.put("/ingredients/:id", async (req, res) => {
  try {
    const ingredient = await inventoryService.updateIngredient(req.params.id, req.body);
    res.json(ingredient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete ingredient
router.delete("/ingredients/:id", async (req, res) => {
  try {
    await inventoryService.deleteIngredient(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receive stock
router.post("/ingredients/:id/receive", async (req, res) => {
  try {
    const { quantity } = req.body;
    const ingredient = await inventoryService.receiveStock(req.params.id, quantity);
    res.json(ingredient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get low stock alerts
router.get("/low-stock-alerts", async (req, res) => {
  try {
    const alerts = await inventoryService.getLowStockAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
