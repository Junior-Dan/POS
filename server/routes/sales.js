import express from 'express';
import { db } from '../db.js';
import { authenticateSession, findUserByPin, canAccessBranch } from './auth.js';
import { getBranchStock, adjustBranchStock, branchExists } from '../branchStock.js';

const router = express.Router();

router.use(authenticateSession);

// GET sales list with filters
router.get('/', (req, res) => {
  try {
    const { startDate, endDate, cashierId, paymentMethod, customerId, branchId: requestedBranch } = req.query;

    let sql = `SELECT * FROM sales WHERE organization_id = ?`;
    const params = [req.authUser.organizationId];

    // Enforce branch isolation for non-owners
    const branchId = (req.authUser && req.authUser.role !== 'owner') ? req.authUser.branchId : (requestedBranch || null);
    if (branchId) {
      sql += ` AND branch_id = ?`;
      params.push(branchId);
    }

    if (startDate) {
      sql += ` AND created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND created_at <= ?`;
      params.push(endDate);
    }
    if (cashierId) {
      sql += ` AND cashier_id = ?`;
      params.push(cashierId);
    }
    if (paymentMethod) {
      sql += ` AND payment_method = ?`;
      params.push(paymentMethod);
    }
    if (customerId) {
      sql += ` AND customer_id = ?`;
      params.push(customerId);
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const sales = db.prepare(sql).all(...params);

    // Fetch ALL line items for these sales in ONE query (avoid an N+1 storm that
    // would block the synchronous DB layer once there are many sales).
    const itemsBySale = {};
    const ids = sales.map(s => s.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const allItems = db.prepare(
        `SELECT * FROM sale_items WHERE organization_id = ? AND sale_id IN (${placeholders})`
      ).all(req.authUser.organizationId, ...ids);
      for (const i of allItems) {
        if (!itemsBySale[i.sale_id]) itemsBySale[i.sale_id] = [];
        itemsBySale[i.sale_id].push(i);
      }
    }

    const result = sales.map(s => {
      const items = (itemsBySale[s.id] || []).map(i => ({
        id: i.product_id,
        productId: i.product_id,
        name: i.product_name,
        qty: i.qty,
        unitPrice: i.unit_price,
        costSnapshot: i.cost_snapshot,
        total: i.total
      }));

      return {
        id: s.id,
        receiptNo: s.receipt_no,
        branchId: s.branch_id,
        cashierId: s.cashier_id,
        cashierName: s.cashier_name,
        customerId: s.customer_id,
        customerName: s.customer_name,
        subtotal: s.subtotal,
        discount: s.discount,
        tax: s.tax,
        total: s.total,
        paymentMethod: s.payment_method,
        mpesaCode: s.mpesa_code,
        status: s.status,
        refunded: Boolean(s.refunded),
        refundAmount: s.refund_amount,
        refundReason: s.refund_reason,
        timestamp: s.created_at,
        items
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single sale details & receipt
router.get('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE (id = ? OR receipt_no = ?) AND organization_id = ?').get(id, id, req.authUser.organizationId);
    if (!sale) {
      return res.status(404).json({ error: "Sale transaction not found" });
    }

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id).map(i => ({
      id: i.product_id,
      productId: i.product_id,
      name: i.product_name,
      qty: i.qty,
      unitPrice: i.unit_price,
      costSnapshot: i.cost_snapshot,
      total: i.total
    }));

    res.json({
      id: sale.id,
      receiptNo: sale.receipt_no,
      branchId: sale.branch_id,
      cashierId: sale.cashier_id,
      cashierName: sale.cashier_name,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      paymentMethod: sale.payment_method,
      mpesaCode: sale.mpesa_code,
      status: sale.status,
      refunded: Boolean(sale.refunded),
      refundAmount: sale.refund_amount,
      refundReason: sale.refund_reason,
      timestamp: sale.created_at,
      items
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Create Transactional Sale
router.post('/', (req, res) => {
  const {
    items,
    subtotal,
    discount,
    tax,
    total,
    paymentMethod,
    mpesaCode,
    customer,
    cashier,
    branchId,
    shiftId
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty. Items are required to complete a sale." });
  }
  if (!total || total <= 0) {
    return res.status(400).json({ error: "Invalid total transaction amount." });
  }
  if (String(paymentMethod || '').toUpperCase() === 'M-PESA' && (!mpesaCode || !String(mpesaCode).trim())) {
    return res.status(400).json({ error: "M-Pesa transaction code is required for M-Pesa payments." });
  }

  // Idempotency: if the client resends the SAME checkout (e.g. a retry after a
  // dropped response), return the already-persisted sale instead of creating a
  // duplicate and double-deducting stock. The key is stable per cart-submit.
  const clientRef = (req.body.clientRef || req.body.idempotencyKey || '').toString().trim();
  if (clientRef) {
    try {
      const prior = db.prepare('SELECT value FROM settings WHERE key = ?').get(`saleref::${clientRef}`);
      if (prior && prior.value) {
        return res.status(201).json({ success: true, sale: JSON.parse(prior.value), idempotent: true });
      }
    } catch (e) { /* fall through and create the sale normally */ }
  }

  const orgId = req.authUser.organizationId;

  // Execute sale creation in an atomic database transaction
  const processSaleTransaction = db.transaction(() => {
    // 0. Resolve the branch this sale deducts from.
    //    - Scoped users (cashier/manager/inventory_officer) are bound to their
    //      OWN assigned branch; a client-supplied branch is never trusted.
    //    - Owners must EXPLICITLY select a real branch — never silently fall
    //      back to B1 or the primary branch.
    let effectiveBranch;
    if (req.authUser && req.authUser.role !== 'owner') {
      effectiveBranch = req.authUser.branchId;
      if (!effectiveBranch) {
        throw new Error('Your account is not assigned to a branch. Ask the owner to assign one before selling.');
      }
    } else {
      effectiveBranch = branchId;
      if (!effectiveBranch || effectiveBranch === 'ALL') {
        throw new Error('Please select a specific branch before completing a sale.');
      }
      if (!branchExists(orgId, effectiveBranch)) {
        throw new Error('Selected branch was not found for your organization.');
      }
    }
    if (!canAccessBranch(req.authUser, effectiveBranch)) {
      throw new Error('You do not have access to the selected branch.');
    }

    // 1. Validate per-BRANCH stock for all items (no cross-branch borrowing).
    for (const item of items) {
      const pId = item.id || item.productId;
      const product = db.prepare('SELECT id, name, active FROM products WHERE id = ? AND organization_id = ?').get(pId, orgId);
      if (!product) {
        throw new Error(`Product '${item.name || pId}' not found in database.`);
      }
      if (!product.active) {
        throw new Error(`Product '${product.name}' is inactive and cannot be sold.`);
      }
      const branchStock = Number(getBranchStock(orgId, pId, effectiveBranch).current_stock);
      if (branchStock < item.qty) {
        throw new Error(`Insufficient stock for '${product.name}' at this branch. Required: ${item.qty}, Available: ${branchStock}.`);
      }
    }

    // 2. Generate Receipt Number and Sale ID
    const receiptNo = `REC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const saleId = `SALE-${Date.now()}`;
    const cashierId = cashier?.id || 'U3';
    const cashierName = cashier?.name || req.authUser?.name || 'Cashier';
    const customerId = customer?.id || 'C1';
    const customerName = customer?.name || 'Walk-in Customer';

    // 3. Insert Sale Record
    db.prepare(`
      INSERT INTO sales (
        id, organization_id, receipt_no, branch_id, cashier_id, cashier_name, customer_id, customer_name,
        subtotal, discount, tax, total, payment_method, mpesa_code, status, shift_id, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, CURRENT_TIMESTAMP
      )
    `).run(
      saleId,
      orgId,
      receiptNo,
      effectiveBranch,
      cashierId,
      cashierName,
      customerId,
      customerName,
      parseFloat(subtotal || total),
      parseFloat(discount || 0),
      parseFloat(tax || 0),
      parseFloat(total),
      paymentMethod || 'CASH',
      mpesaCode || null,
      shiftId || 'SHIFT-101'
    );

    // 4. Create Sale Items, Deduct Stock & Record Inventory Movement
    for (const item of items) {
      const pId = item.id || item.productId;
      const product = db.prepare('SELECT cost_price, name FROM products WHERE id = ? AND organization_id = ?').get(pId, orgId);
      const unitPrice = parseFloat(item.price || item.unitPrice || 0);
      const costSnapshot = parseFloat(product.cost_price || 0);
      const itemTotal = unitPrice * item.qty;

      // Insert Sale Item
      db.prepare(`
        INSERT INTO sale_items (id, organization_id, sale_id, product_id, product_name, qty, unit_price, cost_snapshot, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`SI-${Date.now()}-${Math.floor(Math.random()*1000)}`, orgId, saleId, pId, product.name, item.qty, unitPrice, costSnapshot, itemTotal);

      // Deduct THIS branch's stock (also re-syncs products.current_stock aggregate).
      const { previous, next } = adjustBranchStock(orgId, pId, effectiveBranch, -item.qty);

      // Record branch-scoped Stock Movement
      db.prepare(`
        INSERT INTO stock_movements (id, organization_id, product_id, product_name, branch_id, type, qty, previous_stock, new_stock, ref, user_name, reason)
        VALUES (?, ?, ?, ?, ?, 'SALE', ?, ?, ?, ?, ?, 'POS Sale Completed')
      `).run(
        `MOV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        orgId,
        pId,
        product.name,
        effectiveBranch,
        item.qty,
        previous,
        next,
        receiptNo,
        cashierName
      );
    }

    // 5. Record Payment Entry
    db.prepare(`
      INSERT INTO payments (id, organization_id, sale_id, method, amount, reference_code, status)
      VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS')
    `).run(`PAY-${Date.now()}`, orgId, saleId, paymentMethod || 'CASH', parseFloat(total), mpesaCode || null);

    // 6. Update Customer Spend if non-walk-in
    if (customerId && customerId !== 'C1') {
      db.prepare(`
        UPDATE customers
        SET visits = visits + 1, total_spend = total_spend + ?
        WHERE id = ? AND organization_id = ?
      `).run(parseFloat(total), customerId, orgId);
    }

    // 7. Record Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, 'cashier', ?, 'POS Sale Completed', ?, '-', ?, 'Completed checkout transaction')
    `).run(`AUD-${Date.now()}`, orgId, cashierName, effectiveBranch, receiptNo, `KSh ${total} via ${paymentMethod}`);

    const etimsCuNum = `CU-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const etimsControlCode = `${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}`;

    return {
      saleId,
      receiptNo,
      timestamp: new Date().toISOString(),
      cashierName,
      customerName,
      subtotal: parseFloat(subtotal || total),
      discount: parseFloat(discount || 0),
      tax: parseFloat(tax || 0),
      total: parseFloat(total),
      paymentMethod: paymentMethod || 'CASH',
      mpesaCode: mpesaCode || null,
      etimsCuNum,
      etimsControlCode,
      items
    };
  });

  try {
    const saleResult = processSaleTransaction();
    // Record the idempotency key -> persisted sale so an identical retry is a no-op.
    if (clientRef) {
      try {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(`saleref::${clientRef}`, JSON.stringify(saleResult));
      } catch (e) { /* non-fatal: sale already persisted */ }
    }
    res.status(201).json({
      success: true,
      sale: saleResult
    });
  } catch (e) {
    console.error("Sale Transaction Failed:", e.message);
    res.status(400).json({ error: e.message });
  }
});

// POST Refund a Sale
router.post('/:id/refund', (req, res) => {
  const { id } = req.params;
  const { refundAmount, reason, managerPin } = req.body;

  if (!managerPin) {
    return res.status(400).json({ error: "Manager/Owner PIN authentication required for refunds!" });
  }

  const orgId = req.authUser.organizationId;

  // Verify Manager/Owner PIN against secure hashes (no plaintext comparison).
  const manager = findUserByPin(managerPin, ['owner', 'manager'], orgId);

  if (!manager) {
    return res.status(403).json({ error: "Invalid Manager PIN or insufficient permissions for refund." });
  }

  // Tenant isolation: the approver must belong to THIS organization.
  if (manager.organization_id && manager.organization_id !== orgId) {
    return res.status(403).json({ error: "Refund approver is outside your organization." });
  }

  // Branch isolation: the approving manager must belong to the sale's branch
  // (owners are organization-wide and may approve any branch).
  const saleForBranch = db.prepare('SELECT branch_id FROM sales WHERE (id = ? OR receipt_no = ?) AND organization_id = ?').get(id, id, orgId);
  if (saleForBranch && manager.role.toLowerCase() !== 'owner' && manager.branch_id !== saleForBranch.branch_id) {
    return res.status(403).json({ error: "Refund approver does not belong to this branch." });
  }

  const processRefundTransaction = db.transaction(() => {
    const sale = db.prepare('SELECT * FROM sales WHERE (id = ? OR receipt_no = ?) AND organization_id = ?').get(id, id, orgId);
    if (!sale) {
      throw new Error("Sale transaction not found.");
    }
    if (sale.refunded) {
      throw new Error("Sale transaction has already been refunded.");
    }

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    const amountToRefund = parseFloat(refundAmount || sale.total);

    // Update sale record
    db.prepare(`
      UPDATE sales
      SET refunded = 1, refund_amount = ?, refund_reason = ?
      WHERE id = ?
    `).run(amountToRefund, reason || 'Customer Refund', sale.id);

    // Restore stock to the ORIGINAL sale's branch and record movements.
    const refundBranch = sale.branch_id;
    for (const item of items) {
      const product = db.prepare('SELECT name FROM products WHERE id = ? AND organization_id = ?').get(item.product_id, orgId);
      if (product) {
        const { previous, next } = adjustBranchStock(orgId, item.product_id, refundBranch, item.qty);

        db.prepare(`
          INSERT INTO stock_movements (id, organization_id, product_id, product_name, branch_id, type, qty, previous_stock, new_stock, ref, user_name, reason)
          VALUES (?, ?, ?, ?, ?, 'RETURN', ?, ?, ?, ?, ?, ?)
        `).run(
          `MOV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          orgId,
          item.product_id,
          product.name,
          refundBranch,
          item.qty,
          previous,
          next,
          sale.receipt_no,
          manager.name,
          `Sale Refund: ${reason || 'Customer Return'}`
        );
      }
    }

    // Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Sale Refunded', ?, ?, 'REFUNDED', ?)
    `).run(
      `AUD-${Date.now()}`,
      orgId,
      manager.name,
      manager.role,
      sale.branch_id || '-',
      sale.receipt_no,
      `Original Total: KSh ${sale.total}`,
      reason || 'Customer Refund'
    );

    return { saleId: sale.id, receiptNo: sale.receipt_no, amountRefunded: amountToRefund };
  });

  try {
    const result = processRefundTransaction();
    res.json({ success: true, refund: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
