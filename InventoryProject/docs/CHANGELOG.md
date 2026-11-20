# Changelog

All notable changes to this project will be documented in this file.

## [Docs/Defense: Concise 2-Page System Guide PDF - 2026-11-21]
- **`docs/defense/CofTea_Concise_System_Guide.pdf`**: Exported a concise 2-page PDF summary covering tech stack & hosting, security controls, the 5-step operational process, and retention/scope boundaries.

## [Notifications/UI: Newest-First Sorting & Role-Tailored Inbox Filters - 2026-11-20]
- **`src/features/dashboard/hooks/useNotifications.js`**: Sorted `allNotifications` strictly newest-first by `timestamp` so the latest notification always appears at the top.
- **`src/features/dashboard/components/NotificationInbox.jsx`**: Added `PO_CANCELLED` and `PO_PENDING` icons in `renderIcon`, replaced static category tabs with role-tailored filter pills (`All`, `Unread`, plus `Pending`/`Proposals`/`Active`/`Cancelled`/`Declined` for `Supplier`, or `Critical`/`Stock Alerts`/`PO Updates`/`Price Updates` for café roles), and derived `effectiveTab` during render for safe role switches.

## [Supplier Portal/Notifications: Fix 403 Endpoint Mismatch for Supplier Bell Inbox - 2026-11-20]
- **`src/features/dashboard/hooks/useNotifications.js`**: Updated `fetchSharedPOs` to call `getSupplierOwnOrders()` (`/api/purchasing/my-orders`) when logged in as a `Supplier` instead of `getPurchaseOrders()` (`/api/purchasing`, which returns `403` for external supplier accounts), enabling all PO notifications (including `Pending`, `Cancelled`, `Proposal Pending`, and `Accepted`) in the Supplier Portal bell inbox.

## [Supplier Portal: Cancelled PO Notifications & Reason Display - 2026-11-20]
- **`src/features/dashboard/hooks/useNotifications.js`**: Added `Cancelled` / `CANCELLED` PO notification handling (including `cancellation_reason` and `decline_reason` in notification messages) so suppliers are alerted when a PO is cancelled.
- **`src/features/inventory/components/suppliers/SupplierOrderDetailsRow.jsx` & `SupplierOrdersTable.jsx`**: Added `Cancelled` / `CANCELLED` status badge styling and a **Cancellation Reason Recorded** alert card inside the expanded PO details row.

## [Security/Reliability: Pre-Defense Role Guards, Validation & Pagination Fixes - 2026-11-20]
- **`src/features/dashboard/hooks/useNotifications.js`**: Guarded Supabase realtime `purchase_orders` and `ingredients` callbacks with `canViewPOs`, `canViewSuppliers`, and `canViewStock` so users without PO/Supplier permissions don't trigger `403` requests.
- **`server/routes/recipes.js`**: Added `requireRecipeWriteAccess` middleware on `POST`, `PUT`, and `DELETE` allowing `Owner`, `Admin`, and `Custom` users with `Products` or `ManageProducts` permissions.
- **`server/routes/users.js`**: Added `requireRole('Owner', 'Admin', 'Staff', 'Custom')` to `GET /` and `GET /shifts` so external `Supplier` accounts cannot list internal staff/users.
- **`server/controllers/purchasingController.js` & `server/services/purchasingService.js`**: Validated non-empty `items` and `supplier_id` on `createPurchaseOrder` (`400` on invalid input) and paginated `fetchPoAuditLogs()` past PostgREST's 1,000-row cap.
- **`server/routes/sales.js` & `server/routes/dashboard.js`**: Paginated `GET /api/sales` search/category queries and `fetchBoundedSales` past the 1,000/4,000-row limits.

## [Database/Seed: Backfill Stock Movement Audit Logs for Nov 18–20 Sales - 2026-11-20]
- **`docs/database/seed_stock_movement_2026_11_18_to_20.mjs`**: Added and ran an idempotent script generating `PRODUCT_DEDUCTED` and `INGREDIENT_DEDUCTED` `audit_logs` entries corresponding to the 112 seeded sales from `2026-11-18` to `2026-11-20` so **Reports → Stock Movement** reflects the sales outflows without altering live inventory stock.

## [Analytics/UI: Add Section Header & Detailed Per-Factor InfoTips in MonthlyProjectionModal - 2026-11-20]
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**: Added general `InfoTip` `(i)` icons on the **Projected Volume**, **Projected Daily Avg**, and **Same-Month Historical Sales** headers, and refined each per-factor `(i)` tooltip in **Multi-Year & Calendar Factors** to explain how each multiplier is calculated.

## [Analytics/Fix: Fix `runForecastPromise` TDZ Error in `forecastStockUsingAI` - 2026-11-20]
- **`server/services/aiForecastingService.js`**: Fixed `ReferenceError: Cannot access 'runForecastPromise' before initialization` when `forecastStockUsingAI` resolves synchronously (e.g., past months or deterministic fallback without `await`s) by declaring `let runForecastPromise;` and yielding one microtask (`await Promise.resolve()`) before entering `try/finally`.

## [Analytics/Dashboard: Forecast Display, Manila Timezone & Request Sequencing Fixes - 2026-11-20]
- **`src/features/dashboard/components/PredictiveInsights.jsx`**:
  - Gated the 7-Day Demand Forecast stockout pill on `f.track_stock !== false && f.stockoutRisk` and displayed `orders` vs `units` based on `track_stock`.
  - Updated the Stock Depletion Timeline to respect `item.urgency_status` (`OUT_OF_STOCK`, `CRITICAL`, `LOW_STOCK`) even when `days_remaining` is `> 7` or `null`.
- **`src/features/analytics/hooks/useDemandForecasting.js`**:
  - Added `monthlyReqSeqRef` to `runMonthlyForecast` to ignore stale out-of-order responses during rapid month/year switches.
  - Computed initial `poExpectedDate` in `Asia/Manila` and stored/cleared `toastTimerRef` in `showToast`.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**:
  - Derived `currentYear` and `currentMonth` using `Asia/Manila` so past-month detection matches backend `isHistoricalManilaMonth`.

## [Analytics/UI: Add Info Tooltips to Monthly Projection Factors - 2026-11-20]
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**: Added `InfoTip` `(i)` tooltips to the **Multi-Year & Calendar Factors** header and each individual factor row (`Seasonal Index`, `YoY Trend`, `Weekend Demand Multiplier`, `Peak School Days`, and `Holidays in Selected Month`) explaining how each metric is calculated.

## [Analytics/Forecasting: Fix Forecast Data Accuracy & Mean-Preserving Calendar Math - 2026-11-20]
- **`server/services/aiForecastingService.js`**:
  - Fixed `sale_items` fetch to query all rows in the trailing 120 calendar days (paginated) instead of `.order('id', { ascending: false }).limit(1000)` on random UUIDs.
  - Switched `recentSummary` (`7d / prior 7d / 30d / 90d`) to true Asia/Manila calendar-day bounds instead of active sale-day slicing.
  - Gated `isPayday` in `dailySales` with `!holiday` so holiday Mondays/Fridays don't distort `peakDayMultiplier`.
  - Replaced hardcoded `!(m.year === 2026 && m.month === 11)` with `isHistoricalManilaMonth(m.year, m.month)`, switched `currentMonth` to Manila time, and replaced static `normFactor = 1.10` with the exact `meanMonthMultiplier` of the target month so calendar lifts distribute without inflating or shrinking totals.
  - Added `recordedRevenue` to `runDeterministicEnsembleForecast` for completed past months.
- **`server/routes/analytics.js`**:
  - Initialized `holidayQty: 0` on `productMap` entries (preventing `NaN` holiday totals), switched date/year filters (`currentYear`, `currentYear - 1`) to Asia/Manila time, and replaced static `normFactor = 1.12` with the exact 30-day `mean30CalMult`.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**:
  - Used `recordedRevenue` when viewing historical months and showed `units` vs `orders` based on `track_stock`.

## [Analytics/Forecasting: Sync 7-Day Demand & Gemini Output with Holiday Logic - 2026-11-20]
- **`server/routes/analytics.js`**: Updated `GET /api/analytics/demand-forecast` (7-day & 30-day Menu Demand) to compute a data-driven holiday multiplier (`0.75x–1.20x`, default `0.85x`) from 90-day POS history and skip the Monday/Friday school-rush boost on Philippine holidays (`if (isPay && !isHol)`).
- **`server/services/aiForecastingService.js`**: Anchored `predictedUnitsSold` and `recommendedOrderQuantity` to `runDeterministicEnsembleForecast` when Gemini returns `reasoning`/`confidenceScore`, keeping monthly totals 100% consistent with the displayed multipliers.

## [Analytics/Forecasting: Data-Driven Holiday Multiplier & PH Holiday Calendar - 2026-11-20]
- **`server/services/aiForecastingService.js`**:
  - Added data-driven `holidayMultiplier` (0.75x–1.20x, default 0.85x) computed from historical holiday vs. baseline demand, skipped Mon/Fri peak school boost on holidays (`isPeakSchool && !isHol`), and added Dec 8, Dec 24, National Heroes Day, and Holy Week to `isPhilippineHoliday`.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**:
  - Displayed computed `holidayMultiplier` alongside the holiday count in the Multi-Year & Calendar Factors card.

## [Analytics/Purchasing: Single-Supplier Selection Lock & Scoped Critical Reordering - 2026-11-20]
- **`src/features/analytics/hooks/useDemandForecasting.js`**:
  - Added `doesItemMatchSupplier` and derived `lockedSupplier` from selected ingredients so batch PO selection locks to one common supplier.
  - Updated `handleToggleItemSelect` and `handleToggleSelectAll` to prevent mixing ingredients from conflicting suppliers, and added `handleClearSelection`.
  - Added `poPoolItems` and `getItemsForSupplier` so `Reorder All Critical` and `ForecastCreatePOModal` strictly scope displayed PO items to the active supplier, track edits across supplier switches, and automatically advance to the next remaining supplier after PO submission.
- **`src/features/analytics/components/IngredientRestockTab.jsx` & `DemandForecasting.jsx`**:
  - Disabled checkboxes and dimmed rows belonging to other suppliers once a supplier's item is selected, updated the Select All header state, and added a locked `Supplier:` indicator and **Clear** button beside `Create PO`.
- **`src/features/analytics/components/ForecastCreatePOModal.jsx`**:
  - Replaced `Show all suppliers` with supplier pills strictly derived from the PO item pool, showing per-supplier item counts and a concise notice when critical items span multiple vendors.

## [Suppliers/Purchasing: Mark Supplier Price Updates as Read - 2026-11-20]
- **Backend (`server/routes/purchasing.js`, `server/controllers/purchasingController.js`, `server/services/purchasingService.js`)**:
  - Added `POST /api/purchasing/suppliers/:id/acknowledge-prices` (`acknowledgeSupplierPriceUpdates`) logging `SUPPLIER_PRICE_UPDATES_READ` in `audit_logs` per supplier or per individual `ingredient_id`.
  - Added shared `getUnacknowledgedPriceUpdateLogs()` helper in `purchasingService.js` (used by both `getSuppliers` and `getSupplierPriceUpdates`) to filter out `SUPPLIER_CATALOG_PRICES_UPDATED` events/items that occurred on or before the latest read acknowledgment timestamp so past updates never stack up with new price changes.
- **Frontend (`src/api/purchasingApi.js`, `src/features/inventory/ManageSuppliers.jsx`, `src/features/inventory/components/suppliers/SupplierCatalogModal.jsx`)**:
  - Added `acknowledgeSupplierPriceUpdates(supplierId, ingredientId)` API helper using `apiCall`.
  - Upgraded the `Prices Updated` pill in `ManageSuppliers.jsx` to display the unacknowledged count, open the catalog modal on click, and provide an inline **Mark read** checkmark button.
  - Added **Mark All as Read** in `SupplierCatalogModal.jsx`'s adjustment banner and a per-material **Mark read** button on each updated item row with instant optimistic UI updates.

## [Products/UI: Defer Category Rename Until Save Changes Is Pressed - 2026-11-20]
- **`src/features/inventory/components/products/CategorySettingsModal.jsx`**: Removed the immediate-commit `Rename` button so category name edits stay pending until **Save Changes** is clicked, saving both the category rename and default sizes/add-ons together without discarding unsaved edits.

## [UI/Copy: Sync Dashboard & Forecasting Info Tooltips with 90-Day & Mon/Fri Peak Logic - 2026-11-20]
- **`src/features/dashboard/components/PredictiveInsights.jsx`**: Updated the **7-Day Demand Forecast** and **Stock Depletion Timeline** `InfoTip` tooltips to reflect the 90-day rolling baseline (weighted toward recent 14-day/30-day velocity), 4-year seasonality, and Monday/Friday peak school days (removing outdated `last 30 days` and `paydays` wording).
- **`src/features/analytics/components/ForecastGuideModal.jsx`**: Fixed `Peak School Days (Mon–Fri)` heading to `Peak School Days (Mon & Fri)` so it matches the Monday/Friday peak factor.

## [Docs/Defense: Complete Defense & System Process Script (Word & PDF) - 2026-11-20]
- **`docs/defense/CofTea_Complete_Defense_Script.docx` & `.pdf`**: Generated the combined slide-by-slide (Slides 1–12) and live system process walkthrough script (Public Menu Board, Role-Based Login, POS & Stock-Capped Ordering, Automatic Deduction & Receipts, Inventory/Wastage Monitoring, and AI Demand Forecasting & Supplier PO Loop).

