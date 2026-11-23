# Phase 1 Handoff & Phase 2 Blueprint

> **Project:** CofTea Cafe Inventory & POS System (`InventoryProject/`)  
> **Date:** 2026-11-23  
> **Status:** Phase 1 Verified & Built Cleanly

---

## 1. Phase 1 Completed Changes

### Backend Files Created & Updated
| File | Change Summary |
| :--- | :--- |
| `server/utils/validationHelper.js` *(new)* | Exported `LIMITS`, `validateNumberBound(value, { label, min, max, allowZero })`, and `validateTextLength(value, { label, min, max, required })` throwing `.status = 400` on invalid bounds. |
| `server/utils/stringHelper.js` | Preserved existing exports (`normalizeName`, `getLevenshteinDistance`, `collapseRepeats`, `findSimilarName`); added `normalizeCategory` and 3-pass `checkCompositeDuplicate`. |
| `server/routes/products.js` | Validated `POST /`, `PUT /:id`, and `POST /:id/receive` against `LIMITS`; added `findProductDuplicateConflict` returning `409` `is_hard_duplicate: true` (unforceable) or `409` `is_duplicate_warning: true`; handled Postgres `23505`; preserved `req.user.id` audit logging and excluded `stock_quantity` from `PUT /:id`. |
| `server/services/inventoryService.js` | Validated `createIngredient`, `updateIngredient`, `receiveStock`, and `updateStock(..., { maxLimit })`; added `assertNoIngredientDuplicate` (`409` hard vs. soft duplicate); handled Postgres `23505`. |
| `server/controllers/inventoryController.js` | Added `handleInventoryError` returning `409` (`is_hard_duplicate` / `is_duplicate_warning`) and propagating `err.status || 500`; preserved `req.user.id` audit logging. |
| `server/services/recipesService.js` & `server/routes/recipes.js` | Enforced `[0.001, 100000]` on `quantity_used` in `createRecipe` and `updateRecipe`; propagated `err.status || 500`. |
| `server/services/wastageService.js` & `server/routes/wastage.js` | Enforced `[0.01, 1000000]` on wastage `quantity` and `1–500` chars on `reason` in `reportWastage`; propagated `err.status || 500`; preserved `reported_by: req.user.id`. |
| `server/services/purchasingService.js` & `server/controllers/purchasingController.js` | Validated `quantity`, `unit_price`, `conversion_factor`, and `quantity_received_now` in `buildSupplierIngredientMappings`, `createPurchaseOrder`, `updatePurchaseOrderStatus`, and `updateSupplierOwnCatalog`; propagated `err.status || 500`. |

