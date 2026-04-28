-- ============================================================
-- Migration: Add recipe_unit column to recipes table
-- Run this once in Supabase SQL Editor
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS recipe_unit TEXT;

-- Optional: Add a comment to document the column purpose
COMMENT ON COLUMN recipes.recipe_unit IS 
  'The unit the recipe quantity_used is expressed in (e.g. ML, G, L, KG). 
   If NULL, the ingredient stock unit is assumed. 
   The POS service converts recipe_unit → stock unit before deducting inventory.';

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'recipes'
ORDER BY ordinal_position;
