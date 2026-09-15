# Cof/Tea Cafe Inventory & POS System

## Overview

A comprehensive, full-stack **Inventory Management and Point of Sale (POS)** system designed for Cof/Tea Cafe (Elwood Branch). The system handles everything from cash register operations to raw material tracking, dynamic recipe deductions, and detailed financial analytics.

## Features

### Frontend (React + Vite)
- **Login Screen**: Premium glassmorphism aesthetic featuring the cafe's storefront.
- **POS Interface**: Intelligent product filtering, dynamic size/add-on configuration (with quantities), cart management, and checkout.
- **Dashboard**: Real-time business insights, revenue snapshots, low-stock alerts, and quick actions.
- **Inventory Control**: 
  - Raw material management (ingredients, cups, packaging).
  - Purchase Orders (PO) and Goods Receipt processing.
  - Stock Requests & Wastage logging.
- **Product Management**: 
  - Manage Legacy items (direct stock) vs. Recipe-based items (milk tea, frappes).
  - Configure **Global Category Settings** (default sizes and add-ons) and product-specific overrides.
- **Reports**: Granular sales data, top products, cash register summaries, and audit logs.
- **Staff Management**: User roles and activity tracking.

### Backend (Node.js + Express)
- Modular API routes spanning `/api/pos`, `/api/inventory`, `/api/products`, `/api/analytics`, and more.
- Comprehensive POS deduction logic handling raw material conversions, multi-quantity add-ons, and low-stock prevention.
- JWT-based authentication and role-based middleware.

### Database Architecture
Powered by Supabase (PostgreSQL), utilizing the following core tables:
```sql
users                -- Staff accounts, roles (admin, cashier), credentials
products             -- Menu items and direct-stock items
ingredients          -- Raw materials (syrups, powders, cups) with current stock levels
recipes              -- Junction table linking products to ingredients
category_settings    -- Global default sizes and add-ons per category
sales                -- Transaction records (total, status, staff ID)
sale_items           -- Line items for each sale with size/add-on JSON payloads
purchase_orders      -- Supplier POs for restocking ingredients
po_items             -- Line items within a PO
inventory_logs       -- Audit trail of all stock movements (restocks, manual edits, sales, voids)
wastage_logs         -- Records of spoiled or wasted materials
stock_requests       -- Internal branch requests for stock
cash_register        -- Shift-based cash drawer management
```

## Running the Application

1. **Start the Backend:**
   ```bash
   cd ./server
   npm install
   node server.js
   ```
   *The server runs on http://localhost:5000*

2. **Start the Frontend:**
   ```bash
   npm install
   npm run dev
   ```
   *The frontend runs on http://localhost:5173*