### Frontend Files Created & Updated
| File | Change Summary |
| :--- | :--- |
| `src/utils/validationUtils.js` *(new)* | Exported `INPUT_LIMITS`, `validateAmountInput`, and `clampNumberInput`. |
| `src/utils/productUtils.js` | Updated `checkDuplicateOrSimilar(newName, existingItems, excludeId, newCategory)` with 3-pass composite `name + category` logic (`isHardDuplicate`, `isDifferentCategory`, fuzzy/subset match). |
| `src/features/inventory/hooks/useManageProducts.js` | Removed blocking `ConfirmModal` on normal Add/Update; wired `INPUT_LIMITS` + `validateAmountInput`; hard-blocked same-category duplicates (`isHardDuplicate` & `err.payload?.is_hard_duplicate`); passed `force_update` on soft-warning confirm; bounded product stock receipt, sizes, add-ons, and recipes. |
| `src/features/inventory/hooks/useManageRawMaterials.js` | Removed blocking `ConfirmModal` on normal Add/Update; fixed `handleUpdateIngredient` to pass `category` and `force_update`; wired `INPUT_LIMITS` + `validateAmountInput`; hard-blocked same-category duplicates and kept soft-warning modal. |
| `src/features/inventory/ManageProducts.jsx` & `components/products/ModifyProductModal.jsx` | Passed `message` / `onClearMessage` into `ModifyProductModal` for inline feedback; added `maxLength={100}` (`name`), `min="0.01" max="100000"` (`price`), `min="0" max="1000000"` (`low_stock_threshold`), and `min="0.001" max="100000"` (recipe `quantity`). |
| `src/features/inventory/components/products/AddProductFormSection.jsx` | Added `maxLength={100}` (`name`), `min="0.01" max="100000" step="0.01"` (`price`), and `min="0" max="1000000"` (`low_stock_threshold`). |
| `src/features/inventory/ManageRawMaterials.jsx` | Added inline modal `message` banner with dismiss and reset on close; added `maxLength={100}` (`name`), `min="0" max="1000000"` (`low_stock_alert` / `editAlert`), `maxLength={40}` (`editPurchaseUnit`), `min="0.0001" max="1000000"` (`editConversionFactor`), and `min="0" max="1000000"` (`editCost`). |
| `src/features/inventory/StockReceived.jsx` | Added `min="0.01" max="1000000"` plus JS `validateAmountInput` and resulting stock `<= 1,000,000` check. |
| `src/features/inventory/PurchaseOrderForm.jsx` | Added `min="1" max="100000"` with clamped `onChange`/`onBlur` and pre-review validation for PO quantity, purchase unit (`<= 40` chars), conversion factor, and unit price. |
| `src/features/inventory/components/suppliers/SupplierFormModal.jsx` | Added `maxLength` (`name`: 100, `contact_person`: 100, `email`: 120, `address`: 250, `purchase_unit`: 40), numeric bounds (`price`: `0–1000000`, `conversion_factor`: `0.01–1000000`), and inline `validationError` banner. |
| `src/features/inventory/components/suppliers/SupplierCatalogSection.jsx` | Added `maxLength={40}` (`purchase_unit`), `min="0" max="1000000"` (`price`), and pre-save validation. |
| `src/features/wastage/ReportWastage.jsx` | Bounded `quantity` with `min="0.01"`, `max={Math.min(1000000, stock)}`, and `validateAmountInput` in `handleSubmit`. |

### Composite Duplicate Rules
1. **Pass 1 — Hard Block (`409`, `is_hard_duplicate: true`):** Normalized `name` AND normalized `category` (default `'GENERAL'`) match any existing record (active or archived). Cannot be bypassed with `force_create` or `force_update`.
2. **Pass 2 — Soft Warning (`409`, `is_duplicate_warning: true`, `SAME_NAME_DIFF_CATEGORY`):** Same normalized `name` in a different `category`. Prompts `ConfirmModal` and can proceed when explicitly confirmed.
3. **Pass 3 — Soft Warning (`409`, `is_duplicate_warning: true`, `SIMILAR_NAME`):** Fuzzy/Levenshtein match (backend) or substring/word-subset match (frontend). Prompts `ConfirmModal` and can proceed when explicitly confirmed.

### Global Input Bounds Table
| Field / Domain | Backend (`server/utils/validationHelper.js`) | Frontend (`src/utils/validationUtils.js` / UI) |
| :--- | :--- | :--- |
| Item / Supplier Name | `1`–`100` chars (`NAME_MAX_LEN`) | `1`–`100` chars (`NAME_MAX_LEN`, `maxLength={100}`) |
| Category | `1`–`50` chars (`CATEGORY_MAX_LEN`) | `<= 50` chars (`CATEGORY_MAX_LEN`) |
| Description / Wastage Reason | `<= 500` chars (`DESC_MAX_LEN`) | `<= 500` chars (`DESC_MAX_LEN`) |
| Product Price | `0.01`–`100,000` (`PRODUCT_PRICE_MIN/MAX`) | `0.01`–`100,000` |
| Size / Add-on Price | `0`–`50,000` (`ADDON_PRICE_MIN/MAX`) | `0`–`50,000` |
| Stock Quantity (Total / Max) | `0`–`1,000,000` (`STOCK_QTY_MIN/MAX`) | `0`–`1,000,000` |
| Direct Stock Receive Qty | `0.01`–`1,000,000` (`RECEIVE_QTY_MIN/MAX`) | `0.01`–`1,000,000` |
| Low Stock Threshold / Alert | `0`–`1,000,000` (`THRESHOLD_MIN/MAX`) | `0`–`1,000,000` |
| Recipe Quantity | `0.001`–`100,000` (`RECIPE_QTY_MIN/MAX`) | `0.001`–`100,000` |
| Conversion Factor | `0.0001`–`1,000,000` (`CONVERSION_FACTOR_MIN/MAX`) | `0.0001`–`1,000,000` (`0.01` min in `SupplierFormModal`) |
| Purchase / Catalog Cost | `0`–`1,000,000` (`PURCHASE_COST_MIN/MAX`) | `0`–`1,000,000` |
| Purchase Order Quantity | `0.01`–`100,000` (`PO_QTY_MIN/MAX`) | `1`–`100,000` (integer clamp in `PurchaseOrderForm`) |
| Wastage Quantity | `0.01`–`1,000,000` (`WASTAGE_QTY_MIN/MAX`) | `0.01`–`1,000,000` (capped by current stock in UI) |

