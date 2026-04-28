# Implementation Checklist: Sales Logs & Audit System

## Phase 1: Database Setup (REQUIRED FIRST)

### Step 1: Add Fields to Existing Tables

Run these SQL commands in your Supabase console:

```sql
-- Add fields to sales table (for receipt info)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'COMPLETED';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status character varying DEFAULT 'PAID';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS receipt_number character varying UNIQUE;

-- Add fields to sale_items table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0.00;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes text;

-- Add fields to audit_logs table (for detailed logging)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent character varying;
```

### Step 2: Create New Tables

```sql
-- Daily Sales Summary (for report aggregation)
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

-- Staff Performance Summary (for day/week/month reports)
CREATE TABLE IF NOT EXISTS public.staff_performance_summary (
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

-- Refunds Table (for tracking refunds)
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
```

### Step 3: Add Indexes (for performance)

```sql
-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);

-- Summary indexes
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_date ON public.daily_sales_summary(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_date ON public.staff_performance_summary(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_type ON public.staff_performance_summary(summary_type);

-- Refunds indexes
CREATE INDEX IF NOT EXISTS idx_refunds_sale_id ON public.refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at);
```

✅ **Once complete, proceed to Phase 2**

---

## Phase 2: Backend API Updates

### Step 1: Create API Functions

File: `src/api/logsApi.js` (NEW)

```javascript
export const getSalesReceipt = async (saleId) => {
  // Fetch sale with staff info, items, total
  // Return formatted receipt data
};

export const getAuditLogs = async (filters = {}) => {
  // filters: { startDate, endDate, staffId, actionType }
  // Return paginated audit logs
};

export const getDailySalesSummary = async (date) => {
  // Fetch or calculate daily summary
  // Return total_sales, transactions, items, etc.
};

export const getSalesReportByPeriod = async (startDate, endDate, period = 'daily') => {
  // period: 'daily', 'weekly', 'monthly'
  // Fetch summaries for date range, grouped by period
};

export const logAuditActivity = async (action_type, entity_type, entity_id, details) => {
  // Insert into audit_logs with all details
};
```

### Step 2: Update POS API

File: `src/api/posApi.js` (MODIFY)

```javascript
// When creating a sale, also log to audit_logs
export const createSale = async (saleData) => {
  // 1. Insert into sales table
  // 2. Insert into sale_items table
  // 3. Call logAuditActivity('SALE', 'SALE', saleId, details)
  // 4. Return receipt data
};

// Add receipt number generation
const generateReceiptNumber = () => {
  const date = new Date();
  const timestamp = date.getTime();
  return `RCP-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${timestamp.toString().slice(-6)}`;
};
```

### Step 3: Update Sale Logging

When a sale completes:
```javascript
// Log to audit_logs
await logAuditActivity(
  'SALE',           // action_type
  'SALE',           // entity_type
  saleId,           // entity_id
  {
    staff_id: userId,
    total_amount: total,
    items_count: items.length,
    payment_method: paymentMethod
  }
);
```

---

## Phase 3: Frontend Components

### Component 1: Receipt View

File: `src/front/SalesReceiptModal.jsx` (NEW)

```jsx
const SalesReceiptModal = ({ saleId, onClose }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReceipt();
  }, [saleId]);

  const fetchReceipt = async () => {
    const data = await getSalesReceipt(saleId);
    setReceipt(data);
  };

  return (
    <div className="receipt-modal">
      {/* Receipt Format */}
      <div className="receipt-content">
        <h2>RECEIPT</h2>
        <p>Receipt #: {receipt?.receipt_number}</p>
        <p>Date/Time: {receipt?.created_at}</p>
        <p>Staff: {receipt?.staff_name}</p>
        
        <table className="receipt-items">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            {receipt?.items?.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>₱{item.unit_price}</td>
                <td>₱{item.quantity * item.unit_price}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-summary">
          <p>Subtotal: ₱{receipt?.subtotal}</p>
          <p>Discount: ₱{receipt?.discount_amount}</p>
          <p>Tax: ₱{receipt?.tax_amount}</p>
          <p><strong>TOTAL: ₱{receipt?.total_amount}</strong></p>
        </div>
      </div>
    </div>
  );
};
```

### Component 2: Audit Logs View

File: `src/front/AuditLogs.jsx` (NEW)

