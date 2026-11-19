import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { invalidateAnalyticsCache } from "./analytics.js";

const router = express.Router();

const RESERVED_CATEGORIES = new Set(['ALL', 'OTHERS', 'UNCATEGORIZED']);
const MAX_CATEGORY_LENGTH = 40;

const normalizeCategoryName = (raw) =>
  String(raw || '').trim().replace(/\s+/g, ' ').toUpperCase();

const hasInvalidChars = (str) => {
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return /[\\/%]/.test(str);
};

const validateCategoryName = (raw) => {
  const value = normalizeCategoryName(raw);
  if (!value) {
    return { ok: false, value, error: 'Category name is required.' };
  }
  if (value.length > MAX_CATEGORY_LENGTH) {
    return { ok: false, value, error: `Category name must be ${MAX_CATEGORY_LENGTH} characters or less.` };
  }
  if (hasInvalidChars(value)) {
    return { ok: false, value, error: 'Category name cannot contain /, \\, %, or control characters.' };
  }
  if (RESERVED_CATEGORIES.has(value)) {
    return { ok: false, value, error: `"${value}" is a reserved category name.` };
  }
  return { ok: true, value };
};

// Get all category settings merged with distinct product categories & counts
router.get('/', requireRole('Owner', 'Admin', 'Staff', 'Custom'), async (req, res) => {
  try {
    const [settingsRes, productsRes] = await Promise.all([
      supabase.from('category_settings').select('*'),
      supabase.from('products').select('category')
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (productsRes.error) throw productsRes.error;

    const mergedMap = new Map();

    (settingsRes.data || []).forEach((row) => {
      const key = normalizeCategoryName(row.category);
      if (!key) return;
      mergedMap.set(key, {
        category: key,
        sizes: Array.isArray(row.sizes) ? row.sizes : [],
        add_ons: Array.isArray(row.add_ons) ? row.add_ons : [],
        product_count: 0
      });
    });

    (productsRes.data || []).forEach((prod) => {
      const key = normalizeCategoryName(prod.category);
      if (!key) return;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          category: key,
          sizes: [],
          add_ons: [],
          product_count: 0
        });
      }
      mergedMap.get(key).product_count += 1;
    });

    const result = Array.from(mergedMap.values()).sort((a, b) =>
      a.category.localeCompare(b.category)
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new category (rejects duplicates cleanly)
router.post('/', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { category, sizes, add_ons } = req.body;
    const validation = validateCategoryName(category);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    const name = validation.value;

    const [settingsRes, productsRes] = await Promise.all([
      supabase.from('category_settings').select('category'),
      supabase.from('products').select('category')
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (productsRes.error) throw productsRes.error;

    const existsInSettings = (settingsRes.data || []).some(
      (r) => normalizeCategoryName(r.category) === name
    );
    const existsInProducts = (productsRes.data || []).some(
      (p) => normalizeCategoryName(p.category) === name
    );

    if (existsInSettings || existsInProducts) {
      return res.status(409).json({ error: `Category "${name}" already exists.` });
    }

    const cleanSizes = Array.isArray(sizes) ? sizes : [];
    const cleanAddOns = Array.isArray(add_ons) ? add_ons : [];

    const { data, error } = await supabase
      .from('category_settings')
      .insert({
        category: name,
        sizes: cleanSizes,
        add_ons: cleanAddOns
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Category "${name}" already exists.` });
      }
      throw error;
    }

    invalidateAnalyticsCache();

    await logAudit('CATEGORY_CREATED', req.user.id, {
      category: name,
      sizes_count: cleanSizes.length,
      addons_count: cleanAddOns.length
    });

    res.status(201).json({ ...data, product_count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename an existing category across category_settings and all products (active + archived)
router.patch('/:category/rename', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const oldCategory = normalizeCategoryName(req.params.category);
    const validation = validateCategoryName(req.body?.newCategory);

    if (!oldCategory || RESERVED_CATEGORIES.has(oldCategory)) {
      return res.status(400).json({ error: 'Invalid source category name.' });
    }
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    const newCategory = validation.value;

    if (oldCategory === newCategory) {
      return res.status(400).json({ error: 'New category name must differ from the current name.' });
    }

    const [settingsRes, productsRes] = await Promise.all([
      supabase.from('category_settings').select('*'),
      supabase.from('products').select('id, category')
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (productsRes.error) throw productsRes.error;

    const allSettings = settingsRes.data || [];
    const allProducts = productsRes.data || [];

    const oldSettingsRow = allSettings.find(
      (r) => normalizeCategoryName(r.category) === oldCategory
    );
    const matchedProducts = allProducts.filter(
      (p) => normalizeCategoryName(p.category) === oldCategory
    );

    if (!oldSettingsRow && matchedProducts.length === 0) {
      return res.status(404).json({ error: `Category "${oldCategory}" not found.` });
    }

    const targetInSettings = allSettings.some(
      (r) => normalizeCategoryName(r.category) === newCategory
    );
    const targetInProducts = allProducts.some(
      (p) => normalizeCategoryName(p.category) === newCategory
    );
    if (targetInSettings || targetInProducts) {
      return res.status(409).json({ error: `Category "${newCategory}" already exists.` });
    }

    // 1. Insert new category_settings row copying sizes & add_ons
    const { error: insertErr } = await supabase
      .from('category_settings')
      .insert({
        category: newCategory,
        sizes: oldSettingsRow?.sizes || [],
        add_ons: oldSettingsRow?.add_ons || []
      });
    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: `Category "${newCategory}" already exists.` });
      }
      throw insertErr;
    }

    // 2. Reassign all matching products (active + archived)
    if (matchedProducts.length > 0) {
      const { error: updateErr } = await supabase
        .from('products')
        .update({ category: newCategory })
        .in('id', matchedProducts.map((p) => p.id));

      if (updateErr) {
        // Best-effort undo of Step 1
        await supabase.from('category_settings').delete().eq('category', newCategory);
        throw updateErr;
      }
    }

    // 3. Remove old category_settings row if it existed
    if (oldSettingsRow) {
      const { error: deleteErr } = await supabase
        .from('category_settings')
        .delete()
        .eq('category', oldSettingsRow.category);

      if (deleteErr) {
        console.warn(`Warning: failed to remove old category_settings row "${oldSettingsRow.category}":`, deleteErr.message);
      }
    }

    invalidateAnalyticsCache();

    await logAudit('CATEGORY_RENAMED', req.user.id, {
      old_category: oldCategory,
      new_category: newCategory,
      moved_count: matchedProducts.length
    });

    res.json({
      old_category: oldCategory,
      category: newCategory,
      moved_count: matchedProducts.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an unused category
router.delete('/:category', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const target = normalizeCategoryName(req.params.category);
    if (!target || RESERVED_CATEGORIES.has(target)) {
      return res.status(400).json({ error: 'Invalid or reserved category name.' });
    }

    const [settingsRes, productsRes] = await Promise.all([
      supabase.from('category_settings').select('category'),
      supabase.from('products').select('id, category')
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (productsRes.error) throw productsRes.error;

    const productCount = (productsRes.data || []).filter(
      (p) => normalizeCategoryName(p.category) === target
    ).length;

    if (productCount > 0) {
      return res.status(409).json({
        error: `Cannot delete "${target}" because ${productCount} product(s) still use it (including archived items). Reassign or remove them first.`,
        product_count: productCount
      });
    }

    const existingRow = (settingsRes.data || []).find(
      (r) => normalizeCategoryName(r.category) === target
    );
    if (!existingRow) {
      return res.status(404).json({ error: `Category "${target}" not found.` });
    }

    const { error: delErr } = await supabase
      .from('category_settings')
      .delete()
      .eq('category', existingRow.category);
    if (delErr) throw delErr;

    invalidateAnalyticsCache();

    await logAudit('CATEGORY_DELETED', req.user.id, {
      category: target
    });

    res.json({ deleted: target });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert category settings (Update if exists, insert if not)
router.put('/:category', requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const validation = validateCategoryName(req.params.category);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    const name = validation.value;
    const { sizes, add_ons } = req.body;
    const cleanSizes = Array.isArray(sizes) ? sizes : [];
    const cleanAddOns = Array.isArray(add_ons) ? add_ons : [];

    const upsertPayload = {
      category: name,
      sizes: cleanSizes,
      add_ons: cleanAddOns
    };

    const { data, error } = await supabase
      .from('category_settings')
      .upsert(upsertPayload, { onConflict: 'category' })
      .select()
      .single();

    if (error) throw error;

    invalidateAnalyticsCache();

    await logAudit('CATEGORY_SETTINGS_UPDATED', req.user.id, {
      category: name,
      sizes_count: cleanSizes.length,
      addons_count: cleanAddOns.length
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
