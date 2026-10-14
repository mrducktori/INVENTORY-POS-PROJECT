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
    
    // Log the overall PO status change
    await logAudit('PURCHASE_ORDER_STATUS_UPDATED', user_id || null, {
      po_id: data.id,
      new_status: status
    });

    // Log individual stock receipts for each received item so they show in
    // Transaction Logs and Stock Movement reports
    if (items_received && items_received.length > 0) {
      for (const item of items_received) {
        if (!item.ingredient_id || !item.quantity_received_now || Number(item.quantity_received_now) <= 0) continue;
        
        // Fetch the ingredient to get its name and current stock for the log
        const { getIngredientById } = await import("../services/inventoryService.js");
        const ingredient = await getIngredientById(item.ingredient_id);
        if (!ingredient) continue;

        const conversion = Number(item.conversion_factor || 1);
        const baseUnitsAdded = Number(item.quantity_received_now) * conversion;

        await logAudit('RAW_MATERIAL_STOCK_RECEIVED', user_id || null, {
          ingredient_id: item.ingredient_id,
          name: ingredient.name,
          unit: ingredient.unit,
          quantity_added: baseUnitsAdded,
          new_stock: ingredient.stock_quantity,
          source: 'purchase_order',
          po_id: id,
          purchase_unit: item.purchase_unit || 'Unit',
          purchase_qty: item.quantity_received_now
        });
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// === Supplier Portal ===
const SUPPLIER_ALLOWED_STATUSES = ['Accepted', 'Declined', 'To Be Delivered', 'Delivering', 'Postponed'];

export const getSupplierOwnOrders = async (req, res) => {
  try {
    // Get the supplier_id linked to this user account
    const supplierId = req.user.supplier_id;
    if (!supplierId) {
      // Fetch from DB if not on req.user
      const { supabase } = await import("../config/supabaseClient.js");
      const { data: userData } = await supabase
        .from('users')
        .select('supplier_id')
        .eq('id', req.user.id)
        .single();
      
      if (!userData?.supplier_id) {
        return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
      }
      req.user.supplier_id = userData.supplier_id;
    }

    const data = await purchasingService.getPurchaseOrdersBySupplier(req.user.supplier_id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSupplierOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, expected_date } = req.body;

    if (!SUPPLIER_ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Suppliers can only set: ${SUPPLIER_ALLOWED_STATUSES.join(', ')}` 
      });
    }

    // Get supplier_id from user
    const { supabase } = await import("../config/supabaseClient.js");
    const { data: userData } = await supabase
      .from('users')
      .select('supplier_id')
      .eq('id', req.user.id)
      .single();

    if (!userData?.supplier_id) {
      return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    }

    // Verify this PO belongs to the supplier
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, supplier_id')
      .eq('id', id)
      .single();

    if (!po || po.supplier_id !== userData.supplier_id) {
      return res.status(403).json({ error: 'You can only update your own purchase orders.' });
    }

    const data = await purchasingService.updatePurchaseOrderStatus(id, status, [], expected_date);

    await logAudit('SUPPLIER_PO_STATUS_UPDATED', req.user.id, {
      po_id: id,
      new_status: status,
      supplier_id: userData.supplier_id
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const submitSupplierItemResponses = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items response list is required.' });
    }

    const { supabase } = await import("../config/supabaseClient.js");
    const { data: userData } = await supabase
      .from('users')
      .select('supplier_id')
      .eq('id', req.user.id)
      .single();

    if (!userData?.supplier_id) {
      return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    }

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, supplier_id')
      .eq('id', id)
      .single();

    if (!po || po.supplier_id !== userData.supplier_id) {
      return res.status(403).json({ error: 'You can only update your own purchase orders.' });
    }

    const data = await purchasingService.submitSupplierItemResponses(id, items, req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const respondToSupplierProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, decision, split_into_backorder } = req.body;

    if (!item_id || !decision) {
      return res.status(400).json({ error: 'item_id and decision are required.' });
    }

    const data = await purchasingService.respondToSupplierProposal(
      id,
      item_id,
      decision,
      split_into_backorder ?? true,
      req.user.id
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

