# Changelog

All notable changes to this project will be documented in this file.

## [Overdue Purchase Order Lifecycle & Process Friction Safeguards — 2026-10-23]
- **Overdue Purchase Order Status & Operational Flexibility**:
  - **Dynamic Overdue Detection**:
    - Backend (`server/services/purchasingService.js`) dynamically flags non-terminal orders (`status` not in Received, Cancelled, Declined) whose `expected_date` is earlier than the current Manila date (`expected_date < today`), assigning `is_overdue = true` and calculating exact `days_overdue`.
    - Frontend (`src/utils/dateUtils.js`) provides `isDatePast()` and `getDaysOverdue()` to dynamically format overdue days late (e.g. `8 days late`).
  - **Visual Overdue Badges & Alert Styling**:
    - Table rows in both `PurchaseOrders.jsx` and `SupplierPortal.jsx` render pulsing soft-rose badges: `Overdue (Xd late)` with underlying operational stage indicator (e.g. `Stage: Delivering` or `Stage: Accepted`).
    - Date column displays prominent red alert clock icon and exact days overdue.
  - **Dedicated Overdue Filter Tab**:
    - Added dedicated `Overdue (count)` tab filter in the PO management toolbar in both `PurchaseOrders.jsx` and `SupplierPortal.jsx`.
  - **Operational Flexibility for Overdue Orders**:
    - Store managers and suppliers can take all standard lifecycle actions on overdue orders: **Receive Stock**, **Reschedule Delivery Date**, or **Cancel Order**.
- **Process Friction & Safeguards on Purchase Orders**:
  - **High-Friction Order Cancellation (`CancelPOModal.jsx`)**:
    - Replaced one-click confirmation with an explicit risk review modal.
    - Displays PO reference, supplier name, monetary value, and line item count alongside an irreversible action warning.
    - Enforces mandatory cancellation reason dropdown (e.g. Supplier Unresponsive, Defective/Damaged Goods, Duplicate Order, Pricing Discrepancy) with optional detail notes.
    - Requires an explicit acknowledgment checkbox ("I confirm that I want to void and permanently cancel this purchase order") before the cancel button is enabled.
    - Backend (`purchasingController.js`) enforces non-empty `cancellation_reason` and logs `PURCHASE_ORDER_CANCELLED` audit events.
  - **Delivery Date Rescheduling Workflow (`ReschedulePOModal.jsx`)**:
    - Allows managers and suppliers to set an extended expected delivery date with date picker validation (`min={today}`).
    - Records reschedule reason and history in audit logs and updates the PO delivery schedule, automatically clearing overdue status once rescheduled to the future.
  - **2-Step Verification on Receiving Stock (`ReceivePOModal.jsx`)**:
    - Added a review step between entering received quantities and committing inventory updates to prevent mistaken receiving clicks.
    - Step 2 calculates and previews the exact inventory impact (e.g. `+5 Bags (5,000 g) added to Coffee Beans`) and flags partial vs. full completion before final commitment.
  - **Pre-Submission Order Review Verification (`PurchaseOrderForm.jsx`)**:
    - Added a comprehensive Order Review & Verification modal before placing orders.
    - Displays complete itemized breakdown, purchase units, conversion rates, and total order expenditure with required confirmation acknowledgment.
- **Vite Parser Syntax Fix**:
  - Corrected nested JSX map closure in `SupplierPortal.jsx` and `PurchaseOrders.jsx` resolving Vite transform parse error on line 586.
- **Strict Rule 16 Compliance**:
  - All icons rendered as clean, semantic inline SVGs; strictly zero Unicode emojis across all modals and badges.


## [Module Loading Performance Fix & Universal Skeleton Loading Suite — 2026-10-23]
- **Root-Cause Analysis & Fix for Module Loading Lag**:
  - **Identified Network Storm in `useNotifications.js`**: `Navbar.jsx` mounted on all dashboard pages invoked `useNotifications()` without parameters. The default argument `lowStockItems = []` instantiated a new empty array reference on every render, triggering an infinite `useEffect` loop that fired `/dashboard/stats?period=day` dozens of times per second (over 8,000+ un-throttled requests).
  - **Fixed Rate Limiter Lockout**: The infinite network loop tripped Express `generalLimiter` (2,000 requests/15m), returning HTTP 429 Too Many Requests to `127.0.0.1` and blocking all data fetching across all other modules (POS, Products, Inventory, Sales, Purchasing).
  - **Stabilized Notification Polling & Realtime Channels**: Added module-level constant `EMPTY_LOW_STOCK = []` to prevent re-render loops, throttled background fetches with cooldown timers (30s for stats, 15s for POs), and added explicit channel cleanup (`supabase.removeChannel`).
  - **Dev Whitelist in `server/middleware/rateLimiter.js`**: Bypassed rate limiting for loopback addresses (`127.0.0.1`, `::1`, `localhost`) during local development and increased dev limits.
- **Universal Skeleton Loading Suite (`SkeletonLoader.jsx`)**:
  - Created a modular skeleton component suite adhering strictly to Rule 16 (clean SVG placeholders, subtle pulse shimmer, zero Unicode emojis):
    - `TableSkeleton`: Configurable rows/cols with header bars, pulsing row items, badges, and avatars.
    - `CardGridSkeleton`: Responsive card grid skeleton with thumbnail, tags, titles, prices, and button placeholders.
    - `StatCardsSkeleton`: Metric card placeholders.
    - `FullModuleSkeleton`: Full-screen skeleton layout fallback.
- **Module Skeleton Integrations**:
  - Replaced jarring blank screens, jumpy layouts, and plain "Loading..." text with sleek shimmer skeletons across:
    - **POS (`POS.jsx`)**: Responsive card grid skeleton (`CardGridSkeleton`).
    - **Product Catalog (`Products.jsx`)**: View-aware skeleton (table skeleton for table view, card skeleton for grid view).
    - **Manage Products (`ManageProducts.jsx`)**: Table skeleton in Add mode, card skeleton in Modify mode.
    - **Raw Material Tracker (`RawMaterialTracker.jsx`)**: Smooth 8-row table skeleton.
    - **Product Stock Tracker (`ProductStockTracker.jsx`)**: Smooth 8-row table skeleton.
    - **Purchase Orders (`PurchaseOrders.jsx`)**: Multi-column table skeleton with status badge placeholders.
    - **Audit Logs (`AuditLogs.jsx`)**: Ledger table skeleton.
    - **Transaction Logs (`TransactionLogs.jsx`)**: Multi-column ledger table skeleton.

## [Dashboard Predictive Insights: Declutter, Accurate Depletion & Forecasting Linkage — 2026-10-23]
- **Direct Linkage to Demand Forecasting (`PredictiveInsights.jsx`, `DashboardOverview.jsx`)**:
  - Wired `onNavigate` prop from `Dashboard.jsx` through `DashboardOverview.jsx` to `PredictiveInsights.jsx`.
  - Added "Open Forecast →" and "View Depletion →" action buttons in widget card headers that seamlessly open the full Demand Forecasting module (`Forecasting` tab).
- **Decluttered 7-Day Demand Forecast Widget**:
  - Replaced noisy and inflated percentage strings (e.g. `+4357.1%`) and redundant confidence labels with realistic, executive-grade trend indicators (`Avg. 1.5 / day • +28% trend`).
  - Added clean status badges matching unified stock terminology: `Out of Stock` (soft red), `Restock Needed` (soft amber), and `In Stock` (soft emerald).
  - Fixed SQL join performance in `server/routes/analytics.js` (`GET /api/analytics/demand-forecast`) by eliminating nested table scans that previously caused PostgreSQL statement timeouts.
- **Accurate Stock Depletion Timeline**:
  - Switched data source to `getIngredientDepletionForecast()`, ensuring 100% parity with the main Forecasting module.
  - Replaced broken 100% solid red progress bars with meaningful, proportional supply bars based on a 14-day replenishment window (red for depleted/critical items, amber for low stock, emerald for stable inventory).
  - Fixed grammar from "1 days left" to "1 day left", and added informative secondary metrics showing current stock quantity and daily burn rate.
