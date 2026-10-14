import * as purchasingService from "../services/purchasingService.js";
import { logAudit } from "../utils/auditHelper.js";

// === Suppliers ===
export const getSuppliers = async (req, res) => {
  try {
    const data = await purchasingService.getSuppliers();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const { user_id, ...body } = req.body;
    const data = await purchasingService.createSupplier(body);
    
    // Log audit
    await logAudit('SUPPLIER_CREATED', user_id || null, {
      supplier_id: data.id,
      name: data.name
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, ...body } = req.body;
    const data = await purchasingService.updateSupplier(id, body);
    
    await logAudit('SUPPLIER_UPDATED', user_id || null, {
      supplier_id: data.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// === Purchase Orders ===
export const getPurchaseOrders = async (req, res) => {
  try {
    const data = await purchasingService.getPurchaseOrders();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const { user_id, ...body } = req.body;
    const data = await purchasingService.createPurchaseOrder(body);
    
    // Log audit
    await logAudit('PURCHASE_ORDER_CREATED', user_id || null, {
      po_id: data.id,
      supplier_id: data.supplier_id,
      total_amount: data.total_amount
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, items_received, user_id } = req.body;
    
    const data = await purchasingService.updatePurchaseOrderStatus(id, status, items_received);
    
    // Log audit
    await logAudit('PURCHASE_ORDER_STATUS_UPDATED', user_id || null, {
      po_id: data.id,
      new_status: status
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
