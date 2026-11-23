import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { checkCompositeDuplicate } from "../utils/stringHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import { recalculateProductEstimatedCost, createRecipe, validateSizeOverridesInput } from "../services/recipesService.js";
import { invalidateAnalyticsCache } from "./analytics.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { getArchiveTimestampsMap, getDaysSinceArchived, invalidateArchiveMap } from "../utils/archiveHelper.js";

const router = express.Router();
router.use(requireRole('Owner', 'Admin', 'Staff', 'Custom'));

const validateProductInput = (body, { isUpdate = false } = {}) => {
  const name = validateTextLength(body.name, {
    label: 'Product name',
    min: 1,
    max: LIMITS.NAME_MAX_LEN,
    required: true
  });
  const category = validateTextLength(body.category, {
    label: 'Category',
    min: 1,
    max: LIMITS.CATEGORY_MAX_LEN,
    required: true
  });

  let description = body.description;
  if (body.description !== undefined && body.description !== null) {
    description = validateTextLength(body.description, {
      label: 'Description',
      min: 0,
      max: LIMITS.DESC_MAX_LEN,
      required: false
    });
  } else if (!isUpdate) {
    description = null;
  }

  const price = validateNumberBound(body.price, {
    label: 'Product price',
    min: LIMITS.PRODUCT_PRICE_MIN,
    max: LIMITS.PRODUCT_PRICE_MAX,
    allowZero: false
  });

  const hasThreshold = body.low_stock_threshold !== undefined && body.low_stock_threshold !== null && body.low_stock_threshold !== '';
  const low_stock_threshold = hasThreshold
    ? validateNumberBound(body.low_stock_threshold, {
        label: 'Low stock threshold',
        min: LIMITS.THRESHOLD_MIN,
        max: LIMITS.THRESHOLD_MAX
      })
    : (isUpdate ? undefined : 0);

  let stock_quantity = 0;
  if (!isUpdate && body.stock_quantity !== undefined && body.stock_quantity !== null && body.stock_quantity !== '') {
    stock_quantity = validateNumberBound(body.stock_quantity, {
      label: 'Stock quantity',
      min: LIMITS.STOCK_QTY_MIN,
      max: LIMITS.STOCK_QTY_MAX
    });
  }

  let sizes = body.sizes;
  if (sizes !== undefined && sizes !== null) {
    if (!Array.isArray(sizes)) {
      const err = new Error('Sizes must be an array.');
      err.status = 400;
      throw err;
    }
    sizes = sizes.map((s) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        const err = new Error('Each size entry must be an object.');
        err.status = 400;
        throw err;
      }
      const cleanSizeName = s.name !== undefined && s.name !== null
        ? validateTextLength(s.name, { label: 'Size name', min: 1, max: LIMITS.NAME_MAX_LEN, required: false })
        : s.name;
      const rawPriceAdd = s.price_add !== undefined && s.price_add !== null && s.price_add !== '' ? s.price_add : 0;
      const price_add = validateNumberBound(rawPriceAdd, {
        label: 'Size price adjustment',
        min: LIMITS.ADDON_PRICE_MIN,
        max: LIMITS.ADDON_PRICE_MAX
      });
      const hasMult = s.recipe_multiplier !== undefined && s.recipe_multiplier !== null && s.recipe_multiplier !== '';
      const recipe_multiplier = hasMult
        ? validateNumberBound(s.recipe_multiplier, {
            label: 'Size recipe multiplier',
            min: 0.1,
            max: 10,
            allowZero: false
          })
        : 1;
      return {
        ...s,
        ...(cleanSizeName !== undefined ? { name: cleanSizeName } : {}),
        price_add,
        recipe_multiplier,
        ingredient_id: s.ingredient_id || null,
        lid_ingredient_id: s.lid_ingredient_id || null,
        straw_ingredient_id: s.straw_ingredient_id || null,
        dine_in_no_cup: Boolean(s.dine_in_no_cup)
      };
    });
  } else {
    sizes = [];
  }

  let add_ons = body.add_ons;
  if (add_ons !== undefined && add_ons !== null) {
    if (!Array.isArray(add_ons)) {
      const err = new Error('Add-ons must be an array.');
      err.status = 400;
      throw err;
    }
    add_ons = add_ons.map((a) => {
      if (!a || typeof a !== 'object' || Array.isArray(a)) {
        const err = new Error('Each add-on entry must be an object.');
        err.status = 400;
        throw err;
      }
      const cleanAddonName = a.name !== undefined && a.name !== null
        ? validateTextLength(a.name, { label: 'Add-on name', min: 1, max: LIMITS.NAME_MAX_LEN, required: false })
        : a.name;
      const rawAddonPrice = a.price !== undefined && a.price !== null && a.price !== '' ? a.price : 0;
      const addonPrice = validateNumberBound(rawAddonPrice, {
        label: 'Add-on price',
        min: LIMITS.ADDON_PRICE_MIN,
        max: LIMITS.ADDON_PRICE_MAX
      });
      const hasAddonQty = a.quantity !== undefined && a.quantity !== null && a.quantity !== '';
      const addonQty = hasAddonQty
        ? validateNumberBound(a.quantity, {
            label: 'Add-on quantity',
            min: 0,
            max: LIMITS.RECIPE_QTY_MAX
          })
        : a.quantity;
      return {
        ...a,
        ...(cleanAddonName !== undefined ? { name: cleanAddonName } : {}),
        price: addonPrice,
        ...(hasAddonQty ? { quantity: addonQty } : {})
      };
    });
  } else {
    add_ons = [];
  }

  let initial_recipes = [];
  if (!isUpdate && body.initial_recipes !== undefined && body.initial_recipes !== null) {
    if (!Array.isArray(body.initial_recipes)) {
      const err = new Error('initial_recipes must be an array.');
      err.status = 400;
      throw err;
    }
    initial_recipes = body.initial_recipes.map((r) => {
      if (!r || typeof r !== 'object' || !r.ingredient_id) {
        const err = new Error('Each initial recipe item must include an ingredient_id.');
        err.status = 400;
        throw err;
      }
      const quantity_used = validateNumberBound(r.quantity_used, {
        label: 'Recipe quantity',
        min: LIMITS.RECIPE_QTY_MIN,
        max: LIMITS.RECIPE_QTY_MAX,
        allowZero: false
      });
      const overrides = validateSizeOverridesInput({
        size_name: r.size_name,
        size_quantities: r.size_quantities
      });
      return {
        ingredient_id: r.ingredient_id,
        quantity_used,
        recipe_unit: r.recipe_unit || null,
        size_name: overrides.size_name,
        size_quantities: overrides.size_quantities
      };
    });
  }

  return { name, category, description, price, low_stock_threshold, stock_quantity, sizes, add_ons, initial_recipes };
};

