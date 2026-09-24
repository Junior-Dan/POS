import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET inventory stock movements log
router.get('/movements', (req, res) => {
  try {
    const { productId, type } = req.query;
    let sql = `SELECT * FROM stock_movements WHERE 1=1`;
    const params = [];

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

  if (!productId || newStock === undefined || newStock < 0 || !reason) {
    return res.status(400).json({ error: "Product ID, valid non-negative stock quantity, and reason are required." });
  }

  if (managerPin) {
    const mgr = db.prepare("SELECT name FROM users WHERE pin = ? AND active = 1 AND role IN ('owner', 'manager')").get(managerPin);
    if (!mgr) {
      return res.status(403).json({ error: "Invalid Manager/Owner PIN for stock adjustment." });
    }
  }

  const processAdjustment = db.transaction(() => {
    const product = db.prepare('SELECT id, name, current_stock FROM products WHERE id = ?').get(productId);
    if (!product) {
      throw new Error("Product not found.");
    }

    const prevStock = product.current_stock;
    const targetStock = parseInt(newStock, 10);
    const diff = targetStock - prevStock;

    db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetStock, productId);

    const movId = `MOV-${Date.now()}`;
    db.prepare(`
      INSERT INTO stock_movements (id, product_id, product_name, type, qty, previous_stock, new_stock, ref, user_name, reason)
      VALUES (?, ?, ?, 'STOCK_ADJUSTMENT', ?, ?, ?, 'MANUAL-ADJ', ?, ?)
    `).run(movId, productId, product.name, diff, prevStock, targetStock, userName || 'Manager', reason);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'manager', 'B1', 'Stock Adjustment', ?, ?, ?, ?)
    `).run(`AUD-${Date.now()}`, userName || 'Manager', product.name, `Qty: ${prevStock}`, `Qty: ${targetStock}`, reason);

    return { productId, previousStock: prevStock, newStock: targetStock, diff };
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

  if (managerPin) {
    const mgr = db.prepare("SELECT name FROM users WHERE pin = ? AND active = 1 AND role IN ('owner', 'manager')").get(managerPin);
    if (!mgr) {
      return res.status(403).json({ error: "Invalid Manager PIN." });
    }
  }

  const processDamage = db.transaction(() => {
    const product = db.prepare('SELECT id, name, current_stock FROM products WHERE id = ?').get(productId);
    if (!product) {
      throw new Error("Product not found.");
    }

    const qty = parseInt(qtyDamaged, 10);
    if (product.current_stock < qty) {
      throw new Error(`Cannot record damage of ${qty} bottles. Only ${product.current_stock} currently in stock.`);
    }

    const prevStock = product.current_stock;
    const newStock = prevStock - qty;

    db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, productId);

    db.prepare(`
      INSERT INTO stock_movements (id, product_id, product_name, type, qty, previous_stock, new_stock, ref, user_name, reason)
      VALUES (?, ?, ?, 'DAMAGE', ?, ?, ?, 'DAMAGE-LOG', ?, ?)
    `).run(`MOV-${Date.now()}`, productId, product.name, -qty, prevStock, newStock, userName || 'Manager', `Damaged: ${reason}`);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'manager', 'B1', 'Record Damage', ?, ?, ?, ?)
    `).run(`AUD-${Date.now()}`, userName || 'Manager', product.name, `Stock: ${prevStock}`, `Stock: ${newStock}`, `Logged ${qty} damaged: ${reason}`);

    return { productId, qtyDamaged: qty, previousStock: prevStock, newStock };
  });

  try {
    const result = processDamage();
    res.json({ success: true, damage: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
