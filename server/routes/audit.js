import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET audit logs
router.get('/', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200').all();
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
