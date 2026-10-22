# Changelog

## 2026-10-23
- **Fixed `.gitignore` before test deployment:** Added a root `.gitignore` (root `node_modules/` was being tracked). `InventoryProject/.gitignore` now ignores `node_modules/`, `dist/` at any depth (incl. `server/`).
- **Untracked from git (kept locally):** root `node_modules/`, `InventoryProject/.env`, `config.zip`, `dist.zip`.
- **Prepared for Render deployment:** Added `helmet`, `express-rate-limit`, and `jsonwebtoken` to `InventoryProject/package.json` so single-service deployments on Render build and start cleanly without missing dependencies.
- **Fixed Render build failure (`vite: not found`):** Moved `vite`, `@vitejs/plugin-react`, and `tailwindcss` from `devDependencies` to `dependencies` in `InventoryProject/package.json` so `npm install` installs them even in production mode.
- **Fixed Linux build error (`LOC_PIC.png` case mismatch):** Changed image imports in `LandingPage.jsx` and `LoginPage.jsx` from `loc_pic.png` to uppercase `LOC_PIC.png` to match Linux case-sensitive file systems. Added `vercel.json` for client-side routing.
