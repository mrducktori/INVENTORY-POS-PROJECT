-- ============================================================================
-- Phase 5: Batches are the single source of truth for raw-material stock
-- Target: Supabase PostgreSQL (run once in Supabase Dashboard -> SQL Editor)
-- Safe to re-run: every step is idempotent. REQUIRES the earlier phases (ingredients, inventory_batches, purchase_orders tables).
-- Run this file BEFORE deploying the matching server code, then run phase 6.
--
-- What it does
--   1. Category shelf-life defaults table (raw-material category -> perishable / days).
--   2. Copies perishability overrides + batches out of the old cms_content JSON stores.
--   3. Atomic functions: FEFO deduct, restore, PO line receive.
--   4. Reconciles each ingredient once so stock_quantity == SUM(batch remaining).
--   5. Trigger keeps ingredients.stock_quantity equal to that sum from now on.
-- Functions are executable only by service_role (the server); the anon key in the
-- frontend bundle cannot call them.
-- ============================================================================

-- 1. Shelf-life defaults per raw-material category ---------------------------
CREATE TABLE IF NOT EXISTS public.raw_material_category_shelf_life (
  category TEXT PRIMARY KEY,
  is_perishable BOOLEAN NOT NULL DEFAULT TRUE,
  default_shelf_life_days INTEGER CHECK (default_shelf_life_days IS NULL OR default_shelf_life_days BETWEEN 1 AND 3650),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.raw_material_category_shelf_life IS 'Default expiry rule per raw-material category; ingredients.default_shelf_life_days overrides it';

-- Starting values (owner can change them in the app). Only inserted if missing.
INSERT INTO public.raw_material_category_shelf_life (category, is_perishable, default_shelf_life_days) VALUES
  ('PACKAGING & SUPPLIES', FALSE, NULL),
  ('DAIRY & CREAMERS',     TRUE, 7),
  ('SINKERS & TOPPINGS',   TRUE, 14),
  ('COFFEE & TEA BASES',   TRUE, 180),
  ('SWEETENERS & SYRUPS',  TRUE, 180),
  ('FLAVORING POWDERS',    TRUE, 365),
  ('BEVERAGE ENHANCERS',   TRUE, 180)
ON CONFLICT (category) DO NOTHING;

-- 2. One-time data copy. Skipped on re-run (the trigger from step 5 marks "already migrated"),
--    so re-running this file never overwrites changes made in the app afterwards.
DO $migrate$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_batches_sync_stock') THEN

-- Ingredient-level override: NULL means "use the category default".
-- Every row currently holds the old column default TRUE, so clear it first; real overrides come next.
ALTER TABLE public.ingredients ALTER COLUMN is_perishable DROP NOT NULL;
ALTER TABLE public.ingredients ALTER COLUMN is_perishable DROP DEFAULT;
UPDATE public.ingredients SET is_perishable = NULL, default_shelf_life_days = NULL;

-- 2a. Copy explicit perishability overrides from the old JSON store
UPDATE public.ingredients i
SET is_perishable = (m.value->>'is_perishable')::boolean,
    default_shelf_life_days = NULLIF(m.value->>'default_shelf_life_days', '')::integer
FROM public.cms_content c,
     LATERAL jsonb_each(CASE WHEN c.description ~ '^\s*\{' THEN c.description::jsonb ELSE '{}'::jsonb END) m
WHERE c.section_key = 'ingredient_perishability_meta'
  AND i.id::text = m.key
  AND m.value ? 'is_perishable';

-- 2b. Copy batches from the old JSON store
INSERT INTO public.inventory_batches (
  id, ingredient_id, batch_code, source, initial_quantity, quantity_remaining,
  received_at, expiry_date, po_id, po_item_id, purchase_unit, purchase_quantity, conversion_factor, notes
)
SELECT
  (b->>'id')::uuid,
  (b->>'ingredient_id')::uuid,
  COALESCE(NULLIF(b->>'batch_code', ''), 'LEGACY-' || left(b->>'id', 8)),
  COALESCE(NULLIF(b->>'source', ''), 'DIRECT_RECEIVE'),
  GREATEST(COALESCE((b->>'initial_quantity')::numeric, 0), COALESCE((b->>'quantity_remaining')::numeric, 0), 0.000001),
  GREATEST(COALESCE((b->>'quantity_remaining')::numeric, 0), 0),
  COALESCE(NULLIF(b->>'received_at', '')::timestamptz, NOW()),
  NULLIF(left(b->>'expiry_date', 10), '')::date,
  (SELECT po.id FROM public.purchase_orders po WHERE po.id::text = b->>'po_id'),
  (SELECT poi.id FROM public.purchase_order_items poi WHERE poi.id::text = b->>'po_item_id'),
  NULLIF(b->>'purchase_unit', ''),
  NULLIF(b->>'purchase_quantity', '')::numeric,
  NULLIF(b->>'conversion_factor', '')::numeric,
  NULLIF(b->>'notes', '')
FROM public.cms_content c,
     LATERAL jsonb_array_elements(
       CASE WHEN c.description ~ '^\s*\{' THEN COALESCE(c.description::jsonb->'batches', '[]'::jsonb) ELSE '[]'::jsonb END
     ) b
WHERE c.section_key = 'inventory_batches_store'
  AND EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id::text = b->>'ingredient_id')
