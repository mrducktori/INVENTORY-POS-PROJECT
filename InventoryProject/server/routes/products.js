import express from 'express';
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";

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
    const { name, category, price, description, track_stock, stock_quantity, low_stock_threshold, sizes, add_ons, user_id } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }
    const { data, error } = await supabase
      .from('products')
      .insert([{
        name,
        category,
        price,
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

    await logAudit('PRODUCT_CREATED', user_id || null, {
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

// Update product (price, name, category, etc.)
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price, track_stock, stock_quantity, low_stock_threshold, sizes, add_ons, user_id } = req.body;
    const { data, error } = await supabase
      .from('products')
      .update({
        name,
        category,
        price,
        track_stock,
        stock_quantity,
        low_stock_threshold,
        sizes: sizes || [],
        add_ons: add_ons || []
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await logAudit('PRODUCT_UPDATED', user_id || null, {
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
    const { user_id } = req.body || {};
    const { data, error } = await supabase
      .from('products')
      .update({ is_archived: true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await logAudit('PRODUCT_ARCHIVED', user_id || null, {
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
    const { user_id } = req.body || {};
    const { data, error } = await supabase
      .from('products')
      .update({ is_archived: false })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await logAudit('PRODUCT_RESTORED', user_id || null, {
      product_id: req.params.id,
      name: data.name
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receive stock for product (Direct Stock Tracking)
router.post('/:id/receive', async (req, res) => {
  try {
    const { quantity, user_id } = req.body;
    const productId = req.params.id;

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', productId)
      .single();
    if (fetchError) throw fetchError;

    const newStock = (parseFloat(product.stock_quantity) || 0) + parseFloat(quantity);

    const { data, error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId)
      .select()
      .single();
    if (updateError) throw updateError;

    await logAudit('PRODUCT_STOCK_RECEIVED', user_id || null, {
      product_id: productId,
      name: product.name,
      quantity_added: parseFloat(quantity),
      new_stock: newStock
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
