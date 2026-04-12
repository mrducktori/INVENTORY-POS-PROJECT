import express from "express";
import * as recipesService from "../services/recipesService.js";

const router = express.Router();

// Get all recipes
router.get("/", async (req, res) => {
  try {
    const recipes = await recipesService.getRecipes();
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recipes for a product
router.get("/product/:product_id", async (req, res) => {
  try {
    const recipes = await recipesService.getRecipesByProduct(req.params.product_id);
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create recipe
router.post("/", async (req, res) => {
  try {
    const recipe = await recipesService.createRecipe(req.body);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update recipe
router.put("/:id", async (req, res) => {
  try {
    const recipe = await recipesService.updateRecipe(req.params.id, req.body);
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete recipe
router.delete("/:id", async (req, res) => {
  try {
    await recipesService.deleteRecipe(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
