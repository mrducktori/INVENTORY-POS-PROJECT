# Quick Reference: Database Schema Summary

## TL;DR - What to Add to Database

### Tables to MODIFY (Add Fields):
```
1. sales table → Add 6 fields
2. sale_items table → Add 2 fields  
3. audit_logs table → Add 7 fields
```

### Tables to CREATE (New):
```
1. daily_sales_summary
2. staff_performance_summary
3. refunds
```

---

## Exact SQL to Run (Copy & Paste)

```sql
-- ========== MODIFY EXISTING TABLES ==========

-- 1. Add to SALES table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'COMPLETED';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status character varying DEFAULT 'PAID';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS receipt_number character varying UNIQUE;

-- 2. Add to SALE_ITEMS table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0.00;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes text;

-- 3. Add to AUDIT_LOGS table
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent character varying;

-- ========== CREATE NEW TABLES ==========

-- 4. CREATE DAILY_SALES_SUMMARY table
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

-- 5. CREATE STAFF_PERFORMANCE_SUMMARY table
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

-- 6. CREATE REFUNDS table
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

-- ========== CREATE INDEXES ==========

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

## What Each Table Does

### SALES (Modified)
```
| receipt_number | status | discount | tax | notes |
| RCP-20240420-1 | COMPLETED | 50 | 40 | ... |
```
**Why**: Track receipt number, status, discounts & tax for reporting

### SALE_ITEMS (Modified)
```
| item_id | discount_percent | notes |
| 1 | 10 | "No ice" |
```
**Why**: Item-level discounts and special instructions

### AUDIT_LOGS (Modified)
```
| action_type | entity_type | entity_id | old_value | new_value |
| SALE | SALE | uuid | null | {sale_data} |
```
**Why**: Track WHAT changed, NOT JUST that it changed

### DAILY_SALES_SUMMARY (New)
```
| summary_date | total_sales | transactions | items_sold | avg_transaction |
| 2024-04-20 | 5450.00 | 42 | 156 | 129.76 |
```
**Why**: Fast daily reports without recalculating from sales table

### STAFF_PERFORMANCE_SUMMARY (New)
```
| staff_id | summary_type | total_sales | transactions |
| uuid | DAILY | 1200.00 | 10 |
| uuid | WEEKLY | 8400.00 | 70 |
```
**Why**: Fast staff performance by day/week/month

### REFUNDS (New)
```
| sale_id | reason | refund_amount | refunded_by |
| uuid | Wrong order | 250.00 | admin_id |
```
**Why**: Track all refunds separately for auditing

---

## 3 Key Features You'll Build

### Feature 1: Receipt View
**What**: Click on a sale → see formatted receipt
**Needs**: Modified sales + sale_items
**Data Flow**:
```
Click sale #12345
  ↓
Query: sales JOIN sale_items JOIN products JOIN users
  ↓
Show Receipt:
  - Receipt #: RCP-20240420-12345
  - Staff: John Doe
  - Time: 2024-04-20 14:30
  - Items: Coffee x2 @ 120
  - Total: ₱250
```

### Feature 2: Audit Logs
**What**: Admin sees all staff activities
**Needs**: Enhanced audit_logs table
**Data Flow**:
```
Admin opens "Audit Logs"
  ↓
Filter by: date range, staff, action type
  ↓
Show Table:
  - 14:30 - John - SALE - Order #12345 - ₱250
  - 14:32 - Jane - REFUND - Order #12344 - ₱-100
  - 15:00 - Mike - LOGIN - Logged in
```

### Feature 3: Summary Report
**What**: Daily/Weekly/Monthly sales totals
**Needs**: daily_sales_summary + staff_performance_summary
**Data Flow**:
```
Admin selects "Daily" period
  ↓
Query: daily_sales_summary for date range
  ↓
Show Dashboard:
  - Total: ₱15,450
  - Transactions: 124
  - Items: 456
  - Avg: ₱124.60
  - Staff Breakdown:
    * John: ₱5,000 (42 sales)
    * Jane: ₱4,500 (38 sales)
```

---

## Field Descriptions

### SALES Added Fields
| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| status | varchar | COMPLETED | Sale status (for voids/refunds) |
| payment_status | varchar | PAID | Payment tracking |
| discount_amount | numeric | 50.00 | Total discount applied |
| tax_amount | numeric | 40.00 | Total tax applied |
| notes | text | "Dine-in" | Additional info |
| receipt_number | varchar | RCP-20240420-1 | Unique receipt ID |

### AUDIT_LOGS Added Fields
| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| action_type | varchar | SALE | What action (detailed) |
| entity_type | varchar | SALE | What type of entity |
| entity_id | uuid | ... | Which entity ID |
| old_value | jsonb | null | Previous data |
| new_value | jsonb | {...} | New data |
| ip_address | varchar | 192.168.1.1 | Security tracking |
| user_agent | varchar | Chrome/... | App/browser info |

### DAILY_SALES_SUMMARY Fields
| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| summary_date | date | 2024-04-20 | Which day |
| total_sales | numeric | 5450.00 | Total revenue |
| total_transactions | int | 42 | How many sales |
| total_items_sold | int | 156 | Items count |
| average_transaction | numeric | 129.76 | Revenue per sale |
| staff_count | int | 3 | Staff working |

---

## Testing After Setup

Run these to verify:

```sql
-- Check modified tables
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sales';

-- Should show: receipt_number, discount_amount, tax_amount, status, etc.

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('daily_sales_summary', 'staff_performance_summary', 'refunds');

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';
```

---

## Common Issues & Fixes

### Issue: "Column already exists"
**Fix**: The column was already added. Script is safe to re-run.

### Issue: "Foreign key constraint fails"
**Fix**: Ensure `users`, `sales`, and `products` tables exist first

### Issue: Indexes not appearing
**Fix**: They're optional for functionality, only for performance

### Issue: Unique constraint on receipt_number fails
**Fix**: Set receipt_number = NULL for existing sales, then add constraint

---

## Next Phase: Implementation

After running SQL:
1. ✅ Database ready
2. 📝 Create logsApi.js (API layer)
3. 🧾 Create Receipt component
4. 📋 Create Audit Logs component
5. 📊 Update Summary Report component

See `IMPLEMENTATION_CHECKLIST.md` for details.

