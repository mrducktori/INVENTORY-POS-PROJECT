import express from "express";
import * as requestsService from "../services/requestsService.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireRole("Owner", "Admin", "Staff", "Custom"));

// Create request
router.post("/", async (req, res) => {
  try {
    const request = await requestsService.createRequest({
      ...req.body,
      requested_by: req.user.id
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get requests with filters
router.get("/", async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      requested_by: req.query.requested_by
    };

    const requests = await requestsService.getRequests(filters);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending requests
router.get("/pending", async (req, res) => {
  try {
    const pending = await requestsService.getPendingRequests();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get request statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await requestsService.getRequestStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update request status
router.put("/:id/status", requireRole("Owner", "Admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const request = await requestsService.updateRequestStatus(req.params.id, status, req.user.id);
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
