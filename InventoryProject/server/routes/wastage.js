import express from "express";
import * as wastageService from "../services/wastageService.js";

const router = express.Router();

// Report wastage
router.post("/", async (req, res) => {
  try {
    const wastage = await wastageService.reportWastage({
      ...req.body,
      reported_by: req.user?.id || req.body?.reported_by || null,
    });
    res.status(201).json(wastage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wastage history with filters
router.get("/", async (req, res) => {
  try {
    const filters = {
      ingredient_id: req.query.ingredient_id,
      reported_by: req.query.reported_by,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const wastage = await wastageService.getWastageHistory(filters);
    res.json(wastage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wastage statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await wastageService.getWastageStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