- **Strict Rule 16 Compliance**: Clean typography, generous whitespace, zero Unicode emojis.

## [Stock Trackers: Priority-Grouped Sorting & Unified Low Stock Status — 2026-10-23]
- **Unified "Low Stock / Restock Needed" Status**:
  - Merged redundant "Restock Needed" and "Low Stock" states into a single unified status (`Low Stock / Restock Needed`) across `RawMaterialTracker.jsx` and `ProductStockTracker.jsx`.
  - Consolidated KPI summary cards from 5 cards to 4 clean, responsive cards (`Total`, `Out of Stock`, `Low Stock / Restock Needed`, `In Stock`).
  - Simplified status filter dropdowns to `All Status`, `Out of Stock Only`, `Low Stock / Restock Needed Only`, and `In Stock Only`.
- **Priority-Grouped Alphabetical Sorting**:
  - Arranged stock tables by stock urgency priority:
    1. **Out of Stock** (stock <= 0) — displayed on top with distinct red label header row, alert icon, and item count badge.
    2. **Low Stock / Restock Needed** (stock <= threshold * 1.5) — displayed with distinct amber label header row, warning icon, and item count badge.
    3. **In Stock** (healthy stock) — displayed with distinct emerald label header row, check icon, and item count badge.
  - Items are automatically sorted alphabetically (A-Z) by name within each labeled section.
- **Strict Rule 16 Compliance**:
  - Used pure semantic inline SVGs for all section headers and alert indicators (strictly zero Unicode emojis).

## [Product List Pagination & 3-State Sorting — 2026-10-23]
- **Reusable Pagination Component (`src/components/shared/Pagination.jsx`)**:
  - Implemented pagination with item counts ("Showing 1 to 10 of 42 items"), previous/next controls, dynamic page numbers with ellipsis truncation, and selectable items-per-page (10, 20, 50).
  - Pure SVG navigation icons adhering strictly to Rule 16 (no emojis).
- **Manage Products (`ManageProducts.jsx`)**:
  - **Paginated Table View**: Added pagination to the Product List table inside "Add Product" mode.
  - **3-State Price Sorting**: Clicking the "Price" column header cycles: `asc` (Low to High) → `desc` (High to Low) → `none` (resets to default alphabetical A-Z).
  - **Alphabetical Name Sorting**: Clicking "Product Name" toggles alphabetical sorting (A-Z / Z-A).
  - **Paginated Modify Existing Grid**: Paginated the "Modify Existing" grid cards (12 per page) with page controls to prevent excessive vertical scrolling.
- **Product Catalog (`Products.jsx`)**:
  - **Table View Pagination & Sorting**: Integrated 3-state price sorting (`asc` → `desc` → `none`/alphabetical) and alphabetical name sorting with visual ascending/descending SVG indicators.
  - **Grid Cards View Support**: Added toolbar sort dropdown (`Name: A to Z`, `Name: Z to A`, `Price: Low to High`, `Price: High to Low`) and full pagination across both table and card views.
  - Reset pagination to page 1 automatically when search query, category filter, or sort order changes.

## [Streamlined Recipe Builder & Add-on Defaults Experience — 2026-10-23]
- **Searchable Ingredient Combobox (`SearchableIngredientSelect.jsx`)**:
  - Replaced clumsy, 50+ item native HTML `<select>` dropdowns with an instant search-as-you-type combobox.
  - Added category filter pills (`All`, `Cups & Packaging`, `Syrups`, `Milks & Dairy`, `Tea & Coffee`, `Powders & Toppings`).
  - Added full keyboard accessibility (`ArrowUp`, `ArrowDown`, `Enter` to select, `Escape` to close).
  - Integrated auto-focus chaining (`autoFocusNextRef`) so selecting an ingredient immediately focuses the Quantity field for rapid data entry.
- **Recipe Configuration Flow Upgrades (`ManageProducts.jsx`, `useManageProducts.js`)**:
  - **Quick Select Chips**: Displays contextual suggested ingredients based on product category (e.g., Espresso, Milk, Fructose, Cups for Coffee) for one-click ingredient selection.
  - **Instant Addition**: Eliminated the disruptive full-screen confirmation modal prompt when adding ingredients to a recipe draft.
  - **Inline Quantity Editing**: Added in-place quantity editing directly inside the recipe table with save checkmark and cancel actions, eliminating the need to delete and recreate recipe rows.
  - **Replaced Dropdowns**: Used `SearchableIngredientSelect` for recipe ingredients, product-specific cup materials, and product-specific add-on materials.
- **Renamed Category Defaults to "Add-on Defaults" (`CategorySettingsModal.jsx`, `ManageProducts.jsx`)**:
  - Renamed the header navigation button from "Category Defaults" to "Add-on Defaults".
  - Renamed the modal title from "Global Category Settings" to "Add-on Defaults".
  - Upgraded both Default Sizes cup material and Default Add-ons inventory material pickers with `SearchableIngredientSelect`.
  - Updated helper tips to reference "Add-on Defaults".
- **Strict Rule 16 Compliance**: Strictly zero Unicode emojis used; all action elements utilize clean, semantic SVG icons with minimal visual clutter.

