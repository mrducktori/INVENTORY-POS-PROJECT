import express from "express";
import * as requestsService from "../services/requestsService.js";
import { createLimiter, generalLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Create request
router.post("/", createLimiter, async (req, res) => {
  try {
    const request = await requestsService.createRequest(req.body);
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get requests with filters
router.get("/", generalLimiter, async (req, res) => {
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
router.get("/pending", generalLimiter, async (req, res) => {
  try {
    const pending = await requestsService.getPendingRequests();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get request statistics
router.get("/stats", generalLimiter, async (req, res) => {
  try {
    const stats = await requestsService.getRequestStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update request status
router.put("/:id/status", createLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    const request = await requestsService.updateRequestStatus(req.params.id, status);
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
