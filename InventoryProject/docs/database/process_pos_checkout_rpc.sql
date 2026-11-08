-- ============================================================================
-- Single Database Transaction RPC: process_pos_checkout
-- Wraps order creation, sale items insertion, and inventory deductions 
-- in a single atomic database transaction with row-level locks and automatic rollback.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_pos_checkout(
  p_sale_data JSONB,
  p_sale_items JSONB,
  p_product_deductions JSONB,
  p_ingredient_deductions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_created_sale RECORD;
  v_prod RECORD;
  v_ing RECORD;
  v_item RECORD;
  v_curr_stock NUMERIC;
  v_req_qty NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  -- 1. VERIFY & DEDUCT PRODUCT STOCKS ATOMICALLY (with FOR UPDATE row locking)
  FOR v_prod IN SELECT * FROM jsonb_to_recordset(p_product_deductions) AS x(id UUID, name TEXT, qty NUMERIC)
  LOOP
    SELECT stock_quantity INTO v_curr_stock 
    FROM products 
    WHERE id = v_prod.id AND is_archived = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % (%) not found or is archived', v_prod.name, v_prod.id;
    END IF;

    IF v_curr_stock < v_prod.qty THEN
      RAISE EXCEPTION 'Insufficient stock for product "%": requires %, but only % is in stock', 
        v_prod.name, v_prod.qty, v_curr_stock;
    END IF;

    v_new_stock := v_curr_stock - v_prod.qty;

    UPDATE products 
    SET stock_quantity = v_new_stock 
    WHERE id = v_prod.id;
  END LOOP;

  -- 2. VERIFY & DEDUCT INGREDIENT STOCKS ATOMICALLY (with FOR UPDATE row locking)
  FOR v_ing IN SELECT * FROM jsonb_to_recordset(p_ingredient_deductions) AS x(id UUID, name TEXT, qty NUMERIC)
  LOOP
    SELECT stock_quantity INTO v_curr_stock 
    FROM ingredients 
    WHERE id = v_ing.id AND is_archived = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ingredient % (%) not found or is archived', v_ing.name, v_ing.id;
    END IF;

    IF v_curr_stock < v_ing.qty THEN
      RAISE EXCEPTION 'Insufficient stock for ingredient "%": requires %, but only % is in stock', 
        v_ing.name, ROUND(v_ing.qty, 2), ROUND(v_curr_stock, 2);
    END IF;

    v_new_stock := v_curr_stock - v_ing.qty;

    UPDATE ingredients 
    SET stock_quantity = v_new_stock 
    WHERE id = v_ing.id;
  END LOOP;

  -- 3. INSERT SALE RECORD
  INSERT INTO sales (
    total_amount,
    payment_method,
    staff_id,
    receipt_number,
    discount_amount,
    tax_amount,
    status,
    payment_status,
    amount_received,
    change_amount,
    transaction_reference,
    notes
  )
  VALUES (
    (p_sale_data->>'total_amount')::NUMERIC,
    COALESCE(p_sale_data->>'payment_method', 'CASH'),
    (p_sale_data->>'staff_id')::UUID,
    p_sale_data->>'receipt_number',
    COALESCE((p_sale_data->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_sale_data->>'tax_amount')::NUMERIC, 0),
    COALESCE(p_sale_data->>'status', 'COMPLETED'),
    COALESCE(p_sale_data->>'payment_status', 'PAID'),
    COALESCE((p_sale_data->>'amount_received')::NUMERIC, 0),
    COALESCE((p_sale_data->>'change_amount')::NUMERIC, 0),
    COALESCE(p_sale_data->>'transaction_reference', ''),
    COALESCE(p_sale_data->>'notes', '')
  )
  RETURNING * INTO v_created_sale;

  v_sale_id := v_created_sale.id;

  -- 4. INSERT SALE ITEMS
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_sale_items) AS x(
    product_id UUID,
    quantity NUMERIC,
    unit_price NUMERIC,
    cup_size TEXT,
    add_ons JSONB,
    discount_percent NUMERIC,
    notes TEXT
  )
  LOOP
    INSERT INTO sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      cup_size,
      add_ons,
      discount_percent,
      notes
    )
    VALUES (
      v_sale_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_price,
      v_item.cup_size,
      COALESCE(
        ARRAY(
          SELECT CASE 
            WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
            ELSE elem::text 
          END
          FROM jsonb_array_elements(COALESCE(v_item.add_ons, '[]'::jsonb)) AS elem
        ),
        ARRAY[]::text[]
      ),
      COALESCE(v_item.discount_percent, 0),
      COALESCE(v_item.notes, '')
    );
  END LOOP;

  -- 5. RETURN CREATED SALE
  RETURN to_jsonb(v_created_sale);
END;
$$;
