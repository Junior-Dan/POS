import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole } from './auth.js';

const router = express.Router();
router.use(authenticateSession);
// Organization-wide / branch reports are management-only.
router.use(requireRole('owner', 'manager'));
const kenyaDate = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

function completedSales(date) {
  return db.prepare('SELECT * FROM sales WHERE refunded = 0 AND date(created_at) = ?').all(date || kenyaDate(new Date()));
}

function saleItemsFor(sales) {
  const statement = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
  return sales.flatMap(sale => statement.all(sale.id));
}

// GET Dashboard metrics calculated directly from database
router.get('/dashboard', (req, res) => {
  try {
    const sales = completedSales(req.query.date);
    const items = saleItemsFor(sales);
    const grossSales = sales.reduce((total, sale) => total + Number(sale.total || 0), 0);
    const totalCogs = items.reduce((total, item) => total + Number(item.cost_snapshot || 0) * Number(item.qty || 0), 0);
    const cashSales = sales.filter(sale => sale.payment_method === 'CASH').reduce((total, sale) => total + Number(sale.total || 0), 0);
    const mpesaSales = sales.filter(sale => sale.payment_method === 'M-PESA').reduce((total, sale) => total + Number(sale.total || 0), 0);
    const refundedSales = db.prepare('SELECT refund_amount FROM sales WHERE refunded = 1 AND date(created_at) = ?').all(req.query.date || kenyaDate(new Date()));
    const totalRefunds = refundedSales.reduce((total, sale) => total + Number(sale.refund_amount || 0), 0);
    const activeProducts = db.prepare('SELECT current_stock, min_stock FROM products WHERE active = 1').all();
    const lowStockCount = activeProducts.filter(product => Number(product.current_stock) <= Number(product.min_stock)).length;
    const outOfStockCount = activeProducts.filter(product => Number(product.current_stock) === 0).length;

    res.json({
      todayRevenue: grossSales,
      grossSales,
      totalRefunds,
      todayNetSales: grossSales,
      todayCashSales: cashSales,
      todayMpesaSales: mpesaSales,
      todayCogs: totalCogs,
      todayGrossProfit: grossSales - totalCogs,
      totalTransactions: sales.length,
      lowStockCount,
      outOfStockCount
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Category Sales Breakdown
router.get('/category-breakdown', (req, res) => {
  try {
    const productById = new Map(db.prepare('SELECT id, category FROM products').all().map(product => [product.id, product]));
    const breakdown = {};
    saleItemsFor(db.prepare('SELECT id FROM sales WHERE refunded = 0').all()).forEach(item => {
      const category = productById.get(item.product_id)?.category || 'Other';
      breakdown[category] = (breakdown[category] || 0) + Number(item.total || 0);
    });

    res.json(breakdown);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Hourly Traffic Report
router.get('/hourly', (req, res) => {
  try {
    const hours = ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const orders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    completedSales().forEach(sale => {
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

// GET Brand Profitability Matrix
router.get('/brand-profitability', (req, res) => {
  try {
    const productById = new Map(db.prepare('SELECT id, brand FROM products').all().map(product => [product.id, product]));
    const brands = new Map();
    saleItemsFor(db.prepare('SELECT id FROM sales WHERE refunded = 0').all()).forEach(item => {
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
