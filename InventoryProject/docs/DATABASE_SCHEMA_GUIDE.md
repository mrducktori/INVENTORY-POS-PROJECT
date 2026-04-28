# Database Schema for Sales Logs, Audit Logs & Summary Reports

## Overview
This document outlines the database structure needed to:
1. Display sales logs as receipts (staff, time, items)
2. Maintain detailed audit logs for staff activities
3. Generate summary reports (daily, weekly, monthly)

---

## CURRENT STATE
Your database already has:
- ✅ `sales` table (transaction info)
- ✅ `sale_items` table (items in each sale)
- ✅ `audit_logs` table (general logging)
- ✅ `users` table (staff info)

---

## WHAT YOU NEED TO ADD

### 1. **ENHANCED Sales Table** (Modify Existing)
```sql
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS (
  status character varying DEFAULT 'COMPLETED'::character varying,
  payment_status character varying DEFAULT 'PAID'::character varying,
  discount_amount numeric DEFAULT 0.00,
  tax_amount numeric DEFAULT 0.00,
  notes text,
  receipt_number character varying UNIQUE
);

-- INDEX for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
```

**Fields needed:**
- `id` ✅ (already exists)
- `total_amount` ✅ (already exists)
- `payment_method` ✅ (already exists)
- `staff_id` ✅ (already exists - links to staff)
- `created_at` ✅ (already exists - timestamp)
- `status` (NEW) - 'COMPLETED', 'REFUNDED', 'PENDING'
- `payment_status` (NEW) - 'PAID', 'PENDING', 'PARTIAL'
- `discount_amount` (NEW) - for discounts applied
- `tax_amount` (NEW) - for tax calculations
- `notes` (NEW) - additional info
- `receipt_number` (NEW) - unique receipt ID for receipt view

---

### 2. **ENHANCED Sale Items** (Minor Addition)
```sql
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS (
  discount_percent numeric DEFAULT 0.00,
  notes text
);
```

**Fields needed:**
- `id` ✅ (already exists)
- `sale_id` ✅ (already exists - links to sales)
- `product_id` ✅ (already exists - links to products)
- `quantity` ✅ (already exists)
- `unit_price` ✅ (already exists)
- `discount_percent` (NEW) - item-level discount
- `notes` (NEW) - item notes (e.g., "No ice", "Extra sugar")

---

### 3. **ENHANCED Audit Logs** (Modify Existing)
```sql
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS (
  action_type character varying NOT NULL,
  entity_type character varying,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address character varying,
  user_agent character varying
);

-- INDEX for faster audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
```

**Fields needed:**
- `id` ✅ (already exists)
- `action` ✅ (already exists - general description)
- `user_id` ✅ (already exists - which staff member)
- `details` ✅ (already exists - what happened)
- `created_at` ✅ (already exists - timestamp)
- `action_type` (NEW) - 'LOGIN', 'LOGOUT', 'SALE', 'DISCOUNT', 'REFUND', 'DELETE', 'UPDATE'
- `entity_type` (NEW) - 'SALE', 'PRODUCT', 'USER', 'INGREDIENT'
- `entity_id` (NEW) - ID of affected entity
- `old_value` (NEW) - previous value (for updates)
- `new_value` (NEW) - new value (for updates)
- `ip_address` (NEW) - for security tracking
- `user_agent` (NEW) - browser/app info

---

### 4. **NEW: Daily Sales Summary Table**
```sql
CREATE TABLE public.daily_sales_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  summary_date date NOT NULL UNIQUE,
  total_sales numeric DEFAULT 0.00,
  total_transactions integer DEFAULT 0,
  total_items_sold integer DEFAULT 0,
  total_discounts numeric DEFAULT 0.00,
  total_tax numeric DEFAULT 0.00,
  average_transaction numeric DEFAULT 0.00,
  staff_count integer DEFAULT 0,
  payment_methods jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_sales_summary_pkey PRIMARY KEY (id)
);

-- INDEX for date range queries
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_date ON public.daily_sales_summary(summary_date DESC);
```

**Fields:**
- `id` - UUID primary key
- `summary_date` - Date (2024-04-20)
- `total_sales` - Sum of all sales for the day
- `total_transactions` - Count of transactions
- `total_items_sold` - Sum of quantity
- `total_discounts` - Sum of discounts
- `total_tax` - Sum of taxes
- `average_transaction` - total_sales / transactions
- `staff_count` - Number of staff who made sales
- `payment_methods` - JSON: {cash: 100, card: 50, online: 25}
- `created_at` & `updated_at` - timestamps

---

### 5. **NEW: Staff Performance Summary Table**
```sql
CREATE TABLE public.staff_performance_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  summary_date date NOT NULL,
  summary_type character varying NOT NULL,  -- 'DAILY', 'WEEKLY', 'MONTHLY'
  total_sales numeric DEFAULT 0.00,
  total_transactions integer DEFAULT 0,
  total_items_sold integer DEFAULT 0,
  average_transaction_value numeric DEFAULT 0.00,
  top_product_id uuid,
  shifts_worked integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_performance_summary_pkey PRIMARY KEY (id),
  CONSTRAINT staff_performance_summary_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_staff_summary UNIQUE (staff_id, summary_date, summary_type)
);

-- INDEX for queries
CREATE INDEX IF NOT EXISTS idx_staff_performance_date ON public.staff_performance_summary(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_type ON public.staff_performance_summary(summary_type);
```

