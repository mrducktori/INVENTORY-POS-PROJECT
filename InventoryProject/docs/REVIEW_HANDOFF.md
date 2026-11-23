# System Review Handoff (2026-11-24)

Branch: `Trying-something-wierd` (main: `B1`). Working tree was clean at start.

## Goal
Whole-system review (landing page → POS → inventory → auth), not just today's commits.
Find: repetitive code, weak system design, and "fixes" that didn't fix the root cause.
Then fix in priority order.

## Today's commits under review
- `e789596` big cleanup: middleware, routes, services, POS stock, reports, landing menu, escapeHtml, removed deps
- `2e80bd3` POS controllers/services, purchasing, batchService, allocateDiscount, users routes
- `cc66094` landing page info dialog

## Status
4 read-only review agents were launched on **sonnet** (user wants cheap models: sonnet for reviews, haiku for lookups, never Opus subagents) (frontend/landing, POS, inventory/purchasing, auth/security/architecture).
If this section still says "pending", the session ended before results came back:
re-run the same 4 reviews (prompts: scope listed above, ask for ranked file:line findings + concrete fix).

### Findings

#### A. Frontend / landing (DONE, sonnet review; grep counts approximate)
Real bugs / not-really-fixed:
1. `src/api/client.js:53` PUBLIC_ENDPOINTS makes `/pos/products` public for ALL methods → only GET should skip auth (like `/cms` branch).
2. `src/api/client.js:67` network-error text says "tap Pay again…" everywhere (login, reports) → generic message in client, Pay wording only in posApi sale calls.
3. `src/api/cmsApi.js:13-17` isValidImageUrl accepts `//evil.com` → reject inside the function (URL parse, http/https only), delete call-site patch in `CMSPromotionsTab.jsx:149`.
4. Landing never validates CMS images: `LandingPage.jsx:71` unquoted `url(${hero_image})`, carousel `:109,264`, menu board imgs → validate once in `useLandingPage` setCmsData/parsePromos, quote url().
5. `useLandingPage.js:8` safeHref returns `'#'` but anchors keep `target=_blank`; empty social links still render icons → return null, don't render anchor.
6. `useLandingPage.js:125-135` `||` fallbacks: owner can't blank footer/social in CMS; defaults duplicated in useState (54-70) → one DEFAULTS const + `??`.
7. `useLandingPage.js:157-166` 1200ms timer ends loading before CMS fetch → hero flashes defaults then swaps. Await fetch, timer only as cap.
8. `App.jsx` PrivateRoute doesn't check `isSessionExpired()` → stale tab renders dashboard briefly.
9. `reports/utils/reportUtils.js:72` document.write: verify every printReport caller escapes dynamic values (only useStockMovementReport confirmed).
10. `LandingInfoDialog.jsx` Privacy/Terms is placeholder text shipping as final.

Duplication / design:
- Money formatting 4+ ways (`utils/money.js formatPeso` is the one to keep; delete `forecastUtils.js:6`, `auditFormatter.js:101`, receiptPrint `toFixed`). Add `formatDate/formatDateTime` to `dateUtils.js`.
- ~28 hand-rolled `fixed inset-0` modals, no role=dialog / focus trap. Build one `<Modal>` on native `<dialog>` (copy LandingInfoDialog) in components/shared; reuse ConfirmModal for Cancel/Reschedule PO modals.
- ~60 ad-hoc loading spinners; extract LandingMenuBoard's loading/error/empty blocks into `components/shared/AsyncState.jsx`.
- Every hook repeats fetch/loading/error → small `useAsync(fn, deps)` hook (no new library).
- Pagination/SkeletonLoader shared but rarely used; reports roll their own.
- Dashboard tabs via localStorage+hash+replaceState → Back button leaves app; use nested routes or pushState.
- Staff login path `/coftealoginpageforstaff` hardcoded in 6+ places → `STAFF_LOGIN_PATH` constant; 5-tap logo entry isn't keyboard accessible.
- a11y: carousel lightbox no dialog/focus, autoplay no pause on focus/touch; menu category buttons need aria-pressed, single-row scroller.

_Session 2 (2026-11-24): B/C/D re-launched on sonnet; if still pending below, re-run them._

