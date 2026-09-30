import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import { seedDatabase } from './seedData.js';

import authRoutes, { migratePins } from './routes/auth.js';
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

// ---------------------------------------------------------------------------
// Resilient one-time DB initialization.
// A transient Turso connectivity blip must NOT crash the whole (serverless)
// function at module load — that turns every endpoint, including login/setup,
// into an empty HTTP 500. Instead we attempt init lazily and let requests
// retry until it succeeds, returning a clean JSON 503 in the meantime.
// ---------------------------------------------------------------------------
let dbReady = false;
function ensureDbReady() {
  if (dbReady) return true;
  try {
    initDb();
    seedDatabase();
    migratePins(); // strip any plaintext PINs, backfill secure hashes
    dbReady = true;
    return true;
  } catch (e) {
    console.error('Database initialization failed (will retry on next request):', e.message);
    return false;
  }
}

// Warm up the DB in the background so the first request is fast when the DB is
// reachable. Deferred so it NEVER blocks server startup / the health check —
// requests lazily (re)initialize via the guard middleware below if needed.
setImmediate(() => { try { ensureDbReady(); } catch (e) {} });

// API Health Check (never requires the DB).
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbReady, message: 'Celler POS API Engine is running cleanly.' });
});

// Gate all data/auth routes on the DB being ready; self-heals on later requests.
app.use('/api', (_req, res, next) => {
  if (ensureDbReady()) return next();
  return res.status(503).json({ error: 'Database is temporarily unreachable. Please try again in a moment.' });
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

// Catch-all JSON error handler: guarantees every failed /api request returns a
// parseable JSON body (never an empty 500 or an HTML error page), so the client
// can always show a meaningful message.
app.use('/api', (err, _req, res, next) => {
  console.error('Unhandled API error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  const msg = (err && err.message) ? err.message : 'Unexpected server error.';
  const isDbIssue = /turso|database|fetch failed|network/i.test(msg);
  res.status(isDbIssue ? 503 : 500).json({
    error: isDbIssue ? 'Database is temporarily unreachable. Please try again in a moment.' : msg
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Celler POS Backend Express Server listening on http://localhost:${PORT}`);
  });
}

export default app;