### Modal UX Cleanup
- Removed redundant blocking `ConfirmModal` dialogs ("Confirm Add" / "Confirm Update") from `useManageProducts.js` (`handleAddProduct`, `handleUpdateProduct`) and `useManageRawMaterials.js` (`handleAddIngredient`, `handleUpdateIngredient`).
- Retained `ConfirmModal` (`z-[100000]`) for soft duplicate warnings, archive/restore, permanent delete, direct stock receipt, and recipe item removal.
- Wired inline `message` error banners inside `ModifyProductModal.jsx` and the Edit Modal of `ManageRawMaterials.jsx` so backend `400`/`409` errors remain visible without closing the modal.

---

## 2. Database / SQL Notes

- **Reference Script:** `InventoryProject/docs/database/phase1_duplicate_and_bounds.sql`
- **How to Apply:** This script is idempotent and intended to be run manually in the **Supabase Dashboard -> SQL Editor** if you want database-level enforcement in addition to application validation:
  1. Creates partial unique indexes `idx_products_unique_active_name_category` and `idx_ingredients_unique_active_name_category` on `(LOWER(TRIM(name)), COALESCE(LOWER(TRIM(category)), 'general')) WHERE is_archived = false`.
  2. Adds numeric `CHECK` constraints on `products`, `ingredients`, `recipes`, `wastage`, `purchase_order_items`, and `supplier_ingredients` aligned with `LIMITS`.
- **Pre-Check Note:** If any existing legacy rows in Supabase violate the new `CHECK` bounds or active `(name, category)` uniqueness, clean those rows first before executing the `DO $$ ... END $$;` constraint block. Also note that `InventoryProject/docs/database/*` is gitignored in `.gitignore`, so this SQL file stays local as reference documentation.

---

## 3. Verification Results

All checks were executed after the final application edits:

| Check | Command (run from `InventoryProject/`) | Outcome |
| :--- | :--- | :--- |
| Backend syntax (`node --check`) | `node --check server/utils/validationHelper.js server/utils/stringHelper.js server/routes/products.js server/routes/recipes.js server/routes/wastage.js server/controllers/inventoryController.js server/controllers/purchasingController.js server/services/inventoryService.js server/services/purchasingService.js server/services/recipesService.js server/services/wastageService.js` | **Passed** (exit 0, all 11 files) |
| Frontend ESLint | `npx eslint src/utils/validationUtils.js src/utils/productUtils.js src/features/inventory/hooks/useManageProducts.js src/features/inventory/hooks/useManageRawMaterials.js src/features/inventory/ManageProducts.jsx src/features/inventory/ManageRawMaterials.jsx src/features/inventory/StockReceived.jsx src/features/inventory/PurchaseOrderForm.jsx src/features/inventory/components/products/AddProductFormSection.jsx src/features/inventory/components/products/ModifyProductModal.jsx src/features/inventory/components/suppliers/SupplierFormModal.jsx src/features/inventory/components/suppliers/SupplierCatalogSection.jsx src/features/wastage/ReportWastage.jsx` | **Passed** (exit 0, all 13 files) |
| Production build | `npm run build` (`vite build`) | **Passed** (exit 0; 766 modules transformed in 711ms) |
| Validation & duplicate assertions | `node --input-type=module -e "..."` testing `validationHelper`, `stringHelper.checkCompositeDuplicate`, `validationUtils`, and `productUtils.checkDuplicateOrSimilar` | **Passed** (exit 0) |
| Static hygiene scan | Node scan across all 24 created/modified `.js`/`.jsx` files for Unicode emojis, raw `fetch(`, and `req.body.user_id` | **Passed** (0 issues) |

---

## 4. Next Up: Phase 2 Blueprint