#### B. POS (DONE, sonnet review, claims not re-verified)
Good: server recomputes prices/discounts/payments (client totals ignored); product stock uses compare-and-set; allocateDiscount correct.
1. `server/services/posService.js:465-470,571-577` untracked products with no recipe are stock-checked but never deducted (stock stays 5 forever); catalog `:92` treats them as tracked; void skips too → one tracked path `track_stock || recipes.length===0`, same in void.
2. `server/services/batchService.js:737-741` deductStockFEFO lowers ingredient total before saveBatches; if that throws, rollback never restores → save batches first or undo in catch.
3. `server/services/posService.js:644-770` sale row inserted before deductions; rollback best-effort, sale deleted even if restores fail → delete only if restores ok (else FAILED), or one Postgres RPC.
4. `server/routes/pos.js:11-36` only requireCafeRole, no `requirePermission('POS')` (sales.js has it) → add to router.
5. `server/services/posOperationsService.js:603-625` CUSTOM discount up to 100% with no manager PIN → require verifyManagerPin / cap.
6. `posOperationsService.js:850-885` idempotency key not bound to payload; changed discount/payment returns old sale → store payload hash, 409 on mismatch.
7. `batchService.js:23`, `posOperationsService.js:52` withStoreLock in-process; JSON blobs in CMS store read-modify-write → lost updates if >1 instance.
8. `posOperationsService.js:1195-1275` void restock recomputes from current recipes; take-out packaging never restored → persist deducted items on sale, restore those.
9. `posOperationsService.js:~715-756` cash accepts 1 centavo short; split overpay 0.01 → integer cents.
10. `src/features/pos/hooks/usePOS.js:~850` client total sums unrounded floats → round per line / use server quote.

Duplication / design: discount logic in PaymentModal.jsx:141-220 and posOperationsService.js:537-682; cart repricing copy-pasted 3× in usePOS.js + server; `round2` ×3, `withStoreLock` ×2; `hasNative*Col/Table` feature detection + dual writes (CMS JSON + native tables) hide missing migrations; usePOS.js 1.2k / posOperationsService.js 2k lines; createSale post-commit side effects swallow errors (payments: null in reports).
#### C. Inventory / purchasing (DONE, sonnet review, agent says verified unless noted)
1. `server/services/purchasingService.js:~909-915` PATCH status `Received` without `items_received` → PO Received, no stock added, then locked → reject Received/Partial without items, or derive status from items.
2. `purchasingService.js:~922-958` receive not atomic (createBatch then item update); retry double-counts stock → one RPC, or CAS on `quantity_received` first.
3. `server/services/batchService.js:~499-560,681-740` batches = JSON blob in cms_content + `stock_quantity` second source of truth → real `ingredient_batches` table.
4. `batchService.js:369-446` reconcileIngredientBatchesInArray silently inflates/trims batches to hide drift (symptom patch) → batches only source of truth.
5. `services/requestsService.js:~139-150` audit_logs fallback updates by id without `action='STAFF_REQUEST'` → Admin can overwrite any audit row; validation → 500 → add `.eq("action","STAFF_REQUEST")`, 400s, type allowlist.
6. `server/controllers/purchasingController.js:~230-300` supplier can regress Partial→Accepted, expected_date unvalidated, catch always 500 → transition table, `err.status || 500`.
7. `purchasingService.js:~703-790` createPurchaseOrder: PO + items separate inserts (orphan PO), client unit_price trusted, no supplier/ingredient check → one RPC, read prices from supplier_ingredients.
8. `server/services/recipesService.js:~184-216` estimated cost sums all size rows, ignores multiplier, invents `+3.5`/`price*0.38` (also `routes/products.js:~262`) → one size, return null.
9. `server/utils/unitUtils.js:~19-33` unknown conversion (ML→KG) warns and returns raw number → 30 ML deducts 30 KG → throw / reject in createRecipe.
10. `recipesService.js:~92-130,255-340` size overrides in native cols AND cms JSON, stale override wins; `.single()` errors on 2+ rows → native only, maybeSingle.
11. `purchasingService.js:~1107-1190` respondToSupplierProposal: audits before acting, no status check, unbounded audit scan, backorder split non-atomic.
12. `server/routes/recipes.js:8-17` (= D2) custom guard; Staff default perms rejected.
13. `routes/products.js:~290-305` product inserted before recipes; recipe fail → orphan product, retry conflicts.
14. Reasons/notes/reschedule/overdue rebuilt from unbounded audit_logs scans each list call → real columns.
15. `received_at` mixed +08:00 vs Z, FEFO sorts by string; `validateOptionalExpiryDate` accepts `2026-11-24junk` and past dates.
16. `aiForecastingService.js:9` computePerishabilityContext: name-regex shelf life default 180d, undefined treated perishable.
17. `server/routes/inventory.js` `/ocr-scan` no rate limiter (Gemini quota).
Wastage verified OK.

