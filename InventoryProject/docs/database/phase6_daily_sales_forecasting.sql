-- ============================================================================
-- Phase 6: End-of-day sales summary + forecasting support
-- Target: Supabase PostgreSQL (run once in Supabase Dashboard -> SQL Editor, AFTER phase 5)
-- Safe to re-run. REQUIRES phase 5 first. Run BEFORE deploying the matching server code.
--
--   daily_product_sales   one row per (Manila date, product): units, revenue, orders.
--                         Filled at end of day (Z-reading close + nightly job) and backfilled
--                         from the full sales history the first time.
--   forecast_insights     the nightly plain-language explanation per product (Gemini or template).
--   suppliers.lead_time_days  how many days a delivery usually takes (used for reorder points).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_product_sales (
  sale_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units NUMERIC NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sale_date, product_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_product_sales_product_date ON public.daily_product_sales (product_id, sale_date);
COMMENT ON TABLE public.daily_product_sales IS 'End-of-day rollup of completed (non-voided) sales per product per Manila calendar day';

CREATE TABLE IF NOT EXISTS public.forecast_insights (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  for_date DATE NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'TEMPLATE',  -- 'GEMINI' or 'TEMPLATE'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, for_date)
);
COMMENT ON TABLE public.forecast_insights IS 'Nightly plain-language explanation of each product forecast (explains the numbers, never changes them)';

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 3
  CHECK (lead_time_days BETWEEN 0 AND 60);
COMMENT ON COLUMN public.suppliers.lead_time_days IS 'Typical days from ordering to delivery; reorder point = daily usage x (lead time + safety days)';

-- Recompute [p_from, p_to] (inclusive, Manila dates). Idempotent: deletes then re-inserts the range.
-- p_excluded_sale_ids: voided/refunded sales the server knows about (some voids live outside SQL).
CREATE OR REPLACE FUNCTION public.refresh_daily_product_sales(
  p_from DATE,
  p_to DATE,
  p_excluded_sale_ids UUID[] DEFAULT '{}'
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range.' USING ERRCODE = 'PT400';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('refresh_daily_product_sales')); -- two refreshes of the same days must not interleave
  DELETE FROM public.daily_product_sales WHERE sale_date BETWEEN p_from AND p_to;

  INSERT INTO public.daily_product_sales (sale_date, product_id, units, revenue, orders, refreshed_at)
  SELECT
    (s.created_at AT TIME ZONE 'Asia/Manila')::date,
    si.product_id,
    SUM(si.quantity),
    round(SUM(si.quantity * si.unit_price * (1 - COALESCE(si.discount_percent, 0) / 100.0)), 2),
    COUNT(DISTINCT s.id),
    NOW()
  FROM public.sales s
  JOIN public.sale_items si ON si.sale_id = s.id
  WHERE s.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Manila')
    AND s.created_at <  ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
    AND upper(COALESCE(s.status, '')) NOT IN ('VOIDED', 'REFUNDED', 'RETURNED')
    AND NOT (s.id = ANY (COALESCE(p_excluded_sale_ids, '{}')))
  GROUP BY 1, 2;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

REVOKE ALL ON FUNCTION public.refresh_daily_product_sales(DATE, DATE, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_daily_product_sales(DATE, DATE, UUID[]) TO service_role;
ALTER TABLE public.daily_product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_insights ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- AI adjustment (added later; safe to re-run): bounded multiplier + reason the nightly AI note attaches to each forecast.
ALTER TABLE public.forecast_insights ADD COLUMN IF NOT EXISTS ai_factor NUMERIC NOT NULL DEFAULT 1 CHECK (ai_factor BETWEEN 0.5 AND 2);
ALTER TABLE public.forecast_insights ADD COLUMN IF NOT EXISTS ai_reason TEXT;
NOTIFY pgrst, 'reload schema';

-- Owner-entered special dates (exam week, class suspension, school break, event) the nightly AI is told about.
CREATE TABLE IF NOT EXISTS public.forecast_special_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 2 AND 80),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  effect TEXT NOT NULL DEFAULT 'UNSURE' CHECK (effect IN ('BUSIER', 'SLOWER', 'UNSURE')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_forecast_special_dates_range ON public.forecast_special_dates (start_date, end_date);
ALTER TABLE public.forecast_special_dates ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
