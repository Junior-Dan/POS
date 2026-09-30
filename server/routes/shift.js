import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole, findUserByPin } from './auth.js';

const router = express.Router();
router.use(authenticateSession);
// Cashiers, managers and owners operate shifts/drawers; inventory officers do not.
router.use(requireRole('owner', 'manager', 'cashier'));

// GET active shift (scoped to this organization; to the user's branch for
// non-owners so each branch terminal sees its own drawer)
router.get('/current', (req, res) => {
  try {
    const orgId = req.authUser.organizationId;
    const branchId = (req.authUser.role !== 'owner') ? req.authUser.branchId : (req.query.branchId || null);
    let shift;
    if (branchId) {
      shift = db.prepare('SELECT * FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? AND branch_id = ? ORDER BY start_time DESC LIMIT 1').get(orgId, branchId);
    } else {
      shift = db.prepare('SELECT * FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? ORDER BY start_time DESC LIMIT 1').get(orgId);
    }
    if (!shift) {
      return res.json(null);
    }

    const cashMovements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? AND organization_id = ? ORDER BY timestamp DESC').all(shift.id, orgId);

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

  const orgId = req.authUser.organizationId;
  const effectiveBranch = (req.authUser.role !== 'owner' && req.authUser.branchId)
    ? req.authUser.branchId
    : (branchId || req.authUser.branchId || 'B1');

  try {
    // Close existing active shift if any (this org + this branch)
    const existing = db.prepare('SELECT id FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? AND branch_id = ?').get(orgId, effectiveBranch);
    if (existing) {
      return res.status(400).json({ error: "An active shift is already open. Please close it first." });
    }

    const id = `SHIFT-${Date.now().toString().slice(-6)}`;
    const floatVal = parseFloat(openingFloat || 5000);
    const effCashierId = cashierId || req.authUser.id;
    const effCashierName = cashierName || req.authUser.name;

    db.prepare(`
      INSERT INTO shifts (id, organization_id, branch_id, cashier_id, cashier_name, start_time, opening_float, status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'ACTIVE')
    `).run(id, orgId, effectiveBranch, effCashierId, effCashierName, floatVal);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Open Shift', ?, '-', ?, 'New shift started')
    `).run(`AUD-${Date.now()}`, orgId, effCashierName, req.authUser.role, effectiveBranch, id, `Float: KSh ${floatVal}`);

    res.status(201).json({
      id,
      branchId: effectiveBranch,
      cashierId: effCashierId,
      cashierName: effCashierName,
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

  const orgId = req.authUser.organizationId;

  // If Manager PIN authorization is required (verified against secure hashes).
  if (managerPin) {
    const mgr = findUserByPin(managerPin, ['owner', 'manager'], orgId);
    if (!mgr || (mgr.organization_id && mgr.organization_id !== orgId)) {
      return res.status(403).json({ error: "Invalid Manager PIN entered." });
    }
  }

  try {
    const branchId = (req.authUser.role !== 'owner') ? req.authUser.branchId : null;
    const activeShift = branchId
      ? db.prepare('SELECT id FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? AND branch_id = ? ORDER BY start_time DESC LIMIT 1').get(orgId, branchId)
      : db.prepare('SELECT id FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? ORDER BY start_time DESC LIMIT 1').get(orgId);
    const targetShiftId = shiftId || activeShift?.id || 'SHIFT-101';
    const movId = `CM-${Date.now()}`;
    const signedAmount = type === 'OUT' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
    const actor = userName || req.authUser.name;

    db.prepare(`
      INSERT INTO cash_movements (id, organization_id, shift_id, type, amount, reason, user_name, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(movId, orgId, targetShiftId, type || 'IN', signedAmount, reason, actor);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Cash Movement', ?, '-', ?, ?)
    `).run(`AUD-${Date.now()}`, orgId, actor, req.authUser.role, req.authUser.branchId || '-', `Shift ${targetShiftId}`, `${type}: KSh ${amount}`, reason);

    res.status(201).json({
      id: movId,
      shiftId: targetShiftId,
      type: type || 'IN',
      amount: signedAmount,
      reason,
      userName: actor,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST close shift
router.post('/close', (req, res) => {
  const { shiftId, closingCash, notes, managerPin } = req.body;

  const orgId = req.authUser.organizationId;
  if (managerPin) {
    const mgr = findUserByPin(managerPin, ['owner', 'manager'], orgId);
    if (!mgr || (mgr.organization_id && mgr.organization_id !== orgId)) {
      return res.status(403).json({ error: "Invalid Manager PIN." });
    }
  }

  try {
    const branchId = (req.authUser.role !== 'owner') ? req.authUser.branchId : null;
    const shift = shiftId
      ? db.prepare('SELECT * FROM shifts WHERE id = ? AND organization_id = ?').get(shiftId, orgId)
      : (branchId
          ? db.prepare('SELECT * FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? AND branch_id = ? ORDER BY start_time DESC LIMIT 1').get(orgId, branchId)
          : db.prepare('SELECT * FROM shifts WHERE status = \'ACTIVE\' AND organization_id = ? ORDER BY start_time DESC LIMIT 1').get(orgId));
    if (!shift) {
      return res.status(404).json({ error: "No active shift found to close." });
    }

    // Calculate Net Cash Sales for this shift (org + branch scoped)
    const cashSales = db.prepare(`
      SELECT SUM(total) as totalCash
      FROM sales
      WHERE payment_method = 'CASH' AND refunded = 0 AND organization_id = ? AND branch_id = ? AND created_at >= ?
    `).get(orgId, shift.branch_id, shift.start_time).totalCash || 0;

    // Calculate Net Cash Movements for this shift
    const cashMovs = db.prepare(`
      SELECT SUM(amount) as netMov
      FROM cash_movements
      WHERE shift_id = ? AND organization_id = ?
    `).get(shift.id, orgId).netMov || 0;

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
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Close Shift', ?, ?, ?, ?)
    `).run(
      `AUD-${Date.now()}`,
      orgId,
      shift.cashier_name,
      req.authUser.role,
      shift.branch_id || '-',
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
    const orgId = req.authUser.organizationId;
    const shifts = (req.authUser.role !== 'owner')
      ? db.prepare('SELECT * FROM shifts WHERE organization_id = ? AND branch_id = ? ORDER BY start_time DESC LIMIT 20').all(orgId, req.authUser.branchId)
      : db.prepare('SELECT * FROM shifts WHERE organization_id = ? ORDER BY start_time DESC LIMIT 20').all(orgId);
    res.json(shifts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
