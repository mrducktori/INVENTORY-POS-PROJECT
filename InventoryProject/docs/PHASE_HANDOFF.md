# Phase Handoff & Blueprint

> **Project:** CofTea Cafe Inventory & POS System (`InventoryProject/`)  
> **Date:** 2026-11-23  
> **Status:** Phase 1 & Phase 2 Verified & Built Cleanly

---

## 1. Phase 2 Completed Changes (Batches, FEFO, Expiry Alerts, Perishability & Stocktake)

### Backend Files Created & Updated
| File | Change Summary |
| :--- | :--- |
| `server/services/batchService.js` *(new)* | Dual-layer persistence (`cms_content` keys + optional native `inventory_batches`, `ingredients` perishability cols, and `stocktake_sessions`/`stocktake_items` with capability caching and per-store async mutexes); Manila date arithmetic (`addDaysManila`); smart perishability defaults & overrides (`setIngredientPerishability`); auto-seeding/reconciliation (`enrichIngredientsWithBatches`); FEFO sorting (`annotateAndSortBatchesFEFO`); `createBatch`; `planBatchDeduction` / `deductStockFEFO` / `restoreDeductedBatches`; `getBatches`; `getExpiryAlerts`; `performStocktake` & `getStocktakeHistory` logging `STOCKTAKE_RECONCILED` with `req.user.id`. |
| `server/services/cmsService.js` | Added `"inventory_batches_store"`, `"ingredient_perishability_meta"`, and `"stocktake_history_store"` to `INTERNAL_CMS_KEYS`. |
| `server/utils/validationHelper.js` | Added `SHELF_LIFE_DAYS_MIN: 1`, `SHELF_LIFE_DAYS_MAX: 3650`, `BATCH_CODE_MAX_LEN: 60`, `STOCKTAKE_COUNT_MIN: 0`, and `STOCKTAKE_COUNT_MAX: 1000000` to `LIMITS`. |
| `server/services/inventoryService.js` | Enriched `getIngredients` and `getIngredientById` with batch/perishability fields; validated & saved perishability metadata on `createIngredient` and `updateIngredient`; updated `receiveStock` to record `DIRECT_RECEIVE` batches; evaluated `getLowStockAlerts` against `usable_stock`. |
| `server/routes/inventory.js` & `server/controllers/inventoryController.js` | Added `GET /batches`, `GET /expiry-alerts`, `GET /stocktake`, and `POST /stocktake` (`requireRole('Owner', 'Admin', 'Custom')`); passed `expiry_date`, `batch_code`, and `notes` on `receiveStock` and recorded batch info in `RAW_MATERIAL_STOCK_RECEIVED` audit logs. |
| `server/services/purchasingService.js` & `server/controllers/purchasingController.js` | Updated `updatePurchaseOrderStatus` receiving flow to validate optional `expiry_date`/`batch_code`, create `PURCHASE_ORDER` batches via `batchService.createBatch`, and include `batch_code` / `expiry_date` in `receipt_history` and `RAW_MATERIAL_STOCK_RECEIVED` audit logs. |
| `server/services/posService.js` | Included `category` and `created_at` in ingredient queries; enriched ingredients in `getProducts`, `getPosCatalog`, and `createSale`; computed availability and pre-flight `409` checks using `usable_stock` (excluding expired batches); deducted ingredients via `deductStockFEFO(..., { allowExpired: false })` with `restoreDeductedBatches` rollback and `deducted_batches` in `INGREDIENT_DEDUCTED` audit logs. |
| `server/services/wastageService.js` | Updated `reportWastage` to deduct via `deductStockFEFO` (supporting explicit `batch_id` or `preferExpired` when reason matches expiry, `allowExpired: true`), restore batches on failure, and log `deducted_batches` in `WASTAGE` audit logs. |
| `server/routes/dashboard.js` | Evaluated `lowStockIngredients` using `usable_stock` and attached `expiryAlerts` (`getExpiryAlerts()`) to `GET /api/dashboard/stats`. |

