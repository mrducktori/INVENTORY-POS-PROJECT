import express from 'express';
import cors from 'cors';
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
import { requireAuth } from './middleware/authMiddleware.js';

const app = express();
const PORT = 5000;

// FIX #15: Restrict CORS to only the local Vite dev server and same-origin production.
// Adjust the origin list if your frontend runs on a different port.
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // Vite preview
  'http://localhost:5000', // Same-origin production
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ==========================================
// PUBLIC ROUTES — No authentication required
// ==========================================
app.use('/api/auth', authRoutes);

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

app.get('/', (req, res) => {
  res.send('POS & Inventory System API');
});

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});