```jsx
const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7*24*60*60*1000),
    endDate: new Date(),
    staffId: null,
    actionType: null
  });

  const fetchLogs = async () => {
    const data = await getAuditLogs(filters);
    setLogs(data);
  };

  return (
    <div className="audit-logs-container">
      {/* Filters */}
      <div className="filters">
        <input type="date" value={filters.startDate} />
        <input type="date" value={filters.endDate} />
        <select value={filters.actionType || ''}>
          <option>All Actions</option>
          <option>SALE</option>
          <option>LOGIN</option>
          <option>REFUND</option>
        </select>
        <button onClick={fetchLogs}>Filter</button>
      </div>

      {/* Logs Table */}
      <table className="audit-logs-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Staff</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Details</th>
            <th>Changed From</th>
            <th>Changed To</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{log.created_at}</td>
              <td>{log.staff_name}</td>
              <td>{log.action_type}</td>
              <td>{log.entity_type} #{log.entity_id}</td>
              <td>{log.details}</td>
              <td>{JSON.stringify(log.old_value)}</td>
              <td>{JSON.stringify(log.new_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Component 3: Sales Summary Report

File: `src/front/SalesSummaryReport.jsx` (MODIFY EXISTING)

```jsx
const SalesSummaryReport = () => {
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date()
  });
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, [period, dateRange]);

  const fetchSummary = async () => {
    const data = await getSalesReportByPeriod(
      dateRange.start,
      dateRange.end,
      period
    );
    setSummary(data);
  };

  return (
    <div className="summary-report">
      <div className="report-controls">
        <button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>
          Daily
        </button>
        <button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>
          Weekly
        </button>
        <button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>
          Monthly
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <h3>Total Sales</h3>
          <p>₱{summary?.total_sales.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Transactions</h3>
          <p>{summary?.total_transactions}</p>
        </div>
        <div className="card">
          <h3>Items Sold</h3>
          <p>{summary?.total_items_sold}</p>
        </div>
        <div className="card">
          <h3>Avg Transaction</h3>
          <p>₱{(summary?.total_sales / summary?.total_transactions).toFixed(2)}</p>
        </div>
      </div>

      {/* Staff Breakdown */}
      <table className="staff-breakdown">
        <thead>
          <tr>
            <th>Staff Member</th>
            <th>Sales</th>
            <th>Transactions</th>
            <th>Avg Sale</th>
          </tr>
        </thead>
        <tbody>
          {summary?.staff_data?.map(staff => (
            <tr key={staff.id}>
              <td>{staff.name}</td>
              <td>₱{staff.total_sales.toFixed(2)}</td>
              <td>{staff.transactions}</td>
              <td>₱{(staff.total_sales / staff.transactions).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## Phase 4: Automated Daily Summary

### Create Database Function (Optional but Recommended)

```sql
-- Function to calculate daily summary
CREATE OR REPLACE FUNCTION calculate_daily_summary(summary_date date)
RETURNS void AS $$
BEGIN
  INSERT INTO public.daily_sales_summary (
    summary_date,
    total_sales,
    total_transactions,
    total_items_sold,
    total_discounts,
    total_tax,
    average_transaction,
    staff_count,
    payment_methods
  )
  SELECT
    summary_date,
    COALESCE(SUM(s.total_amount), 0),
    COUNT(DISTINCT s.id),
    COALESCE(SUM(si.quantity), 0),
    COALESCE(SUM(s.discount_amount), 0),
    COALESCE(SUM(s.tax_amount), 0),
    COALESCE(SUM(s.total_amount) / NULLIF(COUNT(DISTINCT s.id), 0), 0),
    COUNT(DISTINCT s.staff_id),
    jsonb_object_agg(s.payment_method, COUNT(*))
  FROM public.sales s
  LEFT JOIN public.sale_items si ON s.id = si.sale_id
  WHERE DATE(s.created_at) = summary_date
  ON CONFLICT (summary_date) DO UPDATE SET
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## Quick Start Checklist

- [ ] Run all SQL commands from Phase 1
- [ ] Create `logsApi.js` with functions
- [ ] Update `posApi.js` to log activities
- [ ] Add receipt number generation
- [ ] Create `SalesReceiptModal.jsx` component
- [ ] Create `AuditLogs.jsx` component
- [ ] Update `SalesSummaryReport.jsx` component
- [ ] Add routes to Dashboard for these components
- [ ] Test receipt view
- [ ] Test audit logs filtering
- [ ] Test daily/weekly/monthly reports

---

## Data Examples

### Sales Table After Update
```
id: uuid
total_amount: 450.00
payment_method: "cash"
staff_id: uuid (John Doe)
status: "COMPLETED"
discount_amount: 50.00
tax_amount: 40.00
receipt_number: "RCP-20240420-123456"
created_at: 2024-04-20 14:30:00
```

### Audit Logs After Update
```
id: uuid
user_id: uuid (John Doe)
action_type: "SALE"
entity_type: "SALE"
entity_id: uuid (sale ID)
details: "Sold 5 items"
old_value: null
new_value: {sale_id, items, total}
created_at: 2024-04-20 14:30:00
```

### Daily Sales Summary
```
summary_date: 2024-04-20
total_sales: 5,450.00
total_transactions: 42
total_items_sold: 156
average_transaction: 129.76
payment_methods: {cash: 25, card: 17}
```

---

**Next Steps**: Follow the phases in order. Database first, then API, then UI.

