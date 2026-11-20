# 📘 CofTea Cafe — Project Reference Guide

> **Purpose:** A single source of truth for the entire codebase — architecture, conventions, CMS plan, known debt, and best practices.  
> **Audience:** The developer (Glory), and any AI agent continuing work on this project.  
> **Last Updated:** 2026-11-18

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & File Map](#2-architecture--file-map)
3. [Tech Stack](#3-tech-stack)
4. [Styling Approach (CSS vs Tailwind)](#4-styling-approach-css-vs-tailwind)
5. [CMS Implementation Guide](#5-cms-implementation-guide)
6. [Backend Conventions](#6-backend-conventions)
7. [Frontend Conventions](#7-frontend-conventions)
8. [Database Schema Notes](#8-database-schema-notes)
9. [Security Status](#9-security-status)
10. [Known Technical Debt](#10-known-technical-debt)
11. [Future Task Backlog](#11-future-task-backlog)
12. [Deployment Checklist](#12-deployment-checklist)

---

## 1. Project Overview

**CofTea Cafe Inventory & POS System** is a full-stack web application for a café business. It handles:

- **Public Landing Page** — CMS-driven menu board for walk-in customers (TV display)
- **Point of Sale (POS)** — Staff-facing order processing
- **Inventory Management** — Raw materials, products, recipes, stock tracking
- **Purchasing** — Suppliers, purchase orders, stock receiving with unit conversion
- **Reports & Analytics** — Sales summaries, audit logs, demand forecasting
- **Account Management** — User CRUD with role-based access (Owner > Admin > Staff)
- **Content Management (CMS)** — Owner/Admin can update landing page content without code

**Production Domain:** `https://cofteacafe.space` (Cloudflare DNS -> Vercel frontend `https://cofteacafe.vercel.app` + Render backend `https://coftea-pos-api.onrender.com`; legacy cPanel monolith setup retained as an alternative option)

---

## 2. Architecture & File Map

```
InventoryProject/
├── src/                        # React frontend (Vite + React 18)
│   ├── App.jsx                 # Router: LandingPage, LoginPage, Dashboard
│   ├── main.jsx                # Entry point + global listeners
│   ├── index.css               # Global styles (Tailwind + custom component classes)
│   ├── api/                    # All API call functions (use apiCall from client.js)
│   │   ├── client.js           # ⭐ Centralized fetch wrapper — ALL requests go through here
│   │   ├── authApi.js          # Login/logout helpers
│   │   ├── cmsApi.js           # getCmsContent, updateCmsContent
│   │   ├── inventoryApi.js     # Ingredients CRUD
│   │   ├── posApi.js           # POS products & sales
│   │   ├── productsApi.js      # Products CRUD
│   │   ├── purchasingApi.js    # Suppliers & purchase orders
│   │   └── ...                 # (reportsApi, salesApi, usersApi, etc.)
│   ├── components/             # Shared/reusable components
│   │   ├── Navbar.jsx          # Sidebar navigation (role-aware)
│   │   └── SalesReceiptModal.jsx
│   ├── config/
│   │   └── supabaseClient.js   # Frontend Supabase client (anon key, for storage uploads)
│   ├── features/               # Feature-based modules (Page + hooks/ + components/ + utils/)
│   │   ├── accounts/           # AccountManager, EmployeeTracker + components/
│   │   ├── analytics/          # DemandForecasting + hooks/, components/, utils/
│   │   ├── auth/               # LandingPage, LoginPage + hooks/useLogin, useLandingPage + components/
│   │   ├── cms/                # CMSDashboard + hooks/, components/
│   │   ├── dashboard/          # Dashboard, DashboardOverview + hooks/, components/
│   │   ├── inventory/          # Products, ManageProducts, RawMaterials, Suppliers, PurchaseOrders, SupplierPortal
│   │   │   ├── hooks/          # useManageProducts, useManageRawMaterials, useSupplierPortal
│   │   │   └── components/     # Grouped by domain: products/, purchasing/, suppliers/
│   │   ├── logs/               # AuditLogs, AdminLogs, TransactionLogs, SalesReceiptJournal, SalesSummaryReport + hooks/, components/
│   │   ├── pos/                # POS + hooks/usePOS + components/
│   │   ├── reports/            # Reports, SalesPerformance, InventoryStatus, StockMovement, Wastage + hooks/, components/, utils/
│   │   ├── requests/           # RequestProduct, ViewRequests
│   │   └── wastage/            # ReportWastage
│   └── utils/                  # Frontend utilities
│       ├── authUtils.js        # Role checking helpers
│       ├── dateUtils.js        # Date formatting
│       ├── productUtils.js     # Product calculation helpers
│       └── constants.js        # App-wide constants
│
├── server/                     # Express.js backend (Node 20+)
│   ├── server.js               # ⭐ Entry point — CORS, routes, static files
│   ├── .env                    # Server environment variables
│   ├── config/
│   │   └── supabaseClient.js   # Server Supabase client (SERVICE_ROLE_KEY — bypasses RLS)
│   ├── middleware/
│   │   ├── authMiddleware.js   # requireAuth (JWT + single-session), requireRole
│   │   └── rateLimiter.js      # generalLimiter, authLimiter, looseLimiter, createLimiter (wired in server.js & auth.js)
│   ├── routes/                 # Express route definitions
│   │   ├── auth.js             # POST /login, /logout (public, with lockout)
│   │   ├── pos.js              # GET /products (public), POST /sale (auth)
│   │   ├── cms.js              # GET / (public), PUT /:section_key (auth)
│   │   ├── products.js         # Full CRUD + stock receive
│   │   ├── inventory.js        # Ingredients CRUD via controller
│   │   ├── purchasing.js       # Suppliers & PO CRUD via controller
│   │   ├── users.js            # User CRUD (Admin/Owner only)
│   │   ├── sales.js            # Sales data + summary reports
│   │   ├── dashboard.js        # Dashboard stats
│   │   ├── analytics.js        # Depletion + demand forecast
│   │   └── ...                 # (audit, wastage, recipes, requests, categorySettings)
│   ├── controllers/            # Business logic layer
│   │   ├── posController.js
│   │   ├── inventoryController.js
│   │   ├── purchasingController.js
│   │   └── cmsController.js
│   ├── services/               # Database interaction layer
│   │   ├── posService.js       # Sale creation with stock deduction + recipe logic
│   │   ├── inventoryService.js # Ingredient CRUD + stock ops
│   │   ├── purchasingService.js # Supplier + PO operations
│   │   ├── cmsService.js       # CMS read/upsert
│   │   └── ...
│   └── utils/
│       ├── auditHelper.js      # logAudit() helper
│       ├── stringHelper.js     # Fuzzy name matching for duplicates
│       ├── dateUtils.js        # Manila timezone helpers
│       └── unitUtils.js        # Unit conversion helpers
│
├── dist/                       # Production build output (upload to cPanel)
└── docs/
    ├── CHANGELOG.md            # Project changelog
    ├── DEPLOYMENT_GUIDE_VERCEL_RENDER.md
    ├── PROJECT_REFERENCE.md    # ⭐ This file
    ├── database/               # SQL schema, RPC, and migration scripts (supabase_schema.sql, etc.)
    ├── defense/                # Defense presentations, scripts, test cases, questionnaires
    └── diagrams/               # DFD, Flowchart, and UML diagram assets (PNG/SVG)
```

### How Navigation Works

The app does NOT use `react-router-dom` for internal dashboard pages. Instead:

- `App.jsx` has 3 routes: `/` (LandingPage), `/login` (LoginPage), `/dashboard/*` (Dashboard)
- Inside `Dashboard.jsx`, navigation uses a **`activeTab` state** managed by `Navbar.jsx`
- `Navbar.jsx` calls `onTabChange('TabName')` which renders the matching component via a `switch` statement
- Role-based visibility is handled by the `isAuthorized(tab)` function in Dashboard.jsx

**Important:** When adding a new feature page:
1. Create the component in `src/features/<module>/`
2. Import it in `Dashboard.jsx`
3. Add a `case` in the `renderContent()` switch
4. Add a nav item in `Navbar.jsx` (check role visibility)

---

## 3. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 19 + Vite 8 | Single-page app (`React Router 7` top-level + tab state) |
| **Styling** | Tailwind CSS 4 + Custom CSS | Mixed approach (see section 4) |
| **Backend** | Express.js 5 (ESM) | Node 20+, ES modules (`"type": "module"`) |
| **Database** | PostgreSQL via Supabase | Hosted (14 tables), uses JS client (`@supabase/supabase-js`) |
| **Storage** | Supabase Storage | `cms-images` bucket for CMS uploads |
| **AI Forecasting** | Google Gemini API (`gemini-3.5-flash-lite`) | Structured prompt inference + 90-day deterministic fallback |
| **Auth** | JWT (`jsonwebtoken`) + bcrypt + single-session ID | Upgraded from `x-user-id` headers |
| **Hosting** | Vercel + Render + Cloudflare DNS | Decoupled cloud (cPanel monolith retained as legacy option) |

---

## 4. Styling Approach (CSS vs Tailwind)

### Current State — It's a Mix, and That's OK

The codebase uses **both** Tailwind utility classes and custom CSS component classes. This is normal when learning Tailwind while maintaining an existing project. Here's how it works:

```
index.css
├── @import "tailwindcss"          ← Enables Tailwind utilities
├── @layer base { ... }            ← Global resets (body, *)
└── @layer components { ... }      ← Custom reusable CSS classes
    ├── .inventory-container       ← Page layout
    ├── .card, .card-header        ← Card components  
    ├── .form-group, .form-row     ← Form layouts
    ├── .table, .table th/td       ← Table styles
    ├── .btn, .btn-primary         ← Button variants
    ├── .modal-overlay, .modal     ← Modal system
    └── .badge-*                   ← Status badges
```

### The Two Patterns in Use

**Pattern A — Custom CSS classes (older pages):**
```jsx
// Uses classes defined in index.css
<div className="inventory-container">
  <div className="card">
    <div className="card-header"><h2>Title</h2></div>
    <div className="card-body">...</div>
  </div>
</div>
```

**Pattern B — Tailwind utilities (newer pages like CMSDashboard):**
```jsx
// Uses Tailwind directly in JSX
<div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
  <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900">Title</h1>
</div>
```

### Guidelines Going Forward

> [!IMPORTANT]
> **Don't refactor old pages to Tailwind unless you're already modifying them.** Focus on new features using Tailwind. Consistency within a single file matters more than consistency across the whole app.

| Situation | Approach |
|-----------|----------|
| **New feature page** | Use Tailwind utilities |
| **Modifying an existing page** | Match whatever that file already uses |
| **Reusable component** | Prefer the custom CSS classes from `index.css` |
| **One-off styling** | Tailwind utilities are fine |
| **Complex animations/transitions** | Add to `index.css` under `@layer components` |

### Common Tailwind Patterns Used in This Project

```
Layout:     flex, flex-1, flex-col, grid, gap-*, p-*, m-*, w-full, h-screen
Text:       text-sm, text-xs, font-bold, font-extrabold, tracking-wider, uppercase
Colors:     bg-gray-50, text-gray-900, bg-white, border-gray-200
Borders:    border, rounded-xl, rounded-lg, shadow-sm
Responsive: md:p-8, md:flex-row, md:w-64
States:     hover:bg-gray-800, focus:ring-2, focus:outline-none
```

### Is the "Messy Mix" Normal?

**Yes, absolutely.** Most real-world projects go through this transition. The code works, and that's what matters right now. When you have time later, you can:
1. Pick pages that bug you the most visually
2. Refactor them one at a time to pure Tailwind
3. Gradually remove unused CSS classes from `index.css`

---

## 5. CMS Implementation Guide

### What Exists Now

You already have a **basic CMS system** working:

| Component | File | What It Does |
|-----------|------|-------------|
| **Database table** | `cms_content` (Supabase) | Stores `section_key`, `title`, `description`, `image_url` |
| **Backend API** | `server/routes/cms.js` + `cmsService.js` | GET all content, PUT by section_key |
| **Admin UI** | `src/features/cms/CMSDashboard.jsx` | Edit title, description, upload images |
| **Public Display** | `src/features/auth/LandingPage.jsx` | Reads CMS content on load |
| **Image Storage** | Supabase Storage `cms-images` bucket | Public bucket for uploaded images |

### What the Client Can Already Do

1. Log in as Owner/Admin
2. Go to "Content Management" in the sidebar
3. Edit the landing page title, description, and background image
4. Changes appear on the public landing page instantly

### CMS Expansion Plan — What To Build Next

Here's the roadmap for making the CMS more powerful for your client:

#### Phase 1: Enhance Current CMS (Quick Wins)

**1a. Add more editable sections**

Right now you probably have a `hero` section. Add more section keys to the `cms_content` table:

```sql
-- Run in Supabase SQL editor
INSERT INTO cms_content (section_key, title, description, image_url) VALUES
  ('hero', 'Welcome to CofTea Cafe', 'Your description here', NULL),
  ('about', 'About Us', 'Our story...', NULL),
  ('promo', 'Today''s Special', 'Check out our latest promo!', NULL),
  ('footer', 'CofTea Cafe', 'Visit us at...', NULL)
ON CONFLICT (section_key) DO NOTHING;
```

**1b. Add a "Live Preview" to the CMS dashboard**

Show a mini preview of how the landing page will look as the owner types:

```jsx
// In CMSDashboard.jsx, below the form
{editing && (
  <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Live Preview</p>
    <h3 className="text-lg font-bold">{formData.title}</h3>
    <p className="text-sm text-gray-600 whitespace-pre-wrap">{formData.description}</p>
    {formData.image_url && (
      <img src={formData.image_url} alt="Preview" className="mt-2 max-h-40 rounded-lg object-cover" />
    )}
  </div>
)}
```

**1c. Add role restriction to CMS route**

Currently any logged-in user can edit CMS. Fix:

```javascript
// server/routes/cms.js
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
router.put("/:section_key", requireAuth, requireRole('Admin', 'Owner'), cmsController.updateCmsContent);
```

#### Phase 2: Rich Content Sections

**2a. Operating Hours section**

```sql
-- Add to cms_content
INSERT INTO cms_content (section_key, title, description) VALUES
  ('hours', 'Operating Hours', '{"mon_fri": "8:00 AM - 10:00 PM", "sat_sun": "9:00 AM - 11:00 PM"}');
```

The `description` field can store JSON for structured data. Parse it in the landing page:

```jsx
// In LandingPage.jsx
const hours = JSON.parse(hoursSection?.description || '{}');
```

**2b. Social Media Links section**

```sql
INSERT INTO cms_content (section_key, title, description) VALUES
  ('socials', 'Follow Us', '{"facebook": "https://fb.com/cofteacafe", "instagram": "https://instagram.com/cofteacafe"}');
```

**2c. Announcements / Promo Banner**

Add an `is_active` boolean column to `cms_content` so the owner can toggle promotions on/off:

```sql
ALTER TABLE cms_content ADD COLUMN is_active boolean DEFAULT true;
```

Then in the CMS dashboard, add a toggle switch. On the landing page, only show sections where `is_active = true`.

#### Phase 3: Multi-Image Gallery (Advanced)

If the client wants a gallery or multiple promo images:

```sql
CREATE TABLE cms_gallery (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key varchar REFERENCES cms_content(section_key),
  image_url varchar NOT NULL,
  caption varchar,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

This lets the owner upload multiple images per section, with drag-to-reorder on the frontend.

#### Advisor Feature: Dynamic Pricing on Menu Board Images

> **Problem:** The current menu board uses pre-designed PNG images (e.g. `Amerikano_menu.png`) with prices **baked into the photo** (P39 / P49 / P59). When a product's price is updated in the database, the sidebar price list updates live, but the menu board image still shows the old price.
>
> **The advisor wants:** Prices on the landing page menu to always match the database — including inside the visual menu boards.

There are 3 possible approaches. **A decision has not been made yet** — evaluate based on timeline and client needs.

##### Approach A: Generate Menu Boards in Code (Recommended)

Stop using images-with-prices entirely. Build the menu board as a **React component** that pulls products and prices from the database and renders them in a styled grid.

**Client uploads:** Only individual product photos (drink photos without text/prices)
**System generates:** The full menu layout with current prices

```
┌──────────────────────────────────────┐
│  AMERIKANO (hot or cold)             │
│           12oz     16oz     22oz     │
│           ₱39      ₱49      ₱59      │  ← Live from database
│                                      │
│  [img]  [img]  [img]  [img]  [img]   │  ← Product photos only
│  orig   caramel hazel salted  black  │
└──────────────────────────────────────┘
```

**Implementation notes:**
- Products already have `sizes` (jsonb) with per-size pricing and `category` for grouping
- Query `/api/pos/products` (public endpoint, no auth needed)
- Group products by category, display each as a styled card grid
- Match the current menu board aesthetic with dark background, white text, bold prices
- Each product image can come from the `image_url` field in the products table or be uploaded via CMS
- CMS would let the client customize category headers, descriptions, and background colors

**Pros:**
- ✅ Prices always match the database — zero manual work when prices change
- ✅ New products appear automatically when added
- ✅ Works on all screen sizes (responsive)
- ✅ Category settings already exist in the database

**Cons:**
- ❌ Won't look exactly like the client's hand-designed menu images
- ❌ Requires individual product photos to be uploaded
- ❌ More upfront work to style the component to match the brand

**Effort:** Medium (2–4 hours for the component + styling)

---

##### Approach B: Hybrid — Image Background + Price Overlay Strip

Keep the client's menu photos for visual appeal, but ask the client to make **new versions without prices in the photo**. The system adds a **price bar** at a fixed position (top, bottom, or overlay strip) that pulls from the database.

```
┌─────────────────────────────────────┐
│                                     │
│  [Client's Menu Photo]              │
│  (shows drinks + flavors only,      │
│   NO prices in the image)           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 12oz: ₱39 | 16oz: ₱49      │    │  ← Generated from DB
│  │ 22oz: ₱59                   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Implementation notes:**
- Map each category image to a category name (already done in `CATEGORY_IMAGES` constant in LandingPage.jsx)
- For each displayed image, fetch the corresponding category's products and render a price overlay
- Use `position: absolute` with `bottom: 0` for a consistent price bar position
- The client needs to provide new images without prices, or photoshop the prices out

**Pros:**
- ✅ Keeps the client's custom visual design
- ✅ Prices update automatically from the database
- ✅ Simpler than full code-generated boards

**Cons:**
- ❌ Requires the client to make NEW images without prices
- ❌ Price bar positioning may not look as polished as the baked-in design
- ❌ Client can't control where the price text appears in the image

**Effort:** Low-Medium (1–2 hours)

---

##### Approach C: Drag-and-Drop Price Positioning (Most Complex)

Build a CMS editor where the client uploads a menu image, then **drags price labels** to the exact position where they want them. The positions (x%, y%) are saved in the database, and the landing page renders the prices as absolutely-positioned overlays.

**Implementation notes:**
- Need a new table like `cms_price_overlays (id, section_key, product_id, x_percent, y_percent, font_size, color)`
- Build a visual editor in the CMS dashboard with draggable elements on top of the image
- On the landing page, render each price as a `position: absolute` element using the saved coordinates
- Use percentage-based positioning to handle different screen sizes

**Pros:**
- ✅ Client has full control over placement
- ✅ Can match the exact look of their custom menu images
- ✅ Most flexible for creative designs

**Cons:**
- ❌ **Very complex** to build (drag-and-drop editor, position persistence, responsive scaling)
- ❌ If the client changes the background image, all positions need to be redone
- ❌ Different screen sizes may shift the overlays
- ❌ Not recommended for a capstone timeline

**Effort:** High (8–15+ hours)

---

##### Current Recommendation

**Start with Approach A** — it's the cleanest solution and avoids the "image has old prices" problem entirely. The current product data already has everything needed (`name`, `category`, `price`, `sizes`). The existing sidebar price list (lines 131–136 in LandingPage.jsx) already does this — the task is to make it the **primary** display instead of a supplement to the images.

If the client is attached to their specific menu photo designs, do **Approach B** and ask them for new versions of the images with prices removed.

### CMS Best Practices to Keep in Mind

| Rule | Why |
|------|-----|
| **Always use `upsert`** for CMS writes | Prevents duplicate section_key errors |
| **Keep section_keys as slugs** | Use `hero`, `about`, `promo` — no spaces or special chars |
| **Store structured data as JSON in `description`** | Keeps the schema simple; parse on the frontend |
| **Validate image uploads server-side** | Check file type (`.jpg`, `.png`, `.webp`) and size (< 5MB) |
| **Add `updated_at` column** | So the owner knows when content was last changed |
| **Restrict CMS writes to Owner/Admin** | Don't let Staff edit the public site |
| **Image optimization** | Consider compressing uploads before storing |

---

## 6. Backend Conventions

### Layered Architecture

```
Routes → Controllers → Services → Supabase
```

- **Routes** (`server/routes/`) — Define HTTP endpoints, apply middleware, extract params
- **Controllers** (`server/controllers/`) — Business logic, audit logging, error handling
- **Services** (`server/services/`) — Pure database operations (Supabase queries)

> [!NOTE]
> Not all routes follow this pattern. Some older routes (like `products.js`, `sales.js`, `users.js`) have the logic directly in the route handler without a controller/service layer. This is fine for simpler endpoints but inconsistent. New features should follow the `Route → Controller → Service` pattern.

### API Endpoint Naming

```
GET    /api/{resource}              → List all
GET    /api/{resource}/:id          → Get one
POST   /api/{resource}              → Create
PUT    /api/{resource}/:id          → Update
DELETE /api/{resource}/:id          → Delete
PUT    /api/{resource}/:id/archive  → Soft delete
PUT    /api/{resource}/:id/restore  → Undo soft delete
POST   /api/{resource}/:id/receive  → Stock receive
```

### Authentication & Authorization

```javascript
// Public routes — no middleware
app.use('/api/auth', authRoutes);

// Protected routes — require valid user
app.use('/api/inventory', requireAuth, inventoryRoutes);

// Role-restricted actions — inside the route file
router.post('/', requireAuth, requireRole('Admin', 'Owner'), handler);
```

**Roles hierarchy:** `Owner > Admin > Staff`

- **Owner** — Full access, including transaction logs
- **Admin** — Full access except owner-only views
- **Staff** — POS, product viewing, raw material tracking, wastage reporting only

### Audit Logging

Every significant action should call `logAudit()`:

```javascript
import { logAudit } from '../utils/auditHelper.js';

// Always use req.user.id (NOT req.body.user_id) after authentication
await logAudit('ACTION_NAME', req.user.id, {
  // Relevant details as an object
  product_id: data.id,
  name: data.name,
  changed_by: req.user.name
});
```

**Important:** Use `req.user.id` from the authenticated middleware, not a `user_id` from the request body. The body value can be spoofed.

---

## 7. Frontend Conventions

### API Calls — Always Use `apiCall()`

```javascript
// ✅ CORRECT — uses centralized client
import { apiCall } from '../../api/client.js';
const data = await apiCall('/inventory/ingredients');

// ❌ WRONG — bypasses session headers and error handling
const res = await fetch('/api/inventory/ingredients');
```

The only exception is `loginUser()` in `authApi.js` which uses raw `fetch` because there's no session yet.

### State Management

- **No global state library** — each feature manages its own state with `useState` and `useEffect`
- **User session** — stored in `localStorage` as `"user"` (JSON stringified)
- **Navigation** — controlled by `activeTab` state in `Dashboard.jsx`

### Component Organization

```
src/features/{module}/
├── ModulePage.jsx          # Main page component
├── components/             # Sub-components used only in this module
│   ├── EditModal.jsx
│   └── FilterBar.jsx
└── hooks/                  # Custom hooks for this module
    └── useModuleData.js
```

### Common UI Patterns

**Modal pattern (used everywhere):**
```jsx
{showModal && (
  <div className="modal-overlay" onClick={() => setShowModal(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      {/* content */}
    </div>
  </div>
)}
```

**Table with search/filter:**
```jsx
const filtered = items.filter(item => 
  item.name.toLowerCase().includes(search.toLowerCase())
);
```

**Loading state:**
```jsx
if (loading) return <div className="text-center p-8 text-gray-500">Loading...</div>;
```

---

## 8. Database Schema Notes

> Verified against the live Supabase PostgreSQL instance (`14` active tables + `1` RPC function + `1` Storage bucket). See [supabase_schema.sql](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/database/supabase_schema.sql) for complete DDL definitions.

### Key Tables (14 Active Tables)

| # | Table | Purpose | Primary / Foreign Keys | Complete Columns |
|---|-------|---------|------------------------|------------------|
| 1 | `users` | System accounts, roles & single-session tracking | PK: `id` (uuid)<br>FK: `supplier_id` → `suppliers.id` | `id`, `name`, `username` (unique), `password_hash`, `role` (`Owner` \| `Admin` \| `Staff` \| `Supplier` \| `Custom`), `status` (`ACTIVE` \| `INACTIVE`), `supplier_id`, `permissions` (`text[]`), `custom_role_name`, `current_session_id`, `created_at` (`timestamptz`) |
| 2 | `products` | Menu catalog & direct-tracked products | PK: `id` (uuid) | `id`, `name`, `category`, `price` (`numeric`), `estimated_cost` (`numeric`), `description`, `image_url`, `track_stock` (`boolean`), `stock_quantity` (`numeric`), `low_stock_threshold` (`numeric`), `max_stock` (`numeric`), `sizes` (`jsonb`), `add_ons` (`jsonb`), `is_archived` (`boolean`), `created_at` (`timestamptz`) |
| 3 | `category_settings` | Default cup sizes & add-ons per category | PK: `category` (text) | `category`, `sizes` (`jsonb`), `add_ons` (`jsonb`) |
| 4 | `ingredients` | Raw materials & packaging inventory | PK: `id` (uuid) | `id`, `name`, `category`, `unit`, `stock_quantity` (`numeric`), `low_stock_alert` (`numeric`), `max_stock` (`numeric`), `unit_cost` (`numeric`), `purchase_unit`, `conversion_factor` (`numeric`), `cost_per_purchase_unit` (`numeric`), `image_url`, `is_archived` (`boolean`), `created_at` (`timestamptz`) |
| 5 | `recipes` | Product-to-ingredient recipe mappings | PK: `id` (uuid)<br>FK: `product_id` → `products.id`<br>FK: `ingredient_id` → `ingredients.id` | `id`, `product_id`, `ingredient_id`, `quantity_used` (`numeric`), `recipe_unit` |
| 6 | `sales` | POS transaction headers & billing details | PK: `id` (uuid)<br>FK: `staff_id` → `users.id` | `id`, `receipt_number`, `total_amount` (`numeric`), `discount_amount` (`numeric`), `tax_amount` (`numeric`), `payment_method` (`CASH` \| `GCASH`), `payment_status`, `status`, `amount_received` (`numeric`), `change_amount` (`numeric`), `transaction_reference`, `notes`, `staff_id`, `created_at` (`timestamptz`) |
| 7 | `sale_items` | Line items per POS transaction | PK: `id` (uuid)<br>FK: `sale_id` → `sales.id`<br>FK: `product_id` → `products.id` | `id`, `sale_id`, `product_id`, `quantity` (`numeric`), `unit_price` (`numeric`), `cup_size`, `add_ons` (`text[]`), `discount_percent` (`numeric`), `notes` |
| 8 | `suppliers` | Supplier directory & vendor contact profiles | PK: `id` (uuid) | `id`, `name`, `contact_info`, `contact_person`, `contact_number`, `email`, `address`, `description`, `created_at` (`timestamptz`) |
| 9 | `supplier_ingredients` | Supplier catalog, default packaging & pricing | PK: (`supplier_id`, `ingredient_id`)<br>FK: `supplier_id` → `suppliers.id`<br>FK: `ingredient_id` → `ingredients.id` | `supplier_id`, `ingredient_id`, `default_purchase_unit`, `default_conversion_factor` (`numeric`), `default_price` (`numeric`) |
| 10 | `purchase_orders` | Purchase order lifecycle headers | PK: `id` (uuid)<br>FK: `supplier_id` → `suppliers.id` | `id`, `supplier_id`, `status` (`PENDING` \| `ACCEPTED` \| `PROPOSED` \| `POSTPONED` \| `TO BE DELIVERED` \| `PARTIAL` \| `RECEIVED` \| `DECLINED` \| `CANCELLED`), `total_amount` (`numeric`), `expected_date`, `created_at` (`timestamptz`), `received_at` (`timestamptz`), `notes`, `decline_reason`, `cancellation_reason` |
| 11 | `purchase_order_items` | PO line items, conversions & partial receipts | PK: `id` (uuid)<br>FK: `purchase_order_id` → `purchase_orders.id`<br>FK: `ingredient_id` → `ingredients.id` | `id`, `purchase_order_id`, `ingredient_id`, `quantity` (`numeric`), `unit_price` (`numeric`), `subtotal` (`numeric`), `quantity_received` (`numeric`), `is_received` (`boolean`), `purchase_unit`, `conversion_factor` (`numeric`), `receipt_history` (`jsonb`) |
| 12 | `wastage` | Spoiled, expired & damaged ingredient logs | PK: `id` (uuid)<br>FK: `ingredient_id` → `ingredients.id`<br>FK: `reported_by` → `users.id` | `id`, `ingredient_id`, `quantity` (`numeric`), `reason`, `estimated_cost` (`numeric`), `reported_by`, `created_at` (`timestamptz`) |
| 13 | `audit_logs` | System audit trail & staff request records | PK: `id` (uuid)<br>FK: `user_id` → `users.id` | `id`, `action`, `action_type`, `entity_type`, `entity_id`, `user_id`, `details` (text/JSON), `new_value` (`jsonb`), `created_at` (`timestamptz`) |
| 14 | `cms_content` | Dynamic landing page & menu CMS sections | PK: `section_key` (text) | `section_key`, `title`, `description` (text/JSON), `image_url`, `updated_at` (`timestamptz`) |

### Stored Procedures (RPC) & Storage Buckets

- **Atomic POS Checkout RPC (`process_pos_checkout` — Drafted in SQL)** — Defined in [process_pos_checkout_rpc.sql](file:///d:/CODING%20THINGS/CAPSTONE%20PROJECT/INVENTORY-POS-PROJECT/InventoryProject/docs/database/process_pos_checkout_rpc.sql). Accepts `(p_sale_data, p_sale_items, p_product_deductions, p_ingredient_deductions)` inside a single PL/pgSQL transaction (`SECURITY DEFINER`) using `FOR UPDATE` row-level locks to verify and deduct tracked `products` and recipe `ingredients`, insert into `sales` and `sale_items`, and roll back on insufficient stock. *(Note: Not yet invoked by `posService.js`; planned for multi-terminal concurrency hardening with deterministic lock ordering and `REVOKE EXECUTE`.)*
- **Storage Bucket (`cms-images`)** — Public Supabase Storage bucket hosting uploaded product photos, raw material images, and CMS promotional banners.

### Important Schema Details

- **Soft Deletes & Retention Rules** — `products` and `ingredients` use `is_archived` boolean (and `users` uses `status = 'INACTIVE'`) rather than immediate hard `DELETE`. Permanent deletion looks up archive timestamps from `audit_logs` (`PRODUCT_ARCHIVED`, `RAW_MATERIAL_ARCHIVED`, `USER_STATUS_CHANGED`): `products`, `ingredients`, and non-Admin accounts require **30 days** elapsed with zero historical sales/PO/wastage/cashier references, **Admin** accounts require **90 days**, and the **Owner** account is permanently protected.
- **Dynamic Restock Thresholds** — Both `ingredients` and `products` support an optional `max_stock` capacity column. When `max_stock` is configured, restock alerts trigger when `stock_quantity <= (max_stock * 0.5)`; otherwise alerts fall back to `low_stock_alert` (`ingredients`) or `low_stock_threshold` (`products`).
- **Recipe-Based & Direct Stock Deductions** — During POS checkout, `posService.js` executes batched stock pre-checks (`Promise.all`) followed by parallel `sales`/`sale_items` writes and product/ingredient deductions with manual rollback compensation on error (`products.stock_quantity` for `track_stock = true` items; `ingredients.stock_quantity` via `recipes` for recipe-based beverages). Wiring `process_pos_checkout` RPC is the planned upgrade for concurrent terminals.
- **PO Unit Conversion & Partial Receiving** — `purchase_order_items` stores `purchase_unit` and `conversion_factor` (converting vendor packages like bags/sacks to inventory units like grams/milliliters upon receiving), alongside `quantity_received`, `is_received`, and a `receipt_history` JSONB array tracking partial deliveries.
- **Audit-Log Backed Staff Requests** — Staff requests (`requestsService.js`) fall back seamlessly to storing records inside `audit_logs` (`action = 'STAFF_REQUEST'`, `entity_type = 'REQUEST'`, structured payload in `new_value` and `details`) when no standalone `requests` table is present.
- **Timezone** — All timestamps are `timestamptz`; the app assumes **Asia/Manila (+08:00)** timezone.

---

## 9. Security Audit & Status

> Full security audit performed on **2026-09-24**. Found **3 critical, 4 high, 5 medium, 3 low** severity issues.
> **Update (2026-11-20):** Core items **C2, H1–H4, M1, M3, and M4** have since been resolved (see the live **Priority Action Plan & Current Status** table at the bottom of Section 9). The itemized descriptions below are kept for historical audit context.

### ✅ What's Already Done Well

| Area | Status |
|------|--------|
| Password hashing (bcrypt, 10 rounds) | ✅ Good |
| CORS whitelist for production domains | ✅ Good |
| `.env` excluded in `.gitignore` | ✅ Good |
| No `dangerouslySetInnerHTML` in React (XSS-safe) | ✅ Good |
| Role-based access on user management routes | ✅ Good |
| Audit trail for critical operations | ✅ Good |
| Account lockout mechanism (3 attempts, 5 min) | ✅ Good |
| No plaintext password fallback | ✅ Good |
| `password_hash` stripped from login response | ✅ Good |

### 🔴 CRITICAL Issues

#### C1. Secrets Committed to Git History

The `.env` file containing Supabase keys, database password, and service role key was committed in the initial push (`b64955f`). Even though `.gitignore` now excludes `.env`, the secrets are **permanently in git history**.

**Exposed:** `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` with password, `VITE_SUPABASE_ANON_KEY`

**Files:** `InventoryProject/.env`, `server/.env`

**Fix:**
1. **Rotate all secrets** in Supabase dashboard (Project Settings → API → regenerate service_role key, Database → change password)
2. Remove from git history:
   ```bash
   # Using BFG Repo Cleaner (https://rtyley.github.io/bfg-repo-cleaner/)
   bfg --delete-files .env
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force
   ```
3. Update `.env` files locally and on cPanel with new keys

#### C2. Broken Authentication — User ID Spoofing

Authentication relies on the client sending an `x-user-id` header. **Any user can impersonate another** by setting this header to a different UUID. There is no server-side session or token verification.

**File:** `server/middleware/authMiddleware.js` (line 10)

```javascript
// Current — trusts whatever the client sends:
const userId = req.headers['x-user-id'] || req.body?.user_id || req.body?.staff_id;
```

**Impact:** An attacker can access any protected endpoint as any user, perform admin actions by knowing an admin's UUID, view/modify/delete any data.

**Fix — JWT-based sessions (recommended):**
```javascript
// 1. Install: npm install jsonwebtoken
// 2. On login success, sign a JWT:
import jwt from 'jsonwebtoken';
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);
res.json({ token, ...userWithoutPassword });

// 3. In authMiddleware, verify the JWT:
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// Then look up user from decoded.userId

// 4. Frontend: store token, send as Authorization: Bearer <token>
```

**Alternative — Session cookies (simpler):**
```javascript
import session from 'express-session';
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 }
}));
```

#### C3. Service Role Key Bypasses All RLS

The server-side Supabase client uses the **service role key**, which bypasses all Row Level Security policies. The RLS policies in `supabase_schema.sql` are effectively useless.

**File:** `server/config/supabaseClient.js` (line 24–30)

**Impact:** Combined with C2, attackers have unrestricted database access through any API endpoint.

**Fix:** Keep using service role key for backend operations, but **fix authentication first (C2)**. The middleware-based auth (`requireAuth`, `requireRole`) is your real access control layer. Optionally, create a second Supabase client with the anon key for user-context queries as defense-in-depth.

### 🟠 HIGH Issues

#### H1. No Security Headers (Missing Helmet)

Express sends **no security headers**, leaving the app vulnerable to clickjacking, MIME-type sniffing, and other browser-level attacks.

**File:** `server/server.js`

**Fix:**
```bash
cd InventoryProject/server && npm install helmet
```
```javascript
// In server.js, near the top after creating the app:
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.supabase.co"],
      connectSrc: ["'self'", "https://*.supabase.co"],
    }
  }
}));
```

#### H2. Rate Limiters Defined But Never Applied

`server/middleware/rateLimiter.js` has 5 well-designed limiters (`generalLimiter`, `authLimiter`, `userManagementLimiter`, `looseLimiter`, `createLimiter`) but **none are imported or used anywhere**.

**Impact:** Login endpoint and all API routes have zero rate limiting — vulnerable to brute force and DoS.

**Fix — Wire them up in `server/server.js`:**
```javascript
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';

// Apply general limiter to all API routes
app.use('/api', generalLimiter);

// Apply strict limiter to auth routes (before the route handler)
app.use('/api/auth', authLimiter);
```

#### H3. No JSON Body Size Limit

`express.json()` has no size limit, allowing attackers to send huge payloads to exhaust memory.

**File:** `server/server.js` (line 52)

**Fix:**
```javascript
// Replace:  app.use(express.json());
// With:
app.use(express.json({ limit: '1mb' }));
```

#### H4. Raw Error Messages Leaked to Clients

Every catch block (~50+ instances across all routes/controllers) sends `err.message` directly to the client. This can reveal database schema details, Supabase internal errors, and stack traces.

**Fix — Centralized error handler:**
```javascript
// server/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred'
    : err.message;
  res.status(err.status || 500).json({ error: message });
};

// In server.js, add AFTER all routes:
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);
```

### 🟡 MEDIUM Issues

#### M1. CMS Routes Have No Role Restriction

The CMS update endpoint requires authentication but **any authenticated user** (including Staff) can modify CMS content.

**File:** `server/routes/cms.js` (line 8)

**Fix:**
```javascript
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
router.put("/:section_key", requireAuth, requireRole('Admin', 'Owner'), cmsController.updateCmsContent);
```

#### M2. In-Memory Lockout Store Won't Scale

Account lockout in `server/routes/auth.js` uses `loginAttempts = {}` (a plain JS object).

**Problems:** Server restart clears all lockouts (attacker just waits for deploy), not shared across instances, entries never cleaned up (memory leak).

**Fix:** Store lockout state in Supabase (a `login_attempts` table) or add periodic cleanup of stale entries.

#### M3. Frontend "Security" Measures Are Security Theater

The DevTools-blocking code in `src/main.jsx` (lines 26–58) — disabling right-click, F12, Ctrl+U, the `debugger` loop — provides **zero actual security**. The `debugger` loop runs every 100ms and wastes CPU for all users. Disabling text selection harms accessibility.

**Fix:** Remove these measures entirely. Real security comes from the server side.

#### M4. Audit Logging Accepts Client-Provided `user_id`

Many controllers trust `user_id` from `req.body` for audit logging instead of using the authenticated `req.user.id`. A malicious user can frame another user in the audit trail.

**Affected files:** `server/routes/products.js`, `server/controllers/inventoryController.js`, `server/controllers/purchasingController.js`, `server/controllers/cmsController.js`

**Fix:**
```javascript
// Replace all instances of:
await logAudit('ACTION', user_id || null, { ... });
// With:
await logAudit('ACTION', req.user.id, { ... });
```

#### M5. Missing Input Validation / Sanitization

Most endpoints accept user input and pass it directly to Supabase without validation. No checks for string lengths, numeric ranges (prices could be negative), or expected data formats.

**Fix:**
```bash
cd InventoryProject/server && npm install express-validator
```
```javascript
import { body, validationResult } from 'express-validator';

router.post('/', [
  body('name').isString().trim().isLength({ min: 1, max: 200 }),
  body('price').isFloat({ min: 0 }),
  body('category').isString().trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  // ... handler
});
```

### 🟢 LOW Issues

#### L1. `dist.zip` in Repository

`InventoryProject/dist.zip` (3.3MB) is tracked. Build artifacts shouldn't be committed. Add `*.zip` to `.gitignore`.

#### L2. CORS Allows `null` Origin

CORS config allows requests with no `origin` header (`if (!origin || ...)`), permitting requests from sandboxed iframes and local file:// pages.

**File:** `server/server.js` (line 43)

**Fix:**
```javascript
if (process.env.NODE_ENV !== 'production' && !origin) {
  callback(null, true);
} else if (allowedOrigins.includes(origin)) {
  callback(null, true);
} else {
  callback(new Error('Not allowed by CORS'));
}
```

#### L3. Login Response Leaks `attemptsLeft` Count

The login endpoint tells the attacker exactly how many attempts remain before lockout, making it easier to time brute-force attacks.

**File:** `server/routes/auth.js` (line 78)

**Fix:** Return the same generic error message regardless of remaining attempts.

### Priority Action Plan & Current Status (Updated 2026-11-18)

| Priority | Issue | Status | Notes |
|----------|-------|--------|-------|
| 🔴 **Now** | C1 — Rotate secrets & clean history | ⚠️ **Manual** | `.env` is gitignored now; historical commit `b64955f` still warrants Supabase key rotation if not rotated yet |
| 🔴 **Now** | C2 — Replace x-user-id with JWT | ✅ **Resolved** | `jsonwebtoken` + `requireAuth` + single-session `sid` implemented; hardcoded fallback secret removed |
| 🟠 **This week** | H2 — Enable rate limiters | ✅ **Resolved** | `generalLimiter`, `looseLimiter`, `createLimiter` wired in `server.js`; `authLimiter` wired on `POST /api/auth/login` |
| 🟠 **This week** | H1 — Add Helmet | ✅ **Resolved** | `helmet` configured in `server/server.js` |
| 🟠 **This week** | H3 — Body size limit | ✅ **Resolved** | `express.json({ limit: '10mb' })` configured in `server/server.js` (supports CMS image uploads) |
| 🟠 **This week** | H4 — Centralized error handler | ✅ **Resolved** | 4-parameter Express error handler in `server/server.js` hides stack traces in production |
| 🟡 **Soon** | M1 — CMS role restriction | ✅ **Resolved** | `requireRole("Admin", "Owner")` applied to `POST /upload-image` and `PUT /:section_key` in `server/routes/cms.js` |
| 🟡 **Soon** | M4 — Fix audit user_id | ✅ **Resolved** | Controllers & routes strictly use `req.user.id`; `POST /api/audit` restricted to Admin/Owner |
| 🟡 **Soon** | M5 — Input validation | ⚠️ **Open** | Partial manual checks exist; consider `express-validator` / `zod` across write endpoints |
| 🟡 **Later** | M3 — Remove debugger tricks | ✅ **Resolved** | DevTools blocking & `debugger` loop removed from `src/main.jsx` |
| 🟢 **Nice to have** | M2 — Persist lockout to DB | ⚠️ **Open** | `loginAttempts` in `server/routes/auth.js` is still in-memory |
| 🟢 **Low** | L2 — CORS strictness | ⚠️ **Open** | `server/server.js` currently has a permissive fallback callback (`return callback(null, true)`) |

---

## 10. Known Technical Debt

### Code Quality

| Issue | Location | Priority |
|-------|----------|----------|
| Mixed CSS + Tailwind styling | Whole frontend | Low — refactor gradually |
| Some routes skip controller/service layers | `products.js`, `sales.js`, `users.js` | Low — works fine as-is |
| Large component files (remaining >500-line modules) | `src/features/` | Low — major monoliths (`DemandForecasting`, `SalesReceiptJournal`, `CMSDashboard`, `ManageProducts`, `StockMovementReport`, `LandingPage`, `SupplierPortal`) refactored into `hooks/` & `components/` |
| Duplicated date formatting logic | `dateUtils.js` exists in both `src/utils/` and `server/utils/` | Low |
| No TypeScript | Whole project | Low — would help but not required |
| Frontend Supabase client used for image uploads | `CMSDashboard.jsx` | Low — works fine, anon key is safe for this |
| Hardcoded Category Filters | `Products.jsx:44-45` | Medium — Rigid "PASTRIES" vs "PASTRY" |
| Missing `useEffect` Dependencies | Multiple components | Low — review selectively |

### Architecture

| Issue | Notes |
|-------|-------|
| **React Error Boundaries** | ✅ Implemented via `ErrorBoundary` in `App.jsx` and `Dashboard.jsx` |
| **Loading skeleton components** | ✅ Implemented via `SkeletonLoader.jsx` across core tables & cards |
| **JWT auth with single-session tracking** | ✅ Implemented (`authMiddleware.js`, `routes/auth.js`, 8h expiry + 2h inactivity timeout) |
| **Pagination** | ✅ Implemented via shared `Pagination.jsx` across tables and lists |

---

## 11. Future Task Backlog

### High Priority

- [x] **Implement JWT authentication** — Replaced `x-user-id` header with signed tokens & removed fallback secret
- [x] **Wire up rate limiters** — Applied in `server.js` and `routes/auth.js`
- [x] **Add Helmet security headers** — Configured in `server.js`
- [ ] **Rotate Supabase secrets** — Keys were committed in initial git push (`b64955f`)

### Medium Priority

- [ ] **Expand CMS** — Add more editable sections (about, hours, promos, socials)
- [ ] **CMS live preview** — Show landing page preview while editing
- [ ] **CMS promo toggle** — `is_active` column to enable/disable sections
- [x] **Role-restrict CMS route** — `requireRole('Admin', 'Owner')` applied to CMS write endpoints
- [x] **Centralized error handler** — Implemented in `server/server.js`
- [ ] **Input validation** — Add `express-validator` or `zod` for request body validation
- [x] **Fix audit logging** — Strictly uses `req.user.id` instead of `req.body.user_id`
- [x] **Fix PO Receiving Logic** — Fixed in `ReceivePOModal.jsx`
- [ ] **Fix React `useEffect` Warnings** — Remaining `exhaustive-deps` warnings in select components
- [ ] **Remove Hardcoded Categories** — Fix "PASTRIES" workaround in `Products.jsx` filter logic

### Low Priority / Polish

- [x] **Refactor large components** — Refactored `DemandForecasting.jsx`, `CMSDashboard.jsx`, `ManageProducts.jsx`, `SupplierPortal.jsx`, `LandingPage.jsx`, `SalesReceiptJournal.jsx`, and `StockMovementReport.jsx` into modular `hooks/` and `components/`
- [x] **Add loading skeletons** — Implemented in `SkeletonLoader.jsx`
- [x] **Remove DevTools blocking** — Removed from `src/main.jsx`
- [ ] **Add `updated_at` to CMS** — So owner knows when content was last changed
- [ ] **Gradually migrate to Tailwind** — Refactor CSS-class pages when modifying them
- [x] **Add React Error Boundary** — Implemented in `App.jsx` and `Dashboard.jsx`
- [ ] **Image upload validation** — Check file type and size before uploading to Supabase
- [x] **Handle API Failures in UI** — Added error & retry state in `Products.jsx`
- [x] **Cleanup Unused Variables & Hooks Rules** — Cleaned up unused variables, `no-empty` blocks, `WastageReport` export bug, and conditional hooks in `ManageProducts` / `TransactionLogs`

---

## 12. Deployment Checklist

When deploying updates to cPanel:

### Frontend Changes Only

1. Run `npm run build` in the `InventoryProject` folder
2. Upload the new `/dist` folder to cPanel (replace the old one)
3. No restart needed — static files are served directly

### Backend Changes

1. Upload changed files inside `/server/` to cPanel
2. **Restart the Node.js App** inside cPanel's "Setup Node.js App"
3. Check the app is running via your domain

### Full Deployment

1. `npm run build` for the frontend
2. Upload `/dist` folder + any changed `/server/` files
3. Restart the Node.js App in cPanel
4. Verify the site loads and API endpoints respond

### What NOT to Upload

- `/node_modules/` — install on server with `npm install`
- `/src/` — only the built `/dist` is needed
- `.env` — should already be on the server, never overwrite blindly
- `.git/` — no need for version control files on the server

---

## Notes for AI Agents

> If you are an AI agent continuing work on this project, please follow these rules:

1. **Read `docs/CHANGELOG.md`** before making changes to understand recent updates
2. **Read `.agents/rules/AGENTS.md`** for project rules (apiCall, CSS, secrets, deployment)
3. **Use `apiCall()` from `src/api/client.js`** for all frontend API requests
4. **Match the styling approach** of the file you're editing (CSS classes vs Tailwind)
5. **Follow the Route → Controller → Service pattern** for new backend features
6. **Update `docs/CHANGELOG.md`** after completing any task
7. **Never hardcode secrets** — always use `process.env`
8. **Use `req.user.id`** for audit logs, not `req.body.user_id`
9. **The Navbar uses a tab-based system**, not React Router, for dashboard sub-pages
10. **Check this file's "Known Technical Debt" section** to avoid repeating known issues
