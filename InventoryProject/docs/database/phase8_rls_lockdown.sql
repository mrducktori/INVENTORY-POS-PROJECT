-- Phase 8: lock down direct database access for the public anon key.
--
-- Security review finding: only 4 tables (raw_material_category_shelf_life,
-- daily_product_sales, forecast_insights, forecast_special_dates) had Row Level Security
-- enabled. Every other table -- including `users` (password_hash, pin_hash) -- had none,
-- meaning the public anon key shipped in the browser bundle (VITE_SUPABASE_ANON_KEY) could
-- read or write every row directly over Supabase's REST API or Realtime, bypassing every
-- permission check the Express server enforces.
--
-- This migration enables RLS with NO policies on every table below: a full default-deny for
-- the `anon` and `authenticated` roles. The Express server is unaffected -- it connects with
-- SUPABASE_SERVICE_ROLE_KEY, and Supabase's service_role has the BYPASSRLS attribute, so it
-- ignores RLS entirely regardless of policies.
--
-- Run this once in the Supabase SQL editor. After running it, a handful of frontend files
-- that used to read tables or hold Realtime subscriptions directly over the anon key were
-- changed to poll the existing authenticated API endpoints instead (Dashboard.jsx,
-- AccountManager.jsx, PurchaseOrders.jsx, useSupplierPortal.js, useNotifications.js) -- that
-- app-code change should ship in the same deploy as this migration, not before it.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocktake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;

-- Separately: confirm in Supabase Dashboard -> Storage -> Policies that the `cms-images`
-- bucket's INSERT policy (used by direct browser uploads in PosSettingsModal.jsx and
-- useManageProducts.js) still only allows images of a sane size/type -- that upload path
-- bypasses the server's own MIME-type check and was flagged separately as a lower-severity
-- finding, not fixed by this migration.
