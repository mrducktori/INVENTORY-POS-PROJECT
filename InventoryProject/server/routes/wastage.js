import express from "express";
import * as wastageService from "../services/wastageService.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();
router.use(requireRole("Owner", "Admin", "Staff", "Custom"));

// Report wastage
router.post("/", requirePermission("ReportWastage"), async (req, res) => {
  try {
    const wastage = await wastageService.reportWastage({
      ...req.body,
      reported_by: req.user.id,
    });
    res.status(201).json(wastage);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get wastage history with filters
router.get("/", requirePermission("ReportWastage", "Reports"), async (req, res) => {
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
router.get("/stats", requirePermission("ReportWastage", "Reports"), async (req, res) => {
  try {
    const stats = await wastageService.getWastageStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
