# Project Rules

## 1. Maintain a Changelog
Whenever you complete a task or make significant changes to the codebase, you MUST update the `docs/CHANGELOG.md` file. 
- Briefly summarize what was added, changed, or fixed.
- Keep the explanations concise to save tokens and provide a clear history of the project for the user.

## 2. API Calling Standards
Whenever making frontend requests to the backend, you MUST use the centralized `apiCall` function from `src/api/client.js` instead of using standard `fetch()`. This ensures session headers and error handling are always consistent.

## 3. Styling & UI Guidelines
All new UI components must match the premium aesthetic. Use external CSS files instead of inline styles. Prefer modern CSS (Flexbox/Grid) and maintain the glassmorphism theme used in the Login and POS screens. DO NOT use plain generic colors.

## 4. Database & Secrets
Never hardcode sensitive information (like Supabase URLs or keys) in the source code. Always use `process.env` and require them to be set in the `.env` file.

## 5. Security Best Practices
Before modifying anything that could cause data loss or expose secrets, pause and ask the user for explicit confirmation. Never upload `.env` or log files to the repository.

## 6. Website Deployment / cPanel Updates
When guiding the user to deploy updates to the cPanel hosting environment:
- **Build Frontend**: Remind the user to run `npm run build` in the `InventoryProject` folder to generate the latest `/dist` folder.
- **Upload Assets**: Remind the user they only need to upload specific changed backend files (e.g., inside `/server/`) and the new `/dist` folder to cPanel. They do NOT need to upload the raw `/src/` files or `/node_modules/` again.
- **Restart App**: Remind the user to Restart their Node.js App inside cPanel after uploading any backend files (`/server/`).
