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

// Update or create category settings
router.put('/:category', async (req, res) => {
  try {
    const category = req.params.category.toUpperCase();
    const { sizes, add_ons } = req.body;
    
    // Upsert using Supabase
    const { data, error } = await supabase
      .from('category_settings')
      .upsert({ 
        category, 
        sizes: sizes || [], 
        add_ons: add_ons || [] 
      }, { onConflict: 'category' })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