ON CONFLICT (id) DO NOTHING;

END IF;
END $migrate$;

-- 3a. Effective shelf life (ingredient override, else category default) -------
CREATE OR REPLACE FUNCTION public.inv_effective_shelf_life(p_ingredient_id UUID)
RETURNS TABLE (is_perishable BOOLEAN, shelf_life_days INTEGER)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(i.is_perishable, c.is_perishable, TRUE),
    CASE WHEN COALESCE(i.is_perishable, c.is_perishable, TRUE)
         THEN COALESCE(i.default_shelf_life_days, c.default_shelf_life_days)
    END
  FROM public.ingredients i
  LEFT JOIN public.raw_material_category_shelf_life c ON c.category = upper(trim(i.category))
  WHERE i.id = p_ingredient_id;
$$;

-- 3b. FEFO deduction. Locks the ingredient row so concurrent sales serialize. --
-- Errors use SQLSTATE 'PT4xx' so the server can map them to HTTP status codes.
CREATE OR REPLACE FUNCTION public.inv_deduct_fefo(
  p_ingredient_id UUID,
  p_qty NUMERIC,
  p_allow_expired BOOLEAN DEFAULT FALSE,
  p_prefer_expired BOOLEAN DEFAULT FALSE,
  p_target_batch_id UUID DEFAULT NULL,
  p_today DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_ing RECORD;
  v_remaining NUMERIC := p_qty;
  v_take NUMERIC;
  v_usable NUMERIC;
  v_expired NUMERIC;
  v_eligible NUMERIC;
  v_out JSONB := '[]'::jsonb;
  v_target RECORD;
  r RECORD;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Deduction quantity must be greater than 0.' USING ERRCODE = 'PT400';
  END IF;

  SELECT id, name, unit INTO v_ing FROM public.ingredients WHERE id = p_ingredient_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw material not found.' USING ERRCODE = 'PT404';
  END IF;

  IF p_target_batch_id IS NOT NULL THEN
    SELECT batch_code, expiry_date INTO v_target FROM public.inventory_batches
    WHERE id = p_target_batch_id AND ingredient_id = p_ingredient_id AND quantity_remaining > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected batch was not found or has no remaining stock.' USING ERRCODE = 'PT404';
    END IF;
    IF NOT p_allow_expired AND v_target.expiry_date < p_today THEN
      RAISE EXCEPTION 'Batch "%" is expired and cannot be deducted.', v_target.batch_code USING ERRCODE = 'PT409';
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(quantity_remaining) FILTER (WHERE expiry_date IS NULL OR expiry_date >= p_today), 0),
    COALESCE(SUM(quantity_remaining) FILTER (WHERE expiry_date < p_today), 0)
  INTO v_usable, v_expired
  FROM public.inventory_batches WHERE ingredient_id = p_ingredient_id AND quantity_remaining > 0;

  v_eligible := v_usable + CASE WHEN p_allow_expired THEN v_expired ELSE 0 END;
  IF v_eligible + 0.000001 < p_qty THEN
    RAISE EXCEPTION '%', format('Insufficient usable stock for "%s". Usable: %s %s%s, Required: %s %s.',
      v_ing.name, round(v_usable, 4), v_ing.unit,
      CASE WHEN v_expired > 0 AND NOT p_allow_expired THEN format(' (%s %s expired excluded)', round(v_expired, 4), v_ing.unit) ELSE '' END,
      round(p_qty, 4), v_ing.unit)
      USING ERRCODE = 'PT409';
  END IF;

  FOR r IN
    SELECT id, batch_code, expiry_date, quantity_remaining
    FROM public.inventory_batches
    WHERE ingredient_id = p_ingredient_id
      AND quantity_remaining > 0
      AND (p_allow_expired OR expiry_date IS NULL OR expiry_date >= p_today)
    ORDER BY
      (id = p_target_batch_id) IS TRUE DESC,
      (p_prefer_expired AND expiry_date < p_today) IS TRUE DESC,
      CASE WHEN expiry_date >= p_today THEN 0 WHEN expiry_date IS NULL THEN 1 ELSE 2 END,
      expiry_date ASC NULLS LAST,
      received_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0.000001;
    v_take := LEAST(r.quantity_remaining, v_remaining);
    UPDATE public.inventory_batches SET quantity_remaining = round(quantity_remaining - v_take, 6) WHERE id = r.id;
    v_out := v_out || jsonb_build_object(
      'batch_id', r.id, 'batch_code', r.batch_code, 'expiry_date', r.expiry_date, 'quantity_deducted', round(v_take, 6)
    );
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN jsonb_build_object(
    'deductedBatches', v_out,
    'newTotalStock', (SELECT stock_quantity FROM public.ingredients WHERE id = p_ingredient_id),
    'remainingUsableStock', (
      SELECT COALESCE(round(SUM(quantity_remaining), 6), 0) FROM public.inventory_batches
      WHERE ingredient_id = p_ingredient_id AND (expiry_date IS NULL OR expiry_date >= p_today)
    )
  );
