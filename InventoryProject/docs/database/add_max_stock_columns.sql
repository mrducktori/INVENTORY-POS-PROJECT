-- Migration: Add max_stock columns to ingredients and products tables
-- Configurable stock alerts flag items where current_stock <= (max_stock * 0.5)

ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS max_stock NUMERIC DEFAULT NULL;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS max_stock NUMERIC DEFAULT NULL;

COMMENT ON COLUMN ingredients.max_stock IS 'Configurable maximum capacity; stock alert fires when stock_quantity <= (max_stock * 0.5)';
COMMENT ON COLUMN products.max_stock IS 'Configurable maximum capacity for direct stock tracked products; stock alert fires when stock_quantity <= (max_stock * 0.5)';
