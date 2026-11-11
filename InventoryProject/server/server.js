import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root or server folder if available (for local dev)
const envPaths = [
  path.resolve(__dirname, '../../.env'), // Root of repository
  path.resolve(__dirname, '../.env'),    // InventoryProject/.env
  path.resolve(__dirname, '.env')        // server/.env
];
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) break;
}

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
import { generalLimiter, authLimiter, looseLimiter, createLimiter } from './middleware/rateLimiter.js';

const app = express();

// Trust reverse proxy (Render, Vercel, cPanel, Cloudflare) for accurate client IP in rate limiting & logs
app.set('trust proxy', 1);

// Use PORT from environment (Render / cPanel sets this) or fall back to 5000 for local dev
const PORT = process.env.PORT || 5000;

// Configure CORS for decoupled architecture (Frontend on Vercel, Backend on Render)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  'http://localhost:5173',       // Vite dev server
  'http://127.0.0.1:5173',       // Vite dev server (IP)
  'http://localhost:4173',       // Vite preview
  'http://127.0.0.1:4173',       // Vite preview (IP)
  'http://localhost:5000',       // Local production
  'http://127.0.0.1:5000',       // Local production (IP)
  'https://cofteacafe.space',    // Production domain
  'https://www.cofteacafe.space',// Production www
];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, Postman, server-to-server, Render health checks)
    if (!origin) return callback(null, true);

    // Allow explicitly configured origins
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow any Vercel deployment preview / production URL (*.vercel.app)
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }
    } catch {
      // In case URL parsing fails
    }

    // In local development or if CORS_ALLOW_ALL is set, allow all
    if (process.env.NODE_ENV !== 'production' || process.env.CORS_ALLOW_ALL === 'true') {
      return callback(null, true);
    }

    // Default permissive callback so newly deployed frontends are not blocked by default
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
};

app.use(cors(corsOptions));
// Note: In Express 5, cors() middleware automatically responds to preflight OPTIONS requests.
// Regex pattern is used for explicit options handler to comply with Express 5 path-to-regexp.
app.options(/.*/, cors(corsOptions));

// Security headers with cross-origin support for APIs
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: '10mb' }));

// ==========================================
// HEALTH CHECKS — Used by Render & monitoring
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'coftea-backend', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'coftea-backend', timestamp: new Date().toISOString() });
});

// ==========================================
// PUBLIC ROUTES — No authentication required
// ==========================================
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter, authRoutes);

// ==========================================
// PROTECTED ROUTES
// ==========================================
app.use('/api/pos', looseLimiter, posRoutes); // pos.js applies its own auth for protected routes like sales
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/recipes', requireAuth, recipesRoutes);
app.use('/api/requests', requireAuth, createLimiter, requestsRoutes);
app.use('/api/wastage', requireAuth, createLimiter, wastageRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/audit', requireAuth, auditRoutes);
app.use('/api/sales', requireAuth, salesRoutes);
app.use('/api/users', usersRoutes); // users.js applies its own granular per-route auth
app.use('/api/products', requireAuth, productsRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/categories/settings', requireAuth, categorySettingsRoutes);
app.use('/api/purchasing', requireAuth, purchasingRoutes);
app.use('/api/purchase-orders', requireAuth, purchasingRoutes);
app.use('/purchase-orders', requireAuth, purchasingRoutes);
app.use('/api/cms', looseLimiter, cmsRoutes);

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
// STATIC FILES & SPA FALLBACK (or Headless API)
// ==========================================
// In monolithic mode (e.g. cPanel or local build), dist/ exists.
// In decoupled mode (Render backend only), dist/ does not exist.
let distPath = path.resolve(__dirname, '../dist'); // Local dev: InventoryProject/dist
if (!fs.existsSync(distPath)) {
  distPath = path.resolve(__dirname, 'dist'); // cPanel: nodeapp/dist
}

const indexPath = path.join(distPath, 'index.html');
if (fs.existsSync(indexPath)) {
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // Vite asset filenames are content-hashed and safe to cache aggressively
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    })
  );
  // Catch-all: return index.html for any non-API route so React Router works
  app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexPath);
  });
} else {
  // Headless API mode (Render): provide friendly root response and 404 handler
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      name: 'CofTea Cafe API',
      message: 'Backend server is running on Render.',
      timestamp: new Date().toISOString()
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });
}

const server = app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server Error] Port ${PORT} is already in use by another process.`);
  } else {
    console.error('[Server Error]', err);
  }
});