END $$;

-- 3c. Undo a deduction (sale/wastage rollback, void restock) ------------------
CREATE OR REPLACE FUNCTION public.inv_restore_batches(p_ingredient_id UUID, p_items JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM public.ingredients WHERE id = p_ingredient_id FOR NO KEY UPDATE;
  UPDATE public.inventory_batches b
  SET quantity_remaining = round(b.quantity_remaining + x.qty, 6)
  FROM (
    SELECT (e->>'batch_id')::uuid AS batch_id, SUM((e->>'quantity_deducted')::numeric) AS qty
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) e
    WHERE (e->>'quantity_deducted')::numeric > 0
    GROUP BY 1
  ) x
  WHERE b.id = x.batch_id AND b.ingredient_id = p_ingredient_id;
  RETURN (SELECT stock_quantity FROM public.ingredients WHERE id = p_ingredient_id);
END $$;

-- 3d. Receive one PO line: batch + stock + quantity_received in one transaction.
-- Caps at the remaining quantity, so a retried click can never double-count stock.
-- Returns NULL when nothing is left to receive on that line.
CREATE OR REPLACE FUNCTION public.inv_receive_po_item(
  p_po_id UUID,
  p_po_item_id UUID,
  p_qty NUMERIC,
  p_batch_code TEXT DEFAULT NULL,
  p_expiry DATE DEFAULT NULL,
  p_purchase_unit TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_take NUMERIC;
  v_conv NUMERIC;
  v_shelf RECORD;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  v_expiry DATE := p_expiry;
  v_batch public.inventory_batches%ROWTYPE;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity received must be greater than 0.' USING ERRCODE = 'PT400';
  END IF;

  SELECT * INTO v_item FROM public.purchase_order_items
  WHERE id = p_po_item_id AND purchase_order_id = p_po_id FOR UPDATE;
  IF NOT FOUND OR v_item.ingredient_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_take := LEAST(p_qty, GREATEST(v_item.quantity - COALESCE(v_item.quantity_received, 0), 0));
  IF v_take <= 0 THEN
    RETURN NULL;
  END IF;
  v_conv := COALESCE(NULLIF(v_item.conversion_factor, 0), 1);

  SELECT * INTO v_shelf FROM public.inv_effective_shelf_life(v_item.ingredient_id);
  IF v_expiry IS NULL AND v_shelf.is_perishable AND v_shelf.shelf_life_days IS NOT NULL THEN
    v_expiry := v_today + v_shelf.shelf_life_days;
  END IF;
  IF v_expiry IS NOT NULL AND v_expiry < v_today THEN
    RAISE EXCEPTION 'Expiry date % is already past; do not receive expired stock.', v_expiry USING ERRCODE = 'PT400';
  END IF;

  INSERT INTO public.inventory_batches (
    ingredient_id, batch_code, source, initial_quantity, quantity_remaining, received_at, expiry_date,
    po_id, po_item_id, purchase_unit, purchase_quantity, conversion_factor
  ) VALUES (
    v_item.ingredient_id,
    COALESCE(NULLIF(trim(p_batch_code), ''), 'LOT-' || to_char(v_today, 'YYYYMMDD') || '-' || upper(left(md5(random()::text), 4))),
    'PURCHASE_ORDER',
    round(v_take * v_conv, 6), round(v_take * v_conv, 6), NOW(), v_expiry,
    p_po_id, p_po_item_id, COALESCE(p_purchase_unit, 'Unit'), v_take, v_conv
  ) RETURNING * INTO v_batch;

  UPDATE public.purchase_order_items
  SET quantity_received = COALESCE(quantity_received, 0) + v_take,
      is_received = COALESCE(quantity_received, 0) + v_take >= quantity,
      receipt_history = COALESCE(receipt_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'date', NOW(), 'quantity', v_take, 'batch_id', v_batch.id,
        'batch_code', v_batch.batch_code, 'expiry_date', v_batch.expiry_date
      ))
  WHERE id = p_po_item_id;

  RETURN jsonb_build_object(
    'batch', to_jsonb(v_batch),
    'quantity_received_now', v_take,
    'conversion_factor', v_conv,
    'ingredient_id', v_item.ingredient_id
  );