## [Docs/Defense: Complete 7-Section Defense Guide (.docx & .pdf) - 2026-11-20]
- **`docs/defense/CofTea_Complete_Defense_Guide.docx` & `.pdf`**: Exported the complete, up-to-date 7-section defense guide covering presentation structure, verified Alpha/Beta paper figures and Appendix C quotes, exact Vercel + Render + Cloudflare + Supabase + Gemini (`gemini-3.5-flash-lite`) stack/TCO, live system mechanics (including today's stock-capped POS `/api/pos/catalog` + `409 Conflict`, fixed liquid yields, and linked-supplier PO filtering), paper-vs-system honesty points, 10 outside-the-box Q&As, and the tonight/tomorrow checklist.
- **`docs/defense/CofTea_Full_Defense_Script_Unassigned.docx` & `.pdf`**: Created a speaker-neutral full defense script covering Slides 1–10, a 5-step Live System Demo walkthrough, a blank Speaker Assignment Tracker, and universal handoff/closing lines.

## [Database/Seed: Historical Sales Seed for 2026-11-18 to 2026-11-20 - 2026-11-20]
- **`docs/database/seed_sales_2026_11_18_to_20.mjs`**: Added and ran an idempotent ESM seed script populating realistic historical `sales` (`112` orders: `38` on Nov 18, `38` on Nov 19, `36` on Nov 20 up to `now - 15m` Manila time) and `sale_items` (`213` lines) using live `products` and `category_settings` pricing/cup sizes/add-ons without touching live inventory stock or `audit_logs`.

## [Receipt Journal: Scope Latest Preset to Capped 250 Fetch & Skip Full-Table Count - 2026-11-20]
- **Backend (`server/routes/sales.js`)**: Added `skip_count=true` support on `GET /api/sales` to omit `{ count: 'exact' }` full-table scans when querying the `Latest` capped batch.
- **Frontend (`src/api/salesApi.js`, `useSalesReceiptJournal.js`, `SalesReceiptJournal.jsx`, `ReceiptJournalToolbar.jsx`)**: Passed `skip_count=true` for the `Latest` preset (with clean `offset` handling when `pageSize='all'`), scoped Total Receipts KPI, Journal Revenue subtitle, `All` scope pill count, and Fetch dropdown options (`Latest 100 / 250 / 500 / 1,000`) to the loaded latest batch (default `250`).

## [POS: Stock-Capped Ordering & Info Modal Max-Orderable Recipe Breakdown - 2026-11-20]
- **Backend (`server/routes/pos.js`, `server/controllers/posController.js`, `server/services/posService.js`)**:
  - Added authenticated `GET /api/pos/catalog` endpoint returning active products with `max_orderable`, recipes, and ingredient stock quantities while keeping public `GET /api/pos/products` free of internal recipe/ingredient details.
  - Added `computeProductAvailability` with epsilon-safe float math (`STOCK_EPSILON = 1e-9`) and hardened `createSale` to enforce missing-ingredient checks, untracked non-recipe stock checks, clean rounding, and `409` status on insufficient stock.
- **POS Stock Engine (`src/api/posApi.js`, `src/features/pos/utils/posStockUtils.js`)**:
  - Added `getPosCatalog()` and pure frontend reservation/capping utilities (`calculateReservedStock`, `getProductStockSummary`, `getMaxQtyForConfiguredItem`, `getMaxAddOnQty`, `validateItemsAgainstStock`) tracking live stock across cart items, ongoing orders, cup sizes, and add-ons.
- **POS UI (`usePOS.js`, `POS.jsx`, `ProductInfoModal.jsx`, `ProductOptionsModal.jsx`, `ProductCard.jsx`, `Cart.jsx`, `OngoingOrders.jsx`)**:
  - Displayed exact available-to-order servings/units alongside per-ingredient max capacity and cup stock in `ProductInfoModal`.
  - Capped item quantities, cup sizes, and add-ons in `ProductOptionsModal` and `Cart`, added live stock badges and `LIMIT REACHED` states on `ProductCard`, flagged understocked `OngoingOrders`, and blocked checkout when live DB stock is insufficient.
  - Simplified `ProductInfoModal`, `ProductOptionsModal`, `ProductCard`, and `Cart` to clean, badge-free plain text styling matching the original POS UI.

## [Analytics/DB: Realistic Brewed Conversion Factors & Linked-Supplier PO Filtering - 2026-11-20]
- **Supabase (`ingredients` & `supplier_ingredients`)**: Updated brewed/liquid conversion factors from dry gram/pack-count values to realistic liquid yields: `ASSAM BLACK TEA` (`500g Bag` -> `20,000 ML`), `OOLONG TEA` (`500g Pack` -> `20,000 ML`), `RED CAROLINE TEA` (`500g Pack` -> `20,000 ML`), `ESPRESSO` (`1kg Pack` -> `2,500 ML`), and `YAKULT` (`Pack of 5` -> `400 ML`), recalculating `unit_cost` while preserving agreed `supplier_ingredients.default_price`.
- **`server/routes/analytics.js`**: Added `available_suppliers` array (all linked entries from `supplier_ingredients` with `default_purchase_unit`, `default_conversion_factor`, and `default_price`) to each ingredient item returned by `GET /api/analytics/ingredient-forecast`.
- **`src/features/analytics/` (`useDemandForecasting.js`, `DemandForecasting.jsx`, `ForecastCreatePOModal.jsx`)**: Filtered the Create PO modal's supplier pills to linked suppliers by default (with a `Show all suppliers` / `Linked only` toggle), synced agreed unit cost/packaging dynamically when switching suppliers, added a `Not in selected supplier's catalog` notice when overriding to an unlinked vendor, and formatted conversions cleanly as `1 × <purchase_unit> = <factor> <unit>`.

## [Docs/Defense: Master Word Reviewer, Cheat Sheet Refresh, Slide 98.17% Fix & Doc Sync - 2026-11-20]
- **`docs/defense/CofTea_Defense_Master_Reviewer_and_Paper_Backup.docx`**: Generated an executive Word defense guide covering the 5 core defense takeaways, verified Alpha (`483/492 = 98.17%`) and Beta (`3.60–3.80`) metrics, Appendix C quotes, exact Vercel + Render + Cloudflare + Supabase + Gemini (`gemini-3.5-flash-lite`) stack/costs, 15 plain-English Q&As, live demo choreography (`password123`, 3 separate browsers, AI Forecasting before POS checkout), and copy-paste Chapter 3 revision backups (`Who`, `REQ001–REQ061`, and full manuscript errata table).
- **`docs/defense/CofTea_Groupmate_Defense_Cheat_Sheet.docx` & `.pdf`**: Refreshed to include all 5 roles (`Owner`, `Admin`, `Staff`, `Supplier`, `Custom`), updated Q6 (prior defense feedback + client confidentiality), 30/90-day archive deletion guardrails, and Nov 18–21 demo-day rules (`password123`), plus generated an editable `.docx` copy.
- **`docs/defense/CofTea_Easy_Groupmate_Guide.docx` & `.pdf`**: Added a simplified 2-page plain-English guide for non-technical groupmates (4-step story, presenter slide numbers, 6 common Q&As, handoff scripts, "Don't Say" rules, and onstage teamwork notes).
- **`docs/defense/CofTea_Simple_Defense_Guide.docx` & `.pdf`**: Created one unified, chronological 3-page guide covering pre-defense setup checkboxes, slide breakdown, exact live demo sequence, 5 easy group Q&As, 6 developer Q&As, and golden defense rules.
- **`docs/defense/CofTea_Final_Defense_Presentation_Slides.pdf`**: Fixed Slides 3 and 8 to show `98.17% (483/492)` consistently without the double-counted `98.20% (492/501)` figure.
- **`docs/PROJECT_REFERENCE.md`**: Synced Section 1 & 3 (React 19, Vite 8, Vercel + Render + Cloudflare DNS + Gemini), Section 8 (`process_pos_checkout` drafted in SQL vs `posService.js` batched pre-checks + rollback compensation), and Section 9 status note.

## [Landing Page: Connected Split Hero & Sharper Edges - 2026-11-19]
- **`src/features/auth/LandingPage.jsx`**: Connected the welcome/menu panel and promo carousel into one unified desktop (`lg+`) split-frame with a translucent frosted glass background (`bg-black/35 backdrop-blur-lg`) and vertical divider, falling back to separate stacked cards on smaller viewports and a single centered card when no promos exist; balanced corner radii (`rounded-xl` / `rounded-lg` / `rounded-md`).
- **`src/features/auth/components/LandingPromoCarousel.jsx`**: Added `connected` prop for flush desktop integration, edge-to-edge height alignment, translucent card background, and balanced corners across the carousel, badges, arrows, controls, and lightbox.
- **`src/features/auth/components/LandingMenuBoard.jsx`**: Adjusted background opacity (`bg-black/45`) and balanced corner radii (`rounded-xl` / `rounded-lg` / `rounded-md`) across the menu panel, category tabs, buttons, product cards, and price chips.

## [Products/POS: Dynamic Category Customization & Editing - 2026-11-19]
- **`server/routes/categorySettings.js`**:
  - Upgraded `GET /api/categories/settings` to return `category_settings` merged with distinct product categories (including `product_count` across active and archived items).
  - Hardened `POST /` validation (reserved names, max length, duplicate 409 rejection instead of silent upsert), added `PATCH /:category/rename` (3-step rename across `category_settings` and `products`), and added `DELETE /:category` (blocked with 409 if in use by any product), with analytics cache invalidation and audit logging.
- **`src/api/categorySettingsApi.js` & `src/utils/productUtils.js`**:
  - Added `createCategory`, `renameCategory`, `deleteCategory`, and `extractCategoryNames` helpers using `apiCall`.
  - Updated `filterProducts` (dynamic `OTHERS` exclusion using live categories) and added `getProductOptionsAvailability`.
- **`src/features/inventory/`**:
  - Updated `ManageProducts`, `useManageProducts`, `CategorySettingsModal`, `CategoryListSidebar`, `CategoryDefaultsEditor`, and product forms/lists so owners/admins can add, rename, delete, and configure product categories dynamically.
- **`src/features/pos/`, `src/components/shared/CategoryFilter.jsx`, `src/features/logs/`**:
  - Wired dynamic categories into POS filters, config-driven cup size & add-on availability, localStorage cart category self-healing, and Sales Receipt Journal filter pills.

## [Analytics/AI: Menu Demand Polish - Made-to-Order Prompt, Demand Outlook, Revenue - 2026-11-19]
- **`server/services/aiForecastingService.js`**: Made-to-order items (`track_stock: false`) now use a dedicated Gemini prompt focused on order volume and Mon/Fri/weekend prep load (no stock/restock wording); they return `recommendedOrderQuantity: 0` and `stockoutRisk: null`. `/ai-forecast` responses now always include `reasoning` (template fallback when Gemini is unavailable, `null` for past months), `price`, and `track_stock`.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**: Added **Demand Outlook** card (current/future months), **Est. Revenue / Recorded Revenue** row, and a "<Month YYYY> total" caption under Projected Volume.
- **`src/features/analytics/components/MenuDemandTab.jsx`**: Renamed "Est. 30 Days" to **Next 30 Days** with a "Rolling from today" sub-label.

## [Analytics/AI: Replace Payday Factor with Mon/Fri Student Peak School Days - 2026-11-19]
- **`server/services/aiForecastingService.js`**:
  - Replaced the 15th/30th salary payday check with `isPeakSchoolDay` (Monday & Friday peak student traffic days, exported with `isPhilippinePayday` alias for compatibility).
  - Updated `runDeterministicEnsembleForecast` to compute `peakDayMultiplier` comparing Mon/Fri volume against Tue–Thu mid-week volume, returning `peakDayMultiplier`, `peakSchoolDays`, and updated reasoning text.
  - Updated the Google Gemini prompt factor #11 and reasoning instructions to evaluate Monday/Friday student surges instead of salary paydays.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`, `ForecastGuideModal.jsx`, `MenuDemandTab.jsx`**:
  - Updated factor labels, tooltips, and reference guide copy to display **Peak School Days (Mon & Fri)**.

## [Analytics/Fix: Historical Month Handling & Historical Sales Display in Projection Modal - 2026-11-19]
- **`server/services/aiForecastingService.js`**:
  - Added Manila-timezone past-month detection (`isHistoricalMonth`) in `runDeterministicEnsembleForecast` and `forecastStockUsingAI`. Past months now return recorded historical `unitsSold` directly with `isHistorical: true`, `engine: 'historical_record'`, `recommendedOrderQuantity: 0`, and skip calling the Gemini API.
  - Added `qty` alongside `unitsSold` inside `sameMonthHistory` items.
- **`src/features/analytics/hooks/useDemandForecasting.js`**:
  - Reset `aiTargetYear` and `aiTargetMonth` to the current calendar year/month whenever `handleOpenMonthlyModal` opens.
- **`src/features/analytics/components/MonthlyProjectionModal.jsx`**:
  - Restricted top forecast year pills to `[currentYear, currentYear + 1]` (`2026`, `2027`) since `2023–2026` history is displayed at the bottom.
  - Updated labels and daily average math (`daysInSelectedMonth`) to distinguish **Recorded Sales (Actual)** for past months from **Projected Volume** for current/future months.
  - Fixed blank boxes in **Same-Month Historical Sales (2023–2026)** by reading `h.unitsSold ?? h.qty ?? 0`.

## [Chore/Structure: Organize Workspace, Docs & Feature Directories - 2026-11-19]
- **Workspace & Docs Cleanup**:
  - Removed duplicate presentation PDFs from the repository root and empty `scratch/` directory.
  - Moved defense presentations, test cases, questionnaires, and weekly update into `docs/defense/`, keeping core references (`PROJECT_REFERENCE.md`, `CHANGELOG.md`, `DEPLOYMENT_GUIDE_VERCEL_RENDER.md`) at `docs/`.
  - Updated `InventoryProject/.gitignore` (`logs/` → `/logs/`) so Git tracks `src/features/logs/`.
- **Feature Directory Standardization**:
  - Moved loose hooks and utils into consistent folders: `auth/hooks/useLogin.js`, `auth/components/PageLoader.jsx`, `dashboard/hooks/useDashboardStats.js`, `dashboard/hooks/useNotifications.js`, `pos/hooks/usePOS.js`, and `reports/utils/reportUtils.js`.
  - Grouped the 17 components inside `src/features/inventory/components/` by domain: `products/`, `purchasing/`, and `suppliers/`.
  - Updated all relative imports across affected files and documented the structure in `docs/PROJECT_REFERENCE.md`.

## [Refactor/Frontend: Modularize Large Feature Pages into Hooks & Sub-Components - 2026-11-19]
- **`src/features/analytics/DemandForecasting.jsx`** (`2,069` → `220` lines): Extracted state/API/sorting logic to `hooks/useDemandForecasting.js`, helper utils to `utils/forecastUtils.js`, and UI sections/modals to `components/ForecastBadges.jsx`, `IngredientRestockTab.jsx`, `MenuDemandTab.jsx`, `ForecastCreatePOModal.jsx`, `MonthlyProjectionModal.jsx`, and `ForecastGuideModal.jsx`.
- **`src/features/cms/CMSDashboard.jsx`** (`1,107` → `178` lines): Extracted CMS parsing, uploads, and save logic to `hooks/useCMSDashboard.js` and tabs/uploader UI to `components/ImageUploadField.jsx`, `CMSBrandTab.jsx`, `CMSHeroTab.jsx`, `CMSPromotionsTab.jsx`, and `CMSLocationFooterTab.jsx`.
- **`src/features/inventory/ManageProducts.jsx`** (`1,023` → `309` lines): Extracted UI sections into `components/AddProductFormSection.jsx`, `ProductListSection.jsx`, `ArchivedProductsSection.jsx`, `ModifyProductSection.jsx`, and `ModifyProductModal.jsx`.
- **`src/features/inventory/SupplierPortal.jsx`** (`818` → `185` lines): Extracted Realtime subscription and PO handlers to `hooks/useSupplierPortal.js` and table/modals to `components/SupplierOrderActionModals.jsx`, `SupplierOrderDetailsRow.jsx`, and `SupplierOrdersTable.jsx`.
- **`src/features/auth/LandingPage.jsx`** (`873` → `224` lines): Extracted CMS/menu/carousel logic to `hooks/useLandingPage.js` and UI sections to `components/LandingMenuBoard.jsx` and `LandingPromoCarousel.jsx`.
- **`src/features/logs/SalesReceiptJournal.jsx`** (`1,112` → `171` lines): Extracted receipt fetching/filtering/pagination to `hooks/useSalesReceiptJournal.js` and UI to `components/ReceiptJournalToolbar.jsx`, `ReceiptJournalTable.jsx`, and `ReceiptGuideModal.jsx`.
- **`src/features/reports/StockMovementReport.jsx`** (`951` → `134` lines): Extracted movement fetching/calculations/CSV-print to `hooks/useStockMovementReport.js` and UI to `components/StockMovementToolbar.jsx`, `StockMovementSummaryCards.jsx`, `StockMovementTable.jsx`, and `StockSnapshotTable.jsx`.

## [Analytics/AI: Upgrade Forecasting to 90-Day Rolling Window & Gemini Quota Caching - 2026-11-19]
- **`server/services/aiForecastingService.js`**:
  - Extended rolling time-series window to **90 days (3 months)** (`averageUnitsSoldLast90Days`, `sameDay3MonthsAgoUnitsSold`, `last90DaysUnitsSold`, `averageLast90Days`) with a 3-tier velocity blend (`50%` recent 7d/14d, `30%` 30-day, `20%` 90-day baseline).
  - Added a **30-minute in-memory forecast cache** (`aiForecastCache`) and in-flight request deduplication (`inflightAiForecasts`) keyed by product, target month/year, and live stock level, plus `invalidateAiForecastCache()` to minimize free-tier Gemini API quota usage.
  - Compacted Gemini AI prompt payload to pre-aggregated 7d/30d/90d summary metrics and trailing 12-month history instead of raw daily arrays.
- **`server/routes/analytics.js`**:
  - Expanded `fetchSalesSince` pagination to 6 parallel pages (up to 6,000 sales) with a 60-second cache and invalidation hook to `invalidateAiForecastCache()`.
  - Upgraded `/ingredient-forecast` and `/demand-forecast` to evaluate a 90-day rolling baseline (`50%` 14d / `30%` 30d / `20%` 90d).
- **`src/features/analytics/DemandForecasting.jsx`**:
  - Updated tooltip and reference guide descriptions to reflect the 90-day (3-month) rolling baseline.

## [Docs/Database: Update Schema Reference & SQL Snapshot - 2026-11-18]
- **`docs/PROJECT_REFERENCE.md` (Section 8 — Database Schema Notes)**:
  - Updated table inventory to match all 14 live Supabase PostgreSQL tables (`users`, `products`, `category_settings`, `ingredients`, `recipes`, `sales`, `sale_items`, `suppliers`, `supplier_ingredients`, `purchase_orders`, `purchase_order_items`, `wastage`, `audit_logs`, `cms_content`) with exact primary/foreign keys and column definitions.
  - Documented `process_pos_checkout` RPC, `cms-images` storage bucket, 30/90-day archive deletion rules, dynamic `max_stock` restock thresholds, PO partial delivery tracking (`receipt_history`), and audit-log backed staff requests.
- **`docs/database/supabase_schema.sql`**:
  - Created a complete PostgreSQL DDL reference script covering all 14 tables, constraints, relationships, and column comments.

## [UI/Supplier Portal: Interactive Category Pills, Status Scope & Sorting in Catalog & Pricing - 2026-11-18]
- **`SupplierCatalogSection.jsx`**:
  - **Interactive Category Filter Pills**: Added horizontal category filter pills with live item count badges for all categories supplied in the catalog, matching the project's standard aesthetic.
  - **Status Scope Filter Pills**: Added `All`, `Edited`, and `Saved` filter pills with badge counts. Selecting `Edited` isolates unsaved price/packaging modifications so suppliers can review changes before saving.
  - **Sorting Capabilities**: Added sort dropdown and clickable column headers for `Raw Material` and `Agreed Price (₱)` supporting `Name (A-Z)`, `Name (Z-A)`, `Price (Low to High)`, `Price (High to Low)`, and `Edited First`.
  - **Search Enhancements & Quick Reset**: Added an instant clear (x) button to the search input, an empty state reset button, and a one-click `Clear all filters` button whenever any filter is active.

## [UI/API: Timeframe, Date Range & Chart Type Filters in Dashboard Category Breakdown - 2026-11-18]
- **`server/routes/dashboard.js`**:
  - Extended `GET /api/dashboard/stats` `period` handling to support `7d`, `14d`, and `30d` rolling windows alongside `day`, `week`, and `month`.
- **`useDashboardStats.js` & `DashboardOverview.jsx`**:
  - Added independent breakdown filter state (`trendPeriod`, `trendStartDate`, `trendEndDate`, `trendStats`, `trendLoading`) and `trendCategoryTotals` calculation so filtering the category breakdown does not overwrite the overview revenue card.
- **`ExpandedTrendChart.jsx`**:
  - Added timeframe preset filters (`Past 7 Days`, `Past 14 Days`, `Past 30 Days`, `This Month`, `Custom`) with custom `Start Date` / `End Date` inputs.
  - Added a `Line` / `Bar` chart mode toggle, category revenue totals inside filter pills, and adaptive X-axis label intervals for longer ranges.
  - Fixed `"MM/DD"` date parsing (`parseChartDate`) using the current Manila year so weekday names render accurately.

## [UI/Receipt Journal: Default Latest Preset to Fetch 250 Receipts - 2026-11-18]
- **`SalesReceiptJournal.jsx`**:
  - Changed initial `fetchLimit` and `RECENT` (`Latest`) preset from `'all'` / `100` to `250`, so opening Receipt Journal or clicking `Latest` fetches the 250 most recent sales.
  - Added `250` to the high-volume `fetchOptions` tier list (`[250, 500, 1000, 2500, 5000]`) and added a safe option fallback on the `Fetch` dropdown when total matches are `<= 250`.

## [UI/API: Dedicated Archived Accounts Section & 30-Day Permanent Deletion for Products, Raw Materials, Accounts - 2026-11-18]
- **`server/utils/archiveHelper.js`**:
  - Created centralized archive timestamp tracking helper (`getArchiveTimestampsMap`, `getDaysSinceArchived`, `invalidateArchiveMap`) reading from `audit_logs` (`PRODUCT_ARCHIVED`, `RAW_MATERIAL_ARCHIVED`, `USER_STATUS_CHANGED`) with short TTL caching and instant cache busting.
- **Backend Enpoints & Protections**:
  - **`products.js`**: `GET /` attaches `archived_at` and `days_since_archived` to archived products. Added `DELETE /products/:id` restricted to `Owner`/`Admin`, enforcing that the item is archived, has passed 30 days, has 0 historical sales records (`sale_items`), and deletes dependent recipes while preserving audit history.
  - **`inventory.js`, `inventoryController.js`, `inventoryService.js`**: `getIngredients` attaches `archived_at` and `days_since_archived`. `DELETE /inventory/ingredients/:id` requires `Owner`/`Admin`, enforces 30 days elapsed, verifies 0 purchase orders and 0 wastage records, and cleans up dependent recipes/supplier links.
  - **`users.js`**: `GET /` attaches `archived_at` and `days_since_archived` to inactive accounts. Updated `DELETE /users/:id`:
    - **Owner Account**: Fully protected from deletion permanently (`The Owner account is fully protected and cannot be deleted`).
    - **Admin Accounts**: Enforces a **90-day archive threshold** before permanent deletion is allowed.
    - **Staff/Supplier/Custom Accounts**: Enforces standard **30-day archive threshold**.
    - Removed arbitrary Admin hierarchy block so archived Admin accounts past 90 days can be permanently deleted while keeping Owner completely immune.
    - Verifies 0 cashier sales receipts (`sales.staff_id`) to preserve audit and transaction integrity.
- **Frontend UI & API**:
  - **`AccountManager.jsx` & `UsersTable.jsx`**:
    - Separated active accounts from archived accounts: the main accounts table now only lists active accounts (`status === 'ACTIVE'`), preventing active and archived users from being mixed.
    - Added dedicated `Archived` tab in the role filter bar with count badge.
    - Added dedicated bottom `Archived Accounts` section matching the dark-card style of `ManageProducts` and `ManageRawMaterials`, showing avatar, name, username, role, elapsed archive days, `Restore` button, and `Delete` button.
    - Account permanent deletion thresholds: **90 days for Admin accounts**, **30 days for other roles**. Displays countdown tooltip and disabled button (`Delete (Xd left)`) until the threshold is met, and enabled red `Delete` button once reached.
    - Owner accounts display `Owner protected` across the table and card view.
  - **`ManageProducts.jsx` & `useManageProducts.js`**:
    - Added 30-day permanent `Delete` button alongside `Restore` in both the table (when viewing archived products) and the bottom dedicated `Archived Products` dark-card section.
    - Active and clickable if `>= 30 days`, disabled with countdown (`Delete (Xd left)`) if `< 30 days`.
  - **`ManageRawMaterials.jsx` & `useManageRawMaterials.js`**:
    - Added 30-day permanent `Delete` button alongside `Restore` in both the materials table (when viewing archived materials) and the bottom dedicated `Archived Raw Materials` dark-card section.
    - Active and clickable if `>= 30 days`, disabled with countdown (`Delete (Xd left)`) if `< 30 days`.
  - Exported `deleteProduct()` in `productsApi.js` and `deleteUser()` in `usersApi.js`.

## [UI/API: Dynamic Fetch Sizing Based on Filter Total in Receipt Journal - 2026-11-18]
- **`server/routes/sales.js`**:
  - Replaced the hardcoded 500-row limit ceiling with support for dynamic batch limits up to 20,000 or `'all'`.
  - Added chunked iteration fetching (in 1,000-row Supabase query batches) so large date ranges and filter results beyond PostgREST's 1,000-row max page limit are fetched without truncation.
- **`SalesReceiptJournal.jsx`**:
  - Dynamic fetch dropdown (`fetchOptions`): Dropdown options are now calculated directly from the total matching records for the active filters (`totalServerCount`), offering `All (X matching)` as well as sensible fractional batch tiers (`500`, `1,000`, `2,500`, `5,000`).
  - Total receipts & KPI cards: The `Total Receipts` card and secondary `All` pill now show the true filtered total (`14,044`, `631`, `185`, etc.) with clear indicators when a partial batch is loaded vs all records loaded.
  - Automatically defaults date presets (`Today`, `Last 7 Days`, `This Month`) to fetch all matching transactions in that window.


## [UI/Dashboard: Auto-Adjusting Typography & Single-Line Category Header in TopSalesGrid - 2026-11-18]
- **`TopSalesGrid.jsx`**:
  - Implemented dynamic auto-adjusting font size helpers (`getCategoryHeaderFontSize` and `getProductItemFontSize`) scaling typography cleanly based on character length so category titles and product names fit without premature clipping or awkward multiline wrapping.
  - Reorganized card header layout with category title on the left (`min-w-0 flex-1 truncate`) and action controls grouped on the right (`shrink-0 whitespace-nowrap` for the `Compact` button and `Items` badge), eliminating the horizontal squeeze that caused "FRUIT DRINKS" and "7 Items" to break across multiple lines.


## [UI/Supplier Catalog: Pinned Updated Materials, Dedicated Badge & Sort/Filter Controls - 2026-11-18]
- **`SupplierCatalogModal.jsx`**:
  - Pinned raw materials with price adjustments to the top of the supplier catalog table by default (`sortUpdatedFirst` enabled when price changes exist).
  - Added dedicated `Price Updated` badge with animated indicator and highlighted left-border row accent (`border-l-4 border-l-amber-500 bg-amber-50/70`) for all updated materials.
  - Added filter pills (`All` vs `Updated`) and sort toggle button (`Updated on Top` vs `A-Z Order`) allowing the catalog list to be instantly filtered to updated items or un-sorted back to alphabetical order.
  - Added quick filter action in the price adjustment notice banner (`Filter Updated Only` / `Show All Materials`).


## [UI/Accounts: Auto-Switch Role to Custom on Permission Changes - 2026-11-18]
- **`AccountForm.jsx`**:
  - Added `handlePermissionsChange()` and `isStaffDefaultPermissions()` so modifying `Staff` page access away from `STAFF_DEFAULT_PERMISSIONS` automatically switches the account role to `Custom` while preserving the selected permissions.

## [UI/API: Receipt Journal Date-Range Request Filter & Add-On Normalization - 2026-11-18]
- **Receipt Journal Server Request Filters (`SalesReceiptJournal.jsx`, `salesApi.js`, `server/routes/sales.js`)**:
  - Added date-range presets (`Latest`, `Today`, `Last 7 Days`, `This Month`, plus `Start` / `End` date inputs) and a `Fetch up to` batch selector (`100 / 250 / 500` receipts) that query `/api/sales` with `start_date`, `end_date`, `category`, `payment_method`, `discounted`, and `search`, unlocking historical receipts beyond the initial 100-row cap.
  - Updated `formatDateTime` in `SalesReceiptJournal.jsx` to format timestamps in `Asia/Manila` and show `Loaded X of Y matching` when total matches exceed the current batch limit.
- **Receipt Add-On Parsing & Error Display (`receiptPrint.js`, `SalesReceiptModal.jsx`)**:
  - Added `normalizeAddOn()` in `receiptPrint.js` and reused it in `SalesReceiptModal.jsx` so PostgreSQL `text[]` JSON add-on strings and plain objects both render/print cleanly, and surfaced fetch errors in `SalesReceiptModal.jsx`.

## [Security/Fixes/Menu Photos: Lean-Swarm Hardening & Plastic-Cup Product Images - 2026-11-18]
- **Menu Product Image Audit & Regeneration (`products`, `cms-images` Supabase bucket)**:
  - Audited all `44` rows in `products`: preserved `3` non-real/archived test items (`KAHIT ANO`, `TESTPRODUCT`, `SPAGHETTI`) without images, kept `16` already-accurate plastic-cup/pastry images, and generated/uploaded **25 new 800×800 clear plastic-cup menu photos** across `COFFEE` (8), `FRAPPE` (7), `FRUIT DRINKS` (4), and `MILK TEA` (6: `BROWN SUGAR`, `OKINAWA`, `ORIGINAL MILKTEA`, `PURPLE TARO`, `RED VELVAT`, `WINTERMELON`).
- **Backend RBAC, CORS, Session, POS, Purchasing, CMS & Timezone Fixes (`InventoryProject/server/`)**:
  - `server.js`: Replaced the permissive CORS fallback with an error callback rejection (`Not allowed by CORS`), and added `generalLimiter` to `/purchase-orders`.
  - Applied `requireRole('Owner', 'Admin', 'Staff', 'Custom')` across internal routes (`wastage.js`, `sales.js`, `dashboard.js`, `analytics.js`, `products.js`, `inventory.js`, `requests.js`, `recipes.js`, `audit.js`, `categorySettings.js`, `pos.js` `POST /sale`, and internal `purchasing.js` routes), restricted admin mutations (`PUT /requests/:id/status`, `POST`/`DELETE` in `recipes.js`, `POST`/`PUT` in `categorySettings.js`) to `Owner`/`Admin`, and allowed `Custom` on supplier archive/restore routes.
  - `posController.js` & `posService.js`: Enforced integer `item.qty` (`1..99`), integer add-on quantities (`0..5`, non-negative), `req.user.id` staff attribution, Manila-dated `generateReceiptNumber` with collision suffix, active non-archived product checks, explicit `amount_received` handling, and `sale_items` cleanup during rollback.
  - `users.js`: Masked `current_session_id` (`'active' | null`) in responses and revoked `current_session_id` on password/role/inactive updates alongside auth cache invalidation.
  - `purchasingController.js` & `purchasingService.js`: Blocked updates on terminal POs (`Received`, `Cancelled`, `Declined`), validated supplier catalog ownership (`existingMap`) and positive prices/conversion factors, capped/validated PO receiving quantities, and cleaned up split parent `purchase_order_items` / `total_amount` on backorders.
  - `wastageService.js`: Blocked archived ingredients, restored deducted stock if `wastage.insert` fails, and selected `unit_cost` / `estimated_cost` in `getWastageStats`.
  - `cmsController.js` & `cmsService.js`: Validated CMS uploads to safe image MIME types/extensions (rejecting SVG/HTML/XML) and restricted `updateCmsContent` fields to `title`, `description`, `image_url`.
  - `server/utils/dateUtils.js` & `dashboard.js`: Added Manila `+08:00` day boundary helpers and Manila date math for the 7-day trend start query.
- **Frontend Bug Fixes, ESLint Zero-Error Hygiene & Rule 16 Icons (`InventoryProject/vite.config.js`, `InventoryProject/src/`)**:
  - Fixed `vite.config.js` `__dirname` (`fileURLToPath`) and resolved all `10` ESLint errors + `16` hook warnings across `SearchableIngredientSelect.jsx`, `AccountForm.jsx`, `AccountManager.jsx`, `UsersTable.jsx`, `LoginPage.jsx`, `NotificationInbox.jsx`, `useNotifications.js`, `ManageProducts.jsx`, `Dashboard.jsx`, and `10` data-fetching hooks/components (`npm run lint` passes with `0` errors and `0` warnings).
  - Fixed divide-by-zero `NaN` in `SalesSummaryReport.jsx`, `await`/error handling and silent realtime refreshes in `PurchaseOrders.jsx` and `SupplierPortal.jsx`, decimal parsing and null `quantity_received` in `ReceivePOModal.jsx`, filtered `byReason` aggregation in `WastageReport.jsx`, 1500ms delay removal in `useLogin.js`, `http(s)://` link sanitization in `LandingPage.jsx`, and `NaN` date checks in `src/utils/dateUtils.js`.
  - Replaced `19` raw `✕` characters across `11` frontend files with clean inline SVG icons per Rule 16.

## [Tooling/Skills: Added Lean Swarm Token-Budget Skill - 2026-11-18]
- **Workspace Skill (`.agents/skills/lean-swarm/SKILL.md`)**:
  - Added a progressive-disclosure `lean-swarm` skill to reduce token and quota usage during `/swarm` and multi-agent runs (right-sizing `invoke_subagent` / `run_workflow` vs `swarm`, capping worker count, skipping unnecessary optional roles, optional model tiering with user consent, bounded `rg` + `read_file` line-range budgets, compact report formats, and phased execution).

## [Cleanup: Removed Seed Scripts & Unused Frontend Files - 2026-11-18]
- **Seeding Scripts Removed (`docs/database/`)**:
  - Removed temporary `seed_missing_nov_sales.mjs` (after running backfill) and legacy `seed_all_supplier_materials.sql`.
- **Unused Frontend Modules & Empty Directories Removed (`src/`, `scripts/`)**:
  - Removed unreferenced files (`src/api/supplierApi.js`, `src/components/ProductCard.jsx`, `src/components/shared/ColumnVisibilityDropdown.jsx`, `src/features/logs/components/SalesReceiptModal.jsx`, `src/hooks/useDemandForecast.js`, `src/utils/uploadImage.js`) and empty folders (`scripts/`, `src/features/settings/`, `src/hooks/`, `src/features/logs/components/`).
- **Documentation Sync**: Updated the file map in `docs/PROJECT_REFERENCE.md`.

## [Data/Seed: Historical Sales Gap Backfill (Nov 11, 14–17) - 2026-11-18]
- **Backfilled Missing Past Days**:
  - Seeded `212` realistic historical POS orders (`404` `sale_items`, `₱25,701.20` total revenue) across the 5 missing past days (`2026-11-11`, `2026-11-14`, `2026-11-15`, `2026-11-16`, `2026-11-17`) in `Asia/Manila` (`+08:00`) operating hours, strictly attributed to active non-archived staff (`Kuya Ben`).
  - Applied corresponding recipe, cup-size, add-on, and tracked-product stock deductions (`1` tracked product and `36` raw ingredients) with zero negative balances, and recorded matching `SALE` entries in `audit_logs`.

## [Security/Fixes/Cleanup: System Audit, Bug Fixes, & ESLint Hygiene - 2026-11-18]
- **Server Startup & Auth Hardening (`server/server.js`, `server/middleware/authMiddleware.js`, `server/routes/auth.js`)**:
  - Fixed Express 5 `PathError` crash on `app.all('/api/*', ...)` in `server/server.js` by replacing it with `app.use('/api', ...)`.
  - Removed unused `authLimiter` import from `server/server.js` (already scoped to `POST /api/auth/login` in `server/routes/auth.js`).
  - Removed hardcoded `'fallback-secret-key-change-me'` JWT fallback in `authMiddleware.js` and `routes/auth.js`, added `getJwtSecret()`, and added startup validation requiring `JWT_SECRET` in `server/server.js`.
- **Frontend Bug & React Hooks Fixes (`WastageReport.jsx`, `ManageProducts.jsx`, `TransactionLogs.jsx`, `useNotifications.js`)**:
  - Fixed `ReferenceError: startDate is not defined` in `WastageReport.jsx` CSV export (`handleExport`) by deriving the export date range from `period`, `customStart`, and `customEnd`.
  - Moved conditional access early returns after all `useMemo`/`useEffect` hook calls in `ManageProducts.jsx` and `TransactionLogs.jsx` to comply with React Rules of Hooks.
  - Replaced `Date.now()` inside `useMemo` in `useNotifications.js` with a lazy `useState` snapshot timestamp for render purity.
- **ESLint & Code Hygiene (`eslint.config.js`, controllers, services, frontend components)**:
  - Added Node globals (`globals.node`) for `server/**/*.js` in `eslint.config.js`.
  - Cleaned up unused `user_id` destructures and dead variables across `inventoryController.js`, `purchasingController.js`, `routes/products.js`, `inventoryService.js`, `purchasingService.js`, `POS.jsx`, `AuditLogs.jsx`, `SalesReceiptJournal.jsx`, `StockMovementReport.jsx`, `SkeletonLoader.jsx`, and `UsersTable.jsx`, preserved error cause in `posService.js`, and documented intentional empty storage/audit JSON `catch` blocks.
- **Forecasting Reliability & Refresh Fixes (`server/routes/analytics.js`, `server/services/aiForecastingService.js`, `src/api/analyticsApi.js`, `src/features/analytics/DemandForecasting.jsx`)**:
  - Added `refresh` cache-bypass support (`?refresh=true`) to `getIngredientDepletionForecast` and `getDemandForecast` and wired it to the Refresh buttons in `DemandForecasting.jsx`.
  - Removed non-deterministic `Math.random()` usage and fixed falsy `0`-day sorting (`daysRemaining ?? 100`) on `GET /api/analytics/inventory-depletion`, and formatted `depletionDate` using `Asia/Manila` local calendar dates.
  - Fixed `Asia/Manila` daily sales date bucketing in `aiForecastingService.js` (`extractProductForecastingFeatures`) so midnight–8 AM Manila sales are not shifted back 1 day by `.toISOString()`.
- **Documentation Sync (`docs/PROJECT_REFERENCE.md`)**:
  - Updated Security Status, Known Technical Debt, and Backlog sections to reflect completed security and architecture upgrades.

## [Config/AI: Updated Primary & Backup Gemini API Keys - 2026-11-17]
- **Configured Backup Failover Key (`server/.env`, `.env`)**:
  - Validated and updated `GEMINI_API_KEY_BACKUP` with the newly provisioned key (`AQ...`) across local and server environment configurations.
  - Retained `GEMINI_API_KEY` (`AIzaSy...`) as the primary key. If the primary key exhausts rate limits (`429`) or encounters an authentication error during demand forecasting, the engine will automatically fail over to `GEMINI_API_KEY_BACKUP`.


## [Docs/Diagrams: Supplier Portal Operational Flowchart - 2026-11-13]
- **Generated Supplier Workflow Flowchart ([`CofTea_Supplier_Flowchart.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Supplier_Flowchart.svg) & [`CofTea_Supplier_Flowchart.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Supplier_Flowchart.png))**:
  - Outlined full end-to-end operational flowchart for the Supplier Portal: authentication & security lockout, catalog wholesale pricing updates, purchase order status inspection (`Pending`, `Active`, `Proposals`, `Overdue`), 4-way decision handling (`Accept All`, `Postpone Date`, `Decline PO with Reason`, and item-by-item proposal negotiation via `SupplierReviewPOModal`), admin review, store goods receipt, and automatic purchase-unit-to-stock-unit conversion.

## [Resilience: Priority 3 Products Catalog Error State & Retry - 2026-11-13]
- **Frontend Error Boundary & Retry Action (`src/features/inventory/Products.jsx`)**:
  - Added dedicated `error` state and clean error presentation in `Products.jsx`.
  - If fetching products fails due to network loss or server unavailability, staff and managers are presented with a clear error banner and a one-click "Retry" button instead of a confusing empty table ("No products found").


## [Robustness: Priority 2 Error Handling & Memory Protection - 2026-11-13]
- **Global Error Handling & Stack-Trace Concealment (`server/server.js`)**:
  - Enhanced the centralized 4-parameter Express error-handling middleware. Handles malformed JSON payloads (`SyntaxError: 400`) gracefully and returns clean JSON errors without leaking stack traces or internal paths in production.
  - Added dedicated `app.all('/api/*', ...)` handler returning standard JSON 404 for any unmatched API endpoints, preventing them from falling through to the HTML SPA router.
- **In-Memory Search Memory Protection (`server/routes/sales.js`)**:
  - Implemented a 1,000-record safety ceiling on in-memory keyword and category sales filters, preventing unbounded queries from exhausting Node.js heap memory on high-volume datasets while keeping active searches fast and responsive.


## [Security: Priority 1 Security Hardening & Audit Protection - 2026-11-12]
- **Cryptographic `JWT_SECRET` Deployment (`.env`, `server/.env`, `server/routes/auth.js`)**:
  - Generated and saved a strong 256-bit random cryptographic secret in `.env` and `server/.env`, removing vulnerability to forged tokens from the default fallback key.
  - Added module-level checks that alert if `JWT_SECRET` is unset in production environments.
- **Audit Log Spoofing Elimination (`inventoryController.js`, `products.js`, `purchasingController.js`)**:
  - Removed all `req.body.user_id` and `user_id || req.user?.id` fallbacks across controllers. All audit trail insertions (`RAW_MATERIAL_CREATED`, `RAW_MATERIAL_UPDATED`, `RAW_MATERIAL_DELETED`, `RAW_MATERIAL_STOCK_RECEIVED`, `RAW_MATERIAL_ARCHIVED`, `RAW_MATERIAL_RESTORED`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_ARCHIVED`, `PRODUCT_RESTORED`, `PRODUCT_STOCK_RECEIVED`, `SUPPLIER_CREATED`, `SUPPLIER_UPDATED`, `PURCHASE_ORDER_CREATED`, `PURCHASE_ORDER_STATUS_UPDATED`) strictly use `req.user.id` from the verified session.
- **Secured Manual Audit Route (`server/routes/audit.js`)**:
  - Protected `POST /api/audit` with `requireRole('Admin', 'Owner')` and strictly bound manual audit rows to `req.user.id`, preventing unauthorized clients from injecting arbitrary log records.
- **Isolated Login Rate Limiting (`server/routes/auth.js`, `server/server.js`)**:
  - Attached `authLimiter` strictly to `POST /api/auth/login` rather than the entire `/api/auth` router, ensuring background heartbeat pings (`POST /api/auth/activity`) and user logouts are never throttled by login attempt counters.


## [AI/Forecasting: Backup Gemini API Key Failover - 2026-11-12]
- **Automatic Backup Key Failover (`aiForecastingService.js`, `server/.env.example`)**:
  - Added support for `GEMINI_API_KEY_BACKUP` in [`aiForecastingService.js`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/server/services/aiForecastingService.js#L509-L645). If the primary `GEMINI_API_KEY` hits a rate limit (`429`) or auth/network error, the forecasting engine automatically retries using `GEMINI_API_KEY_BACKUP` before falling back to the local deterministic ensemble model.
  - Documented `GEMINI_API_KEY_BACKUP` in [`server/.env.example`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/server/.env.example).

## [UI/Products: Clean Modify Product Modal & Action Buttons - 2026-11-12]
- **Removed Redundant Overrides (`src/features/inventory/ManageProducts.jsx`)**:
  - Removed the confusing per-product Sizes Configuration and Add-ons Configuration override tables and tip banner from the "Modify Product" modal. Category-wide sizes and add-ons are managed cleanly and centrally via "Add-on Defaults".
- **Modal Action Layout (`src/features/inventory/ManageProducts.jsx`)**:
  - Removed the floating "Save Changes" button in the middle of the modal form.
  - Linked the modal form via HTML5 `id="modify-product-form"` to the modal footer, placing `Cancel` and `Save Changes` side by side at the bottom right.


## [Perf/System: Faster Loading Without Compromising Security - 2026-11-12]
- **Login Screen & Auth (`src/features/auth/LoginPage.jsx`, `server/routes/auth.js`)**:
  - Removed the artificial `1500ms` blocking splash delay on [`LoginPage`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/auth/LoginPage.jsx).
  - Updated `POST /api/auth/login` to evaluate only the signing-in user's own session timeout state (preserving single-session replacement, bcrypt verification, lockout, and `SESSION_REPLACED`/`LOGIN` audit logs) while running the global inactive-session reaper and login audit inserts non-blockingly.
- **Dashboard & API Deduplication (`src/api/dashboardApi.js`, `server/routes/dashboard.js`)**:
  - Deduplicated concurrent identical `getDashboardStats()` requests on the client so `Navbar` and `DashboardOverview` share one request on load.
  - Combined today's metrics and the 7-day trend history into a single bounded `sales` query on `GET /api/dashboard/stats` instead of querying today's sales twice.
- **Static Asset & CMS Caching (`server/server.js`, `server/services/cmsService.js`)**:
  - Configured long-lived immutable browser cache headers for hashed `/assets/*` bundles while keeping `index.html` `no-cache`.
  - Added a 60-second in-memory server cache (with in-flight deduplication and write invalidation) for public CMS reads.

## [Perf/POS: Fast Batch Checkout & Non-Blocking Audit Logging - 2026-11-12]
- **Root Cause**: [`posService.createSale`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/server/services/posService.js) previously executed dozens of sequential Supabase queries per checkout (N+1 loops over cart items, recipes, cup sizes, add-ons, sequential stock updates, and sequential blocking `await logAudit()` loops before returning), causing several seconds of delay before the Digital Receipt Modal appeared.
- **Backend Optimization (`server/services/posService.js`, `server/utils/auditHelper.js`)**:
  - Replaced per-item N+1 pre-flight loops with 1 parallel batch (`Promise.all` with `.in(...)`) for products, recipes, and extra ingredients.
  - Parallelized `sale_items` insertion and product/ingredient stock deductions (and rollback compensation on error).
  - Added [`logAuditBatch`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/server/utils/auditHelper.js) and moved post-commit audit writes to a single non-blocking batch insert so checkout returns the receipt immediately.

## [Fix/POS: Isolated Thermal Receipt Printing - 2026-11-12]
- **Root Cause**: [`SalesReceiptModal.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/components/SalesReceiptModal.jsx) previously called `window.print()` directly without `@media print` isolation, causing the browser to print the entire POS/dashboard screen, modal backdrop, UI buttons, and browser URL/timestamp headers like a screenshot.
- **Thermal Receipt Utility (`src/utils/receiptPrint.js`)**: Created `printThermalReceipt()`, `formatReceiptDateTime()`, and `computeReceiptTotals()`. Measures the rendered slip height and prints from a top-level `#coftea-print-root` with `@media print` isolation and exact `@page { size: 80mm|58mm <height>mm; margin: 0; }` so Chromium honors custom receipt roll dimensions in Print Preview / Save as PDF without giant blank margins, browser URL headers, or popup blockers.
- **Receipt Modal (`src/components/SalesReceiptModal.jsx`)**: Wired `Print Receipt` to `printThermalReceipt()` and added a saved `80mm` / `58mm` paper-width selector.

## [Fix/Inventory: Display Archived Raw Materials Section - 2026-11-12]
- **Root Cause**: `ManageRawMaterials` already included the **Archived Raw Materials** section and `Archived Only` filter, but `inventoryService.getIngredients()` unconditionally filtered `.neq("is_archived", true)`, preventing archived rows from reaching the frontend.
- **Backend (`inventoryService.js`, `inventoryController.js`)**: Added optional `{ includeArchived }` parameter to `getIngredients()` wired to `?include_archived=true` on `GET /api/inventory/ingredients` (default remains active-only so POS, dashboard, PO forms, wastage, stock receiving, and recipe pickers are unaffected).
- **Frontend (`inventoryApi.js`, `useManageRawMaterials.js`)**: Updated `getIngredients({ includeArchived = false } = {})` to append `?include_archived=true` when requested, and updated `useManageRawMaterials` to fetch with `{ includeArchived: true }` so archived raw materials appear in the **Archived Raw Materials** section and can be restored.

## [Docs/Flowcharts: Role-Based System Flowcharts - 2026-11-12]
- **Created 4 Role-Based Flowcharts (SVG & PNG) in `InventoryProject/docs/diagrams/`**:
  - **Customer**: [`CofTea_Flowchart_Customer.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Customer.svg) & [`CofTea_Flowchart_Customer.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Customer.png)
  - **Staff (Cashier / Barista)**: [`CofTea_Flowchart_Staff.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Staff.svg) & [`CofTea_Flowchart_Staff.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Staff.png)
  - **Supplier**: [`CofTea_Flowchart_Supplier.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Supplier.svg) & [`CofTea_Flowchart_Supplier.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Supplier.png)
  - **Admin & Owner (+ Custom Roles)**: [`CofTea_Flowchart_Admin_Owner.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Admin_Owner.svg) & [`CofTea_Flowchart_Admin_Owner.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_Flowchart_Admin_Owner.png)

## [Docs/DFD: Updated Level 1 Data Flow Diagram - 2026-11-12]
- **Created Updated Level 1 Data Flow Diagram ([`CofTea_DFD_Level1.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_DFD_Level1.svg) & [`CofTea_DFD_Level1.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_DFD_Level1.png))**:
  - Expanded to Processes 1–9 and closed Data Stores `D1`–`D9` (`User`, `Product`, `Recipe`, `Transaction`, `Inventory`, `Waste Log`, `Purchasing & Supplier`, `CMS Content`, and `Audit Log`), including **Supplier Portal**, **CMS & Public Menu**, and **Google Gemini AI** forecast flows.

## [Docs/DFD: Updated Level 0 Context Data Flow Diagram - 2026-11-12]
- **Created & Refined Updated Level 0 Data Flow Diagram ([`CofTea_DFD_Level0.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_DFD_Level0.svg) & [`CofTea_DFD_Level0.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_DFD_Level0.png))**:
  - Updated external entities and data flows around Process `0` (`Cof/Tea Cafe Inventory Management with POS System`) to reflect current system capabilities: direct **Customer** public CMS menu board interaction, **Supplier** (Supplier Portal PO negotiation & catalog pricing), **Google Gemini AI** (generic `Historical Sales & Forecast Request` / `Demand Forecast Results` flows so forecast model details stay flexible), **Staff / Cashier** (POS ongoing holds, discounts, Cash/GCash, wastage, real-time stock alerts), and **Admin / Owner** (RBAC/Custom roles, unit-converted PO receiving, CMS, 4-module Reports, Receipt Journal, Audit & Owner-only Transaction Logs).

## [Docs/UML: Updated System UML Use Case Diagram - 2026-11-12]
- **Created Updated UML Use Case Diagram ([`CofTea_UML_UseCase_Diagram.svg`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_UML_UseCase_Diagram.svg) & [`CofTea_UML_UseCase_Diagram.png`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/diagrams/CofTea_UML_UseCase_Diagram.png))**:
  - Updated actors to match current RBAC & external integrations: **Customer**, **Staff (Cashier / Barista)**, **Supplier**, **Admin**, **Owner** (with generalization to Admin), and **Google Gemini AI** (external forecast API).
  - Documented new & updated capabilities: CMS public menu board, POS sizes/add-ons/hold orders/VAT & discounts, Supplier Portal & PO proposal negotiation, PO unit conversion, 4-year multi-seasonal & AI demand forecasting, Sales Receipt Journal, 4-module Reports (CSV/Print), Audit & Owner-only Transaction Logs, and granular Custom Role permissions.

## [AI/Forecasting: Google Gemini API Free Tier Integration & Service Optimization - 2026-11-11]
- **Activated Gemini AI Demand Forecasting**:
  - Successfully connected and verified user's Google Gemini API key via the official free tier.
  - Updated [`aiForecastingService.js`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/server/services/aiForecastingService.js) to target `gemini-3.5-flash-lite` (with dynamic model override via `GEMINI_MODEL`), resolving deprecation warnings associated with older models.
- **Payload Token Optimization & Latency Reduction**:
  - Streamlined the AI forecast prompt payload by feeding a compact 30-day velocity window and 47-month historical seasonality rather than 600+ individual daily raw transaction records.
  - Reduced prompt size by 92% (~350 KB down to ~27 KB), speeding up AI generation turnaround to ~2.5 seconds with 100% structured JSON compliance.
  - Normalized `confidenceScore` percentages and added an automated fallback to the local deterministic ensemble model if network or quotas ever stall.
- **Environment Configuration**:
  - Configured `GEMINI_API_KEY` and `GEMINI_MODEL` safely in `server/.env` and `InventoryProject/.env` (both preserved in `.gitignore`).

## [Fix: Reports `periodLabel is not defined` Scope Fix - 2026-11-11]
- **Bug Fix**: Moved `periodLabel` to component-level scope in [`SalesPerformanceReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/SalesPerformanceReport.jsx) to eliminate `ReferenceError: periodLabel is not defined` when rendering the period prompt.
- **Production Build**: Successfully compiled latest frontend assets in `InventoryProject/dist/`.


## [Reports: Unified Minimalist UI & Auto-Load Default Data - 2026-11-11]
- **Automatic Default Report Loading**:
  - Implemented auto-fetching on initial mount across all 4 report tabs:
    - **Sales Performance** auto-loads Today's sales data immediately on tab open.
    - **Inventory Status** auto-loads the warehouse stock snapshot immediately on tab open.
    - **Stock Movement** auto-loads This Week's inflow, outflow, and wastage immediately on tab open.
    - **Wastage & Loss** auto-loads This Month's wastage write-offs immediately on tab open.
  - No more initial blank/empty screens on tab opening.
- **On-Demand Compilation on Filter Change**:
  - When the user changes the period or custom date range, the report marks as uncompiled and displays an informative prompt: `"Period Selection Changed: [Period]. Click Generate Report to compile analytics."`
  - Clicking **Generate Report** compiles and displays the analytics for the updated selection.
- **Complete Visual & UI Harmonization Across All 4 Tabs**:
  - **Stock Movement** ([`StockMovementReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/StockMovementReport.jsx)): Replaced heavy uppercase buttons, oversized inputs, and colored card borders with the minimalist zinc theme (`border-zinc-200/80`, `shadow-2xs`, sentence-case `Export CSV`, `Generate Report`, `Print`, and mono KPI cards).
  - **Wastage & Loss** ([`WastageReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/WastageReport.jsx)): Replaced raw date inputs with the standard `Period` dropdown (`Today`, `This Week`, `This Month`, `Custom Date`) matching `SalesPerformanceReport`, upgraded KPI cards to clean monochrome cards, and styled reason badges with subtle neutral borders.


## [UX: Browser Refresh Tab Persistence & URL Hash Routing - 2026-11-11]
- **Main Dashboard Tab Persistence**:
  - Implemented dual-layer persistence (URL hash `#TabName` + `localStorage`) in [`Dashboard.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/dashboard/Dashboard.jsx) so refreshing the browser retains the exact active page (e.g. `Reports`, `Products`, `POS`, `PurchaseOrders`, `Forecasting`).
  - Added `hashchange` listener to seamlessly support browser Back and Forward navigation buttons.
  - Retained strict RBAC authorization checks via `canAccess()` so unauthorized stored tabs safely fallback to the user's role-default landing tab.
- **Sub-Tab Persistence Across Feature Modules**:
  - **Reports Hub** ([`Reports.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/Reports.jsx)): Persists sub-tabs (`sales`, `inventory`, `movement`, `wastage`) via `#Reports/<subtab>` and `localStorage`.
  - **Demand Forecasting** ([`DemandForecasting.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/analytics/DemandForecasting.jsx)): Persists `ingredients` vs `products` tabs via `#Forecasting/<subtab>` and `localStorage`, and automatically triggers initial product fetch if loaded directly on products tab.
  - **Supplier Management** ([`ManageSuppliers.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/ManageSuppliers.jsx)): Persists `suppliers` directory vs `prices` comparison tab.
  - **CMS Dashboard** ([`CMSDashboard.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/cms/CMSDashboard.jsx)): Persists `branding`, `hero`, `promos`, and `details` tabs.
  - **Staff Requests** ([`RequestProduct.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/requests/RequestProduct.jsx)): Persists `SUBMIT` vs `HISTORY` tabs.
- **Session Cleanup**:
  - Updated [`clearUserSession()`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/utils/authUtils.js) to clear all stored active tab keys and reset URL hashes on logout/session expiry.


## [UI: System-Wide Pagination for All Table and List Views - 2026-11-10]
- **Unified Standardized Pagination Component Across All Modules**:
  - Implemented the reusable `<Pagination />` component ([`Pagination.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/components/shared/Pagination.jsx)) across every unpaginated table and list view throughout the application.
  - **Modules Updated**:
    1. **Suppliers**: [`ManageSuppliers.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/ManageSuppliers.jsx) (Suppliers Directory table, 10/20/50 per page).
    2. **Purchasing & Inflow**: [`PurchaseOrders.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/PurchaseOrders.jsx) (PO orders table, 10/20/50 per page) and [`StockReceived.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/StockReceived.jsx) (Inventory status overview with inline live search filter).
    3. **Stock Trackers**: [`ProductStockTracker.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/ProductStockTracker.jsx) and [`RawMaterialTracker.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/RawMaterialTracker.jsx) (Priority status-grouped pagination with 10/20/50 per-page selection).
    4. **Alerts & Wastage**: [`LowStockAlerts.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/LowStockAlerts.jsx) and [`ReportWastage.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/wastage/ReportWastage.jsx) (Incident history table).
    5. **Staff Requests**: [`ViewRequests.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/requests/ViewRequests.jsx) (Staff request management) and [`RequestProduct.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/requests/RequestProduct.jsx) (Personal request history).
    6. **Accounts & Attendance**: [`UsersTable.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/accounts/components/UsersTable.jsx) (Accounts directory) and [`EmployeeTracker.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/accounts/EmployeeTracker.jsx) (Shift logs).
    7. **Audit & Activity Logs**: [`AdminLogs.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/logs/AdminLogs.jsx) (System activity trail, 10/25/50/100 per page) and [`SalesSummaryReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/logs/SalesSummaryReport.jsx) (Cashier sales audit drilldown modal).
    8. **Supplier Portal**: [`SupplierPortal.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/inventory/SupplierPortal.jsx) (Supplier incoming order list).
    9. **Reports Hub Tables**: [`StockMovementReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/StockMovementReport.jsx) (Stock Movement Audit Log), [`WastageReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/WastageReport.jsx) (Detailed wastage log), [`InventoryStatusReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/InventoryStatusReport.jsx) (Full material status table), and [`SalesPerformanceReport.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/reports/SalesPerformanceReport.jsx) (Menu items ranking table).
  - Ensured automatic page reset (`setCurrentPage(1)`) whenever active search terms, status tabs, date pickers, or sort directions change.
  - Verified full print and CSV export functions continue to export 100% of rows while interactive UI tables render fast, paginated slices.


## [Fix: Supplier Management `activeSuppliers is not defined` & Soft Archive Restoration - 2026-11-09]
- **Bug Fix: `activeSuppliers is not defined` (`ManageSuppliers.jsx`)**:
  - Resolved runtime `ReferenceError: activeSuppliers is not defined` by properly defining `activeSuppliers` and `archivedSuppliers` memoizations from `suppliers.filter(s => !s.is_archived)`.
  - Re-bound supplier directory table rendering and empty state checks to `filteredSuppliers` so the search bar accurately filters active suppliers in real-time.
  - Fixed missing `deleteSupplier` import by switching deletion handler to use the imported `archiveSupplier` endpoint, matching the soft-archive convention.
  - Added dedicated **Archived Suppliers** section with one-click restore functionality (`handleRestoreSupplier` via `restoreSupplier()`), allowing accidental archives to be immediately recovered.


## [Reports & Exports: Wastage Data Integration, Manila Timezone Fix, CSV UTF-8 Formatting, & Executive Print Layouts - 2026-11-09]
- **Bug Fix: `fetchProducts is not defined` (`ManageProducts.jsx`, `useManageProducts.js`)**:
  - Exported `fetchProducts` from `useManageProducts.js` and destructured it in `ManageProducts.jsx`, fixing the runtime ReferenceError when viewing archived products or clicking Refresh.
- **Wastage Connection & Midnight Timezone Fix (`StockMovementReport.jsx`, `dateUtils.js`, `wastageService.js`, `audit.js`)**:
  - **Fixed Early Morning / Midnight Manila Timezone Cutoff**: Resolved root cause where `toManilaEndOfDay(endDate)` used `.split('T')[0]` on UTC timestamps (e.g. `2026-11-08T16:21:59Z`), resolving to UTC day `2026-11-08` instead of Manila day `2026-11-09`. This caused transactions and wastage logged past midnight Manila time (+08:00) to be excluded from date filters. Updated `toManilaStartOfDay` and `toManilaEndOfDay` in both backend and frontend `dateUtils.js` to evaluate `Asia/Manila` calendar days reliably.
  - **Direct Wastage Table Integration (`StockMovementReport.jsx`)**: Connected `getWastageReport(startDate, endDate)` directly to `StockMovementReport.jsx` alongside `getAuditLogs`. Wastage records from the `wastage` table (30 total records) are now seamlessly merged and deduplicated against audit logs.
  - **Accurate Wastage KPI & Filtering**: Clicking the `WASTAGE` filter now accurately displays the recorded wastage volume, incident counts, material names, units, reasons, and reporting cashier details.
- **Universal CSV Export Standardization (`reportUtils.js`, `StockMovementReport.jsx`, `WastageReport.jsx`, `InventoryStatusReport.jsx`, `SalesPerformanceReport.jsx`, `SalesReceiptJournal.jsx`, `SalesSummaryReport.jsx`)**:
  - **UTF-8 Byte Order Mark (BOM `\uFEFF`) & RFC-4180**: Standardized `downloadCSV` across all reports and log export functions to include `\uFEFF` and RFC-4180 double-quote escaping. Prevents character encoding corruption in Microsoft Excel, Apple Numbers, and Google Sheets when viewing Philippine Peso (`₱`) and item descriptions.
  - **Structured Metadata Headers**: Every export now features clean corporate headers with `COF/TEA CAFE — [REPORT NAME]`, store identification, date range/period, and generated timestamps.
  - **Pure Numeric Cell Formatting**: Formatted monetary columns with pure decimal numbers in data rows (`58.65` instead of text strings) so spreadsheets can immediately execute `SUM`, `AVERAGE`, and analytics formulas.
  - **Updated Store Branding**: Replaced legacy placeholder name `Highland Coffee` with official `Cof/Tea Cafe` branding across all CSV headers and filenames (`CofTea_Stock_Movement_Report_...csv`, `CofTea_Receipt_Journal_...csv`).
- **Executive Print & PDF Layout Redesign (`reportUtils.js`, `StockMovementReport.jsx`, `WastageReport.jsx`, `InventoryStatusReport.jsx`, `SalesPerformanceReport.jsx`)**:
  - **Dedicated Print Preview Bar**: Added top preview bar with one-click `Print Document / Save PDF` fallback button.
  - **High-Contrast Executive Header**: Official `COF/TEA CAFE` masthead with sub-brand label, period badge, and generation timestamp.
  - **Repeating Page Headers (`thead { display: table-header-group; }`)**: Long tables spanning multiple printed pages automatically repeat table column headers at the top of each page.
  - **Print Color Adjust**: Configured `-webkit-print-color-adjust: exact` and `print-color-adjust: exact` so badges, borders, and KPI boxes print with crisp colors.
  - **Official Confidential Footer**: Added `Confidential • Cof/Tea Cafe Management Report` with system attribution.


## [UI/Search & Logs: System-Wide Case-Insensitive Search & Unified Logs/Reports Design System - 2026-11-09]
- **System-Wide Case-Insensitive & Accurate Search (`server/routes/sales.js`, `SalesReceiptJournal.jsx`, `productUtils.js`, `inventory`, `reports`)**:
  - **Fixed Root Cause of False-Positive Matches on "RED" / "red velvet"**:
    - Discovered that searching for `"RED"` was matching orders containing add-ons because serialized JSON strings contained `"ingredient_id"` (which contains the substring `"red"`).
    - Refactored add-on search in both backend (`server/routes/sales.js`) and frontend (`SalesReceiptJournal.jsx`) to parse JSON and evaluate only the human-readable add-on name (`ao.name`), eliminating false positives.
    - Removed loose UUID prefix and floating total price substring matching in `server/routes/sales.js` that caused unrelated sales (e.g. `CHOCOLATE`) to match unrelated search queries.
    - Standardized `.trim().toLowerCase()` across all client-side and server-side search filters with null-safe handling (`(field || '').toLowerCase().includes(term)`).
    - Audited and updated all search bars across `AuditLogs.jsx`, `TransactionLogs.jsx`, `AdminLogs.jsx`, `ManageProducts.jsx`, `Products.jsx`, `ManageRawMaterials.jsx`, `ProductStockTracker.jsx`, `RawMaterialTracker.jsx`, `productUtils.js` (POS search), and all `Reports.jsx` sub-reports.
- **Unified Design System Across Logs and Reports Modules (`AuditLogs.jsx`, `TransactionLogs.jsx`, `AdminLogs.jsx`, `Reports.jsx`, Sub-reports)**:
  - **Audit Logs (`AuditLogs.jsx`)**:
    - Upgraded page to the unified executive black & white design system (`bg-white` container, subtle zinc borders, refined typography).
    - Added 3 top KPI summary cards: `Total Event Logs`, `Admin Modifications`, and `Security & Auth Events`.
    - Integrated structured multi-tier toolbar with quick date presets (`Today`, `7 Days`, `This Month`, `All Time`), inline date pickers, category dropdown, and search input with inline SVG icon and clear `✕` button.
    - Replaced clunky text pagination buttons with sleek numbered page pills `< 1 2 3 ... N >` and per-page selector (25, 50, 100), with pagination accurately bound to filtered search totals.
  - **Transaction Logs (`TransactionLogs.jsx`)**:
    - Upgraded layout to match executive standards with confidential Owner badge and access control banner.
    - Added 4 KPI metric cards: `Total Transactions`, `POS Sales Events`, `Purchase Orders`, and `Stock Received`.
    - Added structured multi-tier toolbar and numbered pagination pills bar.
  - **Admin Logs (`AdminLogs.jsx`)**:
    - Migrated legacy `.inventory-container` layout to unified Tailwind executive card and table styling with search across operators, actions, and details.
  - **Reports & Analytics Hub (`Reports.jsx`)**:
    - Upgraded top navigation tabs to modern executive segmented pills matching `DemandForecasting` and `SalesReceiptJournal`.
    - Enhanced sub-reports (`SalesPerformanceReport.jsx`, `InventoryStatusReport.jsx`, `StockMovementReport.jsx`, `WastageReport.jsx`) with inline SVG search bars, clear buttons, and consistent table typography and sort indicators.
- **Refined Category Filter Toolbar (`DemandForecasting.jsx`)**:
  - Upgraded category pill tracks in both Ingredient Restock and Menu Demand tables to clean horizontally scrollable pill tracks (`overflow-x-auto no-scrollbar`), permanently eliminating awkward pill wrapping and jagged grey boxes.


## [UI/CMS: Refactor Promotions Carousel Manager Layout & Add Slide Reordering / Sorting - 2026-11-09]
- **Slide Reordering & Sorting Controls (`CMSDashboard.jsx`)**:
  - Added interactive `Move Up` (↑) and `Move Down` (↓) action buttons on each slide card header to easily reorder promotional slides without having to delete and re-enter them.
  - Added slide order index badge (`1`, `2`, ...) and a `First Slide (Hero Cover)` badge indicator so owners know which slide serves as the default landing page cover.
- **Redesigned Slide Card Layout & Poster Preview (`CMSDashboard.jsx`)**:
  - Replaced cramped horizontal rows inside the half-width grid with generous breathing room and clear visual hierarchy.
  - Upgraded Poster Image container with a 128×128 rounded-xl preview, hover-to-expand full resolution link, and empty state placeholder with icon.
  - Full-width URL input field and styled `Upload` button with semantic vector SVG icons, eliminating truncated URLs.
  - Replaced plain text remove buttons with styled red action buttons with trash can vector icons.


## [UI/Forecasting: Refactor Toolbar Layout to Multi-Tier Structure & Add Interactive Column Sorting - 2026-11-09]
- **Restructured Toolbars into Clean Multi-Tier Alignment (`DemandForecasting.jsx`)**:
  - **Ingredient Restock Tab**:
    - **Tier 1 (Controls & Actions)**: Full-width search bar on the left with instant clear button `✕`, paired cleanly with action buttons on the right (`Create PO` / `Reorder All Critical`, `Restock Guide`, `Refresh`).
    - **Tier 2 (Category Filter Track)**: Full-width dedicated category container (`All Types`, `ADD-ONS`, `BEVERAGE ENHANCERS`, `COFFEE & TEA BASES`, `DAIRY & CREAMERS`, `FLAVORING POWDERS`, `PACKAGING & SUPPLIES`, `SINKERS & TOPPINGS`, `SWEETENERS & SYRUPS`), resolving awkward pill wrapping and collision with right-aligned action buttons.
    - **Tier 3 (Status Scope Pills)**: Dedicated status filter container (`All`, `Critical`, `Low`, `Healthy`) with real-time counts.
  - **Menu Demand Tab**:
    - **Tier 1**: Search input on left, `Menu Forecast Guide` and `Refresh` on right.
    - **Tier 2**: Full-width category pills (`All Categories`, `COFFEE`, `FRAPPE`, `FRUIT DRINKS`, `MILK TEA`, `PASTRIES`).
- **Interactive Table Column Sorting with Clean Vector Indicators (`DemandForecasting.jsx`)**:
  - **Menu Demand Table**: Enabled interactive column sorting for `Menu Item` (alphabetical), `Category` (alphabetical), `Daily Average` (numeric), `Next 7 Days` (numeric), `Est. 30 Days` (numeric), `Seasonality (4-Yr)` (numeric index), and `Sales Trend` (growth rate percentage).
  - **Ingredient Restock Table**: Enabled interactive column sorting for `Ingredient` (alphabetical), `On Hand` (stock quantity), `Daily Usage` (burn rate), `Est. Time Left` (runout days, prioritizing critical stockouts first), `Suggested Order` (reorder quantity), and `Supplier` (alphabetical).
  - Added minimalist vector SVG sort indicators (`SortIcon`: inactive dual chevrons, active ascending/descending bold chevrons) with strictly zero emojis per Rule 16.
  - Reset pagination to page 1 automatically when changing sort field or direction.


## [Security/Cleanup: Purge Temporary Database Scratches & Production JSON Backups from `docs/` - 2026-11-09]
- **Removed Sensitive Database Backups & Scratch Scripts (`docs/database/`, `.gitignore`)**:
  - Purged over 15+ MB of raw production sales and transaction database dumps (`sales_backup_2025-01-01_onward...json` and `sales_backup_pre_2025...json` in `docs/database/backups/`) to prevent leaking transaction history, staff user IDs, customer orders, and receipt serials.
  - Removed obsolete one-off `.mjs` scratch scripts (`apply_product_images.mjs`, `audit_images_readonly.mjs`, `audit_ingredients_readonly.mjs`, `audit_products_readonly.mjs`, `backup_products_recipes.mjs`, `clear_test_image.mjs`, `download_images_readonly.mjs`, `restore_images.mjs`, `seed_recent_dashboard_forecasting.js`, etc.) that contained hardcoded local development paths and raw queries.
  - Preserved pure, clean PostgreSQL DDL migrations and stored procedures (`process_pos_checkout_rpc.sql`, `migration_user_permissions.sql`, `migration_purchase_orders_columns.sql`, `categorize_raw_materials.sql`, `seed_all_supplier_materials.sql`) per Rule 15.
  - Added strict exclusion patterns in `.gitignore` for `docs/database/backups/`, `docs/database/*.json`, `*.dump`, `*.bak`, and `*.sqlite` to permanently safeguard against accidental repository commits of database dumps.


## [UI/Receipts: Redesign Receipt Journal to Match Reference Filter Toolbar & KPI Stats - 2026-11-09]
- **Redesigned Receipt Journal Filter Controls (`SalesReceiptJournal.jsx`)**:
  - Transformed the sales journal toolbar to match the reference layout from `DemandForecasting.jsx`:
    - **Search Bar**: Debounced search supporting receipt numbers, cashier names, order items, and transaction references with instant clear button `✕`.
    - **Row 1 Category & Tender Pills**: `All Types`, `COFFEE`, `MILK TEA`, `FRAPPE`, `FRUIT DRINKS`, `PASTRIES`, `CASH`, `GCASH`, and `DISCOUNTED`.
    - **Row 2 Status Scope Pills with Dynamic Counts**: `All ({total})`, `Today ({todayCount})`, `Cash ({cashCount})`, `GCash ({gcashCount})`, and `Discounted ({discountedCount})`.
    - **Action Buttons**: Added one-click **`Export CSV`** button for financial reports, a **`Receipt Guide`** button with reference modal, and an animated **`Refresh`** button.
- **Added KPI Summary Cards & Digital Receipt Integration (`SalesReceiptJournal.jsx`, `SalesReceiptModal.jsx`)**:
  - Added real-time operational KPI metric cards at the top of the journal: `Total Receipts`, `Journal Revenue` (₱), and `Average Ticket` (₱).
  - Integrated full digital thermal receipt inspection via `SalesReceiptModal` with one-click print and BIR VAT breakdown upon row click.
  - Added an interactive **`Receipt & Audit Reference Guide`** modal detailing receipt serial standards (`RCP-YYYYMMDD-XXXXXX`), statutory 20% Senior/PWD discounts, 12% VAT calculations, and electronic GCash reconciliation.


## [Notifications/RBAC: Role-Based Notification Filtering & User-Scoped Alert Inbox - 2026-11-08]
- **Role-Based Notification Delivery Policy (`useNotifications.js`, `NotificationInbox.jsx`, `permissions.js`)**:
  - Implemented strict role and permission-based delivery so users only receive notifications relevant to their duties:
    - **Staff (Cashiers / Baristas / Kitchen Crew)**: Exclusively receives critical Out of Stock (`STOCK_OUT`) and Low Stock (`STOCK_LOW`) inventory alerts so they know what cannot be brewed or punched at POS. Sensitive procurement data—including wholesale purchase order amounts, supplier negotiation proposals, and supplier catalog price updates—is strictly hidden.
    - **Owner & Admin**: Retains full 360-degree operational visibility across all Stock alerts, Purchase Order updates, and Supplier price changes.
    - **Custom Accounts**: Dynamically evaluated against granted page permissions (`canAccess(user, page)`): PO updates require `PurchaseOrders`, Supplier catalog updates require `ManageSuppliers`, and Stock alerts require access to any inventory or sales console.
    - **External Suppliers**: Only sees PO notifications specifically assigned to their `supplier_id`. Internal cafe stock levels and other suppliers' price shifts are strictly hidden.
- **Adaptive Drawer Tabs & Smart Action Navigation (`NotificationInbox.jsx`, `Navbar.jsx`, `DashboardOverview.jsx`)**:
  - Notification drawer tabs adapt dynamically: the `PO Updates` and `Price Updates` filter tabs are completely hidden from Staff users, eliminating empty or inaccessible tabs.
  - Added role indicator badge in drawer header (`Staff • Live Stock Alerts`, `Executive`, `Admin`, etc.).
  - Added smart action resolver (`resolveNotificationAction`): verifies user permission before showing action buttons, preventing broken buttons leading to unauthorized tabs.
  - Optimized network transfer: Staff sessions skip unneeded PO and Supplier Price API requests and websocket subscriptions.
  - Implemented user-scoped persistence in `localStorage` (`coftea_inbox_read_${userId}_v2`), ensuring one user marking alerts as read or dismissed does not inadvertently dismiss alerts for other staff or owners.


## [Fix/POS: Resolve `column "add_ons" is of type text[] but expression is of type jsonb` on POS Checkout - 2026-11-08]
- **Fixed POS Complete Payment Transaction Failure (`posService.js`, `process_pos_checkout_rpc.sql`)**:
  - Identified root cause of payment failure error: the PostgreSQL RPC stored procedure `process_pos_checkout` attempted to insert `jsonb` expressions into `sale_items.add_ons` which is defined in PostgreSQL as `text[]`, throwing SQL code `42804`.
  - Removed the broken RPC call in `posService.js` so `createSale` directly executes the atomic rollback-compensated transaction handler without hitting the stale database RPC definition.
  - Normalized `saleItems.add_ons` to ensure consistent string-array serialization for `sale_items.add_ons` (`text[]`).
  - Updated `docs/database/process_pos_checkout_rpc.sql` with dynamic conversion from JSONB elements to `text[]` for Supabase SQL Editor execution.
  - Verified checkout flow end-to-end with automated test transactions (both with and without add-ons).


## [Security/UX: Password Complexity Rules, Real-Time Checklist & Server Enforcement - 2026-11-08]
- **Interactive Password Security Rules Checklist (`AccountForm.jsx`, `PasswordRulesList.jsx`, `passwordRules.js`)**:
  - Implemented real-time password validation with a visual checklist meeting modern security requirements:
    1. At least 8 characters
    2. At least one uppercase letter (`A–Z`)
    3. At least one lowercase letter (`a–z`)
    4. At least one number (`0–9`)
    5. At least one special symbol (`!@#$%^&*` etc.)
  - Features dynamic status indicators (emerald checkmark SVG when satisfied, neutral dot when pending), a progress bar, strength indicator (`Weak`, `Moderate`, `Good`, `Strong`), and no raw Unicode emojis.
  - Added a "Confirm password" field with real-time match validation ("Passwords match" / "Passwords do not match") and show/hide password toggle buttons.
  - When editing accounts, password remains optional ("Leave blank to keep current"); if a new password is typed, the rules checklist and confirmation automatically activate.
- **Client & Server-Side Security Enforcement (`AccountManager.jsx`, `users.js`, `passwordValidator.js`)**:
  - Added client-side submission guards in `AccountForm.jsx` and `AccountManager.jsx` preventing form submission if requirements are not met or if password and confirmation do not match.
  - Created backend validator `passwordValidator.js` and enforced `validatePasswordRules()` on `POST /api/users` (account creation) and `PUT /api/users/:id` (password changes) in `server/routes/users.js` so API requests cannot bypass password complexity requirements.


## [UI/POS: Move Discount Selection to Checkout & Lessen Header Eyebrows - 2026-11-08]
- **Moved Discount Selection to Post-Ongoing Checkout Flow (`Cart.jsx`, `POS.jsx`, `OngoingOrders.jsx`, `PaymentModal.jsx`)**:
  - Removed the upfront discount button grid from the Cart panel at startup; the cart now focuses purely on punched items, VAT breakdown, and a clean **`Create Order`** button (and secondary `Clear Cart`).
  - Order is placed into **Ongoing Orders**; clicking **`Pay`** in Ongoing Orders opens the checkout modal where discounts (`Senior Citizen 20%`, `PWD 20%`, `Student 10%`, `Staff 15%`, `Custom`, or `No Discount`) and tenders (Cash/GCash) are selected and confirmed.
- **Lessened Noisy Eyebrow Headers Across POS & Wastage (`Cart.jsx`, `OngoingOrders.jsx`, `POS.jsx`, `PaymentModal.jsx`, `ReportWastage.jsx`)**:
  - Replaced shouty uppercase tracking eyebrows (`DISCOUNT TYPE`, `ITEMS: X`, `ORDERS: X`, decorative `Inventory Control` badge) with clean, minimal sentence-case typography.
  - Form labels and card headers in POS and Wastage now use clean font weights and natural casing.

## [Fix: Stale Chunk Preload Recovery & Supabase Navigator Lock Error - 2026-11-08]
- **Fixed Stale Chunk / Disallowed MIME Type (`text/html`) White Screen (`main.jsx`, `ErrorBoundary.jsx`)**:
  - Added global listeners for `vite:preloadError` and dynamic import module failures in `main.jsx` and `ErrorBoundary.jsx`. When an outdated browser session requests an old hashed JS chunk (e.g. `ProductStockTracker-B1R0fw9O.js`) that no longer exists after a new deployment, the browser automatically refreshes once to fetch the latest asset manifest instead of failing with a white screen.
- **Fixed Supabase Navigator LockManager Acquisition Failure (`supabaseClient.js`)**:
  - Configured custom auth client options on the frontend Supabase client (`persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`, `lock: async () => fn()`). This bypasses the native Web Locks API (`navigator.locks`) which was causing `Uncaught (in promise) Error: Acquiring an exclusive Navigator LockManager lock failed` across multiple tabs and backgrounded sessions.

## [Reliability/UX: React ErrorBoundary, WSOD Prevention & Chunk Recovery - 2026-11-08]
- **React ErrorBoundary & White Screen of Death (WSOD) Elimination (`ErrorBoundary.jsx`, `App.jsx`, `Dashboard.jsx`)**:
  - Created [`ErrorBoundary.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/components/shared/ErrorBoundary.jsx) to catch unhandled JavaScript exceptions in the React tree so unexpected data or render crashes never wipe the DOM to a blank white screen.
  - Wrapped global routing in [`App.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/App.jsx) and wrapped tab content inside [`Dashboard.jsx`](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/dashboard/Dashboard.jsx) with `<ErrorBoundary key={activeTab} level="tab">`.
  - Added automatic recovery for `ChunkLoadError` / `Failed to fetch dynamically imported module` (caused by visiting after a new build / deployment) and a clean recovery card with "Try Again", "Reload Page", and collapsible technical diagnostics.

## [CMS/UI/Forecasting: Editable Browser Tab Title & Favicon, Clean CMS Redesign, Dual Forecasting Guides & Searchable Comboboxes - 2026-11-08]
- **Editable Browser Tab Title & Favicon (`browser_tab` & `brand_logo`) + Clean Human-Crafted CMS UI (`CMSDashboard.jsx`, `App.jsx`, `Navbar.jsx`, `cmsApi.js`, `cms.js`, `cmsController.js`, `cmsService.js`)**:
  - Added `BrowserTabBrandingSync` in `App.jsx` and live `'cms:updated'` event synchronization in `cmsApi.js` and `Navbar.jsx` so editing the **Browser Tab Title** or **Browser Tab Icon (Favicon)** in `CMSDashboard.jsx` immediately updates `document.title`, `<link rel="icon">`, and the sidebar brand header across the application.
  - Added a live interactive Browser Tab preview bar inside `CMSDashboard.jsx` and wired authenticated backend image uploads (`POST /api/cms/upload-image` in `cms.js` / `cmsController.js` / `cmsService.js`).
  - Redesigned `CMSDashboard.jsx` into 4 clean, focused tabs (`Brand & Browser Tab`, `Hero & Menu Header`, `Promotions`, `Location & Footer`), removing the noisy gradient banner, repetitive uppercase badges, and raw file inputs.
- **Dedicated Guides for Both Ingredient Restock & Menu Demand Forecasting (`DemandForecasting.jsx`)**:
  - Added contextual `Restock Guide` and `Menu Forecast Guide` buttons on each forecasting tab and upgraded the `Forecasting Reference Guide` modal with dedicated switchable tabs (`Ingredient Restock Guide` and `Menu Demand Guide`) explaining recipe-based daily burn rate, runout days (`Critical ≤ 3d`, `Low 4–7d`, `Healthy > 7d`), 14-day supplier unit conversion, and 4-year (`2023–2026`) seasonal indices, YoY growth, and Philippine calendar/payday multipliers.
  - Replaced native `<select>` filters and month/year dropdowns in `DemandForecasting.jsx` with clean pill selectors.
- **Replaced Native `<select>` Ingredient Dropdowns with `SearchableIngredientSelect` (`ReportWastage.jsx`, `SearchableIngredientSelect.jsx`, `StockReceived.jsx`, `RequestProduct.jsx`)**:
  - Replaced the long native HTML `<select>` raw material dropdown and reason selector in `ReportWastage.jsx` with the searchable combobox `SearchableIngredientSelect` (with category filter pills and live on-hand stock display) and interactive reason buttons.
  - Replaced native ingredient `<select>` lists in `StockReceived.jsx` and `RequestProduct.jsx` with `SearchableIngredientSelect`.

## [Analytics/UI: 4-Year Multi-Seasonal Forecasting (2023–2026) & Materials List Sticky Actions - 2026-11-08]
- **Expanded Historical Sales to 4 Full Years (`2023–2026`, `48,816` Orders) & Seasonal Matrix (`docs/database/seed_2023_2024_and_build_multiyear_summary.mjs`, `server/data/multiYearSalesSummary.json`)**:
  - Seeded **23,148 orders** (**34,092 line items**) across `2023-01-01` – `2024-12-31` in Supabase to join the `2025–2026` dataset, bringing total historical coverage to **48,816 orders** across **47 months (2023–2026)**.
  - Built `server/data/multiYearSalesSummary.json` containing each product's 47-month sales history, monthly **Seasonal Indices (`1..12`)**, **Yearly Daily Averages (`2023–2026`)**, and **Year-over-Year (`yoyGrowthPct`)** growth trajectories.
- **Upgraded Forecasting Engine with Multi-Year Seasonality & YoY Growth (`server/services/aiForecastingService.js`, `server/routes/analytics.js`, `DemandForecasting.jsx`)**:
  - Upgraded `GET /api/analytics/demand-forecast` and `POST /api/analytics/ai-forecast` to blend short-term counter velocity (`7-day` & `30-day`) with 4-year monthly seasonal indices ($S_m$), same-month Year-over-Year historical baselines (`2023–2026`), annual YoY growth rates, and calendar multipliers (weekends, `15th/30th` paydays, and Philippine holidays).
  - Updated `DemandForecasting.jsx` with a `Seasonality (4-Yr)` column (`Peak` / `Norm` / `Low`), `30-Day Est.` sub-label, multi-year factors and same-month `2023–2026` historical breakdown in the `By Month` projection modal, and updated documentation in the `How Demand Forecasting Works` modal.
- **Fixed Clipped Action Column in Materials List (`ManageRawMaterials.jsx`, `useManageRawMaterials.js`)**:
  - Made the `Action` column (`Edit` / `Archive`) sticky on the right edge (`sticky right-0 z-10`) alongside the left-anchored `Material Name` column, and narrowed the left `Add New Raw Material` card (`lg:w-80 xl:w-96 shrink-0`) so the `Materials List` table has full breathing room and action buttons are never cut off.
- **Added Direct Discount Selector & "Checkout & Pay Now" in POS Cart Panel (`Cart.jsx`, `POS.jsx`, `usePOS.js`, `OngoingOrders.jsx`, `PaymentModal.jsx`)**:
  - Added the **Discount Type** selector (`No Discount`, `Senior Citizen 20%`, `PWD 20%`, `Student / Promo 10%`, `Employee / Staff 15%`, and `Custom % / ₱`) directly inside the right-hand **Transaction (Cart)** checkout summary panel (`Cart.jsx`), updating `Subtotal`, `Discount`, `VAT`, and `Total Amount Due` live.
  - Added a **`Checkout & Pay Now`** button in the Cart panel to open the `Complete Payment` modal immediately (pre-filled with the selected discount), alongside **`Hold Order`** (which sends the order and its selected discount to `Ongoing Orders`).
- **Hardened Server Audit & Actor Attribution Security (`products.js`, `inventoryController.js`, `purchasingController.js`, `posController.js`, `wastage.js`, `audit.js`)**:
  - Enforced `req.user?.id` from the JWT authentication middleware across all product, raw material, supplier, POS sale, wastage, and audit log write endpoints so client-supplied `user_id` / `staff_id` / `reported_by` fields cannot be spoofed.
- **Fixed Overlapping Loading State & Cost Calculation in Wastage Report (`WastageReport.jsx`, `SkeletonLoader.jsx`, `wastageService.js`)**:
  - Fixed a broken `{loading && (` wrapper in `WastageReport.jsx` that rendered both the skeleton loader and the report content inside an `h-64` centered flex container during loading (causing the skeleton to float over the header/filters) and hid the report once loading finished.
  - Updated `wastageService.js` and `WastageReport.jsx` to compute estimated PHP cost loss per wasted ingredient and formatted `Overall Statistics` with clean labels and 2-decimal precision.
- **Viewport-Centered Modals When Scrolled & Smooth Collapsible Mobile-Friendly Navbar (`index.css`, `ConfirmModal.jsx`, `PaymentModal.jsx`, `SalesReceiptModal.jsx`, `POS.jsx`, `Navbar.jsx`, `Dashboard.jsx`)**:
  - Fixed `.tab-pane-transition` in `src/index.css` so its animation finishes with `transform: none;` (without `forwards`), preventing the tab wrapper from creating a CSS containing block that trapped `position: fixed` popups at the top of scrolled pages.
  - Portaled `ConfirmModal`, `PaymentModal`, and `POS` modals (`OptionsModal`, `IngredientsModal`, `saleComplete` toast) to `document.body` so all popups always follow the user's current viewport scroll position.
  - Upgraded `Navbar.jsx` and `Dashboard.jsx` with a smooth collapsible desktop sidebar (`w-68` ↔ `w-20` icon rail with persistent state and smooth grid-row submenu transitions) and a responsive mobile top bar + smooth slide-over drawer (`translate-x-0` / `-translate-x-full`) for mobile and tablet screens.
- **Full-Stack Dead Code Elimination & Backend/Database Synchronization (`sync_database_costs_and_audit_columns.mjs`, `auditHelper.js`, `auditLogger.js`, `inventoryService.js`, `recipesService.js`, `wastageService.js`, `posService.js`, `requestsService.js`, `users.js`, `rateLimiter.js`, `purchasingApi.js`, `supplierApi.js`)**:
  - **Database Cost & Audit Backfill (`docs/database/sync_database_costs_and_audit_columns.mjs`)**: Populated `unit_cost` on all 72 `ingredients`, `estimated_cost` on all 43 `products` (computed from recipes), `estimated_cost` on all 29 `wastage` records, and `action_type` / `entity_type` / `entity_id` / `new_value` on 840 `audit_logs` records in Supabase.
  - **Automated Database Cost Persistence (`inventoryService.js`, `recipesService.js`, `wastageService.js`, `products.js`, `purchasingController.js`)**: Wired `createIngredient`, `updateIngredient`, and `updateSupplierOwnCatalog` to automatically compute and store `ingredients.unit_cost`; added `recalculateProductEstimatedCost()` in `recipesService.js` to keep `products.estimated_cost` synced whenever recipes or product prices change; updated `reportWastage()` in `wastageService.js` to persist `estimated_cost` directly in `wastage`.
  - **Unified Audit Logging & Cache Invalidation (`auditHelper.js`, `auditLogger.js`, `recipes.js`, `categorySettings.js`, `analytics.js`)**: Unified `auditHelper.js` and `auditLogger.js` to populate all `audit_logs` columns (`action_type`, `entity_type`, `entity_id`, `new_value`); added audit logging to `recipes.js` and `categorySettings.js` (and removed the non-existent `image_url` column from `category_settings` queries); wired `invalidateAnalyticsCache()` across POS sales, wastage, recipes, products, inventory, and purchase order receipt flows.
  - **Wired Backend Endpoints, Rate Limiters & Database Fallbacks (`requestsService.js`, `users.js`, `rateLimiter.js`, `server.js`, `purchasingApi.js`, `supplierApi.js`, `posApi.js`, `uploadImage.js`, `Dashboard.jsx`)**:
    - Fixed `updateSupplierOrderStatus()` in `purchasingApi.js` to call `PATCH /purchasing/my-orders/:id/status` (`purchasingController.updateSupplierOrderStatus`) instead of bypassing it, and repaired the corrupted null-byte `src/api/supplierApi.js`.
    - Added `audit_logs`-backed database fallbacks for `/api/requests` (`requestsService.js`) and `/api/users/shifts` (`users.js`), wired `userManagementLimiter`, `createLimiter`, and `looseLimiter` into `users.js` and `server.js`, and wired `EmployeeTracker`, `StockReceived`, `RequestProduct`, `ViewRequests`, and `AdminLogs` in `Dashboard.jsx`.

## [Auth/Security: Inactivity Auto-Logout, Live Activity Tracking, Online Status Sync & Audit Logging - 2026-11-08]
- **Inactivity Logout Now Clears Online Session & Writes Audit Log (`authUtils.js`, `client.js`, `App.jsx`, `server/routes/auth.js`)**:
  - Registered a session expiration callback (`registerSessionExpiredCallback`) invoked whenever `clearUserSession('expired')` runs so the frontend automatically calls `POST /api/auth/logout` with `{ reason: 'inactivity' }` before clearing local storage.
  - Updated `POST /api/auth/logout` to verify tokens with `ignoreExpiration: true`, set `users.current_session_id = null` (updating the user's status to **Offline** in Account Manager), and record `LOGOUT` (`reason: 'Inactivity timeout'`) in `audit_logs`.
  - Fixed `SessionTimeoutWatcher` in `App.jsx` to check `isSessionExpired()` *before* refreshing activity on mouse/keyboard/visibility wakeup, and restricted `apiCall` in `client.js` so background `GET` polling requests no longer reset the user's inactivity clock.
- **Server-Side Activity Heartbeat & Automatic Stale Session Reaper (`server/middleware/authMiddleware.js`, `server/routes/users.js`, `authApi.js`)**:
  - Added `POST /api/auth/activity` (throttled once per 60s during active user interaction) and server-side activity tracking (`touchUserServerActivity`).
  - Added `reapInactiveUserSessions()` (running every 60s and before `GET /api/users` / `POST /api/auth/login`) so even if a user closes their browser or loses connection without logging out, any session inactive past the 2-hour timeout automatically has `current_session_id` cleared to `null` (`Offline`) and a `LOGOUT (Inactivity timeout)` entry written to `audit_logs`.
- **Real-Time Online/Offline Sync in Account Manager & Audit Log Formatting (`AccountManager.jsx`, `AuditLogs.jsx`, `Dashboard.jsx`)**:
  - Added a Supabase Realtime listener on `public.users` and a 30s silent refresh in `AccountManager.jsx` so `Online` / `Offline` badges update live without page reloads.
  - Updated `AuditLogs.jsx` to display `"<user> (<role>) was automatically logged out due to inactivity."` for inactivity logouts.

## [Data/Analytics: 2025–2026 Cof/Tea Historical Sales Dataset, Stock Calibration & Analytics Query Optimization - 2026-11-08]
- **Generated Realistic Historical Sales Dataset (`2025-01-01` – `2026-11-08`) (`docs/database/generate_historical_sales.mjs`, `docs/database/restore_sales_backup.mjs`)**:
  - Backed up legacy sales records to `docs/database/backups/` and seeded **25,668 orders** (**45,166 line items**, **₱3.19M revenue**) across **677 continuous days** tailored to **Cof/Tea Cafe** in Taytay, Rizal (Elwood & Kapalaran branch patterns).
  - Modeled realistic customer and local calendar factors: student weekday dismissal rushes (`2:30 PM – 6:30 PM`), Midterm/Final Exam study weeks (`Oct`, `Dec`, `Mar`, `May`), Taytay Tiangge peak shopping days (`Thu/Sat` & `Nov–Dec` season), Philippine holidays (`Valentine's Day`, `Taytay HAMAKA Fiesta`, `Holy Week`, `Undas`, `Christmas Ber-months`, `New Year`), `15th/30th` quincena paydays, rainy/habagat typhoon slow days (`Jul–Sep`), hot dry-season Frappe/Fruit Tea surges (`Mar–May`), cool Ber-month Coffee/Milk Tea surges, and diverse discount/order channels (`dine_in`, `take_out`, `foodpanda`, `grab`, `Student 10%`, `Senior/PWD 20%`, `Employee 15%`).
- **Calibrated Product & Ingredient Stock Quantities**:
  - Updated active product `stock_quantity` values across all 42 menu items to reflect realistic inventory distribution (`26` Healthy/Medium, `14` High Risk needing restock, `2` Out of Stock) instead of having 41/42 products at `0 PCS`.
  - Calibrated key zero-stock ingredients (`Tapioca Pearls`, `Boba Straws`, `Dome Lids`, `Flat Lids`, `Evaporated Milk`, `Fresh Milk`) so the Ingredient Restock forecast shows realistic burn rates and days remaining (`60` Healthy, `3` Low Stock, `7` Critical, `2` Out of Stock).
- **Analytics & Dashboard Query Pagination & Caching (`server/routes/analytics.js`, `server/services/aiForecastingService.js`, `server/routes/dashboard.js`)**:
  - Replaced single unpaginated `.select()` calls (which were silently capped at 1,000 rows by PostgREST and slow due to lateral joins) with fast indexed two-step range queries (`fetchSalesSince`, `fetchBoundedSales`) and a shared 45-second in-memory cache with in-flight promise deduplication.

## [POS/Feature: Discount Type Selector & Post-Checkout Digital Receipt Popup - 2026-11-08]
- **Added Discount Type Options on POS Checkout (`PaymentModal.jsx`, `usePOS.js`, `posController.js`)**:
  - Added selectable discount options during checkout: `No Discount (0%)`, `Senior Citizen (20% OFF)`, `PWD (20% OFF)`, `Student / Promo (10% OFF)`, `Employee / Staff (15% OFF)`, and `Custom (% or ₱)`.
  - Automatically recalculates `Subtotal`, `Discount`, `Total Amount Due`, quick cash preset buttons (`Exact`, `₱100`, `₱200`, `₱500`, `₱1,000`), cash tender validation, and `Change`.
  - Saves `discount_amount` and discount type notes (`Discount: ...`) with the transaction record.
- **Added Automatic Digital Receipt Modal After POS Transaction (`POS.jsx`, `usePOS.js`, `SalesReceiptModal.jsx`, `SalesReceiptJournal.jsx`)**:
  - Immediately pops up the completed **Digital Transaction Receipt** modal once payment is processed (with 0ms delay using the completed sale payload).
  - Displays branch header, date/time, receipt number, cashier name, itemized drinks (with cup sizes and add-ons), subtotal, discount breakdown, total, payment method, amount tendered, reference number (if GCash), change, and `Print Receipt` / `Done` actions.

## [UI/Feature: Forecasting Info Icon & "How It Works" Modal - 2026-11-08]
- **Added "How it works" Info Pill & Guide Modal (`DemandForecasting.jsx`)**:
  - Added a clean `(i) How it works` button next to the `Demand Forecasting` title that opens a concise, plain-language guide modal explaining how `Daily Usage`, `Est. Time Left`, `Suggested Order`, `Sales Trend`, and `Calendar Adjustments` (weekends, paydays, holidays) are calculated.
- **Added Inline Column & Card Info Tooltips (`InfoTip.jsx`, `DemandForecasting.jsx`, `PredictiveInsights.jsx`)**:
  - Enhanced `InfoTip` with `position="bottom"` support so table header tooltips are never clipped by scroll containers.
  - Added hover/focus info icons to key forecasting table columns (`Daily Usage`, `Est. Time Left`, `Suggested Order`, `Daily Average`, `Next 7 Days`, `Sales Trend`) and Dashboard Overview forecast cards.

## [Performance: Full-Stack Load Speed Optimization (Frontend & Backend) - 2026-11-08]
- **Eliminated 3× Duplicate Notification Fetches & WebSocket Channels (`useNotifications.js`)**:
  - `Navbar.jsx` and two `<NotificationInbox />` instances previously initialized 3 separate `useNotifications()` states on Dashboard load, firing 3× `GET /api/purchasing`, 3× `GET /api/purchasing/price-updates`, 2× `GET /api/dashboard/stats`, and 3× Supabase Realtime subscriptions simultaneously.
  - Refactored `useNotifications.js` to use a shared singleton store with in-flight promise deduplication and a single shared Supabase Realtime channel.
- **Short-TTL User Auth Cache in `requireAuth` (`server/middleware/authMiddleware.js`, `auth.js`, `users.js`)**:
  - Added a 20-second in-memory user verification cache in `requireAuth` (with immediate invalidation on login, logout, and user status/profile updates) so parallel API requests on page load no longer trigger 8–12 redundant `SELECT ... FROM users` database round-trips before route handlers execute.
- **Parallelized Dashboard & Purchasing Queries (`server/routes/dashboard.js`, `server/services/purchasingService.js`)**:
  - Converted 5 sequential Supabase queries in `GET /api/dashboard/stats` into a single concurrent `Promise.all()` batch.
  - Consolidated 3 sequential `audit_logs` queries in `getPurchaseOrders` and `getPurchaseOrdersBySupplier` into 1 query executed in parallel with the `purchase_orders` fetch via `Promise.all()`.
- **Route & Tab Code-Splitting (`App.jsx`, `Dashboard.jsx`)**:
  - Added `React.lazy()` + `<Suspense>` for `LoginPage`, `Dashboard`, and all secondary dashboard tabs (`POS`, `Products`, `ManageProducts`, `PurchaseOrders`, `Reports`, etc.), shrinking the entry `index.js` bundle from **757 kB** down to **35.5 kB (10.2 kB gzipped)**.
  - Reduced redundant user status fallback polling in `Dashboard.jsx` from 10s to 60s (and paused when tab is hidden), deduplicated concurrent `getCmsMap()` requests in `cmsApi.js`, and added `loading="lazy"` to menu board images in `LandingPage.jsx`.

## [UI/Polish: Sticky Left-Anchored Name Columns Across Tables - 2026-11-08]
- **Anchored Primary Name Columns on Horizontal Scroll**:
  - Added `sticky left-0 z-10` with opaque background and subtle separator border shadow to the primary Name column across `ManageRawMaterials.jsx` (`Material Name`), `RawMaterialTracker.jsx` (`Ingredient`), `ManageProducts.jsx` (`Product Name`), `Products.jsx` (`Product`), `ProductStockTracker.jsx` (`Product`), `LowStockAlerts.jsx` (`Ingredient`), `ManageSuppliers.jsx` (`Supplier Name`), and `DemandForecasting.jsx` (`Ingredient` & `Menu Item`).
  - Users can now scroll horizontally to reach right-hand action buttons without losing sight of which item row they are interacting with.

## [UI/Fix: Sales Receipt Journal Pagination Restored & Improved - 2026-11-08]
- **Fixed Missing Pagination Condition**:
  - Updated `SalesReceiptJournal.jsx` and `server/routes/sales.js` so `totalCount` safely falls back to the loaded list length when `result.total` or Supabase `count` is omitted or returned as a raw array, preventing `totalCount > 0` from hiding the pagination footer.
- **Added Numbered Page Buttons & Per-Page Selector**:
  - Changed default page size from 25 down to 10 (with a `Per page: 10 / 25 / 50` selector) so the pagination bar sits cleanly in view without requiring long vertical scrolling.
  - Added numbered page buttons (`1`, `2`, `3`, `...`) alongside `Previous` and `Next` controls.

## [UI/Redesign: Demand Forecasting De-Slopped & Simplified - 2026-11-08]
- **Eliminated Clutter & AI Slop (Rule 16)**:
  - Removed the verbose 3-column "Ingredient Burn Rate & Depletion Methodology / Formula Specification" essay block at the bottom of the page.
  - Removed noisy multi-line cell sublabels (e.g., repeating "30-day recipe average" and min-alert subtexts on every row).
  - Replaced loud rainbow-bordered KPI cards (`border-l-4`, `border-t-4`) and hardcoded placeholder metrics ("Forecast Confidence: 92%") with clean, minimalist executive summary cards computed from live data.
- **Redesigned Ingredient Restock View**:
  - Streamlined table columns into clear, single-purpose metrics: `Ingredient`, `On Hand`, `Daily Usage`, `Est. Time Left`, `Suggested Order`, `Supplier`, and `Action`.
  - Consolidated search, category dropdown, status pills, and batch PO actions into a compact single-line toolbar with 15-item pagination.
- **Redesigned Menu Demand (7-Day) View**:
  - Removed confusing "In-Stock: 0 / Out of Stock" columns on made-to-order cafe drinks and fake confidence progress bars.
  - Added clear cafe-centric metrics: `Daily Average`, `Next 7 Days`, `Est. 30 Days`, and a human-readable `Sales Trend` badge (`+X% Up`, `Steady`, `-X% Down`).
  - Simplified the Monthly Projection and Create PO modals and portaled both to `document.body`.

## [UI/Refactor: Sales Receipt Journal Restored Classic Transaction Receipt & Removed Column Filter - 2026-11-08]
- **Removed Column Visibility Dropdown**: Eliminated `ColumnVisibilityDropdown` and its dropdown menu button from the Latest Sales header toolbar, restoring a clean, distraction-free table view with fixed standard columns.
- **Restored Classic Transaction Receipt Modal**:
  - Re-implemented the clean "Transaction Receipt" layout with `COF/TEA CAFE` header, dashed metadata section (Date, Receipt No, Cashier), items breakdown, subtotal/total/change, and brand sign-off.
  - Portaled the modal directly to `document.body` with top-anchored positioning (`items-start pt-8 sm:pt-12 md:pt-16 pb-12 z-[99999]`), ensuring it never gets pushed to the bottom of the screen or cut off when clicking rows on long scrolling tables.

## [Build/Optimization: Chunk Splitting & Ineffective Dynamic Imports Cleanup - 2026-11-08]
- **Eliminated Ineffective Dynamic Import Warnings**:
  - Replaced inline `await import()` statements in `SalesSummaryReport.jsx` (`salesApi`) and `AccountManager.jsx` (`purchasingApi`) with standard top-level static imports, eliminating Rollup/Vite `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings.
- **Configured Vendor Chunk Splitting & Chunk Size Threshold**:
  - Configured `build.rollupOptions.output.manualChunks` in `vite.config.js` to isolate `vendor-react` (React, ReactDOM, React Router), `vendor-charts` (Recharts, D3), and `vendor-supabase` into separate cached bundles.
  - Reduced the monolithic `index.js` chunk from 1,553 kB down to 757 kB (143 kB gzipped).
  - Raised `build.chunkSizeWarningLimit` to 1600 kB, completely silencing chunk size warnings.

## [UI/Fix: Modal Viewport Positioning & Vertical Overflow Fix - 2026-11-08]
- **Eliminated Dead-Center Viewport Clipping**:
  - Replaced symmetrical `items-center` on modal backdrops across the entire application with top-anchored layout (`items-start pt-6 sm:pt-10 md:pt-14 pb-12 overflow-y-auto z-[9999]`).
  - Fixed the flexbox vertical overflow bug where tall modals (such as the Digital Receipt, Recipe Breakdown, Purchase Order Form, Receive PO, and Supplier Catalog) had their headers, close buttons, or bottom action buttons pushed outside the viewport into unreachable negative scroll space on standard screens.
- **Enabled Root Document Body Portals**:
  - Portaled `SalesReceiptModal.jsx` and `Products.jsx` (Recipe Modal) directly into `document.body` via `createPortal`, preventing parent scroll containers and CSS transforms from trapping the dialogs.
  - Set dynamic maximum heights (`max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)]`) with internal scrolling on modal cards, guaranteeing that dialog headers and action buttons are always within view and fully operable.

## [UI/Fix: Official Sales Receipt Modal Restored & Centered - 2026-11-08]
- **Replaced Hand-Rolled Modal with Official Component**: Replaced the duplicate, inlined receipt modal in SalesReceiptJournal.jsx with the official SalesReceiptModal.jsx component.
- **Resolved Viewport Alignment Clipping**: Integrated React createPortal directly to document.body, ensuring the receipt modal is always dead-center in the viewport window regardless of table scroll position.
- **Added Print Action**: Included Print Receipt action with vector icon alongside Close button.

## [UI/Polish: Compacted Log Filter Toolbars - 2026-11-08]
- **Audit Logs & Transaction Logs Toolbar Compaction**:
  - Replaced the massive, stacked 4-tier filter card (~260px tall) in `AuditLogs.jsx` and `TransactionLogs.jsx` with a streamlined, minimalist single-card bar (~56px tall).
  - Integrated segmented date preset chips (`Today`, `7 Days`, `This Month`, `All Time`) and an inline date range pill alongside the Category dropdown and Search bar.
  - Eliminated repetitive uppercase form labels, restoring over 200px of vertical screen real estate directly to the data table.

## [Archiving & POS: Supplier Archiving, Dedicated Archive Sections, Sales Journal Overhaul, & Post-Payment Digital Receipts - 2026-11-08]
- **Supplier Soft-Delete & Foreign Key Protection**:
  - Replaced dangerous hard-deletes on `suppliers` table with soft-deleting (`is_archived`), preventing PostgreSQL foreign key violations on `users_supplier_id_fkey` and historical purchase orders.
  - Created database migration `docs/database/add_is_archived_to_suppliers.sql` with backward-compatible fallback.
  - Added `PUT /purchasing/suppliers/:id/archive` and `PUT /purchasing/suppliers/:id/restore` endpoints.
- **Dedicated Archive Tables / Sections (Matching Client Reference Mockup)**:
  - Added dedicated **Archived Suppliers** section to `ManageSuppliers.jsx` with item counts and one-click Restore.
  - Added dedicated **Archived Products** section to `ManageProducts.jsx` with image thumbnails, price/category chips, and Restore buttons.
  - Added dedicated **Archived Raw Materials** section to `ManageRawMaterials.jsx` with unit badges, stock levels, and Restore buttons.
  - Main directory tables now default to clean, active items only.
- **Sales Receipt Journal Overhaul**:
  - Fixed typo in header ("Lastest Sales" → "Sales Receipt Journal").
  - Fixed item/quantity misalignment by pairing quantities directly with menu items (e.g. `1× Aglio e Olio Pasta`).
  - Added sticky left-pinned anchor to `Order No.` column for smooth horizontal table scrolling without losing row reference.
  - Added explicit "Receipt" action button to every row, refined payment method badges, and improved customer name display ("Walk-in Guest" fallback).
- **Post-Payment POS Digital Receipt**:
  - Automatically pops up the full digital `SalesReceiptModal` upon completing payment in `POS.jsx` and `usePOS.js`, allowing cashiers to immediately view, verify, and print official customer receipts.

## [UI/Polish: Elimination of Raw Unicode Triangle/Arrow Glyphs - 2026-11-08]
- **Unified Chevron & Expandable Row Icons**:
  - Replaced raw `▶` and `▼` characters in expandable table rows (`PurchaseOrders.jsx`, `SupplierPortal.jsx`) that were rendering as Windows blue emoji play buttons with sleek, animated Lucide SVG chevron icons that rotate smoothly on expand.
  - Replaced raw triangle characters in `Navbar.jsx` with minimalist SVG chevrons.
- **Table Sorting & Status Arrows**:
  - Upgraded table column sorting indicators in `AuditLogs.jsx`, `TransactionLogs.jsx`, `InventoryStatusReport.jsx`, `SalesPerformanceReport.jsx`, `WastageReport.jsx`, and `TopSalesGrid.jsx` to clean vector SVG chevrons/arrows.
  - Replaced raw `▲`/`▼` trend indicators in `DemandForecasting.jsx` and `SupplierCatalogModal.jsx` with semantic Lucide trend icons.
- **Action & Navigation Arrows**:
  - Replaced raw `→` and `←` text arrows across `NotificationInbox.jsx`, `LandingPage.jsx`, `LoginPage.jsx`, `StatCards.jsx`, `DashboardOverview.jsx`, `ReceivePOModal.jsx`, `PurchaseOrderForm.jsx`, `SupplierReviewPOModal.jsx`, and `ViewRequests.jsx` with consistent vector stroke SVGs.

## [Purchasing: Supplier Price Protection & Price Change Notifications - 2026-11-08]
- **Admin Supplier Pricing Access Protection**:
  - Locked and read-only price fields in `SupplierFormModal.jsx` when editing existing suppliers; admins manage raw material mappings and packaging units, while official prices are controlled by the supplier.
  - Replaced the "Update Prices" action in `SupplierCatalogModal.jsx` with a "Prices Managed by Supplier" verified status badge.
  - Hardened backend `purchasingService.js` to preserve agreed supplier catalog prices during admin supplier profile edits.
- **Supplier Price Change Tracking & Indicators**:
  - Enhanced backend `updateSupplierOwnCatalog` in `purchasingController.js` to calculate old vs. new price differences on catalog submissions and record audit history.
  - Added "Prices Updated" status badges in `ManageSuppliers.jsx` directory table.
  - Added price adjustment alert banner and inline badges (`Was ₱X (▲ +₱Y)` / `Was ₱X (▼ -₱Y)`) inside `SupplierCatalogModal.jsx`.
- **System Notification & Dashboard Integration**:
  - Added supplier price change notifications into `useNotifications.js` and `NotificationInbox.jsx` with dedicated filter tab and deep-linking to the supplier catalog.

## [UI/UX: Full System "Unslop" & Human-Crafted Polish - 2026-11-08]
- **Comprehensive AI Slop & Emoji Purge (0 Unicode Emojis Remaining in src/)**:
  - Replaced all raw Unicode symbols (✓, ✕, ✎, ⏳, ★) with clean, semantic SVG icons across POS, Purchasing, Low Stock, Dashboard, CMS, and Order queues.
  - Replaced raw ✕ text in modal headers and search inputs with accessible Lucide-style SVG icon buttons with proper aria-labels and smooth hover states.
- **Refined Tactile Micro-Interactions & Surfaces**:
  - Added active:scale-[0.98] tactile depression states to buttons and card controls.
  - Upgraded POS checkout alert from bright saturated green banner to an executive dark toast with an emerald SVG indicator.
  - Softened borders and standardized spacing rhythm across interactive dialogs and summary panels.

## [UI/Table: Interactive Columns, Sorting, Stacked Multi-Line Orders & Badges - 2026-11-05]
- **Interactive Column Visibility System**:
  - Created reusable ColumnVisibilityDropdown.jsx matching client reference mockup.
  - 3-bar column toggle button (|||), checklist popover with Reset and deep green Apply columns action.
  - Persistent user column selections via localStorage (coftea_sales_table_columns).
- **Latest Sales Redesign (SalesReceiptJournal.jsx)**:
  - Re-architected table view to match the reference:
    - Integrated Search bar with debouncing on the toolbar next to column toggler.
    - Added sortable column headers (Customer, Total Price, Paid Amount, Created) with direction indicators.
    - Stacked multi-line order rendering for items and quantities.
    - Clean status and payment method pills (completed, dine_in, cash, debit, mobile_payment).
    - Smooth skeleton loader states during data fetching.
    - Row-click opens full digital transaction receipt modal.

## [UI/UX: Seamless Transitions, Modern Modals & Skeleton Shimmers - 2026-11-04]
- **Unified Modal System**:
  - Implemented modern spring-eased entry and exit keyframes (`modalBackdropFadeIn` and `modalPopIn` with `cubic-bezier(0.16, 1, 0.3, 1)`) across all system modals.
  - Added subtle frosted backdrops (`backdrop-blur-xs`) and gentle scaling transitions for all confirmation, receipt, purchase order, supplier, and inventory configuration popups.
- **Upgraded Data Loaders to Executive Skeleton Shimmers**:
  - Replaced legacy rotating circle spinners in data tables and analytics reports with structured, pulsing skeletons (`TableSkeleton`, `StatCardsSkeleton`, and `CardGridSkeleton`):
    - `InventoryStatusReport.jsx`
    - `SalesPerformanceReport.jsx`
    - `StockMovementReport.jsx`
    - `WastageReport.jsx`
    - `ReportWastage.jsx`
    - `DemandForecasting.jsx` (Depletion table, product forecasts, and AI reorder modal)
    - `SupplierCatalogSection.jsx`
    - `TopSalesGrid.jsx` on Dashboard
    - POS and Product Catalog Recipe Breakdown modals
    - `NotificationInbox.jsx`
    - `SalesReceiptModal.jsx`
- **Dashboard Tab Navigation Fluidity**:
  - Added `tab-pane-transition` in [Dashboard.jsx](file:///D:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/src/features/dashboard/Dashboard.jsx) with smooth fade and subtle vertical translation on view switching.

## [Data: Product Image Cleanup (partial) - 2026-11-04]
- Audited all 43 products: most images were unrelated stock placeholders (e.g. donuts for Java Chip, idli for Frappe Red Velvet).
- Replaced 11 with AI-generated matching photos (800px JPG, Supabase `cms-images/public/products`): Hazelnut Brew, Original Latte, Dark Choco, Frappe Hazelnut, Hokkaido Espresso, Blueberry, Green Apple, Honey Peach, Milk Tea Cookies & Cream, Green Matcha, Hokkaido.
- Cleared the picture of `TESTPRODUCT`.
- Image model quota ran out; 22 products still need images (see below). Kept 6 accurate existing images (Caramel Macchiato, Chocolate Latte, Matcha Latte, Frappe Cookies & Cream, Frappe Matcha, Milk Tea Brown Sugar/Chocolate, Chocolate Chip Cookie).
- Backup of all product image URLs and recipes: `docs/database/backup_products_images_20261104.json`. Helper scripts in `docs/database/` (`apply_product_images.mjs`, `restore_images.mjs`, audit scripts).
- Pending images: Coffee Red Velvet, Salted Caramel, Spanish Latte, Strawberry Latte, Vanilla Blanca, White Cappuccino; Frappe Java Chip, Norman's C&C, Okinawa Espresso, Red Velvet, Strawberry, Vanilla Espresso, Wintermelon Espresso; Fruit Kiwi, Lychee, Passionfruit, Strawberry; Milk Tea Okinawa, Original, Purple Taro, Red Velvat, Wintermelon.

## [Docs: Namecheap Custom Domain Setup for Vercel - 2026-11-04]
- Added **Part 4** to `DEPLOYMENT_GUIDE_VERCEL_RENDER.md`: connecting a Namecheap domain to Vercel (A/CNAME records or Vercel nameservers), SSL verification, updating Render `CLIENT_URL` for CORS, and an optional `api.` subdomain for the Render backend.

## [UI & Animation: Seamless Menu Transitions, Translucent Glass Aesthetics, and Taller Proportions - 2026-11-04]
- **Scrollable Lightbox & Mobile Viewport Protection (LandingPage.jsx)**:
  - Added `overflow-y-auto` and momentum touch scrolling (`-webkit-overflow-scrolling: touch`) to `PromoLightbox` so mobile users can freely scroll if screen height is constrained.
  - Sized mobile image height down to `max-h-[50vh]` (while keeping desktop at `max-h-[76vh]`), ensuring the poster image, title, description, and navigation buttons fit comfortably on screen above the mobile browser URL bar.
  - Added `mb-6` safe-area padding at the bottom of the footer caption to keep Previous/Next buttons and indicator dots completely unobstructed and clickable.
- **Fixed Lightbox Coordinate Trap on PC via Portal (LandingPage.jsx)**:
  - Fixed an issue where CSS transitions and `transform` on the landing page layout established a local coordinate containing block, squishing the `position: fixed` Lightbox into a tiny cropped box on desktop screens.
  - Ported `PromoLightbox` directly to `document.body` using React `createPortal`.
  - On PC and laptops, the modal now correctly spans 100% of the entire viewport with full-bleed backdrop blur (`z-[9999]`), displaying the vertical poster at full resolution and uncropped, with desktop navigation arrows stationed in the spacious margins.
- **Seamless Menu Opening / Closing (LandingPage.jsx)**:
  - Replaced instant conditional DOM mounting with a smooth 500ms ease-out crossfade and scale-in transition (`opacity-0 scale-[0.97] -translate-y-4` to `opacity-100 scale-100 translate-y-0`).
  - Menu Board and Side-by-Side Overview now smoothly glide between states with zero jarring layout pops or flashes.
- **Translucent Glass Cards (No Pure Black Slabs)**:
  - Replaced opaque solid black backgrounds (`bg-zinc-950/80`) with translucent frosted glass (`bg-black/45 backdrop-blur-xl border border-white/20 shadow-2xl`), allowing the warm cafe ambient lighting to softly shine through.
  - Refined location pill with semi-transparent frosted styling and elevated the Open Menu button with smooth hover states.
- **Calibrated Height & Proportions**:
  - Scaled back the card height from 500px down to a balanced `min-h-[340px] sm:min-h-[370px] lg:min-h-[380px]` with refined `p-6 sm:p-7` padding.
  - Restored promo image aspect ratio (`aspect-[16/10] max-h-[380px]`) so the side-by-side layout comfortably fits within standard viewport heights without pushing page headers or footers.

## [Mobile UX: Responsive Carousel & Lightbox Controls - 2026-11-04]
- **Landing Page & Lightbox Navigation (LandingPage.jsx)**:
  - **Repositioned Mobile Navigation**: Removed vertically centered side navigation arrows (top-1/2) on mobile viewports where they were obstructing promotional poster graphics, text, and price badges ("P40 only!", "P55 only!").
  - **Integrated Mobile Control Pill**: In PromoShowcase, embedded the Previous (‹) and Next (›) buttons alongside the indicator dots into a floating frosted glass control bar at the bottom center of the card.
  - **Lightbox Modal Footer Docking**: In PromoLightbox, moved mobile navigation controls into the footer bar flanking the promo title and description, leaving the expanded photo 100% clean and unobstructed.
  - **Touch Swipe Gestures**: Added smooth touch swipe support (onTouchStart, onTouchMove, onTouchEnd) to both the landing page carousel and the fullscreen modal, allowing mobile users to swipe left and right to switch promotions.
  - **Rule 16 Compliance**: Replaced legacy unicode star in the lightbox header badge with clean textual counter typography.

## [UI & Security: Landing Page Side-by-Side Layout, Subtle Interactions, and Active User Archiving Protection - 2026-11-04]
- **Landing Page Layout Redesign (LandingPage.jsx)**:
  - Replaced isolated vertical stacking with a clean, executive side-by-side 2-column layout.
  - Left column: welcome header, branch pill, cafe story, location link, and embedded Open Menu Board trigger.
  - Right column: prominent featured promo carousel showcasing seasonal specials.
  - Toned down hover interactions: removed exaggerated rubber-band transforms, scale jumps (scale-105, scale-110), and bouncy AI template animations in favor of subtle border and opacity transitions.
- **Real-Time Active User Termination & 5s Archiving Warning (UsersTable.jsx, AccountManager.jsx, users.js, Dashboard.jsx, client.js)**:
  - **Online Status Tracking**: UsersTable.jsx now displays real-time Online / Offline badges for active accounts based on current_session_id.
  - **5-Second Countdown Warning Modal**: When an administrator attempts to archive/deactivate an account that is currently online, a dedicated warning modal alerts them that the user is actively working. The confirm button requires a 5-second countdown timer before enabling (Archive & Terminate (5s)... -> Confirm Archive & Force Logout).
  - **Immediate Force Logout**: Archiving sets status = 'INACTIVE' and invalidates current_session_id = null. Active sessions are terminated in real-time via Supabase realtime channel updates and heartbeat checks in Dashboard.jsx, immediately redirecting the archived user to the login screen with an alert banner.

## [Branding: CofTea Cafe Official Favicon & Localhost Logo Integration - 2026-11-04]
- **Favicon Upgrade (public/favicon.svg, public/favicon.png, index.html)**:
  - Replaced the default Vite purple lightning bolt favicon with the official circular **CofTea Cafe (Elwood Branch)** logo mark.
  - Formatted as an SVG with circular clipping and subtle border boundary so it pops crisp and clearly on both light and dark browser tabs.
  - Added alternate PNG and apple-touch-icon links in index.html.
- **UI Logo Enhancements (Navbar.jsx, LandingPage.jsx, LoginPage.jsx)**:
  - Updated sidebar header in Navbar.jsx to use /favicon.svg as an immediate, clean fallback instead of a generic initial.
  - Added logo branding header badge to LoginPage.jsx.
  - Added seamless fallback on LandingPage.jsx to ensure the brand logo always displays immediately on localhost even before CMS assets finish loading.

## [Search & Filtering: Deep Multi-Field Search Across Receipt Journal, Audit/Transaction Logs, Sales Summary, and Purchase Orders - 2026-10-30]
- **Receipt Journal (`SalesReceiptJournal.jsx`, `server/routes/sales.js`, `src/api/salesApi.js`)**:
  - Added debounced multi-field search bar matching Receipt Number (`#0012`), Transaction ID, Cashier/Operator Name, Sold Product Names inside nested `sale_items`, Add-on names, Payment Reference numbers, and Total Amount.
  - Added **Payment Method** filter (`All Methods`, `Cash`, `GCash`, `Card`) and **Quick Date Range Presets** (`All Time`, `Today`, `Last 7 Days`, `This Month`) with a one-click Reset button.
  - Added an inline **Order Summary** preview column (`2x Americano, 1x Matcha...`) and **Payment Method** badge directly in the receipt table rows so users can scan orders without expanding every receipt.
- **Audit Logs (`AuditLogs.jsx`) & Transaction Logs (`TransactionLogs.jsx`)**:
  - Fixed a critical `TypeError: (log.details || "").toLowerCase is not a function` crash caused by `log.details` being a JSONB object rather than a string.
  - Upgraded search to match against the **human-readable formatted description** (`formatAuditDescription` / `formatDescription`), operator name, action code, and raw JSON details (item names, quantities, receipt numbers, supplier names).
  - Added Quick Date Presets (`Today`, `Last 7 Days`, `This Month`, `All Time`) so users are no longer trapped in today-only results when searching historical logs.
- **Sales Summary Report (`SalesSummaryReport.jsx`)**:
  - Fixed staff sales audit modal where `getSales()` returned `{ data, total }` instead of an array and `salesApi.js` previously ignored `staff_id` and `period` query params.
  - Added operator search in the Personnel Performance table and a live receipt/product/payment-method search bar inside the Staff Sales Audit modal.
- **Purchase Orders (`PurchaseOrders.jsx`) & Supplier Portal (`SupplierPortal.jsx`)**:
  - Added a multi-field search input to filter POs by Reference ID (`#8F3A12B4`), Supplier Name, Status, or any Raw Material Name inside `purchase_order_items`.
  - Enhanced the **Items Summary** column to preview the ingredient names inside each PO row.

## [Pagination: Added Pagination to Long Inventory & Supplier Lists - 2026-10-30]
- **Manage Raw Materials (ManageRawMaterials.jsx)**:
  - Added clean reusable Pagination to the Materials List table (defaults to 10 items per page; options: 10, 20, 50).
  - Added Pagination to the Modify Cards grid (defaults to 12 items per page; options: 12, 24, 48).
  - Search, status, and category filter changes automatically reset pagination to page 1.
- **Supplier Portal Catalog (SupplierCatalogSection.jsx)**:
  - Added pagination to the supplier product and pricing catalog table (defaults to 10 items per page; options: 10, 20, 50).
  - Search and category filters reset page to 1 while preserving unsaved price edits across pages.
- **Supplier Price Comparison (SupplierPriceComparison.jsx)**:
  - Added pagination to the multi-vendor pricing comparison matrix (defaults to 10 items per page; options: 10, 20, 50).
  - Eliminates infinite vertical scrolling across all 72 raw materials.

## [UI & Layout: Manage Raw Materials Side-by-Side Layout Restored with Fixed Grid - 2026-10-30]
- **Restored Familiar Side-by-Side Layout**:
  - Restored original 2-button header toggle: **Add Material** and **Modify Existing**.
  - Kept the side-by-side layout (Add form on the left, Materials List on the right).
- **Fixed Cramped Form Grid in Add Material Card**:
  - Replaced the cramped 4-in-a-row inputs (Category, Unit, Initial Stock, Low Stock Alert) with a clean, spacious 2x2 grid (`grid-cols-1 sm:grid-cols-2 gap-4`).
  - Dropdown options and input labels now have full horizontal breathing room without any truncated text.
  - Row 1: Material Name (full width).
  - Row 2: Category and Unit (2 columns).
  - Row 3: Low Stock Alert and Initial Stock (2 columns).
- **Hook Integration (`useManageRawMaterials.js`)**:
  - Preserved `viewMode` default to `'ADD'`.
  - Maintained category support in `createIngredient` and table filters.

## [Raw Materials & Supplier Portal: Categories & Supplier Price Management - 2026-10-30]
- **Raw Material Categorization**:
  - Assigned standard categories across all 22 previously uncategorized active raw materials in the database (`PACKAGING & SUPPLIES`, `COFFEE & TEA BASES`, `DAIRY & CREAMERS`, `SINKERS & TOPPINGS`, `SWEETENERS & SYRUPS`, `FLAVORING POWDERS`, `BEVERAGE ENHANCERS`).
  - Saved SQL schema and migration reference in `docs/database/categorize_raw_materials.sql`.
  - Backend (`server/services/inventoryService.js`): Updated `createIngredient` and `updateIngredient` to accept and persist `category`.
  - Frontend (`ManageRawMaterials.jsx` & `useManageRawMaterials.js`):
    - Added Category dropdown in the "Add Material" drawer.
    - Added Category selector in the "Edit Material" modal to allow updating categories for existing items anytime.
    - Added Category badge column and Category filter dropdown in the raw materials table.
- **Supplier Portal Catalog & Pricing Management (`SupplierPortal.jsx`, `SupplierCatalogSection.jsx`)**:
  - Added top view switcher in Supplier Portal: **Incoming Orders** and **My Catalog & Pricing**.
  - Built dedicated `SupplierCatalogSection.jsx` component adhering to Rule 16 (clean typography, SVG icons, zero Unicode emojis):
    - Suppliers can view all materials they supply, search by name, and filter by category.
    - Direct inline editing of agreed prices (₱), purchase/packaging units (e.g. Bag, Bottle, Box, Can), and yield/conversion factors with live base-unit cost calculation.
    - Visual indicators for modified rows, Reset button, and bulk Save action.
  - Backend API:
    - Added `GET /purchasing/my-catalog` and `PUT /purchasing/my-catalog/prices` in `server/routes/purchasing.js` & `server/controllers/purchasingController.js`.
    - Added audit logging with action `SUPPLIER_CATALOG_PRICES_UPDATED`.
    - Frontend API functions `getSupplierOwnCatalog()` and `updateSupplierOwnCatalog()` in `src/api/purchasingApi.js`.
- **Authentication & Single-Session Resilience (`server/routes/auth.js`, `server/middleware/authMiddleware.js`)**:
  - Added defensive fallback handling for `current_session_id` column queries in case PostgREST schema cache has not yet refreshed after the migration.
  - Prevents login lockouts or unhandled 500 exceptions on the sign-in screen.

## [Deployment: Decoupled Architecture for Vercel (Frontend) & Render (Backend) - 2026-10-30]
- **Frontend Decoupling (`src/api/client.js`, `src/api/authApi.js`)**:
  - Implemented dynamic API base URL resolution (`getApiBaseUrl()`) supporting `VITE_API_URL` with automatic normalization (appends `/api` and trims trailing slashes).
  - Falls back to relative `/api` for local Vite proxy, cPanel single-origin, and Vercel rewrites.
  - Updated `authApi.js` to route `loginUser()` through `API_BASE_URL`.
- **Supabase Client Resilience (`src/config/supabaseClient.js`)**:
  - Added support for both `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
  - Added fallback placeholder initialization to prevent runtime startup crashes during initial Vercel deploy before environment variables are set.
- **Vite Configuration (`vite.config.js`)**:
  - Made `envDir` dynamic to discover `.env` files in either `InventoryProject/` root or `server/`.
- **Backend Modernization for Render (`server/server.js`, `server/config/supabaseClient.js`)**:
  - Configured `app.set('trust proxy', 1)` so reverse proxies (Render, Cloudflare, Vercel) provide true client IP for rate limiting.
  - Enhanced CORS to accept `CLIENT_URL` / `ALLOWED_ORIGINS` environment variables, automatically whitelist all `*.vercel.app` preview deployments, and handle Express 5 preflight OPTIONS.
  - Set Helmet `crossOriginResourcePolicy: { policy: "cross-origin" }`.
  - Added `/health` and `/api/health` endpoints returning 200 OK for Render health monitoring.
  - Handled headless API mode: if `dist/index.html` does not exist, server gracefully returns JSON status on `/` and 404 for unmatched non-API routes instead of ENOENT crash.
  - Made Supabase backend connection accept either `SUPABASE_URL` or `VITE_SUPABASE_URL`.
- **Deployment Manifests & Documentation**:
  - Added `render.yaml` at repository root for Render Blueprint 1-click web service deployment.
  - Configured `vercel.json` at root and inside `InventoryProject/` for Vite SPA rewrites.
  - Added `InventoryProject/server/.env.example` and updated `InventoryProject/.env.example`.
  - Created root `package.json` for monorepo build script resolution.
  - Sanitized `migration_purchase_orders_columns.sql` removing syntax-breaking trailing character.
  - Verified 100% database synchronization: all schema columns (`purchase_orders.notes`, `decline_reason`, `cancellation_reason`, `max_stock`) and `process_pos_checkout` RPC confirmed active.

## [Suppliers & Purchasing: Raw Material Sourcing, Price Differences & Manage Suppliers Overhaul - 2026-10-30]
- **Complete Supplier Sourcing for all 72 Raw Materials**:
  - Mapped 100% of raw materials across café suppliers (Global Coffee Traders, Metro Dairy Co., Star Packaging Supplies, STI COFFEE).
  - Configured verified packaging units, conversion factors, and default prices for all ingredients.
  - Added alternative vendor quotes with realistic price differences for coffee beans, cold brew, and packaging cups to enable vendor cost comparison.
  - Seed reference script generated at `docs/database/seed_all_supplier_materials.sql`.
- **Manage Suppliers Redesign (`ManageSuppliers.jsx`)**:
  - **Suppliers Directory Tab**: Lists all suppliers with contact info, location, supplied item counts, and quick actions ("View Price List / Catalog", "Edit & Prices", "Delete").
  - **Price Differences & Comparison Matrix Tab (`SupplierPriceComparison.jsx`)**: Multi-vendor pricing matrix for all raw materials with category filters, baseline cost, vendor quotes (package price and price per base unit), cost variance, and "Lowest Cost" vendor tags.
  - **Supplier Price Configuration Modal (`SupplierFormModal.jsx`)**: Fast categorized search to select ingredients, customize agreed price (₱), purchase unit, and conversion factor with real-time base cost preview.
  - **Supplier Catalog View (`SupplierCatalogModal.jsx`)**: Modal to inspect any supplier's complete product and price catalog.
- **Backend & PO Integration**:
  - In `purchasingService.js`: Enhanced `createSupplier` and `updateSupplier` to store `default_price`, `default_purchase_unit`, and `default_conversion_factor` per ingredient; added `deleteSupplier`.
  - In `purchasingController.js` and `routes/purchasing.js`: Added `DELETE /suppliers/:id` endpoint with audit logging.
  - In `PurchaseOrderForm.jsx`: Pre-populates agreed supplier pricing, purchase unit, and conversion factor from `supplier_ingredients` when selecting items.

## [Forecasting: Professional Terminology & AI Text Removal - 2026-10-30]
- **Removed Overt AI References in UI**:
  - Removed prominent "AI Predictive" header badge in DemandForecasting.jsx.
  - Replaced "AI Forecasting" column header with "Monthly Projection".
  - Replaced "Gemini AI Model" engine tag with "Demand Trend Model".
  - Refined "Predictions" / "Analyzing..." labels to standard business terms ("Forecast", "Calculating demand projections from sales history...").
- **Backend Service Prompt Refinement (iForecastingService.js)**:
  - Instructed the model prompt to produce executive-grade inventory analysis without mentioning AI, prompts, or algorithms.
  - Replaced synthetic algorithmic wording in deterministic fallback reasoning with concise business metrics.
## [Landing Page: Hidden Staff Login Shortcut - 2026-10-30]
- In `LandingPage.jsx`, tapping the brand logo 5 times within 1.5s between taps navigates to the staff login route (`/coftealoginpageforstaff`).

## [UI Declutter & Anti-Information Overload: InfoTip Component & Clean Views — 2026-10-30]
- **Reusable `InfoTip` Component (`src/components/shared/InfoTip.jsx`)**:
  - Implemented a clean, unobtrusive `(i)` info icon with hover/focus tooltips for secondary descriptions, replacing disruptive multi-line text boxes.
- **Decluttered Modals & Views**:
  - **`ReceivePOModal.jsx`**: Removed redundant full-width explainer box in Step 1; replaced bulky 4-line Step 2 outcome paragraph with a compact status badge and `InfoTip`.
  - **`ReschedulePOModal.jsx`**: Streamlined overdue alert banner with `InfoTip` and removed redundant date picker helper text.
  - **`CancelPOModal.jsx`**: Replaced large warning block with a compact irreversible action bar and `InfoTip`.
  - **`DemandForecasting.jsx`**: Removed massive 25-line "Methodology Explainer Card" detailing internal math formulas; relocated essential methodology guidance to an unobtrusive toolbar `InfoTip`.
  - **`StockMovementReport.jsx`**: Condensed wordy empty and loading states; added `InfoTip` to KPI cards for metric calculations.
  - **`TransactionLogs.jsx`**: Replaced raw Unicode emojis (`🔒`) with clean SVG lock icons and compact `InfoTip`.
  - **`PurchaseOrders.jsx`**: Replaced large overdue callout drawer with a single-line alert and `InfoTip`.

## [Access Control: Custom Roles & Page Permissions - 2026-10-30]
- **Migration**: `docs/database/migration_user_permissions.sql` adds `users.permissions text[]` and `users.custom_role_name text`. Must run before deploying.
- **Permission model** (`src/utils/permissions.js`, `server/utils/permissions.js`):
  - Staff and new `Custom` role accounts are limited to the pages in their permission list (tab keys). Staff with no list keep the previous default pages.
  - Admin/Owner/Supplier access unchanged. Account management, CMS and Transaction Logs are not grantable.
- **Backend** (`server/routes/users.js`): accepts/validates `permissions`, `custom_role_name`, `Custom` role; PUT now also saves `supplier_id`; audit logs include role name and permissions.
- **Frontend gating**: `Dashboard.jsx` uses `canAccess()`; `Navbar.jsx` builds the sidebar from permissions; `QuickActions.jsx` and `ManageProducts.jsx` respect permissions.
- **Account Manager redesign** (`src/features/accounts/`): split into `AccountForm`, `PermissionGrid`, `UsersTable`. Accounts/Create tabs, role segmented control, reusable role templates, grouped page-access checkboxes, searchable/filterable accounts table.
- Permission changes apply on the user's next login.

## [Security & Authentication: Single Active Session Enforcement — 2026-10-26]
- **Enforced Single Active Session Per Account**:
  - Added database migration script `docs/database/add_single_session.sql` adding `current_session_id` to `users`.
  - In `server/routes/auth.js`:
    - On login, a unique `sid` is generated and assigned to `users.current_session_id`. Any previous session is logged (`SESSION_REPLACED`) and replaced.
    - Embeds `sid` into the signed JWT token.
    - On logout, clears `current_session_id` only if the caller's `sid` matches the active session.
  - In `server/middleware/authMiddleware.js`:
    - Rejects requests with 401 and code `SESSION_REPLACED` when `decoded.sid !== data.current_session_id`.
  - In `src/api/client.js` & `src/utils/authUtils.js`:
    - Catches `SESSION_REPLACED` 401 responses and triggers `clearUserSession('replaced')`.
    - Passes Bearer token on `/auth/logout` so server-side session cleanup can verify caller identity.
  - In `src/features/auth/LoginPage.jsx`:
    - Displays dedicated "Signed Out on Another Device" banner when another login displaces the user.

## [Stock Movement Report: Inflow/Outflow/Wastage Overhaul & CSV/PDF Layout Fixes — 2026-10-23]
- **True Stock Movement Tracking (Inflow, Outflow & Wastage)**:
  - In `StockMovementReport.jsx`:
    - Replaced the previous receipts-only approach with full two-way stock movement monitoring across `RAW_MATERIAL_STOCK_RECEIVED`, `PRODUCT_STOCK_RECEIVED`, `INGREDIENT_DEDUCTED`, `PRODUCT_DEDUCTED`, and `WASTAGE`.
    - Added comprehensive metric cards: **Stock Inflow (+)**, **Stock Outflow (-)**, **Wastage / Loss (-)**, **Net Stock Movement**, and **Restock Attention**.
    - Added movement direction filters: `All`, `Inflow`, `Outflow`, and `Wastage`.
    - Resolved missing ingredient/product names in audit deduction records by maintaining active snapshot lookup mappings.
  - In `server/routes/audit.js`:
    - Enhanced audit route to support comma-separated action lists (`query.in('action', actionList)`) and increased query range limit to 2000 for comprehensive reporting.
- **Fixed and Restyled PDF & Print Layout**:
  - In `reportUtils.js`:
    - Fixed parameter mismatch bug in `printReport()` where single-argument invocations rendered `undefined` in the print window.
    - Designed an executive, high-contrast print stylesheet with print color preservation (`-webkit-print-color-adjust: exact`), branded report header, color-coded KPI cards, page-break guards (`page-break-inside: avoid`), and clean typography.
    - Added rendering timeout to prevent premature blank print dialogs in Chromium-based browsers.
- **Fixed and Standardized CSV Export**:
  - Converted CSV export into an RFC-4180 standard CRLF layout with UTF-8 BOM for seamless Microsoft Excel and Google Sheets compatibility.
  - Formatted CSV with clear executive summary metrics, structured Stock Movement Audit Log with explicit `+`/`-` signed quantity changes, and priority-grouped Current Inventory Snapshot.
- **Scaled Text Hierarchy & Enhanced Contrast Across Forecasting View**:
  - In `DemandForecasting.jsx`:
    - **Header & Navigation**: Bumped subtitle from faint `text-sm text-gray-500` to high-contrast `text-sm sm:text-base text-gray-700 font-medium`. Scaled sub-tab buttons to `px-5 py-2.5 text-xs sm:text-sm font-extrabold uppercase` with clear badge counters.
    - **KPI Summary Cards**: Scaled metric labels to `text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide`, numbers to `text-3xl sm:text-4xl font-black`, and subtitles to `text-xs sm:text-sm font-semibold`.
    - **Filter & Search Controls**: Upgraded search input to `text-sm sm:text-base font-medium text-gray-900 placeholder:text-gray-500 py-2.5` and category selector to `font-bold`. Enlarged status filter pills to `px-3.5 py-2 text-xs sm:text-sm font-extrabold`.
    - **Raw Materials Restock Table (Tab 1)**:
      - Scaled column headers to `text-xs sm:text-sm font-black text-gray-700 uppercase py-4`.
      - Material names enlarged to `font-black text-base text-gray-900`; category and unit conversion tags upgraded from `text-[10px]` to `text-xs font-bold text-gray-800` and `text-xs text-gray-600 font-medium`.
      - Stock quantities and burn rates rendered in `font-mono font-black text-base text-gray-900` with clear `text-xs text-gray-600` min alert and calculation subtexts.
      - Restock suggestions bumped to `font-black text-base text-gray-900` with high-visibility estimated cost tags.
      - Upgraded `formatDaysRemaining` status badges to bolder `text-xs sm:text-sm font-black` with saturated, high-contrast badges (red, amber, emerald).
      - Replaced faint supplier text with bold `text-sm font-black text-gray-900`.
    - **Product Demand Predictions Table (Tab 2)**:
      - Scaled table headers to `text-xs sm:text-sm font-black text-gray-700 uppercase py-4`.
      - Product names enlarged to `text-base font-black text-gray-900`.
      - In-stock, daily averages, and 7-day forecast figures boosted to `text-base font-black font-mono`.
      - Confidence scores and stockout risk badges scaled to `text-sm font-extrabold` and `text-xs font-black`.
    - **Purchase Order Modal**:
      - Scaled modal headers, form labels, inputs, table cells, and grand total bar for effortless legibility.
    - **AI Monthly Forecast Modal**:
      - Upgraded product name, select dropdowns, 3 core KPI metrics (`text-3xl font-black`), demand driver cards, and analysis summary text to high-contrast `text-sm` typography.

## [Demand Forecasting: Strict Rule 16 Unicode Emoji Elimination — 2026-10-23]
- **Replaced All Unicode Emojis with Semantic Inline SVGs**:
  - Eliminated raw emojis across `DemandForecasting.jsx`:
    - **KPI Summary Cards**: Replaced `🚨` (Critical), `⚠️` (Low Stock), and `📦` (Monitored Raw Materials) with clean, semantic inline SVG icons.
    - **Filter Pill Buttons**: Replaced `🚨 Critical` and `⚠️ Low Stock` raw emojis with sharp, color-matched inline SVGs.
    - **Search Bar**: Replaced `🔍` with an inline Lucide-style search SVG icon.
    - **Toast Alerts**: Replaced `❌` and `✅` with inline SVG checkmark and alert icons.
    - **Modal Controls**: Replaced raw `✕` characters with scalable SVG close and delete icons.
- **Strict Rule 16 Compliance**: Verified 0 raw Unicode emojis remaining in `DemandForecasting.jsx`.

## [Overdue Purchase Orders: Restricted Action Buttons (Reschedule & Cancel Only) — 2026-10-23]
- **Restricted Action Buttons on Overdue Orders**:
  - In `PurchaseOrders.jsx`, made `Receive Stock` and `Accept Date` unavailable on past due / overdue POs.
  - Overdue orders now strictly allow only **Reschedule** (to provide an updated delivery date) and **Cancel** (to void the order with documented reasons).
  - Styled `Reschedule` button on overdue rows with high-visibility amber CTA styling (`bg-amber-100 text-amber-900 border-amber-300 font-extrabold`) and descriptive tooltip guidance.
  - Added an informational overdue notice banner inside the expanded order details informing managers that stock receiving is locked until a revised delivery date is scheduled.
- **Supplier Portal Overdue Guidance**:
  - In `SupplierPortal.jsx`, updated overdue order controls to hide blind "Mark Delivering" clicks and prioritize "Postpone & Reschedule".
- **Strict Rule 16 Compliance**:
  - All indicators, banners, and tooltips use clean semantic inline SVGs; zero Unicode emojis.

## [Stock Movement Report: Priority-Grouped Sorting & Unified Stock Status — 2026-10-23]
- **Unified "Low Stock / Restock Needed" Status in Stock Movement Snapshot**:
  - Replaced legacy fragmented status classifications (`Restock Needed` vs. `Low Stock`) with the unified `Low Stock / Restock Needed` state across `StockMovementReport.jsx`.
  - Matches the exact design language and alert levels established in `RawMaterialTracker.jsx` and `ProductStockTracker.jsx`.
- **Priority-Grouped Sorting with Labeled Section Headers**:
  - Arranged the Current Inventory Snapshot table by stock urgency:
    1. **Out of Stock** (red header row, alert icon, item count badge)
    2. **Low Stock / Restock Needed** (amber header row, warning icon, item count badge)
    3. **In Stock** (gray/emerald header row, check icon, item count badge)
  - Items are automatically sorted alphabetically (A-Z) by name within each labeled section.
- **Dedicated Stock Status Filter**:
  - Added status filter dropdown (`All Status`, `Out of Stock Only`, `Low Stock / Restock Needed Only`, `In Stock Only`) to the snapshot toolbar for instant drill-down.
- **KPI Card & Print Alignment**:
  - Updated KPI card 3 and print layout to display `Low Stock / Restock Needed` with amber theme.
- **Strict Rule 16 Compliance**:
  - Pure semantic inline SVGs; strictly zero Unicode emojis across all table headers and badges.

## [PO Price Lock & Database Schema Fallback Resilience — 2026-10-23]
- **Locked Unit Price in Demand Forecasting PO Generation**:
  - Made Unit Cost in `DemandForecasting.jsx` ("Generate Purchase Order" modal) read-only (`readOnly`, `cursor-not-allowed`, `bg-gray-50 text-gray-700`) with clear tooltip indication.
  - Ensures prices are strictly sourced from verified supplier catalog defaults and cannot be modified arbitrarily during automated restock PO generation.
- **Resilient PO Creation & Graceful Schema Handling**:
  - Resolved `Could not find the 'notes' column of 'purchase_orders' in the schema cache` error.
  - Updated `purchasingService.js` to attempt inserting `notes` if present, with automatic graceful fallback to core columns (`supplier_id`, `expected_date`, `total_amount`, `status`) if the database table has not yet had the `notes` column added.
  - Captured `notes` in `audit_logs` under `PURCHASE_ORDER_CREATED` event and enriched returned POs so notes are preserved regardless of database migration status.
- **Consolidated Migration Script (`docs/database/migration_purchase_orders_columns.sql`)**:
  - Provided a single, copy-pasteable SQL migration script adding `notes`, `decline_reason`, and `cancellation_reason` to `purchase_orders`, plus `max_stock` to `ingredients` and `products`.

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
  - Replaced emojis in `RevenueSnapshot.jsx` (`★`, `☕`, `→`, `▲`/`▼`) with clean inline SVGs.
  - Replaced emojis in `DemandForecasting.jsx` (`⚡`, `🛒`, `⚠️`, `🔄`, `💬`) with professional SVG icons.
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
