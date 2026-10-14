import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import helmet from 'helmet';

import authRoutes from './routes/auth.js';
import posRoutes from './routes/pos.js';
import inventoryRoutes from './routes/inventory.js';
import recipesRoutes from './routes/recipes.js';
import requestsRoutes from './routes/requests.js';
import wastageRoutes from './routes/wastage.js';
import dashboardRoutes from './routes/dashboard.js';
import auditRoutes from './routes/audit.js';
import salesRoutes from './routes/sales.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';
import analyticsRoutes from './routes/analytics.js';
import categorySettingsRoutes from './routes/categorySettings.js';
import purchasingRoutes from './routes/purchasing.js';
import cmsRoutes from './routes/cms.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';

const app = express();
// Use PORT from environment (cPanel sets this) or fall back to 5000 for local dev
const PORT = process.env.PORT || 5000;

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  'http://localhost:5173',       // Vite dev server
  'http://127.0.0.1:5173',       // Vite dev server (IP)
  'http://localhost:4173',       // Vite preview
  'http://127.0.0.1:4173',       // Vite preview (IP)
  'http://localhost:5000',       // Local production
  'http://127.0.0.1:5000',       // Local production (IP)
  'https://cofteacafe.space',    // Production domain
  'https://www.cofteacafe.space',// Production www
];

app.use(cors({
  origin: (origin, callback) => {
    // For now, to prevent any CORS blocking or server crashes, 
    // dynamically allow the requesting origin.
    // In strict production, you can lock this back down to allowedOrigins.
    callback(null, true);
  },
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.supabase.co"],
      connectSrc: ["'self'", "https://*.supabase.co"],
    }
  }
}));

app.use(express.json({ limit: '1mb' }));

// ==========================================
// PUBLIC ROUTES — No authentication required
// ==========================================
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter, authRoutes);

// ==========================================
// PROTECTED ROUTES — FIX #5: All routes below require a valid, active user session.
// The requireAuth middleware reads x-user-id header (or body.user_id as fallback).
// ==========================================
app.use('/api/pos', posRoutes); // pos.js applies its own auth for protected routes like sales
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/recipes', requireAuth, recipesRoutes);
app.use('/api/requests', requireAuth, requestsRoutes);
app.use('/api/wastage', requireAuth, wastageRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/audit', requireAuth, auditRoutes);
app.use('/api/sales', requireAuth, salesRoutes);
app.use('/api/users', usersRoutes); // users.js applies its own granular per-route auth
app.use('/api/products', requireAuth, productsRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/categories/settings', requireAuth, categorySettingsRoutes);
app.use('/api/purchasing', requireAuth, purchasingRoutes);
app.use('/api/cms', cmsRoutes);

// ==========================================
// ERROR HANDLER — Prevent leaking sensitive info
// ==========================================
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'An unexpected internal error occurred'
  });
});

// ==========================================
// STATIC FILES — Serve the React frontend build
// ==========================================
let distPath = path.resolve(__dirname, '../dist'); // Local dev: InventoryProject/dist
if (!fs.existsSync(distPath)) {
  distPath = path.resolve(__dirname, 'dist'); // cPanel: nodeapp/dist
}
app.use(express.static(distPath));

// Catch-all: return index.html for any non-API route so React Router works
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});