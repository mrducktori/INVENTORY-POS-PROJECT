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

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/wastage', wastageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);

app.get('/', (req, res) => {
  res.send('POS & Inventory System API');
});

app.listen(PORT, () => {
  // Server started
});