**Fields:**
- `id` - UUID primary key
- `staff_id` - Which staff member (FK to users)
- `summary_date` - Date of summary
- `summary_type` - 'DAILY', 'WEEKLY', 'MONTHLY'
- `total_sales` - Money earned by this staff
- `total_transactions` - Orders made by this staff
- `total_items_sold` - Items sold by this staff
- `average_transaction_value` - Avg sale per transaction
- `top_product_id` - Best selling product for this staff
- `shifts_worked` - Number of shifts
- `created_at` - timestamp

---

### 6. **NEW: Refunds Table**
```sql
CREATE TABLE public.refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  reason character varying NOT NULL,
  refund_amount numeric NOT NULL,
  refund_items jsonb NOT NULL,
  refunded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE,
  CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.users(id)
);

-- INDEX
CREATE INDEX IF NOT EXISTS idx_refunds_sale_id ON public.refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at);
```

**Fields:**
- `id` - UUID primary key
- `sale_id` - Which sale was refunded
- `reason` - Why refunded
- `refund_amount` - Money refunded
- `refund_items` - JSON list of items refunded
- `refunded_by` - Which staff approved the refund
- `created_at` - timestamp

---

## SUMMARY: What to Add

### SQL Commands to Run:
```sql
-- 1. Add fields to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'COMPLETED';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status character varying DEFAULT 'PAID';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS receipt_number character varying UNIQUE;

-- 2. Add fields to sale_items table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0.00;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes text;

-- 3. Add fields to audit_logs table
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent character varying;

-- 4. Create daily_sales_summary table
CREATE TABLE IF NOT EXISTS public.daily_sales_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  summary_date date NOT NULL UNIQUE,
  total_sales numeric DEFAULT 0.00,
  total_transactions integer DEFAULT 0,
  total_items_sold integer DEFAULT 0,
  total_discounts numeric DEFAULT 0.00,
  total_tax numeric DEFAULT 0.00,
  average_transaction numeric DEFAULT 0.00,
  staff_count integer DEFAULT 0,
  payment_methods jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_sales_summary_pkey PRIMARY KEY (id)
);

-- 5. Create staff_performance_summary table
CREATE TABLE IF NOT EXISTS public.staff_performance_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  summary_date date NOT NULL,
  summary_type character varying NOT NULL,
  total_sales numeric DEFAULT 0.00,
  total_transactions integer DEFAULT 0,
  total_items_sold integer DEFAULT 0,
  average_transaction_value numeric DEFAULT 0.00,
  top_product_id uuid,
  shifts_worked integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_performance_summary_pkey PRIMARY KEY (id),
  CONSTRAINT staff_performance_summary_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_staff_summary UNIQUE (staff_id, summary_date, summary_type)
);

-- 6. Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  reason character varying NOT NULL,
  refund_amount numeric NOT NULL,
  refund_items jsonb NOT NULL,
  refunded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE,
  CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.users(id)
);

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_date ON public.daily_sales_summary(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_date ON public.staff_performance_summary(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_type ON public.staff_performance_summary(summary_type);
CREATE INDEX IF NOT EXISTS idx_refunds_sale_id ON public.refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at);
```

---

## Data Flow

### Receipt View (Sales Log)
```
User clicks on a sale
  ↓
Fetch from `sales` table (staff_id, created_at, total_amount, receipt_number)
  ↓
Fetch from `sale_items` table (products, quantities, prices)
  ↓
Fetch staff name from `users` table
  ↓
Display Receipt Format:
  - Receipt #12345
  - Staff: John Doe
  - Date/Time: 2024-04-20 14:30
  - Items: [list with prices]
  - Subtotal, Tax, Discount, Total
```

### Audit Logs View
```
Admin clicks "Audit Logs"
  ↓
Query `audit_logs` with filters:
  - Date range (start_date, end_date)
  - Staff member (staff_id)
  - Action type (SALE, LOGIN, REFUND, etc)
  - Entity type (SALE, PRODUCT, etc)
  ↓
Display Table:
  - Time
  - Staff
  - Action
  - Entity
  - Details
  - Old/New Values
```

### Summary Report
```
Admin selects "Daily, Weekly, or Monthly" report
  ↓
Query `daily_sales_summary` or calculate from `sales`:
  - If DAILY: Group by date
  - If WEEKLY: Group by week (start_date to end_date)
  - If MONTHLY: Group by month (year-month)
  ↓
Query `staff_performance_summary` for staff breakdown
  ↓
Display:
  - Total Sales
  - Number of Transactions
  - Items Sold
  - Average Transaction
  - Top Staff / Top Products
  - Payment Methods Breakdown
```

---

## Summary Table

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| sales (modified) | Store completed sales | receipt_number, status, discount_amount, tax_amount |
| sale_items (modified) | Items in sales | discount_percent, notes |
| audit_logs (modified) | Staff activities | action_type, entity_type, old_value, new_value |
| daily_sales_summary | Daily totals | summary_date, total_sales, total_transactions |
| staff_performance_summary | Staff performance | staff_id, summary_type, total_sales, total_transactions |
| refunds | Track refunds | sale_id, reason, refund_amount |

---

## Implementation Order

1. ✅ **Run the SQL commands** to create/modify tables
2. 📝 **Update API functions** to log to audit_logs
3. 📊 **Create daily batch job** to calculate summaries
4. 🧾 **Build Receipt View** UI component
5. 📋 **Build Audit Logs View** with filters
6. 📈 **Build Summary Report** with day/week/month tabs

---

## Notes

- **Daily Summary**: Should be calculated via a database trigger or scheduled job (runs at midnight)
- **Audit Logs**: Should be auto-inserted whenever a sale, refund, or action occurs
- **Performance**: Indexes are critical for date-range queries
- **JSON Fields**: Used for flexible data (payment_methods, refund_items)

