import express from 'express';
import { db } from '../db.js';
import { authenticateSession } from './auth.js';
import { resolveViewBranch, crossBranchDenied } from '../branchStock.js';

const router = express.Router();
router.use(authenticateSession); // any authenticated staff (POS needs customer lookup)

// GET all customers
router.get('/', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers WHERE organization_id = ? ORDER BY total_spend DESC').all(req.authUser.organizationId);
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
      INSERT INTO customers (id, organization_id, name, phone, email, visits, total_spend)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(id, req.authUser.organizationId, name, phone || 'N/A', email || '-');

    res.status(201).json({ id, name, phone, email, visits: 0, totalSpend: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Customer purchase history (customers are shared, but their SALES are
// branch-scoped: staff only see their branch's sales; owner sees selected
// branch or all).
router.get('/:id/sales', (req, res) => {
  const { id } = req.params;
  try {
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);
    let sql = 'SELECT * FROM sales WHERE customer_id = ? AND organization_id = ?';
    const params = [id, req.authUser.organizationId];
    if (!all) { sql += ' AND branch_id = ?'; params.push(branch); }
    sql += ' ORDER BY created_at DESC';
    const sales = db.prepare(sql).all(...params);
    res.json(sales);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