Duplication / design: `convertToBaseUnit` server+`src/utils/productUtils.js:76`; normalizeSizeKey/resolveRecipeQuantityForSize in posStockUtils + recipesService; isPOOverdue ×3 (useSupplierPortal, PurchaseOrders.jsx:133, server) → server `is_overdue`; terminal status list ×5; PATCH/PUT status triple-mounted; missing-column fallbacks everywhere; JSON blobs as tables; controllers dynamic `await import` bypassing services.
#### D. Auth / security / architecture (DONE, sonnet review, claims not re-verified)
No hardcoded secrets, no SQL injection (Supabase builder; only `audit.js:31` interpolates into ilike). JWT 8h, no secret fallback.
1. `server/routes/users.js:272-300,137-155,190-210,59` Admin can reset another Admin's password/role, create Admins → non-Owner may only touch non-Admin/Owner targets (or self).
2. `server/routes/recipes.js:10-18`, `categorySettings.js:59-67` writes gated by view key `Products` → `requirePermission('ManageProducts')`.
3. `server/routes/audit.js:49-62` any Admin can POST arbitrary audit entries (forgeable log) → delete route.
4. `server/server.js:88` CORS allows every `*.vercel.app` with credentials → only own host / CLIENT_URL.
5. `server/routes/auth.js:20-68` lockout keyed ip|username → add per-username counter (delay, not hard lock).
6. JWT in localStorage + `reportUtils.js:72` document.write → strict CSP, escape print values.
7. `server/routes/auth.js:194-208` `/auth/activity` checks signature only, not sid/status → put behind requireAuth.
8. `server/services/cmsService.js:119-167` upload trusts client MIME → magic-byte check.
9. Staff can list users incl. permissions (`users.js:18,400`); raw DB `err.message` returned to clients → one `sendError` helper hiding 5xx text; restrict permissions field.
10. `authMiddleware.js:151,202` 20s per-process auth cache; session check skipped if `current_session_id` undefined (low).

Symptom patches: client.js:53 `/pos/products` public for all methods; server.js:177 CORS detected by err.message match; server.js:155 duplicate `/purchase-orders` mount; authMiddleware.js:154-177 `hasCurrentSessionIdCol` hides missing migration.

Duplication / design: permission logic hand-rolled 3 ways → `requirePermission` everywhere; requireAuth mounted inconsistently → mount once, mark public routes; `requireCafeRole` duplicated in pos.js/purchasing.js + role list ×10 → `CAFE_ROLES`; `STAFF_DEFAULT_PERMISSIONS` duplicated server/frontend; .env loaded twice; route handlers in users.js/sales.js mix auth+logic+DB.
Not reviewed: posController, purchasingController, inventoryController, ocrService, aiForecastingService.

## Next steps (priority order; verify each finding in code before fixing)

**Root causes behind most findings**
- R1 Permission checks hand-rolled per route → `requirePermission` everywhere (fixes D2, B4, C12, part of D1).
- R2 Multi-step writes with best-effort rollback → Postgres RPC/transactions for sale+stock, PO receive, PO create (B2, B3, C2, C7, C13).
- R3 JSON blobs in `cms_content` used as tables + missing-migration fallbacks (`hasNative*`) → run migrations, real tables, delete fallbacks (B7, C3, C4, C10, C14, D symptom patches).
- R4 Logic duplicated client/server (discounts, repricing, stock, overdue, perms, unit conversion) → server is the source; client shows server quote.

