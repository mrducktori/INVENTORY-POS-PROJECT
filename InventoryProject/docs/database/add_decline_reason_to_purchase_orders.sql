-- Migration: Add decline_reason column to purchase_orders table
-- Supports supplier decline reason capture and history tracking

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

COMMENT ON COLUMN purchase_orders.decline_reason IS 'Mandatory explanatory reason provided by the supplier when status is updated to DECLINED';
