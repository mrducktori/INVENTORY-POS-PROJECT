# Project Rules

## 0. Read the Project Reference First
Before starting ANY task, read `docs/PROJECT_REFERENCE.md`. It contains the full architecture map, file structure, CMS implementation plan, security audit, known technical debt, and coding conventions. Also check `docs/CHANGELOG.md` for recent changes.

## 1. Maintain a Changelog
Whenever you complete a task or make significant changes to the codebase, you MUST update `docs/CHANGELOG.md`.
- Briefly summarize what was added, changed, or fixed.
- Keep the explanations concise to save tokens and provide a clear history.

## 2. API Calling Standards
Whenever making frontend requests to the backend, you MUST use the centralized `apiCall` function from `src/api/client.js` instead of using standard `fetch()`. This ensures session headers (`x-user-id`) and error handling are always consistent.
- **Only exception:** `loginUser()` in `authApi.js` uses raw `fetch` because there's no session yet.

## 3. Styling & UI Guidelines
The codebase uses **both** Tailwind CSS utilities and custom CSS component classes in `src/index.css`. This is intentional:
- **New feature pages:** Use Tailwind utilities.
- **Modifying existing pages:** Match whatever styling approach that file already uses.
- **Reusable components:** Prefer the custom CSS classes from `index.css` (`.card`, `.form-group`, `.table`, `.btn`, `.modal`, etc.).
- **Complex animations:** Add to `index.css` under `@layer components`.
- DO NOT use plain generic colors. Match the premium black & white aesthetic.

## 4. Database & Secrets
Never hardcode sensitive information (like Supabase URLs or keys) in the source code. Always use `process.env` and require them to be set in the `.env` file. The server-side Supabase client uses the SERVICE_ROLE_KEY which bypasses RLS — authorization is enforced through middleware (`requireAuth`, `requireRole`).

## 5. Security Best Practices
Before modifying anything that could cause data loss or expose secrets, pause and ask the user for explicit confirmation. Never upload `.env` or log files to the repository.
- Refer to `docs/PROJECT_REFERENCE.md` section 9 for the full security audit and open issues.
- Key issues to be aware of: authentication uses `x-user-id` header (spoofable — JWT migration planned), rate limiters exist but are not yet wired up, Helmet is not installed yet.

## 6. Website Deployment / cPanel Updates
When guiding the user to deploy updates to the cPanel hosting environment:
- **Build Frontend**: Remind the user to run `npm run build` in the `InventoryProject` folder to generate the latest `/dist` folder.
- **Upload Assets**: Remind the user they only need to upload specific changed backend files (e.g., inside `/server/`) and the new `/dist` folder to cPanel. They do NOT need to upload the raw `/src/` files or `/node_modules/` again.
- **Restart App**: Remind the user to Restart their Node.js App inside cPanel after uploading any backend files (`/server/`).

## 7. Backend Architecture — Route → Controller → Service
New backend features MUST follow the layered pattern:
- **Routes** (`server/routes/`) — Define HTTP endpoints, apply middleware (`requireAuth`, `requireRole`), extract params.
- **Controllers** (`server/controllers/`) — Business logic, audit logging, error handling.
- **Services** (`server/services/`) — Pure database operations (Supabase queries only).
- Some older routes (`products.js`, `sales.js`, `users.js`) have logic directly in the route handler — that's OK for existing code, but new features should use the layered pattern.

## 8. Navigation System — Tab-Based, NOT React Router
The dashboard does NOT use `react-router-dom` for internal pages. Navigation works via:
- `Dashboard.jsx` holds an `activeTab` state.
- `Navbar.jsx` calls `onTabChange('TabName')` which renders the matching component in a `switch` statement.
- Role visibility is handled by `isAuthorized(tab)` in `Dashboard.jsx`.

**To add a new feature page:**
1. Create the component in `src/features/<module>/`.
2. Import it in `Dashboard.jsx`.
3. Add a `case` in the `renderContent()` switch.
4. Add a nav item in `Navbar.jsx` (check role visibility).

## 9. Audit Logging
Every significant action MUST be logged using `logAudit()` from `server/utils/auditHelper.js`.
- **ALWAYS use `req.user.id`** from the authenticated middleware — NEVER use `req.body.user_id` (it can be spoofed).
```javascript
await logAudit('ACTION_NAME', req.user.id, {
  target_id: data.id,
  name: data.name,
  changed_by: req.user.name
});
```

## 10. CMS Conventions
The CMS system uses a `cms_content` table with `section_key` as the identifier.
- Use `upsert` for CMS writes to prevent duplicate key errors.
- Keep section_keys as slugs (`hero`, `about`, `promo`) — no spaces or special chars.
- Store structured data as JSON in the `description` field.
- CMS writes should be restricted to `Admin`/`Owner` roles.
- Image uploads go to Supabase Storage `cms-images` bucket (public).
- See `docs/PROJECT_REFERENCE.md` section 5 for the full CMS expansion plan and the dynamic menu pricing approaches.

## 11. Soft Deletes
Products and ingredients use `is_archived` boolean for soft deletes — do NOT use actual `DELETE` operations on these tables. Archive and restore operations have dedicated endpoints (`PUT /:id/archive`, `PUT /:id/restore`).

## 12. Stock Operations
- **Product stock** can only be changed through `POST /products/:id/receive` (add) or the POS/wastage flow (subtract). The `PUT /products/:id` endpoint intentionally excludes `stock_quantity`.
- **Ingredient stock** follows the same pattern via `POST /inventory/ingredients/:id/receive`.
- **PO receiving** uses `purchase_unit` and `conversion_factor` for unit conversion (e.g., 5 Bags → 5000 grams).

## 13. Timezone
All timestamps use `timestamptz`. The app assumes **Asia/Manila (+08:00)** timezone. Date utilities exist in both `src/utils/dateUtils.js` (frontend) and `server/utils/dateUtils.js` (backend).

## 14. Known Technical Debt — Do Not Repeat
Before building anything, check `docs/PROJECT_REFERENCE.md` section 10 for known issues. Key things to avoid:
- Don't create more `debugger` loops or DevTools-blocking code.
- Don't use `req.body.user_id` for audit logs — use `req.user.id`.
- Don't add large monolithic components — break them into sub-components if they exceed ~500 lines.
- Don't bypass `apiCall()` with raw `fetch()` on the frontend.

## 15. Temporary and Seed Files
Anything that is temporary—like seeding things to the database or `.sql` files created by the AI—should be placed in the `docs/` folder (or `docs/database/`). These files are NOT needed for the running system (the backend interacts with the database directly using `supabase-js`), but they serve as a historical reference of database schemas and migrations.
