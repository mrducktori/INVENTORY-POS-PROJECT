# Changelog

## 2026-10-23
- **Fixed `.gitignore` before test deployment:** Added a root `.gitignore` (root `node_modules/` was being tracked). `InventoryProject/.gitignore` now ignores `node_modules/`, `dist/` at any depth (incl. `server/`).
- **Untracked from git (kept locally):** root `node_modules/`, `InventoryProject/.env`, `config.zip`, `dist.zip`.
- **Prepared for Render deployment:** Added `helmet`, `express-rate-limit`, and `jsonwebtoken` to `InventoryProject/package.json` so single-service deployments on Render build and start cleanly without missing dependencies.
- **Verified Vite production build:** Ran `npm run build` locally to verify client bundle builds without errors.
