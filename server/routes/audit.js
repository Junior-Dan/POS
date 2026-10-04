import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole } from './auth.js';
import { resolveViewBranch, crossBranchDenied } from '../branchStock.js';

const router = express.Router();
router.use(authenticateSession);
router.use(requireRole('owner', 'manager'));

// GET audit logs (branch-scoped)
router.get('/', (req, res) => {
  try {
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);
    let sql = 'SELECT * FROM audit_logs WHERE organization_id = ?';
    const params = [req.authUser.organizationId];
    if (!all) { sql += ' AND branch_id = ?'; params.push(branch); }
    sql += ' ORDER BY timestamp DESC LIMIT 200';
    const logs = db.prepare(sql).all(...params);
    res.json(logs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      user: l.user_name,
      role: l.role,
      branchId: l.branch_id,
      action: l.action,
      item: l.item,
      oldVal: l.old_val,
      newVal: l.new_val,
      reason: l.reason
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
