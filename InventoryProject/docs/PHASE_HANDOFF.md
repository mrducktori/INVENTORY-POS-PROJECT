# Final System Handoff Notes (Phases 1-6)

## 1. Phase 6 Completed Changes

### Backend (`server/`)
- **`server/routes/analytics.js` (`simulateFefoSpoilage`, `computeIngredientForecastMetrics`, `/ingredient-forecast`, `/inventory-depletion`)**:
  - Filtered voided/refunded/returned sales in `fetchSalesSince` via `sales.status` and `posOperationsService.getVoidRefundMap()`, and selected `cup_size` / `add_ons` on `sale_items` for `recipesService.resolveRecipeQuantityForSize` per-size ingredient burn.
  - Added `simulateFefoSpoilage(batches, avgDailyBurnRate)` and `computeIngredientForecastMetrics(item, avgDailyBurnRate)` to project batch spoilage before expiry, calculate `effective_usable_stock`, cap perishable restock targets (`recommended_horizon_days = min(14, max(3, floor(default_shelf_life_days * 0.85)))`), and expose `usable_stock`, `expired_stock`, `expiring_soon_stock`, `nearest_expiry_date`, `projected_spoilage_qty`, `shelf_life_capped`, and `spoilage_risk`.
  - Updated `/inventory-depletion` to evaluate non-expired `usable_stock` and return `expired_stock` and `nearest_expiry_date`.
- **`server/services/aiForecastingService.js` & `server/services/recipesService.js`**:
  - Added `category` selection in `getRecipesByProduct` and `computePerishabilityContext` in `aiForecastingService.js` (`shortestShelfLifeDays`, `limitingIngredientName`, `expiringIngredientsCount`, `expiredIngredientsCount`, `shelfLifeCapDays`).
  - Excluded voided/refunded sales in `extractProductForecastingFeatures`, attached `perishabilityContext` to `factors` and `promptPayload`, and capped `recommendedOrderQuantity` in `runDeterministicEnsembleForecast` when `shelfLifeCapDays < daysInMonth`.
- **`server/services/batchService.js` & `server/services/purchasingService.js`**:
  - Exported `getPerishabilityMetaMap` and enriched `getPurchaseOrders` / `getPurchaseOrdersBySupplier` line items with `is_perishable` and `default_shelf_life_days`.
  - Enforced `validateTextLength` bounds in `sanitizeSupplierDetails` (`name` 1–100 required, `contact_person` <=100, `email` <=120, `address` <=250).

