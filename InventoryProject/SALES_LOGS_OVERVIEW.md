# Sales Logs & Audit System - Complete Overview

## What You're Building

A complete system that includes:
1. **Receipt View** - View individual sales as receipts (staff, time, items)
2. **Audit Logs** - Track all staff activities (logins, sales, refunds, etc.)
3. **Summary Reports** - Daily, Weekly, Monthly sales summaries

---

## Database Tables You Need

### 1. Modify Existing `sales` table
Add these 6 fields:
```
- status (COMPLETED, REFUNDED, PENDING)
- payment_status (PAID, PENDING)
- discount_amount (decimal)
- tax_amount (decimal)
- notes (text)
- receipt_number (unique ID like "RCP-20240420-123456")
```

### 2. Modify Existing `sale_items` table
Add these 2 fields:
```
- discount_percent (per item discount)
- notes (special instructions)
```

### 3. Enhance Existing `audit_logs` table
Add these 7 fields:
```
- action_type (SALE, LOGIN, LOGOUT, REFUND, DELETE)
- entity_type (SALE, PRODUCT, USER)
- entity_id (UUID of affected entity)
- old_value (JSON - previous data)
- new_value (JSON - new data)
- ip_address (for security)
- user_agent (browser info)
```

### 4. Create NEW `daily_sales_summary` table
Stores daily aggregated data:
```
- summary_date (date)
- total_sales (sum of all sales)
- total_transactions (count)
- total_items_sold (sum of quantities)
- total_discounts (sum of discounts)
- total_tax (sum of tax)
- average_transaction (total_sales / transactions)
- staff_count (how many staff worked)
- payment_methods (JSON breakdown)
```

### 5. Create NEW `staff_performance_summary` table
Stores performance data by day/week/month:
```
- staff_id (which staff member)
- summary_date (date)
- summary_type (DAILY, WEEKLY, MONTHLY)
- total_sales (money they made)
- total_transactions (orders they took)
- total_items_sold (items they sold)
- average_transaction_value (avg per sale)
- top_product_id (best selling item)
- shifts_worked (number of shifts)
```

### 6. Create NEW `refunds` table
Tracks all refunds:
```
- sale_id (which sale was refunded)
- reason (why refunded)
- refund_amount (money refunded)
- refund_items (JSON list)
- refunded_by (which staff approved)
```

---

## How to Implement

### Step 1: Database (Run SQL)
Copy all SQL from `IMPLEMENTATION_CHECKLIST.md` Phase 1 and run in Supabase console.

### Step 2: Create API Functions
Create new file: `src/api/logsApi.js` with functions:
- `getSalesReceipt(saleId)` - Get receipt data
- `getAuditLogs(filters)` - Get audit logs with filters
- `getDailySalesSummary(date)` - Get day's summary
- `getSalesReportByPeriod(start, end, period)` - Get period summary
- `logAuditActivity(action_type, entity_type, id, details)` - Log activities

### Step 3: Update POS API
Modify `src/api/posApi.js`:
- When creating sale: generate receipt_number and log to audit_logs
- Include new fields: discount, tax, status

### Step 4: Create UI Components
- `SalesReceiptModal.jsx` - Display receipt format
- `AuditLogs.jsx` - Show audit logs table with filters
- Modify `SalesSummaryReport.jsx` - Add day/week/month tabs

### Step 5: Integrate into Dashboard
Add menu items in Dashboard.jsx:
- Transaction Logs (shows receipts)
- Audit Logs (shows activities)
- Sales Report (shows summaries)

---

## User Workflows

### Workflow 1: View Receipt (Staff/Admin)
```
1. Go to "Transaction Logs"
2. See list of sales
3. Click on a sale
4. Modal shows receipt format:
   - Receipt #12345
   - Staff: John Doe
   - Date/Time: 2024-04-20 14:30
   - Items: [Coffee x2 @ 120]
   - Subtotal: 240
   - Tax: 20
   - Discount: 10
   - TOTAL: 250
5. Print option (optional)
```

### Workflow 2: View Audit Logs (Admin Only)
```
1. Go to "Audit Logs"
2. See all staff activities
3. Filter by:
   - Date range (start to end)
   - Staff member
   - Action (Sale, Login, Refund)
4. View details:
   - Time: 2024-04-20 14:30:15
   - Staff: John Doe
   - Action: SALE
   - Changed: Sale #12345 for ₱250
```