### Frontend Files Created & Updated
| File | Change Summary |
| :--- | :--- |
| `src/features/inventory/components/RawMaterialStocktakeSection.jsx` *(new)* | Non-blocking Physical Count / Stocktake workspace with search/category filtering, numeric bounds (`0–1,000,000`), live `Overage` / `Shortage` / `Matched` variance badges, reason presets datalist, inline status banner, `submitStocktake`, and **Recent Stocktake Reconciliations** audit table. |
| `src/utils/validationUtils.js` & `src/utils/dateUtils.js` | Added Phase 2 `INPUT_LIMITS` (`SHELF_LIFE_DAYS_MIN/MAX`, `BATCH_CODE_MAX_LEN`, `STOCKTAKE_COUNT_MIN/MAX`) and Manila-safe `addDaysManila`. |
| `src/api/inventoryApi.js` | Extended `receiveStock` with `{ expiry_date, batch_code, notes }`; added `getInventoryBatches`, `getExpiryAlerts`, `getStocktakeHistory`, and `submitStocktake` via `apiCall`. |
| `src/features/inventory/hooks/useManageRawMaterials.js` & `ManageRawMaterials.jsx` | Added `is_perishable` toggle and `default_shelf_life_days` (`1–3650`) to Add & Edit Raw Material forms; displayed perishability subtext and `Expired: X` badge in the materials table. |
| `src/features/inventory/components/purchasing/ReceivePOModal.jsx` & `StockReceived.jsx` | Added editable/clearable `Expiration Date` (pre-filled in Manila time) and optional `Batch / Lot Code` (`maxLength={60}`) on PO receiving (including Step 2 Review) and direct stock receipt for ingredients. |
| `src/features/inventory/components/suppliers/SupplierFormModal.jsx` | Aligned `conversion_factor` minimum from `0.01` to `INPUT_LIMITS.CONVERSION_FACTOR_MIN` (`0.0001`). |
| `src/features/inventory/RawMaterialTracker.jsx` | Added `LIVE_STOCK` vs `STOCKTAKE` mode switcher; switched stock status/KPIs to `usable_stock` with `Expired` badges and `Nearest Expiry` pills; added inline expandable `Batches (N)` FEFO queue rows (`FEFO #1`, `Expiring Soon`, `Expired`). |
| `src/features/inventory/LowStockAlerts.jsx` | Renamed to **Low-Stock & Expiration Alerts** with **Low Usable Stock** (showing `usable_stock`, excluded expired stock, and `Nearest Expiry`) and **Expiration Alerts** (`getExpiryAlerts()` expired & expiring-soon batch table) tabs. |
| `src/features/dashboard/hooks/useNotifications.js` & `NotificationInbox.jsx` | Synced `stats?.expiryAlerts` into `sharedStore.internalExpiryAlerts`, generated `BATCH_EXPIRED` and `BATCH_EXPIRING_SOON` notifications routed to `LowStockAlerts` / `RawMaterialTracker`, and added matching SVG icons. |
| `src/features/wastage/ReportWastage.jsx` | Switched stock chip to `Usable Available` + `Expired Stock` warning and added **Batch to Deduct** (`Auto (FEFO / Earliest Expiry)` or explicit batch) selector passing `batch_id` to `reportWastage`. |

---

## 2. Phase 2 Database / SQL Notes

- **Reference Script:** `InventoryProject/docs/database/phase2_batches_fefo_stocktake.sql` (local reference migration; `InventoryProject/docs/database/*` is gitignored per `.gitignore`).
- **Dual-Layer Behavior:** Until you execute the SQL script in **Supabase Dashboard -> SQL Editor**, `batchService.js` persists all batch records, perishability overrides, and stocktake sessions inside `cms_content` (`inventory_batches_store`, `ingredient_perishability_meta`, `stocktake_history_store`, all hidden from public CMS reads via `INTERNAL_CMS_KEYS`).
- **What the SQL Script Adds When Applied:**
  1. `is_perishable` (`BOOLEAN DEFAULT TRUE`) and `default_shelf_life_days` (`INTEGER`, `CHECK 1..3650`) columns on `public.ingredients`.
  2. `public.inventory_batches` table with `CHECK` bounds and FEFO/expiry indexes.
  3. `public.stocktake_sessions` and `public.stocktake_items` tables with bounds and foreign-key indexes.

---

## 3. Phase 2 Verification Results

All checks were executed after the final Phase 2 edits:

| Check | Command (run from `InventoryProject/`) | Outcome |
| :--- | :--- | :--- |
| Backend syntax (`node --check`) | `node --check server/services/batchService.js server/services/cmsService.js server/utils/validationHelper.js server/services/inventoryService.js server/routes/inventory.js server/controllers/inventoryController.js server/services/purchasingService.js server/controllers/purchasingController.js server/services/posService.js server/services/wastageService.js server/routes/dashboard.js` | **Passed** (exit 0, all 11 files) |
| Frontend ESLint | `npx eslint src/utils/validationUtils.js src/utils/dateUtils.js src/api/inventoryApi.js src/features/inventory/hooks/useManageRawMaterials.js src/features/inventory/ManageRawMaterials.jsx src/features/inventory/components/purchasing/ReceivePOModal.jsx src/features/inventory/StockReceived.jsx src/features/inventory/components/suppliers/SupplierFormModal.jsx src/features/inventory/RawMaterialTracker.jsx src/features/inventory/components/RawMaterialStocktakeSection.jsx src/features/inventory/LowStockAlerts.jsx src/features/dashboard/hooks/useNotifications.js src/features/dashboard/components/NotificationInbox.jsx src/features/wastage/ReportWastage.jsx` | **Passed** (exit 0, all 14 files) |
| Production build | `npm run build` (`vite build`) | **Passed** (exit 0; 767 modules transformed in 605ms) |
| Batch/FEFO/Perishability assertions | `node --input-type=module -e "..."` verifying `LIMITS`/`INPUT_LIMITS` parity, `INTERNAL_CMS_KEYS`, `addDaysManila` parity, smart perishability defaults/overrides, FEFO sort order, `allowExpired: false` `409` guard, and `preferExpired`/`targetBatchId` wastage plans | **Passed** (exit 0) |
| Static hygiene scan | Node scan across all 25 Phase 2 `.js`/`.jsx` files for Unicode emojis, raw `fetch(`, and `req.body.user_id` | **Passed** (0 issues) |

