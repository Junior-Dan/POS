import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET active shift
router.get('/current', (req, res) => {
  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE status = "ACTIVE" ORDER BY start_time DESC LIMIT 1').get();
    if (!shift) {
      return res.json(null);
    }

    const cashMovements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY timestamp DESC').all(shift.id);

    res.json({
      id: shift.id,
      branchId: shift.branch_id,
      cashierId: shift.cashier_id,
      cashierName: shift.cashier_name,
      startTime: shift.start_time,
      openingFloat: shift.opening_float,
      status: shift.status,
      cashMovements: cashMovements.map(c => ({
        id: c.id,
        type: c.type,
        amount: c.amount,
        reason: c.reason,
        userName: c.user_name,
        timestamp: c.timestamp
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST open a new shift
router.post('/open', (req, res) => {
  const { cashierId, cashierName, openingFloat, branchId } = req.body;
  
  try {
    // Close existing active shift if any
    const existing = db.prepare('SELECT id FROM shifts WHERE status = "ACTIVE"').get();
    if (existing) {
      return res.status(400).json({ error: "An active shift is already open. Please close it first." });
    }

    const id = `SHIFT-${Date.now().toString().slice(-6)}`;
    const floatVal = parseFloat(openingFloat || 5000);

    db.prepare(`
      INSERT INTO shifts (id, branch_id, cashier_id, cashier_name, start_time, opening_float, status)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'ACTIVE')
    `).run(id, branchId || 'B1', cashierId || 'U3', cashierName || 'John Omondi', floatVal);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'cashier', 'B1', 'Open Shift', ?, '-', ?, 'New shift started')
    `).run(`AUD-${Date.now()}`, cashierName || 'John Omondi', id, `Float: KSh ${floatVal}`);

    res.status(201).json({
      id,
      branchId: branchId || 'B1',
      cashierId: cashierId || 'U3',
      cashierName: cashierName || 'John Omondi',
      startTime: new Date().toISOString(),
      openingFloat: floatVal,
      status: 'ACTIVE',
      cashMovements: []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST log cash movement (Cash In / Cash Out)
router.post('/cash-movement', (req, res) => {
  const { shiftId, type, amount, reason, userName, managerPin } = req.body;

  if (!amount || amount <= 0 || !reason) {
    return res.status(400).json({ error: "Amount and reason are required for cash movement." });
  }

  // If Manager PIN check is required
  if (managerPin) {
    const mgr = db.prepare("SELECT name FROM users WHERE pin = ? AND active = 1 AND role IN ('owner', 'manager')").get(managerPin);
    if (!mgr) {
      return res.status(403).json({ error: "Invalid Manager PIN entered." });
    }
  }

  try {
    const activeShift = db.prepare('SELECT id FROM shifts WHERE status = "ACTIVE" ORDER BY start_time DESC LIMIT 1').get();
    const targetShiftId = shiftId || activeShift?.id || 'SHIFT-101';
    const movId = `CM-${Date.now()}`;
    const signedAmount = type === 'OUT' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    db.prepare(`
      INSERT INTO cash_movements (id, shift_id, type, amount, reason, user_name, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(movId, targetShiftId, type || 'IN', signedAmount, reason, userName || 'John Omondi');

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'cashier', 'B1', 'Cash Movement', ?, '-', ?, ?)
    `).run(`AUD-${Date.now()}`, userName || 'John Omondi', `Shift ${targetShiftId}`, `${type}: KSh ${amount}`, reason);

    res.status(201).json({
      id: movId,
      shiftId: targetShiftId,
      type: type || 'IN',
      amount: signedAmount,
      reason,
      userName: userName || 'John Omondi',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST close shift
router.post('/close', (req, res) => {
  const { shiftId, closingCash, notes, managerPin } = req.body;

  if (managerPin) {
    const mgr = db.prepare("SELECT name FROM users WHERE pin = ? AND active = 1 AND role IN ('owner', 'manager')").get(managerPin);
    if (!mgr) {
      return res.status(403).json({ error: "Invalid Manager PIN." });
    }
  }

  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ? OR status = "ACTIVE" ORDER BY start_time DESC LIMIT 1').get(shiftId);
    if (!shift) {
      return res.status(404).json({ error: "No active shift found to close." });
    }

    // Calculate Net Cash Sales for this shift
    const cashSales = db.prepare(`
      SELECT SUM(total) as totalCash 
      FROM sales 
      WHERE payment_method = 'CASH' AND refunded = 0 AND created_at >= ?
    `).get(shift.start_time).totalCash || 0;

    // Calculate Net Cash Movements for this shift
    const cashMovs = db.prepare(`
      SELECT SUM(amount) as netMov 
      FROM cash_movements 
      WHERE shift_id = ?
    `).get(shift.id).netMov || 0;

    const expectedCash = (shift.opening_float || 0) + cashSales + cashMovs;
    const actualCash = parseFloat(closingCash || 0);
    const variance = actualCash - expectedCash;

    db.prepare(`
      UPDATE shifts
      SET end_time = CURRENT_TIMESTAMP,
          closing_cash = ?,
          expected_cash = ?,
          variance = ?,
          status = 'CLOSED',
          notes = ?
      WHERE id = ?
    `).run(actualCash, expectedCash, variance, notes || null, shift.id);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, ?, 'cashier', 'B1', 'Close Shift', ?, ?, ?, ?)
    `).run(
      `AUD-${Date.now()}`,
      shift.cashier_name,
      shift.id,
      `Expected: KSh ${expectedCash}`,
      `Actual: KSh ${actualCash} (Variance: KSh ${variance})`,
      notes || 'Shift closed & reconciled'
    );

    res.json({
      success: true,
      shift: {
        id: shift.id,
        cashierName: shift.cashier_name,
        openingFloat: shift.opening_float,
        expectedCash,
        closingCash: actualCash,
        variance,
        notes,
        status: 'CLOSED'
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET shift history
router.get('/history', (req, res) => {
  try {
    const shifts = db.prepare('SELECT * FROM shifts ORDER BY start_time DESC LIMIT 20').all();
    res.json(shifts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