const findProductDuplicateConflict = async ({ name, category, excludeId = null, force = false }) => {
  const { data: existingProducts, error } = await supabase
    .from("products")
    .select("id, name, category, is_archived");
  if (error) throw error;

  const dup = checkCompositeDuplicate(name, category, existingProducts || [], excludeId);
  if (!dup) return null;

  if (dup.isHardDuplicate) {
    const archivedNote = dup.isArchived ? ' (archived)' : '';
    return {
      status: 409,
      body: {
        error: `Product "${dup.matchName}"${archivedNote} already exists under category "${dup.matchCategory}". Duplicate items in the same category are not allowed.`,
        is_hard_duplicate: true
      }
    };
  }

  if (dup.isDuplicateWarning && !force) {
    const errorMsg = dup.reason === 'SAME_NAME_DIFF_CATEGORY'
      ? `A product named "${dup.matchName}" already exists under category "${dup.matchCategory}".`
      : `A product with a similar name ("${dup.matchName}" in "${dup.matchCategory}") already exists.`;
    return {
      status: 409,
      body: {
        error: errorMsg,
        is_duplicate_warning: true
      }
    };
  }

  return null;
};

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
    const { track_stock, image_url, force_create } = req.body;
    const validated = validateProductInput(req.body);

    const conflict = await findProductDuplicateConflict({
      name: validated.name,
      category: validated.category,
      force: Boolean(force_create)
    });
    if (conflict) {
      return res.status(conflict.status).json(conflict.body);
    }

    const estimated_cost = Math.round(validated.price * 0.38 * 100) / 100;

    const { data, error } = await supabase
      .from('products')
      .insert([{
        name: validated.name,
        category: validated.category,
        price: validated.price,
        estimated_cost,
        description: validated.description,
        image_url,
        is_archived: false,
        track_stock: track_stock || false,
        stock_quantity: validated.stock_quantity,
        low_stock_threshold: validated.low_stock_threshold,
        sizes: validated.sizes,
        add_ons: validated.add_ons
      }])
      .select()
      .single();
    if (error) throw error;

    if (validated.initial_recipes.length > 0) {
      for (const r of validated.initial_recipes) {
        await createRecipe({
          product_id: data.id,
          ingredient_id: r.ingredient_id,
          quantity_used: r.quantity_used,
          recipe_unit: r.recipe_unit,
          size_name: r.size_name,
          size_quantities: r.size_quantities
        });
      }
      const updatedCost = await recalculateProductEstimatedCost(data.id);
      if (updatedCost !== null) {
        data.estimated_cost = updatedCost;
      }
    }

    invalidateAnalyticsCache();

    await logAudit('PRODUCT_CREATED', req.user.id, {
      product_id: data.id,
      name: data.name,
      category: data.category,
      price: data.price
    });

    res.status(201).json(data);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({
        error: 'A product with this name and category already exists.',
        is_hard_duplicate: true
      });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update product (price, name, category, description, etc.)
