import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET all customers
router.get('/', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY total_spend DESC').all();
    res.json(customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone || 'N/A',
      email: c.email || '-',
      visits: c.visits || 0,
      totalSpend: c.total_spend || 0,
      createdAt: c.created_at
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Create Customer
router.post('/', (req, res) => {
  const { name, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: "Customer name is required" });

  const id = `C-${Date.now()}`;
  try {
    db.prepare(`
      INSERT INTO customers (id, name, phone, email, visits, total_spend)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(id, name, phone || 'N/A', email || '-');

    res.status(201).json({ id, name, phone, email, visits: 0, totalSpend: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Customer purchase history
router.get('/:id/sales', (req, res) => {
  const { id } = req.params;
  try {
    const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC').all(id);
    res.json(sales);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