1. **Purchase Order Overhaul**
   - Unify PO creation and receiving flows (`PurchaseOrderForm.jsx`, `ForecastCreatePOModal.jsx`, `ReceivePOModal.jsx`, `purchasingService.js`) with explicit delivery lot tracking, supplier price variance handling, and consistent `INPUT_LIMITS` enforcement.
2. **`inventory_batches` Table & Batch Receiving**
   - Introduce `inventory_batches` (`id`, `ingredient_id` / optional `product_id`, `po_id`, `batch_code`, `received_at`, `expiration_date`, `initial_qty`, `remaining_qty`, `unit_cost`, `status`) populated whenever stock is received via POs (`ReceivePOModal.jsx`) or direct stock receipt (`StockReceived.jsx`).
3. **FEFO (First-Expired, First-Out) Deduction**
   - Update POS checkout (`posService.js`) and wastage reporting (`wastageService.js`) to deduct from active non-expired batches ordered by earliest `expiration_date ASC NULLS LAST, received_at ASC`, keeping `ingredients.stock_quantity` synchronized with the sum of remaining batch quantities.
4. **Expiration Alerts**
   - Surface expiring-soon (e.g., within 7 days) and expired batch alerts in `useNotifications.js`, `NotificationInbox.jsx`, `AdminNotificationPopup.jsx`, and `LowStockAlerts` / `InventoryStatusReport`.
5. **Perishability Metadata**
   - Add `is_perishable` (boolean) and `default_shelf_life_days` (bounded integer) to `ingredients` (and direct-tracked `products`) in `ManageRawMaterials` / `ManageProducts` so receiving forms can auto-suggest expiration dates.
6. **Stocktake (Physical Count & Reconciliation)**
   - Add a dedicated Stocktake tab/workflow allowing staff/admins to record physical counts per ingredient (and batch), preview variance (`counted - system`), auto-adjust stock via an audited adjustment/wastage flow, and log `STOCKTAKE_RECONCILED` via `req.user.id`.

---

## 5. Possible Improvements & Edge Cases Noted

1. **Supplier `conversion_factor` Minimum Mismatch (`0.01` vs `0.0001`):** `SupplierFormModal.jsx` validates `conversion_factor` with `min: 0.01`, whereas `validationUtils.js`, `validationHelper.js`, `ManageRawMaterials.jsx`, and `purchasingService.js` support `0.0001`. Editing a supplier linked to an ingredient with `conversion_factor < 0.01` will fail client-side validation in `SupplierFormModal.jsx` until aligned to `INPUT_LIMITS.CONVERSION_FACTOR_MIN`.
2. **PO Quantity Minimum (`1` vs `0.01`):** `PurchaseOrderForm.jsx` clamps PO quantities to integers `>= 1` (`INPUT_LIMITS.PO_QTY_MIN`), whereas `validationHelper.js` allows fractional PO quantities down to `0.01` (`LIMITS.PO_QTY_MIN`). Keep in mind if fractional PO quantities are ever enabled in the UI.
3. **Uncovered Modals in Phase 1:** `ForecastCreatePOModal.jsx` (AI Restock PO modal) and category management modals (`CategorySettingsModal.jsx`, `RawMaterialCategoriesModal.jsx`) were outside Phase 1 file scope; backend PO validation still protects `createPurchaseOrder`, and `ForecastCreatePOModal` should adopt `INPUT_LIMITS` in Phase 2.
4. **Supplier Text Validation on Backend:** `SupplierFormModal.jsx` enforces `maxLength` on `name` (100), `contact_person` (100), `email` (120), and `address` (250), while `purchasingService.js` (`sanitizeSupplierDetails`) currently leaves text lengths unchecked server-side.
5. **Ampersand Normalization Difference:** Frontend `normalizeName` (`productUtils.js`) converts `&` to `and` before substring/word-subset matching, whereas backend `normalizeName` (`stringHelper.js`) strips non-alphanumeric characters (`&` removed). Exact duplicates still match consistently on both layers, while `A & B` vs `A and B` triggers a soft warning client-side.
6. **Pre-Existing Working Tree Deletions:** `git status` shows deleted files under `InventoryProject/docs/defense/*` that pre-existed outside Phase 1; Phase 1 workers and verifier did not modify or delete `docs/defense/`.
