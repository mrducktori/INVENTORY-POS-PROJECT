import * as purchasingService from "../services/purchasingService.js";
import { logAudit } from "../utils/auditHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";

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
    const { user_id: _userId, ...body } = req.body;
    const data = await purchasingService.createSupplier(body);
    
    // Log audit
    await logAudit('SUPPLIER_CREATED', req.user.id, {
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
    const { user_id: _userId, ...body } = req.body;
    const data = await purchasingService.updateSupplier(id, body);
    
    await logAudit('SUPPLIER_UPDATED', req.user.id, {
      supplier_id: data.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// === Purchase Orders ===
export const archiveSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    await purchasingService.archiveSupplier(id);
    await logAudit('SUPPLIER_ARCHIVED', req.user?.id || null, {
      supplier_id: id
    });
    res.json({ success: true, message: "Supplier archived successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const restoreSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    await purchasingService.restoreSupplier(id);
    await logAudit('SUPPLIER_RESTORED', req.user?.id || null, {
      supplier_id: id
    });
    res.json({ success: true, message: "Supplier restored successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    await purchasingService.archiveSupplier(id);
    await logAudit('SUPPLIER_ARCHIVED', req.user?.id || null, {
      supplier_id: id,
      source: 'delete_action'
    });
    res.json({ success: true, message: "Supplier archived successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
    const { user_id: _userId, ...body } = req.body;
    const data = await purchasingService.createPurchaseOrder(body);
    
    // Log audit
    await logAudit('PURCHASE_ORDER_CREATED', req.user.id, {
      po_id: data.id,
      supplier_id: data.supplier_id,
      total_amount: data.total_amount,
      notes: body.notes || null
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, items_received, expected_date } = req.body;
    const rawReason = req.body.declineReason || req.body.decline_reason || req.body.cancellationReason || req.body.cancellation_reason || req.body.reason || req.body.reschedule_reason;

    const statusUpper = (status || '').toUpperCase();
    if (statusUpper === 'DECLINED') {
      if (!rawReason || typeof rawReason !== 'string' || !rawReason.trim()) {
        return res.status(400).json({ 
          error: 'A declineReason string is required when status is DECLINED.' 
        });
      }
    }

    if (statusUpper === 'CANCELLED') {
      if (!rawReason || typeof rawReason !== 'string' || !rawReason.trim()) {
        return res.status(400).json({ 
          error: 'A cancellation reason string is required when status is CANCELLED.' 
        });
      }
    }

    const reason = rawReason && typeof rawReason === 'string' ? rawReason.trim() : null;
    const authUserId = req.user.id;
    
    const data = await purchasingService.updatePurchaseOrderStatus(id, status, items_received, expected_date, reason);
    
    // Determine the audit action
    let auditAction = 'PURCHASE_ORDER_STATUS_UPDATED';
    if (statusUpper === 'DECLINED') auditAction = 'SUPPLIER_PO_DECLINED';
    else if (statusUpper === 'CANCELLED') auditAction = 'PURCHASE_ORDER_CANCELLED';
    else if (expected_date && !status) auditAction = 'PURCHASE_ORDER_RESCHEDULED';

    await logAudit(auditAction, authUserId, {
      po_id: data.id,
      new_status: status || data.status,
      ...(expected_date ? { expected_date } : {}),
      ...(reason ? { 
        reason, 
        decline_reason: reason, 
        cancellation_reason: reason,
        reschedule_reason: reason 
      } : {})
    });

    // Log individual stock receipts for each received item so they show in
    // Transaction Logs and Stock Movement reports
    const receiptsToLog = Array.isArray(data?._appliedReceipts)
      ? data._appliedReceipts
      : (items_received || []).filter((item) => item.ingredient_id && Number(item.quantity_received_now) > 0);

    if (receiptsToLog.length > 0) {
      for (const item of receiptsToLog) {
        // Fetch the ingredient to get its name and current stock for the log
        const { getIngredientById } = await import("../services/inventoryService.js");
        const ingredient = await getIngredientById(item.ingredient_id);
        if (!ingredient) continue;

        const conversion = Number(item.conversion_factor || 1);
        const baseUnitsAdded = Number(item.quantity_received_now) * conversion;

        await logAudit('RAW_MATERIAL_STOCK_RECEIVED', authUserId, {
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
      invalidateAnalyticsCache();
    }

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
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
    const rawReason = req.body.declineReason || req.body.decline_reason || req.body.reason;

    // Normalize comparison for allowed statuses
    const matchedStatus = SUPPLIER_ALLOWED_STATUSES.find(
      s => s.toLowerCase() === (status || '').toLowerCase()
    );

    if (!matchedStatus) {
      return res.status(400).json({ 
        error: `Invalid status. Suppliers can only set: ${SUPPLIER_ALLOWED_STATUSES.join(', ')}` 
      });
    }

    if (matchedStatus.toLowerCase() === 'declined') {
      if (!rawReason || typeof rawReason !== 'string' || !rawReason.trim()) {
        return res.status(400).json({
          error: 'A declineReason string is required when status is DECLINED.'
        });
      }
    }

    const declineReason = rawReason && typeof rawReason === 'string' ? rawReason.trim() : null;

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
      .select('id, supplier_id, status')
      .eq('id', id)
      .single();

    if (!po || po.supplier_id !== userData.supplier_id) {
      return res.status(403).json({ error: 'You can only update your own purchase orders.' });
    }

    if (['received', 'cancelled', 'declined'].includes(String(po.status || '').toLowerCase())) {
      return res.status(400).json({
        error: `Cannot update purchase order because its status is already ${po.status}.`
      });
    }

    const data = await purchasingService.updatePurchaseOrderStatus(id, matchedStatus, [], expected_date, declineReason);

    await logAudit(matchedStatus.toLowerCase() === 'declined' ? 'SUPPLIER_PO_DECLINED' : 'SUPPLIER_PO_STATUS_UPDATED', req.user.id, {
      po_id: id,
      new_status: matchedStatus,
      supplier_id: userData.supplier_id,
      ...(declineReason ? { decline_reason: declineReason, declineReason } : {})
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


export const getSupplierOwnCatalog = async (req, res) => {
  try {
    const { supabase } = await import("../config/supabaseClient.js");
    let supplierId = req.user.supplier_id;
    if (!supplierId) {
      const { data: userData } = await supabase
        .from('users')
        .select('supplier_id')
        .eq('id', req.user.id)
        .single();
      supplierId = userData?.supplier_id;
    }

    if (!supplierId) {
      return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        id,
        name,
        contact_person,
        contact_number,
        email,
        address,
        supplier_ingredients (
          ingredient_id,
          default_purchase_unit,
          default_conversion_factor,
          default_price,
          ingredients ( id, name, unit, category )
        )
      `)
      .eq('id', supplierId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSupplierOwnCatalog = async (req, res) => {
  try {
    const { supabase } = await import("../config/supabaseClient.js");
    let supplierId = req.user.supplier_id;
    if (!supplierId) {
      const { data: userData } = await supabase
        .from('users')
        .select('supplier_id')
        .eq('id', req.user.id)
        .single();
      supplierId = userData?.supplier_id;
    }

    if (!supplierId) {
      return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected items array.' });
    }

    // Fetch existing supplier_ingredients with ingredient names to detect price changes
    const { data: existingRows } = await supabase
      .from('supplier_ingredients')
      .select('ingredient_id, default_price, default_purchase_unit, default_conversion_factor, ingredients(id, name)')
      .eq('supplier_id', supplierId);

    const existingMap = new Map((existingRows || []).map(r => [String(r.ingredient_id), r]));
    const validatedItems = [];

    for (const item of items) {
      if (!item || !item.ingredient_id) {
        return res.status(400).json({ error: 'Each catalog item must include an ingredient_id.' });
      }
      const existing = existingMap.get(String(item.ingredient_id));
      if (!existing) {
        return res.status(403).json({ error: 'You can only update ingredients assigned to your supplier catalog.' });
      }

      const rawPrice = item.default_price ?? item.price ?? existing.default_price ?? 0;
      const newPrice = Number(rawPrice);
      const rawFactor = item.default_conversion_factor ?? item.conversion_factor ?? existing.default_conversion_factor ?? 1;
      const convFactor = Number(rawFactor);

      if (!Number.isFinite(newPrice) || newPrice < 0) {
        return res.status(400).json({ error: 'Item price must be a valid non-negative number.' });
      }
      if (!Number.isFinite(convFactor) || convFactor <= 0) {
        return res.status(400).json({ error: 'Conversion factor must be a positive number.' });
      }

      validatedItems.push({ item, existing, newPrice, convFactor });
    }

    const priceChanges = [];

    for (const { item, existing, newPrice, convFactor } of validatedItems) {
      const oldPrice = parseFloat(existing.default_price) || 0;

      if (Math.abs(oldPrice - newPrice) > 0.001) {
        priceChanges.push({
          ingredient_id: item.ingredient_id,
          ingredient_name: existing.ingredients?.name || 'Raw Material',
          old_price: oldPrice,
          new_price: newPrice,
          difference: newPrice - oldPrice,
          updated_at: new Date().toISOString()
        });
      }

      const { error: upErr } = await supabase
        .from('supplier_ingredients')
        .update({
          default_price: newPrice,
          default_purchase_unit: item.default_purchase_unit || item.purchase_unit || existing.default_purchase_unit || 'Unit',
          default_conversion_factor: convFactor
        })
        .match({ supplier_id: supplierId, ingredient_id: item.ingredient_id });
      if (upErr) throw upErr;

      // Sync the ingredient's cost_per_purchase_unit and unit_cost in the database
      if (newPrice > 0) {
        const unitCost = Math.round((newPrice / convFactor) * 10000) / 10000;
        await supabase
          .from('ingredients')
          .update({
            cost_per_purchase_unit: newPrice,
            conversion_factor: convFactor,
            unit_cost: unitCost
          })
          .eq('id', item.ingredient_id);
      }
    }

    // Fetch supplier name for audit details
    const { data: supplierInfo } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', supplierId)
      .single();

    const supplierName = supplierInfo?.name || 'Supplier';

    await logAudit('SUPPLIER_CATALOG_PRICES_UPDATED', req.user.id, {
      supplier_id: supplierId,
      supplier_name: supplierName,
      items_count: validatedItems.length,
      price_changes: priceChanges
    });

    res.json({ success: true, count: validatedItems.length, price_changes: priceChanges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSupplierPriceUpdates = async (req, res) => {
  try {
    const updates = await purchasingService.getUnacknowledgedPriceUpdateLogs();
    res.json(updates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const acknowledgeSupplierPriceUpdates = async (req, res) => {
  try {
    const { id } = req.params;
    const ingredientId = req.body?.ingredient_id || null;
    await logAudit('SUPPLIER_PRICE_UPDATES_READ', req.user.id, {
      supplier_id: id,
      ...(ingredientId ? { ingredient_id: ingredientId } : {}),
      acknowledged_by: req.user.name || req.user.username || 'Admin'
    });
    res.json({ success: true, supplier_id: id, ingredient_id: ingredientId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
