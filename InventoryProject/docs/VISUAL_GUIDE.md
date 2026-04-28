# Database Schema Visual Guide

## Data Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Staff Member)                       │
│                     id | name | role | email                    │
└────────────┬──────────────────────────────────────────────────┬──┘
             │                                                  │
             │ staff_id                                    user_id
             ▼                                                  ▼
    ┌─────────────────────┐                      ┌─────────────────────┐
    │     SALES           │                      │   AUDIT_LOGS (NEW)  │
    │ ─────────────────── │                      │ ─────────────────── │
    │ • id (PK)           │◄─────sale_id─────┐   │ • id (PK)           │
    │ • receipt_number✓   │                   │   │ • action_type✓      │
    │ • total_amount      │                   │   │ • entity_type✓      │
    │ • discount_amount✓  │                   │   │ • entity_id✓        │
    │ • tax_amount✓       │                   │   │ • old_value✓        │
    │ • status✓           │                   │   │ • new_value✓        │
    │ • payment_status✓   │                   │   │ • created_at        │
    │ • created_at        │                   │   └─────────────────────┘
    │ • notes✓            │                   │
    │ • staff_id (FK)     │                   │
    └─────────┬───────────┘                   │
              │                               │
              │ sale_id                       │
              ▼                               │
    ┌─────────────────────┐                   │
    │   SALE_ITEMS        │───────────────────┘
    │ ─────────────────── │
    │ • id (PK)           │
    │ • product_id (FK)   │
    │ • quantity          │
    │ • unit_price        │
    │ • discount_percent✓ │
    │ • notes✓            │
    └─────────────────────┘
              │
              │ product_id
              ▼
    ┌─────────────────────┐
    │    PRODUCTS         │
    │ ─────────────────── │
    │ • id (PK)           │
    │ • name              │
    │ • category          │
    │ • price             │
    └─────────────────────┘
```

---

## Reporting Flow

```
                    ┌─────────────────────────────┐
                    │  Admin Views Sales Report    │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │   Select Period              │
                    │ • DAILY • WEEKLY • MONTHLY   │
                    └──────────────┬────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Query SALES  │  │ Query SALES  │  │ Query SALES  │
        │ by date      │  │ by week      │  │ by month     │
        │ 2024-04-20   │  │ 04-15 to 04-21 │ 2024-04     │
        └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
               │                 │                 │
               └─────────────────┼─────────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │ Calculate / Fetch Summary │
                    │ from daily_sales_summary  │
                    │ & staff_performance_      │
                    │ summary                   │
                    └────────────┬──────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
        ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Display Cards   │ │ Staff Table   │ │ Payment Mix  │
        │ • Total Sales   │ │ • Names       │ │ • Cash: 60%  │
        │ • Transactions  │ │ • Individual  │ │ • Card: 40%  │
        │ • Items Sold    │ │   Sales       │ └──────────────┘
        │ • Avg Trans     │ │ • Rankings    │
        └─────────────────┘ └──────────────┘
```

---

## Receipt View Data Flow

```
┌──────────────────────┐
│  User clicks SALE    │
│  from transaction    │
│  log                 │
└──────────┬───────────┘
           │
           │ saleId = 12345
           ▼
    ┌─────────────────────────────────────────┐
    │ Query sales table WHERE id = 12345      │
    │ JOINs: users, sale_items, products      │
    └──────────────────┬──────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │ Fetch receipt data:        │
         │ • Receipt number           │
         │ • Staff name               │
         │ • Timestamp                │
         │ • Items list               │
         │ • Total, tax, discount     │
         └─────────────┬──────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Render Receipt Modal        │
        │                              │
        │  ══════════════════════════  │
        │   RECEIPT #RCP-20240420-1    │
        │                              │
        │   Staff: John Doe            │
        │   Date: 2024-04-20 14:30     │
        │   ──────────────────────     │
        │   Coffee x2      ₱240.00     │
        │   Cake x1        ₱120.00     │
        │   ──────────────────────     │
        │   Subtotal:      ₱360.00     │
        │   Discount:      -₱50.00     │
        │   Tax:           +₱40.00     │
        │   ──────────────────────     │
        │   TOTAL:         ₱350.00     │
        │   ══════════════════════════  │
        │   [Print]  [Close]           │
        └──────────────────────────────┘
```

---

## Audit Log Data Flow

```
┌──────────────────────────────────┐
│  Action happens in system        │
│  (e.g., SALE is completed)       │
└──────────────────┬───────────────┘
                   │
                   ▼
        ┌────────────────────────────┐
        │ Call logAuditActivity()    │
        │                            │
        │ action_type: 'SALE'        │
        │ entity_type: 'SALE'        │
        │ entity_id: sale_id         │
        │ user_id: staff_id          │
        │ details: {items, total}    │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Insert into audit_logs     │
        │ table                      │
        └────────────┬───────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  Admin clicks "Audit Logs"             │
    └────────────────┬───────────────────────┘
                     │
         ┌───────────▼────────────┐
         │  Select Filters:       │
         │ • Date range           │
         │ • Staff member         │
         │ • Action type          │
         └───────────┬────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │ Query audit_logs with filters          │
    └────────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │ Display Audit Table:               │
        │ ────────────────────────────────   │
        │ Time | Staff | Action | Entity     │
        │ ────────────────────────────────   │
        │ 14:30| John  | SALE   | SALE #123  │
        │ 14:35| Jane  | REFUND | SALE #122  │
        │ 15:00| Mike  | LOGIN  | N/A        │
        │ 15:15| John  | DELETE | PRODUCT #5 │
        └────────────────────────────────────┘
