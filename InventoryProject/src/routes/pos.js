import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();


// ✅ GET PRODUCTS
router.get("/products", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_archived", false);

  if (error) return res.status(500).json(error);
  res.json(data);
});


// ✅ CREATE SALE
router.post("/sale", async (req, res) => {
  const { cart, total, staff_id } = req.body;

  // 1. Insert sale
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert([{ total_amount: total, payment_method: "CASH", staff_id }])
    .select()
    .single();

  if (saleError) return res.status(500).json(saleError);

  // 2. Insert sale items
  const saleItems = cart.map(item => ({
    sale_id: sale.id,
    product_id: item.id,
    quantity: item.qty,
    unit_price: item.price
  }));

  const { error: itemError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemError) return res.status(500).json(itemError);

  res.json({ message: "Sale completed", sale });
});

export default router;