## [Live Retail Data Seeding for Dashboard & Demand Forecasting — 2026-10-23]
- **Realistic October 2026 Retail Seeding (`docs/database/seed_recent_dashboard_forecasting.js`)**:
  - Seeded 374 authentic retail transactions and 737 line items covering October 10 to October 23, 2026 without deleting or truncating any existing records.
  - Implemented organic cafe traffic patterns: afternoon/evening peaks, weekend surges (Saturday/Sunday multiplier), and the Philippine mid-month payday rush (October 15).
  - Seeded 4 purchase orders across all workflow states (`DECLINED` with mandatory reason, `TO_BE_DELIVERED`, `PENDING`, and `RECEIVED`).
  - Flagged critical low-stock ingredients (`BLUEBERRY SYRUP`, `16OZ PET CUPS`) below the configurable `max_stock * 0.5` threshold to populate real-time inventory alerts.
  - Logged realistic wastage records to activate operational loss monitoring.
  - Populates real-time dashboard figures (Today's revenue ₱2,941, 7-day revenue ₱24,187, continuous daily sales curve) and activates all 42 active products in the Demand & Depletion Forecasting engine.

## [Supplier PO Declines, Configurable Thresholds, Atomic Deductions & Date Range Queries — 2026-10-23]
- **Supplier PO Declines (`PATCH /purchase-orders/:id`)**:
  - Updated `PATCH /api/purchase-orders/:id` and `PATCH /api/purchasing/purchase-orders/:id` to strictly validate `declineReason` as a non-empty string when status is updated to `DECLINED` (returns HTTP 400 with descriptive error if missing or empty).
  - Saved decline reason in `purchase_orders.decline_reason` and recorded in `audit_logs` under `SUPPLIER_PO_DECLINED`.
  - Added SQL migration `docs/database/add_decline_reason_to_purchase_orders.sql`.
  - Updated `SupplierPortal.jsx` with a dedicated Decline Modal requiring a mandatory explanation before declining.
  - Displayed the supplier's decline reason in both the Supplier Portal and the Shop Manager Purchase Orders table & expanded order drawer.
- **Configurable Stock Thresholds (`current_stock <= (max_stock * 0.5)`)**:
  - Removed static hardcoded low stock triggers.
  - Implemented dynamic low stock calculation: flags items where `current_stock <= (max_stock * 0.5)` across `inventoryService.getLowStockAlerts`, `server/routes/dashboard.js`, and `server/routes/analytics.js`.
  - Added SQL migration `docs/database/add_max_stock_columns.sql`.
- **Atomic POS Checkout Deductions (`server/services/posService.js`)**:
  - Implemented PostgreSQL RPC transaction function `process_pos_checkout` (`docs/database/process_pos_checkout_rpc.sql`) running order creation, item insertion, and inventory deductions in a single atomic database transaction with row locks (`FOR UPDATE`).
  - Added automated compensation rollback pattern in `posService.createSale`: if any step in checkout or stock deduction fails, all deducted stocks are restored to previous snapshot values and the sale record is rolled back.
- **Strict Date Range Queries for Dashboard & Analytics**:
  - Added `toManilaStartOfDay` and `toManilaEndOfDay` in `server/utils/dateUtils.js` ensuring bounding timestamps always cover `00:00:00+08:00` to `23:59:59.999+08:00`.
  - Updated `server/routes/dashboard.js` `/stats` endpoint to strictly bound revenue, transaction counts, average transaction values, top products by category, and daily trend groupings between `startDate` and `endDate`.
  - Updated `server/routes/sales.js`, `server/routes/audit.js`, and `server/services/wastageService.js` to strictly enforce bounding start and end dates.
  - Enhanced frontend `TopSalesGrid.jsx` and `useDashboardStats.js` with Custom Date Range pickers.

## [Design Policy: Rule 16 Added — Strictly No Emojis & Anti-AI Slop Decluttering — 2026-10-23]
- **Codified Rule 16 in `.agents/rules/AGENTS.md`**:
  - Prohibits all raw Unicode emojis in UI buttons, tables, badges, headers, or cards. Requires crisp, semantic inline SVGs.
  - Mandates eliminating verbose text clutter, noisy helper text, redundant badge spam, and literal formula explanations to ensure a clean, human-designed aesthetic.
- **Removed Emojis Across Dashboard & Analytics UI**:
  - Replaced emojis in [RevenueSnapshot.jsx](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/dashboard/components/RevenueSnapshot.jsx) (`★`, `☕`, `→`, `▲`/`▼`) with clean inline SVGs.
  - Replaced emojis in [DemandForecasting.jsx](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/analytics/DemandForecasting.jsx) (`⚡`, `🛒`, `⚠️`, `🔄`, `💬`) with professional SVG icons.
- **Redesigned & Decluttered Forecast Modal**:
  - Removed internal formula boxes and noisy marketing copy.
  - Redesigned with minimalist typography, calm spacing, and clear executive metrics.


## [AI-Driven Stock Forecasting Hub & 16-Factor Time-Series Engine — 2026-10-23]
- **Time-Series Feature Extraction Service (`server/services/aiForecastingService.js`):**
  - Adapted the 16-factor feature engineering architecture from .NET C# to Node.js/Express.
  - Implemented Philippine calendar intelligence: national regular/special non-working holidays and quincena paydays (15th and 30th salary rush).
  - Engineered time-series lags and velocity indicators: $t-1$ previous day sales, $t-7$ same day last week, $t-30$ same day last month, rolling 7-day and 30-day moving averages, 7-day velocity growth rate, and 30-day monthly growth rate.
  - Added dual-model execution: prompts Google Gemini AI (`gemini-1.5-flash`) via structured JSON when `GEMINI_API_KEY` is present, with automatic fallback to an intelligent deterministic statistical ensemble model so offline development and local environments never fail.
- **Backend Analytics API (`server/routes/analytics.js`):**
  - Added `POST /api/analytics/ai-forecast` endpoint accepting `{ productId, year, month }` matching `StockForecastRequestDTO`.
  - Optimized database querying using indexed `product_id` lookup on `sale_items` to eliminate Postgres statement timeouts (`57014`).
  - Enhanced multi-product `GET /api/analytics/demand-forecast` to integrate weekend, payday, and holiday cyclic multipliers.
- **Frontend AI Stock Forecaster Hub (`DemandForecasting.jsx`, `analyticsApi.js`):**
  - Added `getAIForecast` helper in `src/api/analyticsApi.js`.
  - Added real-time on-hand stock and `⚡ AI Forecast` action buttons across all product rows in the Product Demand tab.
  - Created interactive **AI Stock & Demand Forecaster Modal**:
    - Target month and year picker with instant re-run capability.
    - Model engine status (`Google Gemini AI` or `Deterministic Statistical Ensemble`) with confidence scores.
    - 3 core KPIs: Predicted Monthly Units Sold, Current On-Hand Inventory, and Recommended Order Quantity (`max(0, predicted - stock)`).
    - Transparent 4-factor breakdown: Weekend Lift, 15/30 Payday Surge, Philippine Holiday Surge (+20%), and Weekly Velocity Growth.
    - AI Analytical Synthesis explanation.


## [Dashboard Revenue Overview Graph Redesign — 2026-10-23]
- **Executive Revenue Overview Redesign (`RevenueSnapshot.jsx`):**
  - Replaced the cramped single black line sparkline with a full-width financial performance card.
  - **Dual View Modes**: Added interactive tab switcher allowing managers to toggle between **Spline Trend** (multi-stop emerald/teal luminous gradient area curve with glowing data nodes and halo rings) and **Daily Volume** (modern rounded bar chart).
  - **KPI Performance Badges**: Added rolling 7-Day Total Revenue, Daily Average intake, dynamic 7-Day Peak Sales Day pill (`★ Peak Day (Sun): ₱X,XXX`), and comparative change badge (`▲ 18.5% vs 7-day avg`).
  - **Custom Interactive Tooltip (`CustomRevenueTooltip`)**: Floating glassmorphic card displaying human-readable dates (`Fri, Oct 17`), centavo-accurate gross sales, and top 3 category revenue drivers.
  - **Clean Axes & Gridlines**: Integrated peso-formatted Y-axis labels (`₱1k`, `₱2k`), abbreviated day names (`Mon`, `Tue`), subtle dashed grid lines, and adaptive 0-baseline domain handling.
  - Retained "Breakdown by Category" action button to trigger the expanded category-level comparison modal.


## [Deployment Preparation & Environment Fixes — 2026-10-23]
- **Fixed `.gitignore` across repository:** Added root `.gitignore` and updated `InventoryProject/.gitignore` to properly ignore `node_modules/`, `dist/`, `.env*` files, and `*.zip` artifacts.
- **Untracked Sensitive & Build Files:** Removed tracked root `node_modules/`, `InventoryProject/.env`, `config.zip`, and `dist.zip` from git tracking while retaining local copies.
- **Fixed Render & Production Dependencies:** Added `helmet`, `express-rate-limit`, and `jsonwebtoken` to `InventoryProject/package.json`. Moved `vite`, `@vitejs/plugin-react`, and `tailwindcss` to `dependencies` so production builds (`npm install` when `NODE_ENV=production`) have access to build tools.
- **Fixed Linux Case-Sensitive Image Imports:** Changed imports in `LandingPage.jsx` and `LoginPage.jsx` from `loc_pic.png` to uppercase `LOC_PIC.png` to prevent build failures on Linux hosting (Vercel/Render).
- **Added Vercel SPA Routing Configuration:** Added `InventoryProject/vercel.json` with rewrite rules so direct URLs and page refreshes route cleanly to `/index.html`.
- **Switched Landing and Login Pages to Database CMS Image:** Removed reliance on local image assets (`loc_pic.png`) in `LandingPage.jsx` and `LoginPage.jsx`. Both pages now fetch and render the official `landing_hero` background image directly from Supabase CMS (`cms-images`).
- **Resilient API Client Parsing:** Updated `src/api/client.js` to safely inspect response text before parsing JSON, preventing white screens and unexpected end-of-JSON errors when the backend is offline or proxying.
- **Restored Local `.env`:** Recreated local `InventoryProject/.env` and `InventoryProject/server/.env` so the Express server and Vite frontend have access to Supabase credentials during local development.
- **Secure & High-Performance CMS Image Architecture:**
  - Upgraded `src/api/cmsApi.js` with in-memory caching (`getCmsMap`, `getCmsImage`) with 3-minute TTL and immediate invalidation on update. Components (`Navbar`, `LandingPage`, `LoginPage`) now share cached CMS data without firing duplicate requests.
  - Added safe URL validation (`isValidImageUrl`) to prevent XSS injection via malicious image protocols.
  - Added `GET /api/cms/:section_key` for single-section retrieval with regex validation (`/^[a-z0-9_]{2,50}$/`).
  - Enforced `requireRole('Admin', 'Owner')` on `PUT /api/cms/:section_key` (Rule 10) and updated audit logging to use authenticated `req.user.id` (Rule 9).

## [Ingredient Depletion & Restock Forecasting Hub with One-Click Purchase Orders — 2026-10-19]
- **Predictive Ingredient Burn & Depletion Forecasting Engine (`server/routes/analytics.js`):**
  - Added new `GET /api/analytics/ingredient-forecast` endpoint that cross-references completed 30-day POS sales orders with product bill-of-materials (`recipes`).
  - Implements unit conversion to base metrics (`g`, `ml`, `pcs`), weighted burn velocity (70% recent 14-day velocity + 30% monthly baseline), runout day estimates (`days_remaining`), and depletion date calendar forecasting.
  - Automatically calculates restock deficits targeting a safe 14-day operational buffer, converting raw requirements into supplier purchase units (`purchase_unit` and `conversion_factor`), preferred supplier mapping (`supplier_ingredients`), and estimated restock capital needed.
- **Frontend Demand & Depletion Forecasting Hub (`DemandForecasting.jsx`, `analyticsApi.js`):**
  - Upgraded the Forecasting module with dual-tab architecture:
    - **Tab 1: Raw Materials Restock (Default)**: Displays summary KPI cards (Critical Depletion count, Low Stock count, Total Restock Capital Required, Monitored Materials), urgency status filters (All, Critical, Low Stock, Healthy), search bar, and depletion table with stock level health, burn rate, runout predictions, and restock recommendations.
    - **Tab 2: Product Sales Demand**: Preserves 7-day predicted item velocity, weekly growth rates, confidence meters, and risk scoring.
  - **One-Click Restock Purchase Order Creation**:
    - Users can click `+ Order` on any individual ingredient or select multiple ingredients and click `🛒 Create PO (Batch)` to open an automated procurement modal.
    - Pre-fills supplier assignment, estimated delivery date (3 days forward), purchase units, editable quantities, unit costs, and computes total PO amounts.
    - Directly executes `createPurchaseOrder()` via `src/api/purchasingApi.js` (`POST /api/purchasing`), creates purchase orders in Supabase, triggers toast feedback, and auto-refreshes forecasting metrics.
- **Database Schema Migration (`add_receipt_history_to_po_items.sql`):**
  - Created migration script in `docs/database/add_receipt_history_to_po_items.sql` and updated `docs/database_updates.sql` adding `receipt_history JSONB DEFAULT '[]'::jsonb` to `purchase_order_items`.
  - Retained all existing `receipt_history` column selection, partial-receive updates, and fallback handling in `purchasingService.js`.
  - Running this SQL migration in Supabase permanently satisfies the database schema requirement and stops Postgres error `42703`.

## [Collapsible Menu Board, CMS Brand Logo Manager & Notification Fixes — 2026-10-19]
- **Landing Page Collapsible Menu Board (`LandingPage.jsx`):**
  - Updated the walk-in Menu Board to expand directly in-place from the central card (default is **Closed**).
  - Expanded the collapsed Menu Board button to full container width (`max-w-[960px] w-full`), matching the exact width and top bar aesthetic (`BROWSE OUR / Menu Board` with `Open Menu ▾`) of the expanded board.
  - Made the brand logo in the landing pad header significantly larger (`w-14 h-14 sm:w-18 sm:h-18 md:w-22 md:h-22`) with glowing drop-shadow and border framing.
  - Resolved menu board loading issue caused by HTTP 429 rate-limiting:
    - Updated `generalLimiter` in `server/middleware/rateLimiter.js` to 2,000 requests per 15 minutes and configured automatic `skip` for public menu browsing (`/pos/products`) and CMS reads (`/cms`).
    - Lifted products state to `LandingPage.jsx` so products are pre-fetched on initial load, eliminating toggle latency and redundant network requests.
    - Added comprehensive loading, error message with "Tap to Retry", and empty state displays to `MenuPanel`.
  - Added a dedicated **Promotions Showcase with Multi-Promo Carousel & Lightbox (`promo_section`):**
    - **Multiple Promos Support**: Enabled Admin/Owner to manage multiple promotional deals via CMS Dashboard, each with custom title, caption/terms, and independent banner image upload to Supabase Storage.
    - **Interactive Slider**: Automatically rotates every 5.5s (pausing on hover), with smooth manual Next/Prev chevron navigation and indicator dots.
    - **Click-to-Expand Lightbox**: Clicking on any promo picture opens a high-definition fullscreen modal (`PromoLightbox`) with keyboard shortcuts (Escape, Left/Right arrows), dark backdrop blur, and close controls.
    - Preserves existing single-promo data gracefully through robust JSON and fallback parsing.
    - Automatically closes / hides when the Menu Board is expanded, maximizing screen space for viewing products.
  - **Phone-Friendly & Mobile Optimized:**
    - Full viewport adaptation using `min-h-[100dvh]` to avoid mobile address bar clipping.
    - Added vertical scroll safety on mobile (`overflow-y-auto`) when closed and contained scrolling when open.
    - Responsive 2-column mobile product grid with compact card padding and legible size chips.
    - Horizontal scroll-friendly category filters and smooth touch momentum scrolling (`-webkit-overflow-scrolling: touch`).
- **Brand Logo Content Manager & Navbar Integration (`CMSDashboard.jsx`, `Navbar.jsx`, `LandingPage.jsx`):**
  - Added a dedicated `brand_logo` section in CMS Dashboard (`Content Management`) enabling Admin/Owner to configure brand title, subtitle/tagline, and upload a custom logo image (PNG/JPG/SVG) stored in Supabase Storage (`cms-images`).
  - Integrated the CMS brand logo into the public landing page header and hero showcase.
  - Connected the CMS brand logo to the authenticated Dashboard sidebar navigation (`Navbar.jsx`), displaying the custom uploaded logo with graceful fallback to the default initial badge.
- **Notification Inbox & Real-Time Sync Fixes (`useNotifications.js`, `NotificationInbox.jsx`, `DashboardOverview.jsx`, `server/routes/dashboard.js`):**
  - Fixed property name mismatch (`lowStockItemsDetails` vs `lowStockDetails`) so low-stock and out-of-stock items reliably populate the Notification Inbox.
  - Updated `server/routes/dashboard.js` to return both `lowStockDetails` and `lowStockItemsDetails` for robust backwards-compatibility.
  - Enhanced `useNotifications.js` to automatically fetch low stock items if not supplied by the parent, synchronizing unread counts between Navbar and the Inbox drawer.
  - Added Supabase real-time listeners for `ingredients` and `products` table updates in addition to `purchase_orders`.
  - Added `variant="navbar"` trigger to `NotificationInbox.jsx` and added a notification bell in `Navbar.jsx`, enabling users to inspect notifications from any dashboard tab.


## [Fix Unused Variable Lint Errors in LandingPage — 2026-10-15]
- **Landing Page Cleanup (`LandingPage.jsx`):**
  - Removed unused `isHovering` state and its associated mouse/touch event listeners.
  - Removed unused `navigate` hook and `useNavigate` import from `react-router-dom`.
  - Verified with `npx eslint src/features/auth/LandingPage.jsx` (exited 0 with no errors).

## [Fix White Screen Render Crash & Realtime Collision — 2026-10-10]
- **Supabase Realtime Channel Collision (`useNotifications.js`):**
  - Resolved `cannot add postgres_changes callbacks for realtime after subscribe()` error when multiple components mount `useNotifications` by assigning unique timestamped channel IDs per hook instance.
- **Public CMS Endpoint Access (`client.js`):**
  - Added `GET /cms` to public endpoints in `client.js` so public landing page visitors can load café CMS content without triggering authentication or session expiration redirects.
- **Render-Phase Navigation Guard (`LoginPage.jsx`):**
  - Moved `navigate('/dashboard')` into a `useEffect` hook to prevent React 18/19 `Cannot update a component while rendering a different component` render-phase crash.

## [Item-by-Item Supplier PO Acceptance, Date Proposals & Backorders — 2026-10-10]
- **Supplier Review & Product Availability Breakdown (`SupplierPortal.jsx`, `SupplierReviewPOModal.jsx`):**
  - Replaced bulk-only acceptance with an interactive per-item review modal.
  - Suppliers can select availability status for each ordered product individually:
    - **Available**: Confirmed for delivery on the requested schedule.
    - **Propose Later Date**: Set a specific proposed delivery date with an explanatory note when items are temporarily out of stock.
    - **Unavailable**: Mark items that cannot be fulfilled along with a required reason.
  - Quick action to "Mark All Available" with a single click.
  - Added filter tabs in Supplier Portal: `All Orders`, `Pending Review`, `Proposals & Rescheduled`, `Active Deliveries`, and `Completed`.
- **Shop Review & Backorder Conversion (`PurchaseOrders.jsx`):**
  - Added dedicated **"Supplier Proposals"** tab in Purchase Orders highlighting orders with proposed dates or unavailable items.
  - Shop (Admin/Owner) can review the supplier's proposals per item:
    - **Accept Proposed Date**: Confirms the supplier's proposed date and splits the delayed product into a distinct accepted Backorder PO.
    - **Decline Date**: Rejects the proposed date without affecting available items.
  - Displays supplier notes, unavailable reasons, and approval states in order breakdown rows.
- **Backend & Service Logic (`purchasingService.js`, `purchasingController.js`, `purchasing.js`):**
  - Added `enrichPOsWithSupplierProposals` to enrich PO items with supplier proposals and shop decisions using audit logs.
  - Added `PUT /api/purchasing/my-orders/:id/item-responses` for suppliers to submit availability breakdowns.
  - Added `PUT /api/purchasing/:id/proposals/respond` for the shop to accept or decline proposed dates and trigger automatic backorder PO creation.
- **Live Notifications (`useNotifications.js`):**
  - Added alert notifications for `Proposal Pending` status to notify managers in real-time when a supplier submits date proposals.

## [Live Dashboard Notification & Alerts Inbox — 2026-10-10]
- **Dashboard Notification Inbox (`NotificationInbox.jsx`, `useNotifications.js`):**
  - Built an interactive Notification / Alerts Inbox trigger button with unread count badges in the Dashboard header.
  - Implemented a slide-over drawer with backdrop blur, quick filter tabs (`All`, `Unread`, `PO Updates`, `Stock Alerts`), relative timestamps, and one-click deep navigation.
  - **Purchase Order & Supplier Lifecycle Alerts:** Real-time tracking of PO statuses:
    - `Accepted`: Alerts when a supplier accepts an order with total amount and scheduled delivery date.
    - `Declined`: Immediate critical alert when a supplier declines an order.
    - `Postponed`: Rescheduled alert with supplier's new expected arrival date.
    - `Delivering` / `To Be Delivered`: Alerts staff to prepare for incoming stock delivery.
    - `Pending`: Awaiting supplier confirmation.
    - `Partial`: Tracks partially received orders with remaining pending items.
  - **Inventory Stock Alerts:** Tracks low stock warnings and critical out-of-stock (0 units) alerts across both raw materials and stock-tracked products.
  - **Real-time Synchronization:** Listens to Supabase `postgres_changes` on `purchase_orders` to reflect updates instantly without page refreshes.
  - **State Persistence:** Preserves read and dismissed notification states in `localStorage` across user sessions with "Mark all as read" and "Clear Read" controls.
  - **Global Navigation Indicator (`Navbar.jsx`):** Added dynamic unread badge count on the sidebar's "Dashboard Overview" navigation item.

## [Extended Inactivity Session Timeout to 2 Hours — 2026-10-10]
- **Session Timeout (`authUtils.js`, `client.js`):**
  - Updated rolling inactivity session timeout `SESSION_TIMEOUT_MS` from 30 minutes to 2 hours (`2 * 60 * 60 * 1000`).
  - Updated session expiration alert banner notice to inform users that sessions expire after 2 hours of inactivity.

## [Auto-Bring Up Selected PO Items — 2026-10-07]
- **Purchase Order Form (`PurchaseOrderForm.jsx`):**
  - Configured item checklist to automatically float all selected PO items to the top of the list so users immediately see and configure their active order items without scrolling through unselected ingredients.
  - Added clean section separation with an "Available Items" divider when both selected and unselected items exist.
  - Added dynamic "X Selected" pill badge in the checklist header and a live order summary (`X items selected: ₱Total`) in the modal footer.
  - Improved quantity typing interaction so clearing the input doesn't prematurely reset to 1.

## [Direct Per-Receive Rows & Batch History Tracking — 2026-10-07]
- **Audit Log Enrichment (`purchasingService.js`):**
  - Added `enrichPOsWithReceiptHistory` to cross-reference stock receipt audit logs with purchase orders. Every partial or complete receiving event (`RAW_MATERIAL_STOCK_RECEIVED`) is now accurately attached to its PO item with its specific timestamp and quantity.
  - Previous multiple receive actions (e.g., Receive 1: 1 pack, Receive 2: 1 pack) now preserve distinct events rather than collapsing into a single updated number.
- **Direct Table Row Rendering (`PurchaseOrders.jsx`):**
  - Removed the inner nested table container completely.
  - Each receipt event is rendered as an explicit direct table row (`Received 1`, `Received 2`, `Received 3`...) immediately beneath the ordered ingredient, with exact timestamps, received quantity, unit price, and received total value.
  - Restarted backend server to apply the updated purchasing service.

## [Fix Timezone & Timestamp Display for Received POs — 2026-10-07]
- **Timezone Standardization (`dateUtils.js`, `PurchaseOrders.jsx`, `ReceivePOModal.jsx`):**
  - Resolved timezone bug where timestamps without a `Z` suffix from PostgreSQL (`timestamp without time zone`) were parsed as local morning times (e.g., 07:00 UTC displayed as 07:00 AM instead of 3:00 PM).
  - Implemented `parseUTCDate` in `src/utils/dateUtils.js` which accurately detects UTC timestamps lacking a timezone offset and converts them into proper Date objects.
  - Implemented and wired `formatDisplayDateTime` and `formatDisplayDate` using the official `Asia/Manila` (+08:00) timezone across `PurchaseOrders.jsx` (Receiving History sub-table, expected dates) and `ReceivePOModal.jsx`.

## [Purchase Orders Receiving History Rows Redesign — 2026-10-07]
- **Purchase Orders (`PurchaseOrders.jsx`):**
  - Replaced the misaligned red sub-rows (`↳ Received` with red left border and negative red total) with a clean, beautifully aligned Receiving History sub-table under each ordered item.
  - Dedicated table columns for each receipt batch: `Batch` (`Batch #1`, `Batch #2`), `Date & Time Received`, `Quantity Received` (highlighted in emerald green), `Unit Price`, and `Received Value`.
  - Added total received progress header badge (`Total Received: X / Y units`).
  - Supports both multi-batch partial receiving records and single-batch receipts gracefully.

## [Fix Purchase Orders Loading Error — 2026-10-07]
- **Purchase Orders Service (`purchasingService.js`):**
  - Resolved `column purchase_order_items_1.receipt_history does not exist` database error (PostgREST code `42703`) which prevented purchase orders from loading on the frontend.
  - Added resilient schema-safe fallbacks to `getPurchaseOrders` and `getPurchaseOrdersBySupplier`: if `receipt_history` does not exist in the database table, it falls back cleanly to the existing table schema without throwing an error.
  - Added safe conditional handling in `updatePurchaseOrderStatus` so partial receiving updates work whether or not `receipt_history` column exists.
  - Restarted backend server to apply the updated purchasing service.

## [Unified Revenue Snapshot Sparkline & Trends Widget — 2026-10-07]
- **Revenue Snapshot (`RevenueSnapshot.jsx`):**
  - Merged the disconnected mini sparkline card and the standalone "7-Day Trends" button into a single unified, interactive widget button.
  - The unified container houses the live sparkline chart on the left and an integrated "7-Day Trends >" badge pill on the right.
  - Clicking anywhere on the combined card opens the expanded 7-day trend analysis view with smooth hover highlights and micro-interactions.

## [Modal & Product Management Typography Upgrades — 2026-10-07]
- **Receipt Journal (`SalesReceiptJournal.jsx`):**
  - Replaced the blue emoji play button (`▶`) with a clean vector chevron arrow (`>`) that smoothly rotates 90 degrees downward (`v`) when a receipt row is expanded.
  - Upgraded expanded digital receipt card text sizes, item descriptions, and totals for high legibility.
- **Product Management (`ManageProducts.jsx`):**
  - Enlarged form labels from cramped/broken `text` classes to `text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider`.
  - Upgraded table column headers from tiny `text-[10px]/text-[11px]` to `text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider`.
  - Upgraded table row elements: Product names (`text-sm md:text-base font-extrabold`), Category (`text-xs md:text-sm font-bold text-gray-600`), and Price (`text-sm md:text-base font-extrabold`).
  - Enlarged Stock badges (`Recipe based` & `{stock} in stock`) and Status badges from `text-[10px]` to `text-xs font-bold`.
  - Enlarged Action buttons (`Edit`, `Archive`, `Restore`) to `text-xs md:text-sm font-bold`.
- **System-wide Modals Typography Overhaul:**
  - **`SalesReceiptModal.jsx`**: Expanded modal width (`max-w-lg`) and boosted typography across store header, date/staff lines, table items, bold prices, and footer metadata.
  - **`PaymentModal.jsx`**: Enlarged modal width (`max-w-lg`), cash tender quick buttons (`text-xs md:text-sm font-bold`), cash input (`text-xl font-bold`), and change amount (`text-2xl md:text-3xl font-black`).
  - **`POS.jsx` (Options & Recipe Modals)**: Upgraded quantity counter, cup size buttons, add-on stepper items, and ingredient recipe details to clear, accessible sizes.
  - **`CategorySettingsModal.jsx`**: Replaced micro-text table headers and inputs with readable `text-sm md:text-base` elements.
  - **`ReceivePOModal.jsx`**: Upgraded header, verification note, item labels, received history, and quantity input box.
  - **`SupplierPortal.jsx`**: Enlarged Postpone modal container, input, and action buttons.
  - **`ConfirmModal.jsx`**: Upgraded to `max-w-md` with `text-xl md:text-2xl` title and `text-base` description.

## [Top Sales Category Accordion & Responsive Grid Fix — 2026-10-07]
- **Fixed Category Compact / Collapse Behavior:**
  - Resolved the issue where clicking `Compact` or `Compact All` failed to collapse categories with 1 or 2 items because the code was previously slicing `(0, 2)` instead of folding.
  - When compacted (`isCompacted === true`), category cards now truly collapse their item lists and display a sleek summary bar (`Total Units: X sold • Click to view items ▼`).
  - When opened (`isCompacted === false`), the full ranked products with share meters and quantities expand smoothly.
  - Clicking `▲ Compact All` now collapses all category cards into compact view, and `▼ Open All` expands them all.
- **Adaptive Grid Columns (No Empty Gaps):**
  - Updated grid column sizing to dynamically adapt to the number of categories:
    - 3 categories (like in the dashboard) now render as `md:grid-cols-2 lg:grid-cols-3` filling the full container width with no empty 4th column.
    - 1 or 2 categories adapt to `grid-cols-1` and `md:grid-cols-2`.
- **Dedicated Clickable Toggle Buttons:**
  - Added explicit `▼ Open` (dark active pill) and `▲ Compact` buttons with event propagation isolation so clicking either the button or the header card toggles the state reliably.

## [POS Input Limits & Sanity Bounds — 2026-10-07]
- **Item Quantity Bounds (Limit: 1 – 99):**
  - In `POS.jsx` and `usePOS.js`, item quantities are capped at a maximum of 99 per line item.
  - Buttons (`−` and `+`) automatically disable when reaching the minimum (1) or maximum (99).
  - Manual numeric inputs clamp values between 1 and 99, preventing accidental entries like 100,000.
- **Add-on Limits (Max 5 per add-on):**
  - In `POS.jsx` and `usePOS.js`, beverage add-ons (pearl, nata, jelly, extra sugar/ice, etc.) are capped at a realistic maximum of 5 servings per drink.
  - The `+` button disables once 5 is reached, and displays a clear `"Max 5 per add-on"` notice.
- **Cart Stepper Controls & Clamped Inputs:**
  - Upgraded the quantity field in `Cart.jsx` with dedicated increment/decrement stepper buttons and strict clamping (`min="1" max="99"`).
- **Payment Modal Cash Tender Limits & Quick Presets:**
  - In `PaymentModal.jsx`, added a reasonable upper bound for cash tender (`Math.min(100000, Math.max(order.total + 5000, 50000))`).
  - Entering illogical amounts (e.g., ₱1,000,000 for a ₱150 purchase) is blocked with an informative validation error explaining the upper bound.
  - Added quick cash denomination preset buttons (`Exact`, `₱100`, `₱200`, `₱500`, `₱1,000`) for one-tap cashier tendering to prevent extra-zero typing typos.
- **Backend API Guardrails:**
  - In `server/controllers/posController.js`, enforced strict validation on `POST /api/pos/sale`:
    - Validates cart item counts (`<= 100` distinct items) and item quantities (`1 <= qty <= 99`).
    - Validates add-on counts (`0 <= customer_qty <= 5`).
    - Validates cash received (`amount_received >= total` and `<= ₱100,000`).

## [30-Minute Inactivity Session Timeout & Auto-Logout — 2026-10-07]
- **30-Minute Rolling Inactivity Session Timeout:**
  - Configured `SESSION_TIMEOUT_MS = 30 * 60 * 1000` (30 minutes) in `src/utils/authUtils.js`.
  - Added timestamp tracking (`session_last_activity` in `localStorage`) updated automatically whenever the user interacts with the app (clicks, typing, scrolling, API calls) throttled to avoid overhead.
  - Resolves the issue where closing the browser or staying offline for hours or days left accounts permanently logged in.
- **Offline / Closed Browser Auto-Expiration:**
  - If a user closes their browser or tab and returns after 30 minutes (or days later), `getCurrentUser()` and `PrivateRoute` detect the elapsed timeout, clear the local credentials, and redirect them to `/coftealoginpageforstaff`.
  - Sets an informative notice in `sessionStorage` (`"Your session timed out after 30 minutes of inactivity. Please log in again."`).
- **Live Inactivity Watcher (`SessionTimeoutWatcher`):**
  - Added background activity listener and 15-second timer interval in `App.jsx` to catch idle open browser tabs and automatically redirect them when 30 minutes elapse.
  - Multi-tab synchronization: Listens to the `window` storage event so that logging out or timing out in one tab instantly updates and locks all other open tabs.
- **Protected API Request Validation:**
  - Updated `src/api/client.js` to verify session validity before sending authenticated requests and touch the activity timestamp on successful calls.
- **Informative Login Banner in `LoginPage.jsx`:**
  - Added a dedicated blue session timeout notice alert banner informing returning users why they need to sign in again after an inactive period.

## [5-Year Historical Sales Seeding & Accessible Adaptive Dashboard — 2026-10-07]
- **5-Year Historical Sales Seeding:**
  - Created and ran `docs/database/seed_5yr_sales.cjs` to generate realistic past sales transactions spanning 2021-10-08 to 2026-10-07.
  - **Preserved Existing Data:** Checked database for dates that already had recorded sales (54 existing dates) and strictly skipped them, seeding only the 1,809 missing days.
  - Seeded **6,424 sales transactions** and **12,875 sale item records** with authentic Philippine cafe items, realistic order distributions, and payment methods (`Cash`, `GCash`, `Card`).
- **Adaptive Screen Width:**
  - Removed restrictive `max-w-7xl` and fixed width constraints in `DashboardOverview.jsx` and related subcomponents.
  - Upgraded layout to full-width fluid responsive sizing (`w-full px-6 lg:px-10 py-6 min-h-full space-y-6`), seamlessly adapting to wider desktop displays (e.g., 1920x945 and ultrawide) without awkward gutters.
- **Enhanced Typography & Legibility:**
  - Enlarged small text across all dashboard sections for better readability and visual accessibility.
  - Key metric values boosted to `text-4xl md:text-5xl font-black tabular-nums`.
  - Section headers, table labels, card captions, and item names increased from small `text-xs`/`text-[11px]` to legible `text-sm`, `text-base`, and `text-lg`.
- **Eliminated Icon Clutter & Visual Noise:**
  - Stripped redundant decorative icon badges from metric cards, headers, and quick-action buttons.
  - Kept only functional, minimal icons where necessary (e.g., chevron collapse arrows, register button).
  - Removed repetitive tags and sub-captions (e.g., "POS Synced", "Past 7 Days Rolling Window"), streamlining the operational workspace.
- **Top Sales Grid Adaptive Balance:**
  - Upgraded category grid in `TopSalesGrid.jsx` to `xl:grid-cols-4`, allowing the 4 drink categories (Coffee, Milk Tea, Fruit Drinks, Frappe) to sit side-by-side on wide viewports without leaving orphaned single cards.
  - Softened high-contrast black underline bars to subtle, refined `h-1.5` progress meters with breathing room between items.
- **Role-Based POS Register Access:**
  - Restricted the `"Open POS Register →"` header action button in `DashboardOverview.jsx` exclusively to `Staff` accounts (`user.role === 'Staff'`). Hidden for `Admin` and `Owner` roles.
  - In `QuickActions.jsx`, replaced the POS register card with `"Manage Products"` for `Admin`/`Owner` accounts.
- **Complete Product Catalog Images:**
  - Seeded and uploaded high-resolution, professional cafe beverage and pastry images to Supabase Storage (`cms-images/public/`) for all 32 products previously lacking photos.
  - Now **41 of 41 products (100%)** have authentic image assets displayed across the Product List (`ManageProducts`), POS item cards, and public Landing Page.
- **Report Wastage Page Restyle & Adaptive Layout:**
  - Redesigned `ReportWastage.jsx` into an adaptive 2-column layout (Left: Incident Logging Form, Right: Wastage Audit Log with live search filtering) eliminating awkward empty whitespace on desktop.
  - Replaced outdated colored top-border stripes (`border-t-4 border-orange-500`, etc.) with unified `rounded-2xl` KPI metric cards featuring `text-4xl md:text-5xl` typography.
  - Corrected header title from inaccurate `"Report Broken Items"` to `"Report Wastage"`.
  - Added live stock availability context chips, larger form inputs (`h-12`), and soft status pill badges for reasons (`Expiry`, `Spoilage`, `Damage`, `Spillage`).
- **View Products Dual View Modes & Photo Support:**
  - Added a segmented view mode switcher (`Table View` vs `Grid Cards View`) to `Products.jsx`.
  - **Table View**: Added `w-12 h-12` rounded product image thumbnails alongside product titles with lazy loading.
  - **Grid Cards View**: Implemented a responsive 4-column card grid featuring full-width photo banners (`h-48`), category overlays, live stock status pills, and prominent "View Recipe" actions.
  - Enhanced the Recipe Breakdown modal to display the selected product's photo in the header.
- **Top Sales Category Tabs, Compact/Open Toggles & Bigger Indicator:**
  - Added Category Tabs (`All Categories`, `Coffee`, `Milk Tea`, `Fruit Drinks`, `Frappe`) to `TopSalesGrid.jsx` for quick category filtering.
  - Added individual category card compact/open toggling as well as a global `Compact All` / `Open All` button. When compacted, each card shows the top 2 items with a "+ more items (Click to open)" button.
  - Enlarged the items indicator badge to a prominent, high-visibility `text-base font-black px-3.5 py-1.5 bg-zinc-900 text-white rounded-xl` badge.
- **Archive & Restore UX Friction Protection:**
  - Added explicit confirmation modal friction to both `ManageProducts.jsx` and `ManageRawMaterials.jsx` before performing Archive or Restore actions.
  - Clicking **Archive** prompts an informative warning dialog explaining that the item will be deactivated from the POS register/active inventory while preserving all historical sales/orders, requiring a deliberate "Yes, Archive" confirmation.
  - Clicking **Restore** prompts a clear activation confirmation ("Yes, Restore") with distinct green/red action buttons and cancel options, preventing accidental misclicks.
- **System-Wide Async Button Lockout & Double-Click Protection:**
  - Added strict execution lockouts (`isProcessing` and `processingId`) to prevent race conditions from rapid spam-clicking.
  - In `ConfirmModal.jsx`, disabled both Cancel and Confirm buttons while the async action is executing, showing a loading spinner and "Processing..." label.
  - In `ManageProducts.jsx` and `ManageRawMaterials.jsx`, disabled all table action buttons (`Archive`, `Restore`, `Edit`) during active operations (`disabled={isProcessing}` with `disabled:opacity-50 disabled:cursor-not-allowed`). The targeted button displays a spinner and "Please wait..." indicator until the database transaction and state reload completely finish.
  - Restored `BLUEBERRY` status to active after resolving the collision.
- **Top Sales Grid Quantity & Sold Text Legibility:**
  - Enlarged the sold units figure to `text-base md:text-lg font-black text-zinc-900` and the "sold" label from `text-xs font-medium text-zinc-500` to `text-sm md:text-base font-extrabold text-zinc-700` for clear readability on wide screens.

## [Dashboard Restyle & Human-Crafted Polish — 2026-10-07]
- **Removed "AI-Generated" Elements:** Removed tacky `[AI Predicted]` badge and raw debug text ("Growth: 128.6% Confidence: 65% Risk: HIGH"). Replaced with professional, operational cafe metrics (`Velocity Model` and `Runout Rate` indicators).
- **Eliminated Harsh 4px Colored Borders:** Replaced old Bootstrap/AdminLTE style colored top stripes (`border-t-4 border-t-red-500`, `border-t-black`) with unified modern `rounded-2xl` card geometry and subtle borders (`border-gray-200/90`).
- **Typography & Font Polish:** Imported `Plus Jakarta Sans` with antialiasing and switched currency/numeric figures to `tabular-nums` for crisp, aligned layout.
- **Operational Context Header:** Added live shift status indicator (pulsing emerald dot), date and Manila time badge, and clear station role greeting.
- **Revenue Hero & Sparkline:** Added thousand-separator currency formatting (`₱X,XXX.XX`), area gradient sparkline, and interactive `Trends ↗` button.
- **Tailored Stat Cards & Icons:** Added dedicated station monochrome icons for Transactions, Average Sale, and Low Stock. Replaced generic alerts with subtle pulsing indicators and refined `Details →` prompts.
- **Thoughtful Empty State:** Replaced blank void with an illustrated, informative empty state in `TopSalesGrid` explaining that sales compile live as orders are finalized in POS.
- **Tactile Quick Actions & Sidebar:** Upgraded station shortcut cards with dedicated icons and hover transitions. Polished sidebar with clean `CofTea Cafe` branding and rounded active pills.

## [Full System Test Cases, ISO 25010 Questionnaire & Real-Time PO Sync — 2026-09-30]
- **Partial Delivery Tracking:** Enhanced Purchase Orders with batch-level receipt logs, timestamped delivery history, remaining quantity calculation, and subtotal deductions.
- **Supplier Portal & Real-Time Sync:** Implemented Supabase real-time channel subscriptions in `PurchaseOrders.jsx` and `SupplierPortal.jsx` so state changes (acceptance, postponement, stock receiving) sync without page refresh.
- **Comprehensive Test Cases:** Created 30 full-system test cases (`supplier_po_test_cases.md`) covering all modules (POS, Inventory, PO, Wastage, Reports, Accounts, CMS, RBAC, etc.) in clean, student-style tables.
- **System-Wide ISO 25010 Questionnaire:** Updated `iso_25010_questionnaire.md` to comprehensively evaluate the entire system across all 8 software quality dimensions (Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security, Maintainability, Portability).
- **Word (.docx) Export:** Generated formatted Microsoft Word documents for both the System Test Cases (`CofTea_System_Test_Cases.docx`) and Evaluation Questionnaire (`CofTea_ISO_25010_Evaluation_Questionnaire.docx`) saved in the `docs/` folder.

## [PO Defaults on Ingredient + UX Improvements — 2026-09-25]
- **PO Defaults on Ingredient:** Moved `purchase_unit`, `conversion_factor`, and `cost_per_purchase_unit` defaults from the `supplier_ingredients` join table to the ingredient record itself. Now PO defaults persist regardless of which supplier is assigned. The PO form reads defaults from the ingredient, not the supplier mapping.
- **Raw Materials Edit Modal:** Added a "Purchase Order Defaults" section to the edit modal so users can set purchase unit, conversion factor, and cost once per ingredient.
- **Backend:** Updated `inventoryService.updateIngredient()` to accept and persist the new PO default columns.
- **ManageProducts Stock Column:** Removed the inline stock receive widget (input + Add button). Products with `track_stock` now show "Restock via Supplier PO" hint instead.
- **POS Card Clicks:** Removed `onClick` from the card body in POS ProductCard — only the "Info" and "+ Add" buttons trigger actions now.
- **Inventory Card Clicks:** Same treatment for ManageProducts and ManageRawMaterials grid cards — only the "Edit" button is clickable, not the entire card.
- **CMS Friction:** Replaced text URL display with visual image preview in CMS edit form. Added auto-save on image upload to remove extra click.
- **Cart Price Sync:** Fixed add-ons not being included when syncing cart prices. Added `getVirtualProduct()` helper to inject category-level sizes and add-ons before recalculating.

## [Product Image Uploads & CMS Bridging — 2026-09-25]
- **Landing Page Login Icon:** Disabled/removed the discreet sign-in lock icon from the public landing page header as per user preference. Staff login is now exclusively accessed by manually navigating to `/coftealoginpageforstaff`.
- **Menu Images:** Added image upload functionality to `ManageProducts.jsx` connecting to Supabase storage (`cms-images` bucket). Fixed a database issue where missing RLS policies blocked anonymous image uploads.
- **Table Thumbnail:** Added a small product image thumbnail preview in the product list table inside `ManageProducts.jsx`.
- **CMS Shortcut:** Added an informational banner in `CMSDashboard.jsx` to explicitly guide users to the "Manage Products" tab for updating the landing page menu pictures and prices.
- **Rule Compliance:** Moved temporary AI database seeding files (`temp_insert.cjs`) to `docs/database/` in compliance with Rule 15.

## [Agent Rules Expanded — 2026-09-24]
- **Updated `.agents/rules/AGENTS.md`** from 6 rules to 15 rules (0–14). New rules cover: mandatory project reference reading (Rule 0), backend architecture pattern (7), tab-based navigation system (8), audit logging with `req.user.id` (9), CMS conventions (10), soft deletes (11), stock operation patterns (12), timezone (13), and known tech debt avoidance (14).

## [Dynamic Menu Pricing Documentation — 2026-09-24]
- **Documented 3 approaches** for the advisor's request to auto-update prices on landing page menu boards. Added to `docs/PROJECT_REFERENCE.md` under "Advisor Feature: Dynamic Pricing on Menu Board Images."
  - **Approach A (Recommended):** Generate menu boards in code from DB data
  - **Approach B:** Hybrid — client provides images without prices, system overlays a price bar
  - **Approach C:** Drag-and-drop price positioning on images (complex, not recommended for capstone timeline)

## [Project Reference Guide — 2026-09-24]
- **Created `docs/PROJECT_REFERENCE.md`** — Comprehensive guide covering architecture, file map, CMS implementation plan (3 phases), styling conventions (CSS vs Tailwind), backend/frontend patterns, database schema notes, security status, known tech debt, future task backlog, deployment checklist, and agent handoff instructions.

## [Security Audit — 2026-09-24]
- **Full-stack security scan:** Identified 15 issues across Critical (3), High (4), Medium (5), Low (3) severity levels.
- **Key findings:** Secrets in git history, user ID spoofing via `x-user-id` header, rate limiters defined but never wired, missing Helmet headers, raw error messages leaked to clients.
- **Recommendations:** Rotate secrets, implement JWT auth, enable rate limiters, add Helmet, centralize error handling, restrict CMS routes, add input validation.

## [Flexible PO Purchasing Units]
- **On-The-Fly Bulk Conversions:** Moved purchase unit logic out of static raw material configurations directly into the Purchase Order creation screen. This allows cafes to buy the exact same raw material from different suppliers in different packaging sizes (e.g. 1L cartons from Supplier A, 2L jugs from Supplier B).
- **Schema Updates:** Added `purchase_unit` and `conversion_factor` tracking directly to the `purchase_order_items` table.
- **Smart Receiving Logic:** When a PO is marked as "Received", the backend dynamically multiplies the quantity received by the conversion factor defined specifically for that PO item before adding it to inventory stock (e.g. Receiving 5 Bags adds 5,000 grams).

## [Routing, Purchasing & CMS]
- **Routing & Navigation:** Extracted `Login.jsx` into `LandingPage.jsx` and `LoginPage.jsx`, using `react-router-dom` for strict route separation between the public menu board and the staff login.
- **Discreet Login:** Added a subtle icon in the landing page header to access the staff login, removing all "STAFF LOGIN" text.
- **Supplier & PO Workflow:** Replaced simple text inputs/dropdowns with interactive checklists for mapping raw materials to suppliers (`ManageSuppliers.jsx`) and creating Purchase Orders (`PurchaseOrderForm.jsx`). 
- **PO Receiving Inspection:** Added a `ReceivePOModal` in `PurchaseOrders.jsx` to allow staff to log exact quantities received, supporting partial receipts.
- **Client-Friendly CMS:** Introduced a `CMSDashboard.jsx` allowing the Owner/Admin to update landing page text (Title, Description) and upload background images directly to the Supabase `cms-images` bucket. The public landing page now renders content dynamically.

## [Security Updates]
- Added `.env` patterns to `.gitignore` to prevent secret leaks.
- Removed tracked `.env` files from Git cache.
- Created `.env.example` template for secure sharing of environment variables across the team.

## [Landing Page Modernization]
- Redesigned `Login.jsx` to use a hero-background layout with the location photo.
- Overhauled `Login.css` to feature a premium glassmorphism aesthetic.
- Introduced the 'Outfit' font family for modernized typography.
- Enhanced animations, borders, and modal styles to improve visual hierarchy while maintaining the core monochrome theme.

## [Initial Setup]
- Set up automatic legacy-peer-deps using `.npmrc`
- Created `NPM-EXPLANATION.md` for context
- Added agent rules (`.agents/AGENTS.md`) to automatically log future changes here.

## [POS Enhancements]
- **Add-on Quantities:** Implemented the ability to select multiple quantities for a single add-on during checkout.
- **Dynamic Pricing:** Total order price now dynamically recalculates by multiplying the add-on's price by its selected quantity.
- **Cart Display:** Cart items now cleanly display the quantity of an add-on (e.g., `Pearl (x2)`) if greater than 1.
- **Inventory Tracking Logic:** POS now correctly flags legacy items without recipes as "OUT OF STOCK" based on direct stock quantity.

## [UI & UX Improvements]
- **Iconography:** Replaced all text-based Symbols with professional SVG icons across the `Login.jsx` screen and `Navbar.jsx` side menu.
- **Category Settings UI:** Fixed the layout of the Global Category Settings modal. The sizes and add-ons tables now wrap seamlessly, preventing horizontal overflow, and text wrapping has been added for long ingredient names.
- **Product Management UX:** Added a helpful informational banner inside `ManageProducts.jsx` to clarify that individual item size/addon configurations act as overrides to category defaults.
- **Add-on Quantity Selectors:** Transformed the basic add-on toggle buttons into styled quantity selector components (`-` `Qty` `+`) in the POS modal.

## [Bug Fixes]
- Fixed a backend bug in `posService.js` where inventory deductions were failing because the system checked for `item.add_ons_objs` instead of `item.add_ons`.
- Updated backend logic to ensure raw material deductions correctly multiply by the customer's selected add-on quantity.
