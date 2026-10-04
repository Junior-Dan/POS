import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole } from './auth.js';
import { resolveViewBranch, crossBranchDenied } from '../branchStock.js';

const router = express.Router();
router.use(authenticateSession);
// Organization-wide / branch reports are management-only.
router.use(requireRole('owner', 'manager'));
const kenyaDate = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

// Completed (non-refunded) sales, scoped to a branch unless `all` (owner ALL view).
function completedSales(date, orgId, branch, all) {
  let sql = 'SELECT * FROM sales WHERE refunded = 0 AND organization_id = ? AND date(created_at) = ?';
  const params = [orgId, date || kenyaDate(new Date())];
  if (!all) { sql += ' AND branch_id = ?'; params.push(branch); }
  return db.prepare(sql).all(...params);
}

function saleItemsFor(sales) {
  const statement = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
  return sales.flatMap(sale => statement.all(sale.id));
}

// Per-branch stock status computed from product_branch_stock (authoritative).
// A product-branch slot is "low" when current_stock <= its branch min_stock,
// "out" when current_stock === 0. For ALL we still count per (product, branch)
// slot — never the org aggregate treated as one branch.
function stockStatus(orgId, branch, all) {
  // Select the raw snake_case columns (no AS aliases): Postgres folds unquoted
  // aliases to lowercase, so `AS minStock` would come back as `minstock` through
  // the Supabase exec_sql(json_agg) path and misread. Snake_case column names
  // round-trip identically on SQLite, Turso and Supabase.
  let sql = `
    SELECT pbs.branch_id, pbs.current_stock, pbs.min_stock
    FROM product_branch_stock pbs
    JOIN products p ON p.id = pbs.product_id AND p.organization_id = pbs.organization_id
    WHERE pbs.organization_id = ? AND p.active = 1`;
  const params = [orgId];
  if (!all) { sql += ' AND pbs.branch_id = ?'; params.push(branch); }
  const rows = db.prepare(sql).all(...params);

  let lowStockCount = 0, outOfStockCount = 0, stockTotal = 0;
  const perBranch = {};
  for (const r of rows) {
    const bId = r.branch_id;
    const s = Number(r.current_stock), m = Number(r.min_stock);
    stockTotal += s;
    const isLow = s <= m, isOut = s === 0;
    if (isLow) lowStockCount++;
    if (isOut) outOfStockCount++;
    if (!perBranch[bId]) perBranch[bId] = { branchId: bId, lowStockCount: 0, outOfStockCount: 0, stockTotal: 0 };
    perBranch[bId].stockTotal += s;
    if (isLow) perBranch[bId].lowStockCount++;
    if (isOut) perBranch[bId].outOfStockCount++;
  }
  return { lowStockCount, outOfStockCount, stockTotal, perBranch: Object.values(perBranch) };
}

// GET Dashboard metrics calculated directly from database (branch-scoped).
router.get('/dashboard', (req, res) => {
  try {
    const orgId = req.authUser.organizationId;
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);

    const sales = completedSales(req.query.date, orgId, branch, all);
    const items = saleItemsFor(sales);
    const grossSales = sales.reduce((total, sale) => total + Number(sale.total || 0), 0);
    const totalCogs = items.reduce((total, item) => total + Number(item.cost_snapshot || 0) * Number(item.qty || 0), 0);
    const cashSales = sales.filter(sale => sale.payment_method === 'CASH').reduce((total, sale) => total + Number(sale.total || 0), 0);
    const mpesaSales = sales.filter(sale => sale.payment_method === 'M-PESA').reduce((total, sale) => total + Number(sale.total || 0), 0);

    let refundSql = 'SELECT refund_amount FROM sales WHERE refunded = 1 AND organization_id = ? AND date(created_at) = ?';
    const refundParams = [orgId, req.query.date || kenyaDate(new Date())];
    if (!all) { refundSql += ' AND branch_id = ?'; refundParams.push(branch); }
    const refundedSales = db.prepare(refundSql).all(...refundParams);
    const totalRefunds = refundedSales.reduce((total, sale) => total + Number(sale.refund_amount || 0), 0);

    const stock = stockStatus(orgId, branch, all);

    res.json({
      branchId: all ? 'ALL' : branch,
      todayRevenue: grossSales,
      grossSales,
      totalRefunds,
      todayNetSales: grossSales,
      todayCashSales: cashSales,
      todayMpesaSales: mpesaSales,
      todayCogs: totalCogs,
      todayGrossProfit: grossSales - totalCogs,
      totalTransactions: sales.length,
      stockTotal: stock.stockTotal,
      lowStockCount: stock.lowStockCount,
      outOfStockCount: stock.outOfStockCount,
      // Per-branch low/out-of-stock so an ALL view shows status per branch
      // rather than pretending the aggregate is a single branch's status.
      perBranchStock: stock.perBranch
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Category Sales Breakdown (branch-scoped)
router.get('/category-breakdown', (req, res) => {
  try {
    const orgId = req.authUser.organizationId;
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);
    const productById = new Map(db.prepare('SELECT id, category FROM products WHERE organization_id = ?').all(orgId).map(product => [product.id, product]));
    const breakdown = {};
    let salesSql = 'SELECT id FROM sales WHERE refunded = 0 AND organization_id = ?';
    const params = [orgId];
    if (!all) { salesSql += ' AND branch_id = ?'; params.push(branch); }
    saleItemsFor(db.prepare(salesSql).all(...params)).forEach(item => {
      const category = productById.get(item.product_id)?.category || 'Other';
      breakdown[category] = (breakdown[category] || 0) + Number(item.total || 0);
    });

    res.json(breakdown);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Hourly Traffic Report (branch-scoped)
router.get('/hourly', (req, res) => {
  try {
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);
    const hours = ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const orders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    completedSales(undefined, req.authUser.organizationId, branch, all).forEach(sale => {
      const h = new Date(sale.created_at).getHours();
      const idx = Math.floor(h / 2);
      if (idx >= 0 && idx < 12) {
        data[idx] += Number(sale.total || 0);
        orders[idx] += 1;
      }
    });

    res.json({ hours, data, orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Brand Profitability Matrix (branch-scoped)
router.get('/brand-profitability', (req, res) => {
  try {
    const orgId = req.authUser.organizationId;
    if (crossBranchDenied(req.authUser, req.query.branch)) {
      return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
    }
    const { branch, all } = resolveViewBranch(req.authUser, req.query.branch);
    const productById = new Map(db.prepare('SELECT id, brand FROM products WHERE organization_id = ?').all(orgId).map(product => [product.id, product]));
    const brands = new Map();
    let salesSql = 'SELECT id FROM sales WHERE refunded = 0 AND organization_id = ?';
    const params = [orgId];
    if (!all) { salesSql += ' AND branch_id = ?'; params.push(branch); }
    saleItemsFor(db.prepare(salesSql).all(...params)).forEach(item => {
      const brand = productById.get(item.product_id)?.brand || 'Other';
      const current = brands.get(brand) || { brand, units: 0, revenue: 0, cogs: 0 };
      current.units += Number(item.qty || 0);
      current.revenue += Number(item.total || 0);
      current.cogs += Number(item.cost_snapshot || 0) * Number(item.qty || 0);
      brands.set(brand, current);
    });

    const matrix = [...brands.values()].sort((left, right) => right.revenue - left.revenue).map(row => {
      const margin = row.revenue - row.cogs;
      const marginPct = row.revenue > 0 ? ((margin / row.revenue) * 100).toFixed(1) : 0;
      return {
        ...row,
        margin,
        marginPct
      };
    });

    res.json(matrix);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
