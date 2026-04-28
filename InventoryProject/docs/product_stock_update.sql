-- Add stock tracking columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC DEFAULT 5;

-- Comment to explain:
-- If track_stock is TRUE, the POS will deduct from products.stock_quantity.
-- If track_stock is FALSE, the POS will deduct from ingredients based on recipes.

-- Update inventory_logs to support direct product tracking
ALTER TABLE public.inventory_logs ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_logs ALTER COLUMN ingredient_id DROP NOT NULL;
