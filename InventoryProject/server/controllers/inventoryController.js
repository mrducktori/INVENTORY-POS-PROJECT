import * as inventoryService from "../services/inventoryService.js";

export const getIngredients = async (req, res) => {
  try {
    const data = await inventoryService.getIngredients();
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
    const data = await inventoryService.createIngredient(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateIngredient = async (req, res) => {
  try {
    const data = await inventoryService.updateIngredient(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteIngredient = async (req, res) => {
  try {
    await inventoryService.deleteIngredient(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const receiveStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const data = await inventoryService.receiveStock(req.params.id, quantity);
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
    const data = await inventoryService.archiveIngredient(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const restoreIngredient = async (req, res) => {
  try {
    const data = await inventoryService.restoreIngredient(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

