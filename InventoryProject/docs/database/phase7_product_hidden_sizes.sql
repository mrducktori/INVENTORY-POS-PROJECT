-- Phase 7: per-product size toggles.
-- Cup sizes live in category_settings.sizes (one size may carry "is_base": true inside that JSON).
-- A product can switch some of its category's sizes OFF by listing their names here.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hidden_sizes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.hidden_sizes IS 'Names of category sizes toggled off for this product (e.g. ["22 oz"]).';