---

## 4. Next Up: Phase 3 Blueprint

1. **Sizes Inside Add/Edit Product**
   - Move cup/portion size configuration directly into `AddProductFormSection.jsx` and `ModifyProductModal.jsx` (inheriting defaults from category settings with per-product customization and `ADDON_PRICE_MAX` bounds).
2. **Per-Size Recipe & Packaging Deduction**
   - Allow recipes (`recipes` table / size-linked mappings) to vary ingredient quantities and cup/lid packaging per selected size (e.g., 12oz vs 16oz vs 22oz cup, espresso shots, milk/ice volume) so `posService.js` (`computeProductAvailability`, `createSale`) and `posStockUtils.js` calculate exact stock caps and FEFO deductions per size.
3. **Modifiers & Add-ons Engine**
   - Standardize add-on and modifier groups (sugar level, ice level, extra espresso, pearls, whipped cream) with stock-linked ingredient deduction, availability capping in POS, and bounded price/qty rules across `ManageProducts`, `POS`, and `LandingMenuBoard`.
4. **Order-Type Tagging**
   - Add first-class `order_type` (`Dine-In`, `Take-Out`, `Delivery`) tagging in `POS`, `sales` persistence, receipt modals/journal (`SalesReceiptModal.jsx`, `SalesReceiptJournal.jsx`), and optional packaging auto-deduction (e.g., carrier bag / take-out cup sleeve when `Take-Out` or `Delivery` is selected).

---

## 5. Possible Improvements & Edge Cases Noted

1. **PO Item Perishability Enrichment in `ReceivePOModal.jsx`:** `purchasingService.js` (`getPoSelectColumns`) currently selects `ingredients ( name, unit )` without enriching `is_perishable` / `default_shelf_life_days`. As a result, `ReceivePOModal.jsx` pre-fills a +30-day date for PO items until manually cleared, though `batchService.createBatch` still applies the ingredient's true perishability metadata when `expiry_date` is cleared. Enriching PO items via `batchService.getIngredientPerishability` in `getPurchaseOrders` would allow `ReceivePOModal.jsx` to default non-perishable packaging to blank and pre-fill exact ingredient shelf lives (e.g., 14d for dairy).
2. **Blank Expiry on Perishable Receipt:** In `batchService.createBatch`, submitting a blank/cleared `expiry_date` on an item configured as `is_perishable: true` intentionally falls back to `todayManila + default_shelf_life_days`. Items that genuinely do not expire should be toggled to `Non-Perishable` (`is_perishable: false`) in **Manage Raw Materials**.
3. **Native SQL Migration Backfill:** `batchService.js` stores full historical batches in `cms_content` and dual-upserts batches touched after migration to `inventory_batches`. If you run `phase2_batches_fefo_stocktake.sql` after batches already exist in `cms_content`, opening **Raw Material Tracker** or triggering `enrichIngredientsWithBatches` reconciles newly created/seeded batches, while an optional one-time backfill from `cms_content` -> `inventory_batches` can be added if querying `inventory_batches` directly in SQL reports.
4. **Phase 1 Carryover Notes (Updated):**
   - *Resolved in Phase 2:* `SupplierFormModal.jsx` `conversion_factor` minimum now matches `INPUT_LIMITS.CONVERSION_FACTOR_MIN` (`0.0001`).
   - *Still applicable:* `PO_QTY_MIN` (`1` integer clamp in `PurchaseOrderForm.jsx` vs `0.01` in `validationHelper.js`), `ForecastCreatePOModal.jsx` bounds adoption, backend text-length validation in `purchasingService.js` (`sanitizeSupplierDetails`), and pre-existing working tree deletions under `InventoryProject/docs/defense/`.

---

## 6. Phase 1 Summary (Reference Archive)

- **Composite Duplicate Prevention (`name + category`):** Added `checkCompositeDuplicate` (`server/utils/stringHelper.js`) and 3-pass `checkDuplicateOrSimilar` (`src/utils/productUtils.js`) to hard-block (`409`, `is_hard_duplicate: true`, unforceable) exact same-category duplicates on products and raw materials while keeping soft `409` confirmation warnings for different categories or similar names; added reference SQL `docs/database/phase1_duplicate_and_bounds.sql`.
- **Global Input Bounds:** Created `server/utils/validationHelper.js` (`LIMITS`) and `src/utils/validationUtils.js` (`INPUT_LIMITS`), enforcing aligned bounds across products, raw materials, recipes, direct stock receipt, POs, suppliers, and wastage.
- **Modal UX Cleanup & Bug Fixes:** Removed redundant blocking `ConfirmModal` prompts on normal Add/Update in `useManageProducts.js` and `useManageRawMaterials.js`, fixed `handleUpdateIngredient` to pass `category` and `force_update`, and surfaced inline modal error banners inside `ModifyProductModal.jsx` and `ManageRawMaterials.jsx`.
