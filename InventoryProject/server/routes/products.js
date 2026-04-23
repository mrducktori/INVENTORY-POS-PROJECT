import express from 'express';
import { supabase } from "../config/supabaseClient.js";

const router = express.Router();

// Get all products (active and archived)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new product
router.post('/', async (req, res) => {
  try {
    const { name, category, price, description } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, category, price, is_archived: false }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (price, name, category)
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price } = req.body;
    const { data, error } = await supabase
      .from('products')
      .update({ name, category, price })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
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
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