### Workflow 3: View Sales Report (Admin Only)
```
1. Go to "Sales Summary Report"
2. Choose period:
   - DAILY (shows today, or select date)
   - WEEKLY (shows this week)
   - MONTHLY (shows this month)
3. See dashboard cards:
   - Total Sales: ₱15,450
   - Transactions: 124
   - Items Sold: 456
   - Avg Transaction: ₱124.60
4. See staff breakdown table:
   - John: ₱5,000 (42 sales)
   - Jane: ₱4,500 (38 sales)
   - Mike: ₱5,950 (44 sales)
5. See charts (optional):
   - Sales by hour
   - Top 10 products
   - Payment methods
```

---

## Important Notes

### Audit Logging Best Practices
Every action should log:
```javascript
await logAuditActivity(
  'SALE',              // what action
  'SALE',              // what type of entity
  saleId,              // which entity
  {
    staff: userInfo,
    total: amount,
    items: itemCount
  }
);
```

### Auto-Increment Summaries
Add cron job or database trigger to calculate summaries nightly:
```
Every night at 00:00 (midnight):
  - Calculate previous day's summary
  - Insert into daily_sales_summary
  - Calculate staff performance
```

### Indexes for Performance
Critical for reports:
```
- sales(staff_id) - for staff filtering
- sales(created_at) - for date filtering
- audit_logs(created_at) - for date range queries
- daily_sales_summary(summary_date DESC) - for report queries
```

### Receipt Number Format
Suggested format: `RCP-YYYYMMDD-XXXXXX`
- RCP = Receipt prefix
- YYYYMMDD = Date (20240420)
- XXXXXX = Last 6 digits of timestamp

---

## Testing Checklist

- [ ] Database tables created and fields added
- [ ] Can insert sales with receipt_number
- [ ] Can query sales with staff info
- [ ] Audit logs capture SALE actions
- [ ] Receipt modal displays correctly
- [ ] Audit logs filter by date/staff/action works
- [ ] Daily summary calculates correctly
- [ ] Weekly report groups by week
- [ ] Monthly report groups by month
- [ ] Staff performance shows correct totals

---

## Files to Create/Modify

### Create New Files
```
src/api/logsApi.js                          (NEW - API functions)
src/front/SalesReceiptModal.jsx             (NEW - Receipt view)
src/front/AuditLogs.jsx                     (NEW - Audit logs view)
src/front/SalesReceipt.jsx                  (NEW - Full page view)
```

### Modify Existing Files
```
src/api/posApi.js                           (UPDATE - add logging)
src/front/Dashboard.jsx                     (UPDATE - add menu items)
src/front/SalesSummaryReport.jsx            (UPDATE - add tabs)
supabase_schema.sql                         (UPDATE - add new tables)
```

---

## Database Query Examples

### Get Receipt Data
```sql
SELECT 
  s.id, s.receipt_number, s.created_at, s.total_amount,
  s.discount_amount, s.tax_amount,
  u.name as staff_name,
  array_agg(json_build_object(
    'name', p.name,
    'quantity', si.quantity,
    'unit_price', si.unit_price
  )) as items
FROM sales s
JOIN users u ON s.staff_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
LEFT JOIN products p ON si.product_id = p.id
WHERE s.id = $1
GROUP BY s.id, u.name;
```

### Get Daily Summary
```sql
SELECT 
  DATE(s.created_at) as summary_date,
  SUM(s.total_amount) as total_sales,
  COUNT(DISTINCT s.id) as total_transactions,
  SUM(si.quantity) as total_items_sold,
  COUNT(DISTINCT s.staff_id) as staff_count
FROM sales s
LEFT JOIN sale_items si ON s.id = si.sale_id
WHERE DATE(s.created_at) = $1
GROUP BY DATE(s.created_at);
```

### Get Audit Logs with Filters
```sql
SELECT *
FROM audit_logs
WHERE created_at BETWEEN $1 AND $2
  AND ($3::uuid IS NULL OR user_id = $3)
  AND ($4::varchar IS NULL OR action_type = $4)
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;
```

---

## Summary

**Minimum required:**
1. Add 6 fields to `sales` table ✅
2. Create `daily_sales_summary` table ✅
3. Create `staff_performance_summary` table ✅
4. Create `logsApi.js` with 4 functions ✅
5. Create receipt modal component ✅
6. Update SalesSummaryReport with tabs ✅

**Optional but recommended:**
- Audit logs enhancements
- Refunds tracking
- Auto-summary calculations
- Charts and analytics

---

## Next Steps

1. Run SQL commands from `IMPLEMENTATION_CHECKLIST.md`
2. Verify tables created in Supabase
3. Create `logsApi.js` 
4. Create UI components
5. Test each feature
6. Deploy

