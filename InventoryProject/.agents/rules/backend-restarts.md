# Backend Server Restarts

Whenever modifying backend server code (e.g., Express routes, controllers, or services) for a project:
1. Always check the active terminal commands in your metadata.
2. If a backend server is actively running (e.g., `npm run start` or `node server.js`) and it does NOT use a hot-reloading tool like `nodemon`, the changes will not take effect automatically.
3. You MUST explicitly instruct the user to stop (Ctrl + C) and restart their backend server before asking them to test the new changes. 
4. Never assume the user knows to restart the server themselves.
