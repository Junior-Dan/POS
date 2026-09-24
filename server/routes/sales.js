import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET sales list with filters
router.get('/', (req, res) => {
  try {
    const { startDate, endDate, cashierId, paymentMethod, customerId } = req.query;

    let sql = `SELECT * FROM sales WHERE 1=1`;
    const params = [];

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

    const getItems = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`);

    const result = sales.map(s => {
      const items = getItems.all(s.id).map(i => ({
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
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? OR receipt_no = ?').get(id, id);
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

  // Execute sale creation in an atomic database transaction
  const processSaleTransaction = db.transaction(() => {
    // 1. Validate Stock for all items
    for (const item of items) {
      const product = db.prepare('SELECT id, name, current_stock, cost_price, active FROM products WHERE id = ?').get(item.id || item.productId);
      if (!product) {
        throw new Error(`Product '${item.name || item.id}' not found in database.`);
      }
      if (!product.active) {
        throw new Error(`Product '${product.name}' is inactive and cannot be sold.`);
      }
      if (product.current_stock < item.qty) {
        throw new Error(`Insufficient stock for '${product.name}'. Required: ${item.qty}, Available: ${product.current_stock}.`);
      }
    }

    // 2. Generate Receipt Number and Sale ID
    const receiptNo = `REC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const saleId = `SALE-${Date.now()}`;
    const cashierId = cashier?.id || 'U3';
    const cashierName = cashier?.name || 'John Omondi';
    const customerId = customer?.id || 'C1';
    const customerName = customer?.name || 'Walk-in Customer';

    // 3. Insert Sale Record
    db.prepare(`
      INSERT INTO sales (
        id, receipt_no, branch_id, cashier_id, cashier_name, customer_id, customer_name,
        subtotal, discount, tax, total, payment_method, mpesa_code, status, shift_id, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, CURRENT_TIMESTAMP
      )
    `).run(
      saleId,
      receiptNo,
      branchId || 'B1',
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
      const product = db.prepare('SELECT current_stock, cost_price, name FROM products WHERE id = ?').get(pId);
      const unitPrice = parseFloat(item.price || item.unitPrice || 0);
      const costSnapshot = parseFloat(product.cost_price || 0);
      const itemTotal = unitPrice * item.qty;

      // Insert Sale Item
      db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, qty, unit_price, cost_snapshot, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`SI-${Date.now()}-${Math.floor(Math.random()*1000)}`, saleId, pId, product.name, item.qty, unitPrice, costSnapshot, itemTotal);

      // Deduct Inventory Stock
      const newStock = product.current_stock - item.qty;
      db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, pId);

      // Record Stock Movement
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, product_name, type, qty, previous_stock, new_stock, ref, user_name, reason)
        VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, ?, 'POS Sale Completed')
      `).run(
        `MOV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        pId,
        product.name,
        item.qty,
        product.current_stock,
        newStock,
        receiptNo,
        cashierName
      );
    }

    // 5. Record Payment Entry
    db.prepare(`
      INSERT INTO payments (id, sale_id, method, amount, reference_code, status)
      VALUES (?, ?, ?, ?, ?, 'SUCCESS')
    `).run(`PAY-${Date.now()}`, saleId, paymentMethod || 'CASH', parseFloat(total), mpesaCode || null);

    // 6. Update Customer Spend if non-walk-in
    if (customerId && customerId !== 'C1') {
      db.prepare(`
        UPDATE customers 
        SET visits = visits + 1, total_spend = total_spend + ? 
        WHERE id = ?
      `).run(parseFloat(total), customerId);
    }

    // 7. Record Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'cashier', 'B1', 'POS Sale Completed', ?, '-', ?, 'Completed checkout transaction')
    `).run(`AUD-${Date.now()}`, cashierName, receiptNo, `KSh ${total} via ${paymentMethod}`);

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
      paymentMethod,
      mpesaCode,
      items
    };
  });

  try {
    const saleResult = processSaleTransaction();
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

  // Verify Manager PIN
  const manager = db.prepare("SELECT * FROM users WHERE pin = ? AND active = 1 AND role IN ('owner', 'manager')").get(managerPin);

  if (!manager) {
    return res.status(403).json({ error: "Invalid Manager PIN or insufficient permissions for refund." });
  }

  const processRefundTransaction = db.transaction(() => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? OR receipt_no = ?').get(id, id);
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

    // Restore Inventory Stock and record movements
    for (const item of items) {
      const product = db.prepare('SELECT current_stock, name FROM products WHERE id = ?').get(item.product_id);
      if (product) {
        const newStock = product.current_stock + item.qty;
        db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, item.product_id);

        db.prepare(`
          INSERT INTO stock_movements (id, product_id, product_name, type, qty, previous_stock, new_stock, ref, user_name, reason)
          VALUES (?, ?, ?, 'RETURN', ?, ?, ?, ?, ?, ?)
        `).run(
          `MOV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          item.product_id,
          product.name,
          item.qty,
          product.current_stock,
          newStock,
          sale.receipt_no,
          manager.name,
          `Sale Refund: ${reason || 'Customer Return'}`
        );
      }
    }

    // Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, ?, 'B1', 'Sale Refunded', ?, ?, 'REFUNDED', ?)
    `).run(
      `AUD-${Date.now()}`,
      manager.name,
      manager.role,
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
