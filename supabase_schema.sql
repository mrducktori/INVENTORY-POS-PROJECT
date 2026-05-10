-- Enable UUID extension (not strictly necessary for gen_random_uuid() in PG 13+, but good practice)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLE DEFINITIONS & FOREIGN KEYS
-- ==========================================

-- 1. Users Table
-- Note: In a typical Supabase setup, you might want this to link to the built-in auth.users table.
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  role character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'ACTIVE'::character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- 2. Audit Logs Table
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action character varying NOT NULL,
  user_id uuid NOT NULL,
  details text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 3. Ingredients Table
CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  unit character varying NOT NULL,
  stock_quantity numeric DEFAULT 0.00 CHECK (stock_quantity >= 0),
  low_stock_alert numeric DEFAULT 10.00,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ingredients_pkey PRIMARY KEY (id)
);

-- 4. Category Settings Table
CREATE TABLE public.category_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category character varying NOT NULL UNIQUE,
  sizes jsonb DEFAULT '[]'::jsonb,
  add_ons jsonb DEFAULT '[]'::jsonb,
  image_url character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT category_settings_pkey PRIMARY KEY (id)
);

-- 5. Products Table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  category character varying NOT NULL,
  price numeric NOT NULL,
  is_archived boolean DEFAULT false,
  track_stock boolean DEFAULT false,
  stock_quantity numeric DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_fkey FOREIGN KEY (category) REFERENCES public.category_settings(category) ON DELETE RESTRICT
);

-- 6. Recipes Table
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity_used numeric NOT NULL,
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE
);


-- 7. Sales Table
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  total_amount numeric NOT NULL,
  payment_method character varying NOT NULL,
  staff_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id)
);

-- 8. Sale Items Table
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  cup_size character varying,
  add_ons jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE,
  CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- 9. Wastage Table
CREATE TABLE public.wastage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  reason character varying NOT NULL,
  reported_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wastage_pkey PRIMARY KEY (id),
  CONSTRAINT wastage_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE,
  CONSTRAINT wastage_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id)
);



-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage ENABLE ROW LEVEL SECURITY;

-- Assuming Standard Supabase Setup: 
-- We assume auth.uid() reflects the current logged-in user and matches public.users.id.
-- If you have an `ADMIN` role and a `STAFF` role, here are general policies:

-- 1. Users
-- Everyone can read users (you may want to restrict this depending on privacy needs)
CREATE POLICY "Anyone can view users" ON public.users FOR SELECT USING (true);
-- Only users with role ADMIN can insert/update/delete users
CREATE POLICY "Admins can manage users" ON public.users 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 2. Ingredients
CREATE POLICY "Anyone can view ingredients" ON public.ingredients FOR SELECT USING (true);
CREATE POLICY "Admins can manage ingredients" ON public.ingredients 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 3. Category Settings
CREATE POLICY "Anyone can view category settings" ON public.category_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage category settings" ON public.category_settings 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 4. Products
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 5. Recipes
CREATE POLICY "Anyone can view recipes" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Admins can manage recipes" ON public.recipes 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 6. Sales
CREATE POLICY "Anyone can view sales" ON public.sales FOR SELECT USING (true);
-- Assumes staff member creating the sale maps to auth.uid()
CREATE POLICY "Staff can insert sales" ON public.sales FOR INSERT 
  WITH CHECK (auth.uid() = staff_id);

-- 7. Sale Items
CREATE POLICY "Anyone can view sale items" ON public.sale_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert sale items" ON public.sale_items FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Wastage
CREATE POLICY "Anyone can view wastage" ON public.wastage FOR SELECT USING (true);
CREATE POLICY "Staff can log wastage" ON public.wastage FOR INSERT 
  WITH CHECK (auth.uid() = reported_by);



-- 9. Audit Logs
-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
-- Assume triggers insert audit logs. If app inserts them, allow authenticated users:
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