END $$;

-- 4. One-time reconcile: make the batches add up to the current stock ---------
DO $$
DECLARE
  r RECORD;
  v_shelf RECORD;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  FOR r IN
    SELECT i.id, i.stock_quantity,
           COALESCE((SELECT SUM(b.quantity_remaining) FROM public.inventory_batches b WHERE b.ingredient_id = i.id), 0) AS batch_sum
    FROM public.ingredients i
  LOOP
    IF r.stock_quantity - r.batch_sum > 0.000001 THEN
      SELECT * INTO v_shelf FROM public.inv_effective_shelf_life(r.id);
      INSERT INTO public.inventory_batches (ingredient_id, batch_code, source, initial_quantity, quantity_remaining, received_at, expiry_date, notes)
      VALUES (r.id, 'MIGRATED-' || to_char(v_today, 'YYYYMMDD'), 'MIGRATION_ADJUSTMENT',
              round(r.stock_quantity - r.batch_sum, 6), round(r.stock_quantity - r.batch_sum, 6), NOW(),
              CASE WHEN v_shelf.is_perishable AND v_shelf.shelf_life_days IS NOT NULL THEN v_today + v_shelf.shelf_life_days END,
              'Stock that had no batch record when batches became the source of truth');
    ELSIF r.batch_sum - r.stock_quantity > 0.000001 THEN
      PERFORM public.inv_deduct_fefo(r.id, r.batch_sum - r.stock_quantity, TRUE, TRUE);
    END IF;
  END LOOP;
END $$;

-- 5. Trigger: stock_quantity always equals SUM(batch quantity_remaining) --------
CREATE OR REPLACE FUNCTION public.inv_sync_ingredient_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM public.ingredients WHERE id = COALESCE(NEW.ingredient_id, OLD.ingredient_id) FOR NO KEY UPDATE; -- lock first so the sum below sees every committed lot change
  UPDATE public.ingredients i
  SET stock_quantity = COALESCE((
    SELECT round(SUM(b.quantity_remaining), 6) FROM public.inventory_batches b WHERE b.ingredient_id = i.id
  ), 0)
  WHERE i.id IN (NEW.ingredient_id, OLD.ingredient_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_inventory_batches_sync_stock ON public.inventory_batches;
CREATE TRIGGER trg_inventory_batches_sync_stock
AFTER INSERT OR DELETE OR UPDATE OF quantity_remaining, ingredient_id ON public.inventory_batches
FOR EACH ROW EXECUTE FUNCTION public.inv_sync_ingredient_stock();

-- Final sync (covers anything the reconcile loop rounded).
UPDATE public.ingredients i
SET stock_quantity = COALESCE((SELECT round(SUM(b.quantity_remaining), 6) FROM public.inventory_batches b WHERE b.ingredient_id = i.id), 0);

-- 6. Lock the functions down to the server ------------------------------------
REVOKE ALL ON FUNCTION public.inv_effective_shelf_life(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_deduct_fefo(UUID, NUMERIC, BOOLEAN, BOOLEAN, UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_restore_batches(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_receive_po_item(UUID, UUID, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_effective_shelf_life(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_deduct_fefo(UUID, NUMERIC, BOOLEAN, BOOLEAN, UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_restore_batches(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.inv_receive_po_item(UUID, UUID, NUMERIC, TEXT, DATE, TEXT) TO service_role;
ALTER TABLE public.raw_material_category_shelf_life ENABLE ROW LEVEL SECURITY;

-- Tell PostgREST about the new functions/table.
NOTIFY pgrst, 'reload schema';
