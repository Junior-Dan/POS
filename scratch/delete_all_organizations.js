import { db, initDb } from '../server/db.js';

try {
  initDb();
  console.log("Database initialized. Clearing all organizations and associated tenant data...");

  const tables = [
    'organizations', 'users', 'branches', 'products', 'suppliers',
    'customers', 'shifts', 'sales', 'sale_items', 'stock_movements',
    'cash_movements', 'purchases', 'purchase_items', 'expenses',
    'audit_logs', 'payments', 'categories', 'sessions', 'settings'
  ];

  for (const t of tables) {
    try {
      db.prepare(`DELETE FROM ${t}`).run();
      console.log(`Cleared table: ${t}`);
    } catch (e) {
      console.warn(`Notice clearing ${t}: ${e.message}`);
    }
  }

  console.log("SUCCESS: All organizations and database tables have been completely cleared!");
} catch (err) {
  console.error("Error deleting organizations:", err);
  process.exit(1);
}
