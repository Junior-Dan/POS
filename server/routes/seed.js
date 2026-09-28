import express from 'express';
import { db } from '../db.js';
import { seedDatabase } from '../seedData.js';
import { authenticateSession, requireRole } from './auth.js';

const router = express.Router();

// POST trigger re-seeding — strictly protected and disabled in production.
router.post('/reset', authenticateSession, requireRole('owner'), (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return res.status(403).json({ error: 'Database reset is disabled in production environments.' });
  }

  const orgId = req.authUser.organizationId;
  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID is required.' });
  }

  try {
    db.prepare('DELETE FROM sale_items WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM sales WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM stock_movements WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM cash_movements WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM purchase_items WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM purchases WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM expenses WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM shifts WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM products WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM suppliers WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM customers WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM categories WHERE organization_id = ?').run(orgId);
    db.prepare('DELETE FROM audit_logs WHERE organization_id = ?').run(orgId);

    res.json({ success: true, message: "Organization data reset successfully." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
