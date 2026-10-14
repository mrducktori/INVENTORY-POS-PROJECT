-- Run this script in the Supabase SQL Editor

-- 1. Create Supplier Ingredients Junction Table
CREATE TABLE IF NOT EXISTS supplier_ingredients (
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (supplier_id, ingredient_id)
);

-- 2. Modify Purchase Order Items
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS quantity_received DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_received BOOLEAN DEFAULT FALSE;

-- 3. Create CMS Content Table
CREATE TABLE IF NOT EXISTS cms_content (
    section_key VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    image_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial CMS content if empty
INSERT INTO cms_content (section_key, title, description, image_url)
VALUES (
    'landing_hero', 
    'COF/TEA CAFÉ | ELWOOD BRANCH', 
    'Experience the best coffee and tea in town. Check out our menu!',
    ''
) ON CONFLICT (section_key) DO NOTHING;

-- Note: Also ensure a Storage Bucket named 'cms-images' is created in your Supabase project with public read access.