### Frontend (`src/`)
- **`src/features/analytics/components/IngredientRestockTab.jsx`**: Shows non-expired `usable_stock` (alongside total stock if different), `Expired` / `Expiring <=7d` / `Exp` status pills in **On Hand**, and `Shelf-Life Cap (Xd)` / `Spoilage Risk` pills in **Suggested Order**.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx` & `ForecastGuideModal.jsx`**: Added **Perishability & Shelf-Life Window** factor details inside projection factors and updated restock guide copy for usable stock, FEFO spoilage, and shelf-life caps.
- **`src/features/analytics/components/ForecastCreatePOModal.jsx` & `src/features/inventory/components/purchasing/ReceivePOModal.jsx`**: Clamped forecast PO order quantities to `INPUT_LIMITS.PO_QTY_MIN..PO_QTY_MAX` (`100000`) and notes to `INPUT_LIMITS.DESC_MAX_LEN` (`500`); updated `ReceivePOModal.jsx` so non-perishable PO items default to blank `expiry_date` (`''`) instead of `+30` days.

## 2. Complete Phase 1-6 Master Checklist
- **Phase 1 — Duplicate Prevention, Input Bounds & Modal Cleanup**: Composite `name + category` hard-block (`409`) with soft similarity warnings (`stringHelper.checkCompositeDuplicate`); unified backend/frontend `LIMITS` / `INPUT_LIMITS`; removed redundant blocking Add/Update `ConfirmModal`s; preserved ingredient `category` in `useManageRawMaterials.js`.
- **Phase 2 — PO Overhaul, Batches, FEFO/FIFO & Stocktake**: supplier-scoped line items, batch tracking, FEFO/FIFO sale deduction and physical Stocktake reconciliation (all in `server/services/batchService.js`), expiration alerts & manual expiry wastage (`InventoryBatchesSection.jsx`), and perishability metadata.
- **Phase 3 — Sizes, Per-Size Recipes, Modifiers & Order Types**: Size matrix (`REGULAR`, `MEDIUM`, `LARGE`), per-size recipes and cup/lid/straw packaging rules (`recipesService.js`, `ManageRecipeModal.jsx`), add-ons / sugar / ice modifiers (`CustomizeOrderModal.jsx`, `ProductOptionsModal.jsx`), `DINE_IN` / `TAKE_OUT` / `DELIVERY` deduction rules (`posService.js`), and print receipt customization updates.
- **Phase 4 — POS Checkout, Discounts, Split/QR Payments, Void/Refund, Shifts & KDS**: Server-authoritative cart pricing, `SENIOR`/`PWD`/`STUDENT`/`STAFF`/`PROMO_CODE`/`CUSTOM` discounts, `CASH`/`GCASH`/`MAYA`/`CARD`/`QRPH`/`SPLIT` tenders, QR payment intent adapter, checkout idempotency (`pos_idempotency_store`), bcrypt Manager PIN (`429` rate-limited) + Void/Return/Refund (`RESTOCK`/`WASTAGE`), X/Z-Reading shifts, and Barista/Kitchen KDS queue.
- **Phase 5 — Daily/Weekly/Monthly/Yearly Reports, Inline Audit & OCR Scanner**: `daily`/`weekly`/`monthly`/`yearly`/`custom` reporting across `sales.js`, 1,000-row paginated aggregation, void exclusion + `period_breakdown`, non-blocking inline Staff Sales Audit (`SalesSummaryReport.jsx`), and `OcrScannerPanel.jsx` + `ocrService.js` (Gemini Vision + offline deterministic text parser) integrated in `StockReceived.jsx` and `ReceivePOModal.jsx`.
- **Phase 6 — Perishability/FEFO Forecasting & Carryover Polish**: FEFO batch spoilage projection, shelf-life horizon caps on ingredient and AI product forecasts, non-voided 90-day burn metrics, supplier text bounds, forecast PO clamps, and non-perishable blank expiry defaults.

## 3. Full-System Scan & Verification Report
All full-system checks passed inside `InventoryProject/` after all Phase 1–6 edits:
- **Backend Syntax (`node --check`)**: `43 / 43` `.js` files under `server/` passed (`failures: 0`).
- **Frontend Lint (`npx eslint src/`)**: Passed with `0` errors and `0` warnings across all `src/` files.
- **Production Build (`npm run build` / `vite build`)**: Passed cleanly (`772 modules transformed`, built in `623ms`).
- **End-to-End Node Assertions (Phases 1-6)**: Passed across `validationHelper`, `stringHelper.checkCompositeDuplicate`, `validationUtils`, `batchService`, `purchasingService.sanitizeSupplierDetails`, `recipesService.resolveRecipeQuantityForSize`, `productUtils`, `posStockUtils`, `posOperationsService`, `cmsService`, `receiptPrint.extractDiscountLabel`, `sales.js` windowing/aggregation, `ocrService`, `analytics.js` (`simulateFefoSpoilage`, `computeIngredientForecastMetrics`), and `aiForecastingService.js` (`computePerishabilityContext`, `runDeterministicEnsembleForecast`).
- **Static Hygiene Scan (`153` `src/` files, `43` `server/` files)**:
  - Unicode emojis in `src/` and `server/`: `0` hits.
  - Raw `fetch(` in `src/`: only `src/api/authApi.js:20` (`loginUser` exception per `AGENTS.md`) and `src/api/client.js:81` (`apiCall` itself).
  - `req.body.user_id` in `server/`: `0` hits.
  - CMS key isolation (`cmsService.js`): `8` `ALLOWED_CMS_KEYS`, `11` `INTERNAL_CMS_KEYS`, `0` overlap.

## 4. Supabase SQL Migrations & Deployment Notes
Reference SQL migrations stored in `docs/database/` (apply sequentially in Supabase SQL Editor if migrating from an older schema):
1. `docs/database/phase1_duplicate_and_bounds.sql` — Unique normalized name+category index and numeric `CHECK` constraints.
2. `docs/database/phase2_batches_fefo_stocktake.sql` — `inventory_batches`, `stocktake_sessions`, `stocktake_items`, and ingredient perishability/expiry metadata columns (no PO status changes).
3. `docs/database/phase3_sizes_modifiers_ordertype.sql` — `recipes.size_name`, `recipes.size_quantities` (`JSONB`), `sales.order_type`, and `sale_items.modifiers` (`JSONB`).
4. `docs/database/phase4_pos_payments_void_shifts_kds.sql` — `users.pin_hash`, `sale_payments`, `pos_shifts`, `sale_voids`, and `kds_tickets`.

**Deployment & Environment Checklist:**
- Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `server/.env` to enable live Gemini Vision OCR and Gemini AI demand reasoning (offline fallbacks remain active when unset).
- For cPanel deployment: run `npm run build` in `InventoryProject/`, upload updated `/server/` files and the new `/dist` folder (no `/src/` or `/node_modules/` upload needed), and restart the Node.js App in cPanel.

## 5. Remaining Minor Notes & Future Recommendations
1. **Security Hardening**: Migrate auth from spoofable `x-user-id` headers to signed JWTs/HTTP-only cookies, restrict CORS origins, and move in-memory `loginAttempts` / `pinFailureBuckets` rate limits into Redis or Supabase.
2. **Client Setup & Configuration Locations (Quick Guide)**:
   - **Categories, Cup Sizes, Lids/Straws & KDS Prep Station (`Barista` vs `Kitchen`)**: **Products -> Manage Categories** (`CategorySettingsModal.jsx`) configures category prep station and default options inherited by new products; individual items can also customize sizes/recipes in **Add / Modify Product**.
   - **Promo Codes, Student/Staff Discounts, Store GCash/Maya Static QR & Take-Out Bags**: **POS -> POS Setup** (`PosSettingsModal.jsx`, Owner/Admin only).
   - **Manager Void/Refund Approval PINs**: **Staff & Security -> Access Control -> Manager PINs** (`AccountManager.jsx`) or inline inside **POS -> Void & Refund**.
   - **Held Orders vs. Paid Orders in KDS**: Cashiers can hold orders (`Ongoing`) before payment and view both `HELD (UNPAID)` tickets and paid `PENDING`/`PREPARING`/`READY` tickets in **POS -> Order Queue / KDS**.
3. **Historical Store Backfill & Single-Shift Scale**: Records written to `cms_content` stores prior to running `phase4_pos_payments_void_shifts_kds.sql` stay readable via dual-layer services; optionally backfill them into native tables for external SQL reporting. `computeXReading` assumes single-register shifts under 1,000 sales per shift window.
4. **Live Gateway & Print Hardware**: Wire live GCash/Maya/QRPH webhooks (`PAYMENT_WEBHOOK_SECRET`), optional thermal ESC/POS printing, and explicit base-vs-purchase unit conversion toggles on OCR intake lines if suppliers mix pack sizes and gram/mL quantities.

## 6. Known Limitations
- Batches are stored primarily in a `cms_content` JSON store (mirrored best-effort to `inventory_batches`) guarded by an in-process lock (`withStoreLock`), so the backend must run as a single process (no clustering or multiple instances).
- Sales, voids, KDS tickets, shifts and manager PINs also use `cms_content` JSON stores with the same single-process requirement.
- Voids require a Manager PIN configured in POS Settings (no default PIN).
