# Weekly Development Progress Report
**Date:** September 25, 2026

This document summarizes the major features, fixes, and architectural improvements implemented this week across the application.

## 1. Purchase Order (PO) & Inventory Management
* **Centralized PO Defaults:** Moved `purchase_unit`, `conversion_factor`, and `cost_per_purchase_unit` directly to the Ingredient records. POs now auto-fill defaults regardless of which supplier is selected.
* **Database Migration:** Successfully migrated all 64 ingredients to use the new centralized defaults model.
* **Edit Modal Improvements:** Added a dedicated "Purchase Order Defaults" section to the Raw Materials edit modal, allowing direct editing of PO defaults.
* **UI/UX Cleanup:** Removed the inline manual stock receiving widget from the Manage Products list. Products that track stock now enforce restocking strictly via the Supplier PO flow.
* **Visual Clarity:** Added a clear dash separator (`-`) between quantity and purchase unit text in the Purchase Orders table (e.g., `1 - 750ml Bottle`).

## 2. Audit Logging & System Tracking
* **PO Audit Integration:** Restocking through the PO flow now correctly generates individual `RAW_MATERIAL_STOCK_RECEIVED` audit logs for each item received.
* **Stock Movement Reports:** Because of the new audit integration, PO receives now accurately display in the Stock Movement analytics reports.
* **Transaction Logs Upgrade:** Added a dedicated "Purchase Orders" filter category to the Transaction Logs with custom badges. PO creation and status updates are now tracked and displayed.

## 3. UI/UX Refinements (Friction Reduction)
* **Card Interactivity:** Removed accidental whole-card clicks on the POS, Manage Products, and Manage Raw Materials pages. Now, only the specific buttons (Edit, Add, Info) trigger modals, preventing accidental repetitive actions.
* **CMS Auto-Save:** Optimized the CMS Dashboard image uploads. Replaced text URLs with real-time visual previews and added auto-saving upon image upload, removing the need for an extra "Save" click.
* **CMS Context:** Added an informational banner in the CMS Dashboard guiding users to the "Manage Products" tab to update landing page menu pictures and prices.
* **Landing Page:** Removed the discreet sign-in lock icon from the public landing page. Staff login is now accessed manually via `/coftealoginpageforstaff`.
* **Menu Images:** Added image upload capabilities directly to `ManageProducts.jsx` and added small thumbnail previews to the product list table.
* **Cart Price Sync Fix:** Fixed a bug where Add-on prices were excluded when recalculating cart totals. The system now injects category-level sizes and add-ons before recalculating.

## 4. Backend & Security Updates
* **Duplicate Username Handling:** Replaced raw database constraint errors (`users_username_key`) with user-friendly "This username is already taken" messages when creating or editing accounts.
* **Storage Policies:** Fixed a database configuration issue by applying correct Row Level Security (RLS) policies to the `cms-images` Supabase storage bucket, enabling anonymous image uploads.

## 5. Agent Rules & Documentation
* **Agent Guidelines Expanded:** Expanded the `.agents/rules/AGENTS.md` file from 6 to 15 strict project rules covering backend architecture, soft deletes, audit logging (`req.user.id`), and tab-based navigation patterns.
* **Menu Pricing Documentation:** Documented three distinct approaches for the "Dynamic Pricing on Menu Board Images" feature requested by the advisor in `docs/PROJECT_REFERENCE.md`.
* **File Cleanup:** Relocated temporary AI database seeding files into `docs/database/` to comply with strict repository standards.
