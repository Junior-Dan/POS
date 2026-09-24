import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET expenses list
router.get('/', (req, res) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all();
    res.json(expenses.map(e => ({
      id: e.id,
      category: e.category,
      amount: e.amount,
      description: e.description,
      user: e.user_name,
      receiptRef: e.receipt_ref,
      timestamp: e.created_at
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Create Expense
router.post('/', (req, res) => {
  const { category, amount, description, user, receiptRef } = req.body;

  if (!category || !amount || amount <= 0) {
    return res.status(400).json({ error: "Expense category and positive amount are required." });
  }

  const id = `EXP-${Date.now()}`;
  const amt = parseFloat(amount);
  const userName = user || 'Manager';

  try {
    db.prepare(`
      INSERT INTO expenses (id, category, amount, description, user_name, receipt_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, category, amt, description || null, userName, receiptRef || null);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'manager', 'B1', 'Log Expense', ?, '-', ?, ?)
    `).run(`AUD-${Date.now()}`, userName, category, `KSh ${amt}`, description || 'Shop operational expense');

    res.status(201).json({
      id,
      category,
      amount: amt,
      description,
      user: userName,
      receiptRef,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