**Progress (session 2)**: DONE by lead: D1 (users.js `blocksPrivilegedChange` + test), R1 (pos.js POS perm, recipes/categorySettings ManageProducts), D3 (audit POST removed), C5 (requests action filter), C1 (`derivePoReceiptStatus` + test), B1 (no-recipe products deducted + void restock), B2 (FEFO total restored on saveBatches failure), C9 (`canConvertUnit`, recipes rejected on save). Workers (sonnet) dispatched: D4/D7/C17, A1-A4, B5/B6, forecasting analysis. User also asked: make demand forecast understandable/accurate + end-of-day AI processing.

**Forecasting analysis (sonnet, read-only)**: two separate engines that disagree.
- List `GET /analytics/demand-forecast` (server/routes/analytics.js:508-718): no LLM; 14/30/90d weighted avg, blended 65/35 with static `server/data/multiYearSalesSummary.json` (613KB, generated 2026-11-08, never refreshed), hard-coded weekend ×1.24 / "payday"(=Mon/Fri) ×1.20, confidence = fixed `78+12+5`.
- Modal `POST /analytics/ai-forecast` → `aiForecastingService.forecastStockUsingAI` (:671): 7/30/90 ensemble + Gemini clamped to ±20% (adds noise), Gemini confidence used unchecked; 30-min in-memory cache; Gemini call per modal open.
- Accuracy: no backtest/error metric; zero-sale days missing from weekday/holiday averages (aiForecastingService.js:257); YoY default 12%; static JSON merge takes larger value, fabricated min/max.
- UI (src/features/analytics MenuDemandTab, MonthlyProjectionModal, ForecastGuideModal): jargon, fake confidence, no inputs/dates/last-updated, no "predicted vs actual".
- No scheduler exists; `closeShiftZReading` (posOperationsService.js:1668-1766) is a hook point but shift ≠ day → upsert daily summary by Manila date + lazy backfill.

**Phase 1 COMPLETE** (lead + 3 sonnet workers, all reviewed by lead; 15/15 server tests, vite build ok). Also B5 manager PIN for CUSTOM discount, B6 `hashCheckoutPayload` idempotency.

**DB probe (2026-11-24, read-only)**: all phase migrations already applied. `inventory_batches` exists with 0 rows (batches still in cms_content `inventory_batches_store` JSON, 23KB). `ingredients.is_perishable/default_shelf_life_days` exist but code guesses shelf life by name regex. `sales` has 49,165 rows 2023-01-01 → 2026-11-23, so static multiYearSalesSummary.json is redundant.

**Redefense plan (user: panel wants batch tracking tied to PO receiving, expiry/QA, low stock + forecast connected)**
1. Batches: migrate JSON → `inventory_batches`, table is the only source; `stock_quantity` maintained in the same Postgres RPC (atomic FEFO deduct/restore, receive). Delete reconcile + JSON paths.
2. Shelf life: category default (per raw-material category) + per-item `default_shelf_life_days` override; expiry required on receive for perishables, pre-filled.
3. PO flow: transition table, receive = RPC creating batch rows linked to po_item, prices from supplier_ingredients, PO+items in one RPC.
4. Low stock = usable (non-expired) stock vs reorder point (forecast daily usage × (lead time + safety)); separate "expiring soon" alert.
5. Forecast: `daily_product_sales` summary filled end-of-day (Z-close + nightly + lazy backfill); one engine (weekday avg zero-filled + trend + same-month-last-year from DB); backtest accuracy; charts; Gemini writes nightly explanation only.