```

---

## Table Modification Summary

### SALES Table
```
BEFORE:                          AFTER:
┌────────────────────┐          ┌─────────────────────────────┐
│ id                 │          │ id                          │
│ total_amount       │          │ total_amount                │
│ payment_method     │          │ payment_method              │
│ staff_id           │          │ staff_id                    │
│ created_at         │          │ created_at                  │
└────────────────────┘          │ ─ receipt_number (NEW) ✓    │
                                │ ─ status (NEW) ✓            │
                                │ ─ payment_status (NEW) ✓    │
                                │ ─ discount_amount (NEW) ✓   │
                                │ ─ tax_amount (NEW) ✓        │
                                │ ─ notes (NEW) ✓             │
                                └─────────────────────────────┘
```

### SALE_ITEMS Table
```
BEFORE:                          AFTER:
┌────────────────────┐          ┌─────────────────────────────┐
│ id                 │          │ id                          │
│ sale_id            │          │ sale_id                     │
│ product_id         │          │ product_id                  │
│ quantity           │          │ quantity                    │
│ unit_price         │          │ unit_price                  │
└────────────────────┘          │ ─ discount_percent (NEW) ✓  │
                                │ ─ notes (NEW) ✓             │
                                └─────────────────────────────┘
```

### AUDIT_LOGS Table
```
BEFORE:                          AFTER:
┌────────────────────┐          ┌──────────────────────────────┐
│ id                 │          │ id                           │
│ action             │          │ action                       │
│ user_id            │          │ user_id                      │
│ details            │          │ details                      │
│ created_at         │          │ created_at                   │
└────────────────────┘          │ ─ action_type (NEW) ✓        │
                                │ ─ entity_type (NEW) ✓        │
                                │ ─ entity_id (NEW) ✓          │
                                │ ─ old_value (NEW) ✓          │
                                │ ─ new_value (NEW) ✓          │
                                │ ─ ip_address (NEW) ✓         │
                                │ ─ user_agent (NEW) ✓         │
                                └──────────────────────────────┘
```

---

## New Tables Created

### 1. DAILY_SALES_SUMMARY
```
┌────────────────────────────────────┐
│ summary_date: 2024-04-20           │
│ total_sales: ₱5,450.00             │
│ total_transactions: 42             │
│ total_items_sold: 156              │
│ average_transaction: ₱129.76       │
│ staff_count: 3                     │
│ payment_methods: {cash: 25, card:17}│
└────────────────────────────────────┘
```

### 2. STAFF_PERFORMANCE_SUMMARY
```
┌─────────────────────────────────────────┐
│ staff_id: john_uuid                     │
│ summary_date: 2024-04-20                │
│ summary_type: DAILY                     │
│ total_sales: ₱1,200.00                  │
│ total_transactions: 10                  │
│ total_items_sold: 38                    │
│ average_transaction_value: ₱120.00      │
│ top_product_id: coffee_uuid             │
└─────────────────────────────────────────┘
```

### 3. REFUNDS
```
┌──────────────────────────────────┐
│ sale_id: sale_uuid               │
│ reason: Wrong order              │
│ refund_amount: ₱250.00           │
│ refund_items: [...]              │
│ refunded_by: admin_uuid          │
│ created_at: 2024-04-20 14:35     │
└──────────────────────────────────┘
```

---

## Summary Matrix

| Feature | Uses Which Table(s) | New Fields |
|---------|-------------------|-----------|
| **Receipt View** | sales, sale_items, products, users | receipt_number, discount_amount, tax_amount |
| **Audit Logs** | audit_logs, users | action_type, entity_type, entity_id, old/new_value |
| **Daily Report** | daily_sales_summary | (entire table is new) |
| **Weekly Report** | daily_sales_summary | (groups by week) |
| **Monthly Report** | daily_sales_summary | (groups by month) |
| **Staff Performance** | staff_performance_summary, sales | (entire table is new) |
| **Refund Tracking** | refunds, sales | (entire table is new) |

---

## Implementation Priority

### Phase 1: ESSENTIAL (Do First)
- [ ] Modify sales table (add receipt_number, discounts, tax)
- [ ] Modify sale_items table (add notes)
- [ ] Create daily_sales_summary table
- [ ] Build receipt modal UI

### Phase 2: IMPORTANT (Do Second)
- [ ] Enhance audit_logs table
- [ ] Build audit logs UI
- [ ] Build summary report UI

### Phase 3: NICE-TO-HAVE (Do Later)
- [ ] Create refunds table
- [ ] Create staff_performance_summary table
- [ ] Add charts/graphs

---

**Legend**: ✓ = New field, (entire table) = New table

