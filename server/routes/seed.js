import express from 'express';
import { db } from '../db.js';
import { seedDatabase } from '../seedData.js';

const router = express.Router();

// POST trigger re-seeding
router.post('/reset', (req, res) => {
  try {
    db.exec(`
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM stock_movements;
      DELETE FROM cash_movements;
      DELETE FROM purchase_items;
      DELETE FROM purchases;
      DELETE FROM expenses;
      DELETE FROM shifts;
      DELETE FROM products;
      DELETE FROM suppliers;
      DELETE FROM customers;
      DELETE FROM users;
      DELETE FROM categories;
      DELETE FROM audit_logs;
      DELETE FROM settings;
    `);

    seedDatabase();

    res.json({ success: true, message: "Database re-seeded with clean initial dataset." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
