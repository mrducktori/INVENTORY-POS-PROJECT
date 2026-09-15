# Changelog

All notable changes to this project will be documented in this file.

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
