-- ===========================================================================
-- SEED SCRIPT: All Raw Materials Supplier Mappings & Packaging Pricing
-- Historical reference of full supplier ingredients catalog.
-- ===========================================================================

-- 1. Ensure supplier description column exists
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS description text;

-- 2. Update default packaging and costs for raw materials
UPDATE public.ingredients SET purchase_unit = 'Pack of 100', conversion_factor = 100, cost_per_purchase_unit = 180 WHERE name = '22 OZ CUPS';
UPDATE public.ingredients SET purchase_unit = 'Pack of 100', conversion_factor = 100, cost_per_purchase_unit = 180 WHERE name = '22OZ PET CUPS';
UPDATE public.ingredients SET purchase_unit = '500g Bag', conversion_factor = 500, cost_per_purchase_unit = 350 WHERE name = 'ASSAM BLACK TEA';
UPDATE public.ingredients SET purchase_unit = '1 kg Pack', conversion_factor = 1000, cost_per_purchase_unit = 420 WHERE name = 'DARK CHOCOLATE POWDER';
UPDATE public.ingredients SET purchase_unit = '1L Carton', conversion_factor = 1000, cost_per_purchase_unit = 95 WHERE name = 'FRESH MILK';
UPDATE public.ingredients SET purchase_unit = '1 kg Tub', conversion_factor = 1000, cost_per_purchase_unit = 180 WHERE name = 'NATA DE COCO';
UPDATE public.ingredients SET purchase_unit = '1 kg Pack', conversion_factor = 1000, cost_per_purchase_unit = 140 WHERE name = 'TAPIOCA PEARLS';

-- 3. Supplier ingredients schema reference
-- Table: supplier_ingredients
-- Columns:
--   supplier_id (uuid, FK suppliers.id)
--   ingredient_id (uuid, FK ingredients.id)
--   default_purchase_unit (text)
--   default_conversion_factor (numeric)
--   default_price (numeric)