// FIX #1: stock_quantity is intentionally excluded from this endpoint.
// Stock can only be changed through POST /:id/receive (add) or the POS/wastage flow (subtract).
router.put('/:id', async (req, res) => {
  try {
    const { track_stock, image_url, force_update } = req.body;
    const validated = validateProductInput(req.body, { isUpdate: true });

    const conflict = await findProductDuplicateConflict({
      name: validated.name,
      category: validated.category,
      excludeId: req.params.id,
      force: Boolean(force_update)
    });
    if (conflict) {
      return res.status(conflict.status).json(conflict.body);
    }

    const updatePayload = {
      name: validated.name,
      category: validated.category,
      price: validated.price,
      image_url,
      track_stock,
      sizes: validated.sizes,
      add_ons: validated.add_ons,
      ...(validated.description !== undefined ? { description: validated.description } : {}),
      ...(validated.low_stock_threshold !== undefined ? { low_stock_threshold: validated.low_stock_threshold } : {})
    };

    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await recalculateProductEstimatedCost(req.params.id);
    invalidateAnalyticsCache();

    await logAudit('PRODUCT_UPDATED', req.user.id, {
      product_id: req.params.id,
      name: validated.name,
      category: validated.category,
      price: validated.price
    });

    res.json(data);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({
        error: 'A product with this name and category already exists.',
        is_hard_duplicate: true
      });
    }
    res.status(err.status || 500).json({ error: err.message });
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
// FIX #11: Validates that quantity is a positive number within bounds before adding to stock.
router.post('/:id/receive', async (req, res) => {
  try {
    const { quantity } = req.body;
    const productId = req.params.id;

    const parsedQty = validateNumberBound(quantity, {
      label: 'Quantity received',
      min: LIMITS.RECEIVE_QTY_MIN,
      max: LIMITS.RECEIVE_QTY_MAX,
      allowZero: false
    });

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', productId)
      .single();
    if (fetchError) throw fetchError;

    const newStock = (parseFloat(product.stock_quantity) || 0) + parsedQty;
    validateNumberBound(newStock, {
      label: 'Resulting stock quantity',
      min: LIMITS.STOCK_QTY_MIN,
      max: LIMITS.STOCK_QTY_MAX
    });

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
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
