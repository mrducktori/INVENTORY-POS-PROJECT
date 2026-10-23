-- ==============================================================================
-- DATABASE SCHEMA MIGRATION: Purchase Orders & Inventory Thresholds
-- Run this script in your Supabase Dashboard -> SQL Editor (or psql)
-- ==============================================================================

-- 1. Add notes and reason columns to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS decline_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN purchase_orders.notes IS 'Order notes or special delivery instructions from procurement / depletion forecast';
COMMENT ON COLUMN purchase_orders.decline_reason IS 'Mandatory explanatory reason provided by the supplier when status is updated to DECLINED';
COMMENT ON COLUMN purchase_orders.cancellation_reason IS 'Documented reason provided when a purchase order is voided or cancelled';

-- 2. Add max_stock column to ingredients table for dynamic restock alerts
ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS max_stock NUMERIC DEFAULT NULL;

COMMENT ON COLUMN ingredients.max_stock IS 'Configurable maximum ingredient capacity; restock alert fires when stock_quantity <= (max_stock * 0.5)';

-- 3. Add max_stock column to products table for direct product tracking
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS max_stock NUMERIC DEFAULT NULL;

COMMENT ON COLUMN products.max_stock IS 'Configurable maximum product capacity; restock alert fires when stock_quantity <= (max_stock * 0.5)';