**Redefense build progress (user approved order 1→5; then an independent reviewer agent, then ask user)**
- SQL (user must run in Supabase SQL Editor, in order): `docs/database/phase5_batches_source_of_truth.sql`, `docs/database/phase6_daily_sales_forecasting.sql`. NEW SERVER CODE REQUIRES BOTH (batchService reads inventory_batches + RPCs).
- Step 1 DONE: batchService rewritten (table only, RPC inv_deduct_fefo/inv_restore_batches/inv_receive_po_item, trigger keeps stock_quantity = sum). createIngredient opening stock → INITIAL_STOCK batch. PO receive loop → RPC.
- Step 2 DONE: shelf life = item override → `raw_material_category_shelf_life` → none; endpoints GET/PUT /inventory/categories/(:category/)shelf-life; rename carries rule. Frontend (worker): receive requires expiry for perishables, tri-state item setting, category shelf-life UI.
- Step 3 DONE (worker): supplier transition table, PO create uses catalog price + centavo totals + orphan cleanup, respondToSupplierProposal validation. C14 skipped (audit logs feed more than reasons).
- Step 4 DONE: low stock = usable ≤ reorder point (forecast daily usage × (lead time + 2)); fallback manual threshold; GET /inventory/reorder-plan; expiring_before_use_qty.
- Step 5 server DONE: `services/forecastService.js` (weekday avg zero-filled × damped trend × last-year season; backtest accuracy; nightly Gemini/template insights; end-of-day job every 30 min + Z-close + void refresh). GET /analytics/forecast, POST /analytics/forecast/refresh. Frontend forecast UI: worker running. TODO after: delete old aiForecastingService/demand-forecast/ai-forecast/multiYearSalesSummary.json once frontend no longer calls them.
- Tests: 25/25 server.

**Phase 1: small, high-impact fixes (no schema change)**
1. D1 Admin can take over other Admins (users.js).
2. R1: `requirePermission` on pos.js ('POS'), recipes.js + categorySettings.js ('ManageProducts').
3. D3 delete forgeable audit POST; C5 add `action` filter in requestsService.
4. C1 reject status Received/Partial without items_received.
5. B1 untracked no-recipe products never deducted (sale + void).
6. B2 deductStockFEFO order (save batches before total).
7. C9 unitUtils throw on unknown conversion + validate recipes.
8. D4 CORS `*.vercel.app` → own host; D7 `/auth/activity` behind requireAuth; C17 rate-limit ocr-scan.
9. B5 manager PIN / cap for CUSTOM discount; B6 idempotency payload hash.
10. A1 client.js `/pos/products` GET only; A3/A4 image URL validation.

**Phase 2: transactions (R2)**: sale+stock RPC, PO receive RPC, PO create RPC, product+recipes create.

**Phase 3: data model (R3)**: ingredient_batches table, recipe size overrides native only, PO reason/notes columns, drop fallbacks; then B8 persist deducted items for void.

**Phase 4: duplication/UX (R4 + section A design list)**: server quote endpoint, shared Modal/AsyncState/useAsync, formatPeso, CAFE_ROLES, round2, sendError helper.

## Redefense build — status (2026-11-24)
Steps 1-5 built (batches as source of truth, category shelf life, PO flow, usable-stock low-stock alerts, end-of-day forecasting + charts).
Independent reviews (own + fresh Sonnet agent) fixed: trigger ingredient lock (NO KEY UPDATE), advisory lock on the daily rollup,
revenue net of line discounts, `is_archived` filter, manual low-stock floor always counts, shelf-life cap on suggested order,
Gemini retry until GEMINI rows exist, partial PO receive / partial stocktake now recorded, PO receive blocked while Pending/Proposal,
low-stock falls back to manual thresholds if forecast data fails, supplier `lead_time_days` editable.
Old AI forecast (aiForecastingService, multiYearSalesSummary.json, 3 routes) deleted. `invalidateAnalyticsCache` is now a no-op kept for ~30 call sites.
BEFORE DEPLOY: run docs/database/phase5_batches_source_of_truth.sql then phase6_daily_sales_forecasting.sql in Supabase SQL Editor (try a copy first).
Not done: B3/B8 (atomic sale + exact-batch void restore), C13, R4 duplication, SQL functions have no automated test (needs a DB).

Later same day: AI layer added (nightly Gemini factor 0.9-1.1 + reason per product, holidays/paydays as input; stored in forecast_insights.ai_factor/ai_reason; adjusted forecast drives reorder plan; UI shows computed vs AI-adjusted). Void now restores exact lots from INGREDIENT_DEDUCTED audit rows; checkout awaits that audit. Product create validates first and deletes product if recipe save fails. CHECKOUT_ROLLBACK_FAILED audit on failed compensation.
Deliberately not done: fully SQL-atomic checkout, R4 shared Modal/formatPeso cleanup.
