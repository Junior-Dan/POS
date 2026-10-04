import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole, canAccessBranch } from './auth.js';
import { resolveViewBranch, assertWriteBranch, crossBranchDenied } from '../branchStock.js';

const router = express.Router();
router.use(authenticateSession);
router.use(requireRole('owner', 'manager'));

// GET expenses list (branch-scoped)
router.get('/', (req, res) => {
  try {
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);
    let sql = 'SELECT * FROM expenses WHERE organization_id = ?';
    const params = [req.authUser.organizationId];
    if (!all) { sql += ' AND branch_id = ?'; params.push(branch); }
    sql += ' ORDER BY created_at DESC';
    const expenses = db.prepare(sql).all(...params);
    res.json(expenses.map(e => ({
      id: e.id,
      branchId: e.branch_id,
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

// POST Create Expense (branch-owned)
router.post('/', (req, res) => {
  const { category, amount, description, user, receiptRef } = req.body;

  if (!category || !amount || amount <= 0) {
    return res.status(400).json({ error: "Expense category and positive amount are required." });
  }

  const orgId = req.authUser.organizationId;
  let branchId;
  try {
    branchId = assertWriteBranch(req.authUser, orgId, req.body.branchId, canAccessBranch);
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  const id = `EXP-${Date.now()}`;
  const amt = parseFloat(amount);
  const userName = user || req.authUser.name || 'Manager';

  try {
    db.prepare(`
      INSERT INTO expenses (id, organization_id, branch_id, category, amount, description, user_name, receipt_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, orgId, branchId, category, amt, description || null, userName, receiptRef || null);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Log Expense', ?, '-', ?, ?)
    `).run(`AUD-${Date.now()}`, orgId, userName, req.authUser.role, branchId, category, `KSh ${amt}`, description || 'Shop operational expense');

    res.status(201).json({
      id,
      branchId,
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
