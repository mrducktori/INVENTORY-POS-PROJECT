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
  stock_quantity numeric DEFAULT 0.00,
  low_stock_alert numeric DEFAULT 10.00,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ingredients_pkey PRIMARY KEY (id)
);

-- 4. Products Table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  category character varying NOT NULL,
  price numeric NOT NULL,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- 5. Recipes Table
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity_used numeric NOT NULL,
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE
);

-- 6. Requests Table
CREATE TABLE public.requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL,
  details jsonb NOT NULL,
  status character varying DEFAULT 'PENDING'::character varying,
  requested_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT requests_pkey PRIMARY KEY (id),
  CONSTRAINT requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE
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

-- 10. Employee Shifts Table
CREATE TABLE public.employee_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  shift_type character varying DEFAULT 'Morning',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT employee_shifts_pkey PRIMARY KEY (id),
  CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and owners can view shifts" ON public.employee_shifts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('Admin', 'Owner'))
  );
CREATE POLICY "Authenticated users can insert their shifts" ON public.employee_shifts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage shifts" ON public.employee_shifts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('Admin', 'Owner'))
  );

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
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

-- 3. Products
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 4. Recipes
CREATE POLICY "Anyone can view recipes" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Admins can manage recipes" ON public.recipes 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 5. Sales
CREATE POLICY "Anyone can view sales" ON public.sales FOR SELECT USING (true);
-- Assumes staff member creating the sale maps to auth.uid()
CREATE POLICY "Staff can insert sales" ON public.sales FOR INSERT 
  WITH CHECK (auth.uid() = staff_id);

-- 6. Sale Items
CREATE POLICY "Anyone can view sale items" ON public.sale_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert sale items" ON public.sale_items FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Wastage
CREATE POLICY "Anyone can view wastage" ON public.wastage FOR SELECT USING (true);
CREATE POLICY "Staff can log wastage" ON public.wastage FOR INSERT 
  WITH CHECK (auth.uid() = reported_by);

-- 8. Requests
CREATE POLICY "Anyone can view requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Users can create their own requests" ON public.requests FOR INSERT 
  WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "Users can update their own requests or Admins can update" ON public.requests FOR UPDATE 
  USING (
    auth.uid() = requested_by OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 9. Audit Logs
-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
-- Assume triggers insert audit logs. If app inserts them, allow authenticated users:
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
