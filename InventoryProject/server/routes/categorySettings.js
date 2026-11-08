import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";

const router = express.Router();

// Get all category settings
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('category_settings')
      .select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new category setting
router.post('/', async (req, res) => {
  try {
    const { category, sizes, add_ons } = req.body;
    const uppercaseCategory = String(category || '').toUpperCase();

    const { data, error } = await supabase
      .from('category_settings')
      .upsert({ 
        category: uppercaseCategory, 
        sizes: sizes || [], 
        add_ons: add_ons || []
      }, { onConflict: 'category' })
      .select()
      .single();
      
    if (error) throw error;

    await logAudit('CATEGORY_SETTINGS_CREATED', req.user?.id || null, {
      category: uppercaseCategory,
      sizes_count: (sizes || []).length,
      addons_count: (add_ons || []).length
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert category settings (Update if exists, insert if not)
router.put('/:category', async (req, res) => {
  try {
    const { sizes, add_ons } = req.body;
    const uppercaseCategory = req.params.category.toUpperCase();
    
    const upsertPayload = {
      category: uppercaseCategory,
      sizes: sizes || [], 
      add_ons: add_ons || []
    };

    const { data, error } = await supabase
      .from('category_settings')
      .upsert(upsertPayload, { onConflict: 'category' })
      .select()
      .single();
      
    if (error) throw error;

    await logAudit('CATEGORY_SETTINGS_UPDATED', req.user?.id || null, {
      category: uppercaseCategory,
      sizes_count: (sizes || []).length,
      addons_count: (add_ons || []).length
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
