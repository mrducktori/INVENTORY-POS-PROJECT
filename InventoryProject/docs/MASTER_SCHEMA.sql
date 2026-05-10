-- MASTER DATABASE TEMPLATE: COF/TEA POS SYSTEM
-- Verified Schema (9 Tables)
-- Use this as the source of truth for all database queries and relationships.

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

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action character varying NOT NULL,
  user_id uuid,
  details text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  action_type character varying,
  entity_type character varying,
  entity_id uuid,
  new_value jsonb,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.category_settings (
  category character varying NOT NULL,
  sizes jsonb DEFAULT '[]'::jsonb,
  add_ons jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT category_settings_pkey PRIMARY KEY (category)
);

CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  unit character varying NOT NULL,
  stock_quantity numeric DEFAULT 0.00 CHECK (stock_quantity >= 0::numeric),
  low_stock_alert numeric DEFAULT 10.00,
  created_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false,
  unit_cost numeric DEFAULT 0.00,
  category text,
  CONSTRAINT ingredients_pkey PRIMARY KEY (id)
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  category character varying NOT NULL,
  price numeric NOT NULL,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  estimated_cost numeric DEFAULT 0.00,
  description text,
  image_url text,
  track_stock boolean DEFAULT false,
  stock_quantity numeric DEFAULT 0 CHECK (stock_quantity >= 0::numeric),
  low_stock_threshold numeric DEFAULT 5,
  sizes jsonb DEFAULT '[]'::jsonb,
  add_ons jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_fkey FOREIGN KEY (category) REFERENCES public.category_settings(category)
);

CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity_used numeric NOT NULL,
  recipe_unit text,
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);

CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  discount_percent numeric DEFAULT 0.00,
  notes text,
  cup_size text,
  add_ons jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  total_amount numeric NOT NULL,
  payment_method character varying NOT NULL,
  staff_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'COMPLETED'::character varying,
  payment_status character varying DEFAULT 'PAID'::character varying,
  discount_amount numeric DEFAULT 0.00,
  tax_amount numeric DEFAULT 0.00,
  notes text,
  receipt_number character varying UNIQUE,
  amount_received numeric,
  change_amount numeric,
  transaction_reference character varying,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id)
);

CREATE TABLE public.wastage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  reason character varying NOT NULL,
  reported_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  estimated_cost numeric DEFAULT 0.00,
  CONSTRAINT wastage_pkey PRIMARY KEY (id),
  CONSTRAINT wastage_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT wastage_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id)
);
