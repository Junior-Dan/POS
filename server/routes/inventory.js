import express from 'express';
import { db } from '../db.js';
import { authenticateSession, findUserByPin, requireRole, canAccessBranch } from './auth.js';
import { getBranchStock, setBranchStock, adjustBranchStock, branchExists, crossBranchDenied } from '../branchStock.js';

const router = express.Router();

router.use(authenticateSession);
// Cashiers have no access to inventory operations.
router.use(requireRole('owner', 'manager', 'inventory_officer'));

// Resolve & authorize the branch an inventory op targets.
//  - Scoped users (manager/inventory_officer): always their OWN branch.
//  - Owners: must pass a real, accessible branchId in the body.
// Throws on any violation so callers return a clean 4xx.
function resolveTargetBranch(req, orgId, requestedBranch) {
  if (req.authUser.role !== 'owner') {
    const b = req.authUser.branchId;
    if (!b) throw new Error('Your account is not assigned to a branch.');
    // A scoped user forging a different branch id is rejected outright.
    if (crossBranchDenied(req.authUser, requestedBranch)) {
      throw new Error('Access denied: you cannot operate on another branch.');
    }
    return b;
  }
  const b = requestedBranch;
  if (!b || b === 'ALL') throw new Error('Owners must specify a branch for this inventory operation.');
  if (!branchExists(orgId, b)) throw new Error('Selected branch was not found for your organization.');
  if (!canAccessBranch(req.authUser, b)) throw new Error('You do not have access to the selected branch.');
  return b;
}

// GET inventory stock movements log (branch-scoped)
router.get('/movements', (req, res) => {
  try {
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { productId, type, branch: requestedBranch } = req.query;
    let sql = `SELECT * FROM stock_movements WHERE organization_id = ?`;
    const params = [req.authUser.organizationId];

    // Branch isolation: non-owners only ever see their own branch. Owners may
    // optionally filter by a branch; omitting it shows all branches.
    if (req.authUser.role !== 'owner') {
      sql += ` AND branch_id = ?`;
      params.push(req.authUser.branchId);
    } else if (requestedBranch && requestedBranch !== 'ALL') {
      sql += ` AND branch_id = ?`;
      params.push(requestedBranch);
    }

    if (productId) {
      sql += ` AND product_id = ?`;
      params.push(productId);
    }
    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY timestamp DESC LIMIT 200`;

    const movements = db.prepare(sql).all(...params);
    res.json(movements.map(m => ({
      id: m.id,
      timestamp: m.timestamp,
      productId: m.product_id,
      productName: m.product_name,
      branchId: m.branch_id,
      type: m.type,
      qty: m.qty,
      previousStock: m.previous_stock,
      newStock: m.new_stock,
      ref: m.ref,
      user: m.user_name,
      reason: m.reason
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Manual Stock Adjustment
router.post('/adjust', (req, res) => {
  const { productId, newStock, reason, userName, managerPin } = req.body;

  if (req.authUser && req.authUser.role === 'cashier') {
    return res.status(403).json({ error: "Access Denied: Cashiers are not permitted to adjust inventory quantities." });
  }

  if (!productId || newStock === undefined || newStock < 0 || !reason) {
    return res.status(400).json({ error: "Product ID, valid non-negative stock quantity, and reason are required." });
  }

  const orgId = req.authUser.organizationId;
  if (managerPin) {
    const mgr = findUserByPin(managerPin, ['owner', 'manager'], orgId);
    if (!mgr || (mgr.organization_id && mgr.organization_id !== orgId)) {
      return res.status(403).json({ error: "Invalid Manager/Owner PIN for stock adjustment." });
    }
  }

  let targetBranch;
  try {
    targetBranch = resolveTargetBranch(req, orgId, req.body.branchId);
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  const processAdjustment = db.transaction(() => {
    const product = db.prepare('SELECT id, name FROM products WHERE id = ? AND organization_id = ?').get(productId, orgId);
    if (!product) {
      throw new Error("Product not found.");
    }

    const targetStock = parseInt(newStock, 10);
    // Set THIS branch's absolute stock (also re-syncs the org-wide aggregate).
    const { previous, next } = setBranchStock(orgId, productId, targetBranch, targetStock);
    const diff = next - previous;

    const movId = `MOV-${Date.now()}`;
    db.prepare(`
      INSERT INTO stock_movements (id, organization_id, product_id, product_name, branch_id, type, qty, previous_stock, new_stock, ref, user_name, reason)
      VALUES (?, ?, ?, ?, ?, 'STOCK_ADJUSTMENT', ?, ?, ?, 'MANUAL-ADJ', ?, ?)
    `).run(movId, orgId, productId, product.name, targetBranch, diff, previous, next, userName || req.authUser.name || 'Manager', reason);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Stock Adjustment', ?, ?, ?, ?)
    `).run(`AUD-${Date.now()}`, orgId, userName || req.authUser.name || 'Manager', req.authUser.role, targetBranch, product.name, `Qty: ${previous}`, `Qty: ${next}`, reason);

    return { productId, branchId: targetBranch, previousStock: previous, newStock: next, diff };
  });

  try {
    const result = processAdjustment();
    res.json({ success: true, adjustment: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST Record Stock Damage / Breakage
router.post('/damage', (req, res) => {
  const { productId, qtyDamaged, reason, userName, managerPin } = req.body;

  if (!productId || !qtyDamaged || qtyDamaged <= 0 || !reason) {
    return res.status(400).json({ error: "Product ID, positive damaged quantity, and reason are required." });
  }

  const orgId = req.authUser.organizationId;
  if (managerPin) {
    const mgr = findUserByPin(managerPin, ['owner', 'manager'], orgId);
    if (!mgr || (mgr.organization_id && mgr.organization_id !== orgId)) {
      return res.status(403).json({ error: "Invalid Manager PIN." });
    }
  }

  let targetBranch;
  try {
    targetBranch = resolveTargetBranch(req, orgId, req.body.branchId);
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  const processDamage = db.transaction(() => {
    const product = db.prepare('SELECT id, name FROM products WHERE id = ? AND organization_id = ?').get(productId, orgId);
    if (!product) {
      throw new Error("Product not found.");
    }

    const qty = parseInt(qtyDamaged, 10);
    const prevStock = Number(getBranchStock(orgId, productId, targetBranch).current_stock);
    if (prevStock < qty) {
      throw new Error(`Cannot record damage of ${qty} bottles. Only ${prevStock} currently in stock at this branch.`);
    }

    // Decrement THIS branch's stock (also re-syncs the org-wide aggregate).
    const { previous, next } = adjustBranchStock(orgId, productId, targetBranch, -qty);

    db.prepare(`
      INSERT INTO stock_movements (id, organization_id, product_id, product_name, branch_id, type, qty, previous_stock, new_stock, ref, user_name, reason)
      VALUES (?, ?, ?, ?, ?, 'DAMAGE', ?, ?, ?, 'DAMAGE-LOG', ?, ?)
    `).run(`MOV-${Date.now()}`, orgId, productId, product.name, targetBranch, -qty, previous, next, userName || req.authUser.name || 'Manager', `Damaged: ${reason}`);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Record Damage', ?, ?, ?, ?)
    `).run(`AUD-${Date.now()}`, orgId, userName || req.authUser.name || 'Manager', req.authUser.role, targetBranch, product.name, `Stock: ${previous}`, `Stock: ${next}`, `Logged ${qty} damaged: ${reason}`);

    return { productId, branchId: targetBranch, qtyDamaged: qty, previousStock: previous, newStock: next };
  });

  try {
    const result = processDamage();
    res.json({ success: true, damage: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
