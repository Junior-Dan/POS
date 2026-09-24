import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET all active products
router.get('/', (req, res) => {
  try {
    const { category, search, activeOnly } = req.query;
    let sql = `
      SELECT p.*, s.name as supplier_name 
      FROM products p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id
    `;
    const params = [];
    const conditions = [];

    if (activeOnly !== 'false') {
      conditions.push('p.active = 1');
    }

    if (category && category !== 'All') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.name ASC';

    const products = db.prepare(sql).all(...params);

    // Map fields to match existing frontend expectations
    const mapped = products.map(p => ({
      id: p.id,
      brand: p.brand || '',
      name: p.name,
      category: p.category,
      productType: p.product_type || 'retail',
      unit: p.unit || 'bottle',
      abv: p.abv || 0,
      size: p.size || '',
      caseUnits: p.case_units || 12,
      barcode: p.barcode || '',
      sku: p.sku || '',
      cost: p.cost_price,
      price: p.selling_price,
      wholesalePrice: p.wholesale_price || 0,
      minPrice: p.min_price || 0,
      taxRate: p.tax_rate || 16,
      stock: p.current_stock,
      minStock: p.min_stock || 5,
      reorder: p.reorder_level || 10,
      supplierId: p.supplier_id,
      supplierName: p.supplier_name,
      highValue: Boolean(p.high_value),
      active: Boolean(p.active)
    }));

    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET product by Barcode or SKU or ID
router.get('/lookup/:query', (req, res) => {
  const { query } = req.params;
  try {
    const product = db.prepare(`
      SELECT p.*, s.name as supplier_name 
      FROM products p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.barcode = ? OR p.sku = ? OR p.id = ?
    `).get(query, query, query);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      id: product.id,
      brand: product.brand || '',
      name: product.name,
      category: product.category,
      productType: product.product_type || 'retail',
      unit: product.unit || 'bottle',
      abv: product.abv || 0,
      size: product.size || '',
      caseUnits: product.case_units || 12,
      barcode: product.barcode || '',
      sku: product.sku || '',
      cost: product.cost_price,
      price: product.selling_price,
      wholesalePrice: product.wholesale_price || 0,
      minPrice: product.min_price || 0,
      taxRate: product.tax_rate || 16,
      stock: product.current_stock,
      minStock: product.min_stock || 5,
      reorder: product.reorder_level || 10,
      supplierId: product.supplier_id,
      supplierName: product.supplier_name,
      highValue: Boolean(product.high_value),
      active: Boolean(product.active)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create product
router.post('/', (req, res) => {
  const p = req.body;
  if (!p.name || !p.category || p.price === undefined) {
    return res.status(400).json({ error: "Name, category, and price are required" });
  }

  // Check unique barcode / SKU
  if (p.barcode) {
    const exists = db.prepare('SELECT id FROM products WHERE barcode = ?').get(p.barcode);
    if (exists) return res.status(400).json({ error: `Barcode '${p.barcode}' is already assigned to another product!` });
  }
  if (p.sku) {
    const exists = db.prepare('SELECT id FROM products WHERE sku = ?').get(p.sku);
    if (exists) return res.status(400).json({ error: `SKU '${p.sku}' is already assigned to another product!` });
  }

  const id = p.id || `P${Date.now()}`;
  const costPrice = parseFloat(p.cost || p.costPrice || 0);
  const sellingPrice = parseFloat(p.price || p.sellingPrice || 0);
  const stock = parseInt(p.stock || p.currentStock || 0, 10);

  try {
    const stmt = db.prepare(`
      INSERT INTO products (
        id, brand, name, category, product_type, unit, abv, size, case_units,
        barcode, sku, cost_price, selling_price, wholesale_price, min_price,
        tax_rate, current_stock, min_stock, reorder_level, supplier_id, high_value, active
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 1
      )
    `);

    stmt.run(
      id,
      p.brand || '',
      p.name,
      p.category,
      p.productType || 'retail',
      p.unit || 'bottle',
      parseFloat(p.abv || 0),
      p.size || '',
      parseInt(p.caseUnits || 12, 10),
      p.barcode || null,
      p.sku || null,
      costPrice,
      sellingPrice,
      parseFloat(p.wholesalePrice || sellingPrice),
      parseFloat(p.minPrice || costPrice),
      parseFloat(p.taxRate || 16),
      stock,
      parseInt(p.minStock || 5, 10),
      parseInt(p.reorder || p.reorderLevel || 10, 10),
      p.supplierId || null,
      p.highValue ? 1 : 0
    );

    // Record initial stock movement
    if (stock > 0) {
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, product_name, type, qty, previous_stock, new_stock, ref, user_name, reason)
        VALUES (?, ?, ?, 'OPENING_STOCK', ?, 0, ?, 'NEW_PRODUCT', ?, 'Product Created Initial Stock')
      `).run(`MOV-${Date.now()}`, id, `${p.brand || ''} ${p.name}`.trim(), stock, stock, p.userName || 'System');
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, 'manager', 'B1', 'Create Product', ?, '-', ?, 'New product registered')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), p.userName || 'Manager', p.name, `Price: KSh ${sellingPrice}, Stock: ${stock}`);

    res.status(201).json({ id, ...p, cost: costPrice, price: sellingPrice, stock });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update product
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const p = req.body;

  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    const costPrice = p.cost !== undefined ? parseFloat(p.cost) : (p.costPrice !== undefined ? parseFloat(p.costPrice) : existing.cost_price);
    const sellingPrice = p.price !== undefined ? parseFloat(p.price) : (p.sellingPrice !== undefined ? parseFloat(p.sellingPrice) : existing.selling_price);
    const stock = p.stock !== undefined ? parseInt(p.stock, 10) : existing.current_stock;

    db.prepare(`
      UPDATE products
      SET brand = COALESCE(?, brand),
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          product_type = COALESCE(?, product_type),
          unit = COALESCE(?, unit),
          abv = COALESCE(?, abv),
          size = COALESCE(?, size),
          case_units = COALESCE(?, case_units),
          barcode = COALESCE(?, barcode),
          sku = COALESCE(?, sku),
          cost_price = ?,
          selling_price = ?,
          wholesale_price = COALESCE(?, wholesale_price),
          min_price = COALESCE(?, min_price),
          current_stock = ?,
          reorder_level = COALESCE(?, reorder_level),
          supplier_id = COALESCE(?, supplier_id),
          high_value = COALESCE(?, high_value),
          active = COALESCE(?, active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      p.brand, p.name, p.category, p.productType, p.unit, p.abv, p.size,
      p.caseUnits, p.barcode, p.sku, costPrice, sellingPrice, p.wholesalePrice,
      p.minPrice, stock, p.reorder || p.reorderLevel, p.supplierId, p.highValue ? 1 : 0,
      p.active !== undefined ? (p.active ? 1 : 0) : existing.active, id
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, 'manager', 'B1', 'Update Product', ?, ?, ?, 'Product details updated')
    `).run(
      `AUD-${Date.now()}`, new Date().toISOString(), p.userName || 'Manager', existing.name,
      `Price: ${existing.selling_price}, Stock: ${existing.current_stock}`,
      `Price: ${sellingPrice}, Stock: ${stock}`
    );

    res.json({ message: "Product updated successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE (soft-deactivate) product
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT name FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, 'Manager', 'manager', 'B1', 'Deactivate Product', ?, 'Active', 'Inactive', 'Product deactivated')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), existing.name);

    res.json({ message: "Product deactivated successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Categories Endpoints
router.get('/categories/all', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY name ASC').all();
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/categories/create', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required" });

  const id = `CAT-${Date.now()}`;
  try {
    db.prepare('INSERT INTO categories (id, name, description, active) VALUES (?, ?, ?, 1)').run(id, name, description || null);
    res.status(201).json({ id, name, description });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
