import express from "express";
import * as wastageService from "../services/wastageService.js";
import { createLimiter, generalLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Report wastage
router.post("/", createLimiter, async (req, res) => {
  try {
    const wastage = await wastageService.reportWastage(req.body);
    res.status(201).json(wastage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wastage history with filters
router.get("/", generalLimiter, async (req, res) => {
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
router.get("/stats", generalLimiter, async (req, res) => {
  try {
    const stats = await wastageService.getWastageStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
