import express from "express";
import * as recipesService from "../services/recipesService.js";
import { logAudit } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "./analytics.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();
router.use(requireRole("Owner", "Admin", "Staff", "Custom"));

// Writes need the edit permission; 'Products' only lets a user view the page.
const requireRecipeWriteAccess = requirePermission("ManageProducts");

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
router.post("/", requireRecipeWriteAccess, async (req, res) => {
  try {
    const recipe = await recipesService.createRecipe(req.body);
    invalidateAnalyticsCache();
    await logAudit("RECIPE_CREATED", req.user.id, {
      recipe_id: recipe.id,
      product_id: recipe.product_id,
      ingredient_id: recipe.ingredient_id,
      quantity_used: recipe.quantity_used,
      recipe_unit: recipe.recipe_unit,
      ...(recipe.size_name ? { size_name: recipe.size_name } : {}),
      ...(recipe.size_quantities ? { size_quantities: recipe.size_quantities } : {})
    });
    res.status(201).json(recipe);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update recipe
router.put("/:id", requireRecipeWriteAccess, async (req, res) => {
  try {
    const recipe = await recipesService.updateRecipe(req.params.id, req.body);
    invalidateAnalyticsCache();
    await logAudit("RECIPE_UPDATED", req.user.id, {
      recipe_id: recipe.id,
      product_id: recipe.product_id,
      ingredient_id: recipe.ingredient_id,
      quantity_used: recipe.quantity_used,
      recipe_unit: recipe.recipe_unit,
      ...(recipe.size_name ? { size_name: recipe.size_name } : {}),
      ...(recipe.size_quantities ? { size_quantities: recipe.size_quantities } : {})
    });
    res.json(recipe);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete recipe
router.delete("/:id", requireRecipeWriteAccess, async (req, res) => {
  try {
    const result = await recipesService.deleteRecipe(req.params.id);
    invalidateAnalyticsCache();
    await logAudit("RECIPE_DELETED", req.user.id, {
      recipe_id: req.params.id,
      ...(result?.deleted || {})
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
