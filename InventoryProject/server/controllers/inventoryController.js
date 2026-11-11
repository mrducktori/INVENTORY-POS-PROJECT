import * as inventoryService from "../services/inventoryService.js";
import { logAudit } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";

export const getIngredients = async (req, res) => {
  try {
    const includeArchived = req.query.include_archived === "true";
    const data = await inventoryService.getIngredients({ includeArchived });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getIngredientById = async (req, res) => {
  try {
    const data = await inventoryService.getIngredientById(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createIngredient = async (req, res) => {
  try {
    const { user_id, ...body } = req.body;
    const data = await inventoryService.createIngredient(body);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_CREATED', req.user?.id || user_id || null, {
      ingredient_id: data.id,
      name: data.name,
      unit: data.unit
    });

    res.status(201).json(data);
  } catch (err) {
    if (err.is_duplicate_warning) {
      return res.status(409).json({ error: err.message, is_duplicate_warning: true });
    }
    res.status(500).json({ error: err.message || err });
  }
};

export const updateIngredient = async (req, res) => {
  try {
    const { user_id, ...body } = req.body;
    const data = await inventoryService.updateIngredient(req.params.id, body);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_UPDATED', req.user?.id || user_id || null, {
      ingredient_id: req.params.id,
      name: data.name,
      unit: data.unit,
      low_stock_alert: data.low_stock_alert
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteIngredient = async (req, res) => {
  try {
    const user_id = req.user?.id || req.body?.user_id || null;
    // Fetch name before deleting for the log
    const existing = await inventoryService.getIngredientById(req.params.id).catch(() => null);
    await inventoryService.deleteIngredient(req.params.id);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_DELETED', user_id, {
      ingredient_id: req.params.id,
      name: existing?.name || 'Unknown'
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const receiveStock = async (req, res) => {
  try {
    const { quantity, user_id } = req.body;
    // Fetch ingredient name before updating
    const existing = await inventoryService.getIngredientById(req.params.id).catch(() => null);
    const data = await inventoryService.receiveStock(req.params.id, parseFloat(quantity));
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_STOCK_RECEIVED', req.user?.id || user_id || null, {
      ingredient_id: req.params.id,
      name: existing?.name || 'Unknown',
      quantity_added: parseFloat(quantity),
      new_stock: data.stock_quantity
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLowStockAlerts = async (req, res) => {
  try {
    const data = await inventoryService.getLowStockAlerts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const archiveIngredient = async (req, res) => {
  try {
    const user_id = req.user?.id || req.body?.user_id || null;
    const data = await inventoryService.archiveIngredient(req.params.id);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_ARCHIVED', user_id, {
      ingredient_id: req.params.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const restoreIngredient = async (req, res) => {
  try {
    const user_id = req.user?.id || req.body?.user_id || null;
    const data = await inventoryService.restoreIngredient(req.params.id);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_RESTORED', user_id, {
      ingredient_id: req.params.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
