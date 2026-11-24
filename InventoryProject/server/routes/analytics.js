import express from 'express';
import { requireRole } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import * as forecastService from '../services/forecastService.js';

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));
router.use(requirePermission('Dashboard', 'Forecasting', 'Reports'));

// Kept so the many stock/recipe/product writers can still call it. The forecast reads the
// end-of-day rollup (not live stock), so there is nothing to clear; forecastService refreshes
// its own cache after a close or void.
// shortcut: no-op, remove it and its ~30 call sites when those files are next touched.
export function invalidateAnalyticsCache() {}

// One engine serves both the list and the product detail (services/forecastService.js).
router.get('/forecast', async (req, res) => {
  try {
    res.json(await forecastService.getForecastOverview({ horizon: req.query.horizon }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Re-run the end-of-day rollup + explanations now (e.g. after importing old sales).
router.post('/forecast/refresh', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    await forecastService.ensureDailySummary({ force: true });
    res.json(await forecastService.generateNightlyInsights({ force: true }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Owner-entered special dates (exam week, school break...) that the nightly AI is told about.
router.get('/special-dates', async (req, res) => {
  try {
    res.json(await forecastService.listSpecialDates());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/special-dates', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    res.status(201).json(await forecastService.createSpecialDate(req.body || {}, req.user?.id || null));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/special-dates/:id', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    await forecastService.deleteSpecialDate(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
