import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { findSimilarName } from "../utils/stringHelper.js";
import { recalculateProductEstimatedCost } from "../services/recipesService.js";
import { invalidateAnalyticsCache } from "./analytics.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { getArchiveTimestampsMap, getDaysSinceArchived, invalidateArchiveMap } from "../utils/archiveHelper.js";

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));

// Get all products (active and archived)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (error) throw error;

    const archiveMap = await getArchiveTimestampsMap();
    const productsWithArchive = (data || []).map(p => {
      if (!p.is_archived) return p;
      const archivedAt = archiveMap.products[p.id] || p.created_at || null;
      return {
        ...p,
        archived_at: archivedAt,
        days_since_archived: getDaysSinceArchived(archivedAt)
      };
    });

    res.json(productsWithArchive);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new product
router.post('/', async (req, res) => {
  try {
    const { name, category, price, description, track_stock, stock_quantity, low_stock_threshold, sizes, add_ons, image_url, force_create } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    // Check for duplicates
    if (!force_create) {
      const { data: existingProducts } = await supabase.from("products").select("name");
      if (existingProducts) {
        const existingNames = existingProducts.map(p => p.name);
        const similar = findSimilarName(name, existingNames);
        if (similar) {
          return res.status(409).json({ 
            error: `A product with a similar name ("${similar}") already exists.`,
            is_duplicate_warning: true 
          });
        }
      }
    }

    const estimated_cost = Math.round((parseFloat(price) || 0) * 0.38 * 100) / 100;

    const { data, error } = await supabase
      .from('products')
      .insert([{
        name,
        category,
        price,
        estimated_cost,
        description,
        image_url,
        is_archived: false,
        track_stock: track_stock || false,
        stock_quantity: stock_quantity || 0,
        low_stock_threshold: low_stock_threshold || 0,
        sizes: sizes || [],
        add_ons: add_ons || []
      }])
      .select()
      .single();
    if (error) throw error;

    invalidateAnalyticsCache();

    await logAudit('PRODUCT_CREATED', req.user.id, {
      product_id: data.id,
      name: data.name,
      category: data.category,
      price: data.price
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (price, name, category, description, etc.)
// FIX #1: stock_quantity is intentionally excluded from this endpoint.
// Stock can only be changed through POST /:id/receive (add) or the POS/wastage flow (subtract).
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price, description, track_stock, low_stock_threshold, sizes, add_ons, image_url } = req.body;
    
    const { data, error } = await supabase
      .from('products')
      .update({
        name,
        category,
        price,
        description,
        image_url,
        track_stock,
        low_stock_threshold,
        sizes: sizes || [],
        add_ons: add_ons || []
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await recalculateProductEstimatedCost(req.params.id);
    invalidateAnalyticsCache();

    await logAudit('PRODUCT_UPDATED', req.user.id, {
      product_id: req.params.id,
      name,
      category,
      price
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive product
router.put('/:id/archive', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ is_archived: true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    invalidateAnalyticsCache();
    invalidateArchiveMap();

    await logAudit('PRODUCT_ARCHIVED', req.user.id, {
      product_id: req.params.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore archived product
router.put('/:id/restore', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ is_archived: false })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    invalidateAnalyticsCache();
    invalidateArchiveMap();

    await logAudit('PRODUCT_RESTORED', req.user.id, {
      product_id: req.params.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete archived product (Owner/Admin only, >= 30 days archived, 0 sales)
router.delete('/:id', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error: fetchErr } = await supabase
      .from('products')
      .select('id, name, is_archived, created_at')
      .eq('id', id)
      .single();

    if (fetchErr || !product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (!product.is_archived) {
      return res.status(400).json({ error: 'Only archived products can be permanently deleted.' });
    }

    // Check 30 days elapsed
    const archiveMap = await getArchiveTimestampsMap(true);
    const archivedAt = archiveMap.products[id] || product.created_at;
    const daysElapsed = getDaysSinceArchived(archivedAt);

    if (!archivedAt || daysElapsed < 30) {
      const remaining = Math.max(1, 30 - daysElapsed);
      return res.status(400).json({
        error: `Cannot permanently delete product yet. Product must be archived for at least 30 days (${remaining} day(s) remaining).`
      });
    }

    // Check foreign key integrity (sale_items)
    const { count: salesCount, error: salesErr } = await supabase
      .from('sale_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);
    if (salesErr) throw salesErr;

    if (salesCount && salesCount > 0) {
      return res.status(400).json({
        error: `Cannot delete product "${product.name}" because it is linked to ${salesCount} historical sales record(s). For auditing and accounting integrity, it must remain archived.`
      });
    }

    // Remove dependent recipes
    await supabase.from('recipes').delete().eq('product_id', id);

    // Delete product
    const { error: delErr } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (delErr) throw delErr;

    invalidateAnalyticsCache();
    invalidateArchiveMap();

    await logAudit('PRODUCT_DELETED', req.user.id, {
      product_id: id,
      name: product.name,
      deleted_by: req.user.name
    });

    res.json({ success: true, message: `Product "${product.name}" permanently deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receive stock for product (Direct Stock Tracking)
// FIX #11: Validates that quantity is a positive number before adding to stock.
router.post('/:id/receive', async (req, res) => {
  try {
    const { quantity } = req.body;
    const productId = req.params.id;

    const parsedQty = parseFloat(quantity);
    if (!parsedQty || parsedQty <= 0 || isNaN(parsedQty)) {
      return res.status(400).json({ error: 'Quantity received must be a positive number.' });
    }

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', productId)
      .single();
    if (fetchError) throw fetchError;

    const newStock = (parseFloat(product.stock_quantity) || 0) + parsedQty;

    const { data, error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId)
      .select()
      .single();
    if (updateError) throw updateError;

    invalidateAnalyticsCache();

    await logAudit('PRODUCT_STOCK_RECEIVED', req.user.id, {
      product_id: productId,
      name: product.name,
      quantity_added: parsedQty,
      new_stock: newStock
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
