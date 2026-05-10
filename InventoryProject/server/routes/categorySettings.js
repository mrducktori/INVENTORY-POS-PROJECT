import express from 'express';
import { supabase } from "../config/supabaseClient.js";

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
    const { category, sizes, add_ons, image_url } = req.body;
    const uppercaseCategory = category.toUpperCase();

    const { data, error } = await supabase
      .from('category_settings')
      .insert({ 
        category: uppercaseCategory, 
        sizes: sizes || [], 
        add_ons: add_ons || [],
        image_url 
      })
      .select()
      .single();
      
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert category settings (Update if exists, insert if not)
router.put('/:category', async (req, res) => {
  try {
    const { sizes, add_ons, image_url } = req.body;
    const uppercaseCategory = req.params.category.toUpperCase();
    
    const upsertPayload = {
      category: uppercaseCategory,
      sizes: sizes || [], 
      add_ons: add_ons || [],
      ...(image_url !== undefined && { image_url })
    };

    const { data, error } = await supabase
      .from('category_settings')
      .upsert(upsertPayload, { onConflict: 'category' })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
