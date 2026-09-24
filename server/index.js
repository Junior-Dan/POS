import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import { seedDatabase } from './seedData.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import shiftRoutes from './routes/shift.js';
import inventoryRoutes from './routes/inventory.js';
import purchaseRoutes from './routes/purchases.js';
import supplierRoutes from './routes/suppliers.js';
import customerRoutes from './routes/customers.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import settingRoutes from './routes/settings.js';
import auditRoutes from './routes/audit.js';
import seedRoutes from './routes/seed.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;


app.use(cors());
app.use(express.json());

// Initialize DB schema & Seed clean data if needed
initDb();
seedDatabase();

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cellar POS API Engine is running cleanly.' });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/shift', shiftRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/seed', seedRoutes);

app.listen(PORT, () => {
  console.log(`Cellar POS Backend Express Server listening on http://localhost:${PORT}`);
});

// Keepalive interval for Node process
setInterval(() => {}, 60000);

