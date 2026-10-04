import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole } from './auth.js';
import { adjustBranchStock, branchExists, primaryBranchId } from '../branchStock.js';

const router = express.Router();
router.use(authenticateSession);
router.use(requireRole('owner', 'manager', 'inventory_officer'));

// GET purchases list
router.get('/', (req, res) => {
  try {
    const purchases = db.prepare('SELECT * FROM purchases WHERE organization_id = ? ORDER BY created_at DESC').all(req.authUser.organizationId);
    const getItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? AND organization_id = ?');

    const result = purchases.map(p => ({
      id: p.id,
      poNumber: p.po_number,
      branchId: p.branch_id,
      supplierId: p.supplier_id,
      supplierName: p.supplier_name,
      dateIssued: p.date_issued,
      deliveryDate: p.delivery_date,
      status: p.status,
      totalValue: p.total_value,
      notes: p.notes,
      items: getItems.all(p.id, req.authUser.organizationId).map(i => ({
        productId: i.product_id,
        name: i.product_name,
        qtyOrdered: i.qty_ordered,
        qtyReceived: i.qty_received,
        unitCost: i.unit_cost,
        totalCost: i.total_cost
      }))
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Create Purchase Order
router.post('/', (req, res) => {
  const { supplierId, supplierName, dateIssued, deliveryDate, items, notes, totalValue, branchId } = req.body;

  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Supplier ID and items list are required to issue purchase order." });
  }

  const orgId = req.authUser.organizationId;
  const effectiveBranch = (req.authUser.role !== 'owner' && req.authUser.branchId)
    ? req.authUser.branchId
    : (branchId || req.authUser.branchId || 'B1');

  const processPO = db.transaction(() => {
    const id = `PO-${Date.now()}`;
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random()*900)}`;
    const calcTotal = items.reduce((acc, i) => acc + (parseFloat(i.unitCost || 0) * parseInt(i.qtyOrdered || 0, 10)), 0);

    db.prepare(`
      INSERT INTO purchases (id, organization_id, po_number, branch_id, supplier_id, supplier_name, date_issued, delivery_date, status, total_value, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ORDERED', ?, ?)
    `).run(
      id,
      orgId,
      poNumber,
      effectiveBranch,
      supplierId,
      supplierName || 'Supplier',
      dateIssued || new Date().toISOString().split('T')[0],
      deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      calcTotal || totalValue || 0,
      notes || null
    );

    for (const item of items) {
      const pId = item.productId || item.id;
      const product = db.prepare('SELECT name FROM products WHERE id = ? AND organization_id = ?').get(pId, orgId);
      const name = product ? product.name : (item.name || 'Product');
      const qty = parseInt(item.qtyOrdered || item.qty || 1, 10);
      const unitCost = parseFloat(item.unitCost || item.cost || 0);

      db.prepare(`
        INSERT INTO purchase_items (id, organization_id, purchase_id, product_id, product_name, qty_ordered, qty_received, unit_cost, total_cost)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(`PI-${Date.now()}-${Math.floor(Math.random()*1000)}`, orgId, id, pId, name, qty, unitCost, qty * unitCost);
    }

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Create Purchase Order', ?, '-', ?, 'Purchase order issued to supplier')
    `).run(`AUD-${Date.now()}`, orgId, req.authUser.name, req.authUser.role, effectiveBranch, poNumber, `Total: KSh ${calcTotal}`);

    return { id, poNumber, totalValue: calcTotal };
  });

  try {
    const result = processPO();
    res.status(201).json({ success: true, purchaseOrder: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Receive Purchase Order (Updates Stock automatically)
router.post('/:id/receive', (req, res) => {
  const { id } = req.params;
  const { itemsReceived, notes, userName } = req.body;

  const orgId = req.authUser.organizationId;
  const receivePO = db.transaction(() => {
    const po = db.prepare('SELECT * FROM purchases WHERE (id = ? OR po_number = ?) AND organization_id = ?').get(id, id, orgId);
    if (!po) {
      throw new Error("Purchase Order not found.");
    }
    if (po.status === 'RECEIVED') {
      throw new Error("Purchase Order has already been fully received.");
    }

    const poItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? AND organization_id = ?').all(po.id, orgId);

    // Credit the PO's own branch. Guard against legacy/invalid branch ids
    // ('B1', 'ALL', null) by falling back to the org's primary branch so the
    // received stock always lands on a real branch.
    const receiveBranch = branchExists(orgId, po.branch_id) ? po.branch_id : primaryBranchId(orgId);

    for (const item of poItems) {
      // Find override qty or use ordered qty
      const override = itemsReceived ? itemsReceived.find(i => i.productId === item.product_id) : null;
      const qtyToReceive = override ? parseInt(override.qtyReceived, 10) : item.qty_ordered;

      // Update PO Item received count
      db.prepare('UPDATE purchase_items SET qty_received = ? WHERE id = ? AND organization_id = ?').run(qtyToReceive, item.id, orgId);

      // Increase Inventory Stock automatically — credited to the PO's branch.
      const product = db.prepare('SELECT name FROM products WHERE id = ? AND organization_id = ?').get(item.product_id, orgId);
      if (product && receiveBranch) {
        // Keep the catalogue cost_price in sync (cost is org-wide), then credit
        // the branch quantity (which re-syncs products.current_stock aggregate).
        db.prepare('UPDATE products SET cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?')
          .run(item.unit_cost, item.product_id, orgId);

        const { previous, next } = adjustBranchStock(orgId, item.product_id, receiveBranch, qtyToReceive);

        // Record Inventory Movement
        db.prepare(`
          INSERT INTO stock_movements (id, organization_id, product_id, product_name, branch_id, type, qty, previous_stock, new_stock, ref, user_name, reason)
          VALUES (?, ?, ?, ?, ?, 'PURCHASE', ?, ?, ?, ?, ?, 'Stock Received from PO')
        `).run(
          `MOV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          orgId,
          item.product_id,
          product.name,
          receiveBranch,
          qtyToReceive,
          previous,
          next,
          po.po_number,
          userName || req.authUser.name || 'Inventory Officer'
        );
      }
    }

    // Mark PO as RECEIVED
    db.prepare("UPDATE purchases SET status = 'RECEIVED', notes = COALESCE(?, notes) WHERE id = ? AND organization_id = ?").run(notes || null, po.id, orgId);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Receive Purchase Order', ?, 'ORDERED', 'RECEIVED', 'Stock received and inventory increased')
    `).run(`AUD-${Date.now()}`, orgId, userName || req.authUser.name || 'Inventory Officer', req.authUser.role, po.branch_id || '-', po.po_number);

    return { id: po.id, poNumber: po.po_number, status: 'RECEIVED' };
  });

  try {
    const result = receivePO();
    res.json({ success: true, purchaseOrder: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
