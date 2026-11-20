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
    const { user_id: _userId, ...body } = req.body;
    const data = await inventoryService.createIngredient(body);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_CREATED', req.user.id, {
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
    const { user_id: _userId, ...body } = req.body;
    const data = await inventoryService.updateIngredient(req.params.id, body);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_UPDATED', req.user.id, {
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
    const user_id = req.user.id;
    // Fetch name before deleting for the log
    const existing = await inventoryService.getIngredientById(req.params.id).catch(() => null);
    const result = await inventoryService.deleteIngredient(req.params.id);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_DELETED', user_id, {
      ingredient_id: req.params.id,
      name: existing?.name || result?.name || 'Unknown',
      deleted_by: req.user.name
    });

    res.json({ success: true, message: `Raw material "${existing?.name || result?.name || 'Item'}" permanently deleted.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const receiveStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    // Fetch ingredient name before updating
    const existing = await inventoryService.getIngredientById(req.params.id).catch(() => null);
    const data = await inventoryService.receiveStock(req.params.id, parseFloat(quantity));
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_STOCK_RECEIVED', req.user.id, {
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
    const user_id = req.user.id;
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
    const user_id = req.user.id;
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

export const getCategories = async (req, res) => {
  try {
    const data = await inventoryService.getRawMaterialCategories();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const rawName = req.body?.name ?? req.body?.category;
    const data = await inventoryService.createRawMaterialCategory(rawName);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_CATEGORY_CREATED', req.user.id, {
      category: data.category,
      created_by: req.user.name
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const renameCategory = async (req, res) => {
  try {
    const rawNewName = req.body?.new_name ?? req.body?.name ?? req.body?.category;
    const result = await inventoryService.renameRawMaterialCategory(req.params.name, rawNewName);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_CATEGORY_RENAMED', req.user.id, {
      old_name: result.old_name,
      new_name: result.new_name,
      updated_count: result.updated_count,
      changed_by: req.user.name
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const result = await inventoryService.deleteRawMaterialCategory(req.params.name);
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_CATEGORY_DELETED', req.user.id, {
      category: result.category,
      deleted_by: req.user.name
    });

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
