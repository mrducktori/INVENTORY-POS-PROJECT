# Changelog

All notable changes to this project will be documented in this file.

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
