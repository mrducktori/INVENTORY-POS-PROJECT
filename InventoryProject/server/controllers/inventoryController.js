import * as inventoryService from "../services/inventoryService.js";
import * as batchService from "../services/batchService.js";
import * as ocrService from "../services/ocrService.js";
import { logAudit } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";

const handleInventoryError = (res, err) => {
  if (err?.is_hard_duplicate || err?.is_duplicate_warning) {
    return res.status(409).json({
      error: err.message,
      is_hard_duplicate: !!err.is_hard_duplicate,
      is_duplicate_warning: !!err.is_duplicate_warning
    });
  }
  return res.status(err?.status || 500).json({ error: err?.message || err });
};

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
    handleInventoryError(res, err);
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
    handleInventoryError(res, err);
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
    const { quantity, expiry_date, batch_code, notes } = req.body;
    // Fetch ingredient name before updating
    const existing = await inventoryService.getIngredientById(req.params.id).catch(() => null);
    const data = await inventoryService.receiveStock(req.params.id, quantity, {
      expiry_date,
      batch_code,
      notes
    });
    invalidateAnalyticsCache();

    await logAudit('RAW_MATERIAL_STOCK_RECEIVED', req.user.id, {
      ingredient_id: req.params.id,
      name: existing?.name || data?.name || 'Unknown',
      quantity_added: Number(quantity),
      new_stock: data.stock_quantity,
      batch_code: data.created_batch?.batch_code || null,
      expiry_date: data.created_batch?.expiry_date || null
    });

    res.json(data);
  } catch (err) {
    handleInventoryError(res, err);
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

export const getBatches = async (req, res) => {
  try {
    const ingredientId = req.query.ingredient_id || null;
    const data = await batchService.getBatches({ ingredientId });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getExpiryAlerts = async (req, res) => {
  try {
    const data = await batchService.getExpiryAlerts();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getStocktakeHistory = async (req, res) => {
  try {
    const data = await batchService.getStocktakeHistory();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const performStocktake = async (req, res) => {
  try {
    const { counts, notes } = req.body;
    const session = await batchService.performStocktake({
      counts,
      notes,
      user: req.user
    });
    invalidateAnalyticsCache();
    res.status(201).json(session);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const scanOcrDocument = async (req, res) => {
  try {
    const result = await ocrService.scanInventoryDocument({
      base64Image: req.body?.base64Image ?? req.body?.image_base64 ?? null,
      mimeType: req.body?.mimeType ?? req.body?.mime_type ?? null,
      fileName: req.body?.fileName ?? req.body?.file_name ?? null,
      rawText: req.body?.rawText ?? req.body?.raw_text ?? "",
      scanMode: req.body?.scanMode ?? req.body?.scan_mode ?? "PO_RECEIPT"
    });

    await logAudit("OCR_DOCUMENT_SCANNED", req.user.id, {
      engine: result.engine,
      scan_mode: result.scan_mode,
      items_count: result.items.length,
      warnings_count: result.warnings.length,
      supplier_name: result.supplier_name || null
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
