import express from 'express';
import { db } from '../db.js';
import { authenticateSession, requireRole } from './auth.js';

const router = express.Router();
router.use(authenticateSession);
router.use(requireRole('owner', 'manager', 'inventory_officer'));

// GET suppliers
router.get('/', (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE active = 1 AND organization_id = ? ORDER BY name ASC').all(req.authUser.organizationId);
    res.json(suppliers.map(s => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contact_person,
      phone: s.phone,
      email: s.email,
      address: s.address
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Create supplier
router.post('/', (req, res) => {
  const { name, contactPerson, phone, email, address } = req.body;
  if (!name) return res.status(400).json({ error: "Supplier name is required." });

  const id = `SUP-${Date.now()}`;
  const orgId = req.authUser.organizationId;
  try {
    db.prepare(`
      INSERT INTO suppliers (id, organization_id, name, contact_person, phone, email, address, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, orgId, name, contactPerson || null, phone || null, email || null, address || null);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Create Supplier', ?, '-', 'Active', 'New supplier registered')
    `).run(`AUD-${Date.now()}`, orgId, req.authUser.name, req.authUser.role, req.authUser.branchId || '-', name);

    res.status(201).json({ id, name, contactPerson, phone, email, address });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT Update supplier
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, contactPerson, phone, email, address } = req.body;

  const orgId = req.authUser.organizationId;
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ? AND organization_id = ?').get(id, orgId);
    if (!existing) return res.status(404).json({ error: "Supplier not found" });

    db.prepare(`
      UPDATE suppliers
      SET name = COALESCE(?, name),
          contact_person = COALESCE(?, contact_person),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address)
      WHERE id = ? AND organization_id = ?
    `).run(name, contactPerson, phone, email, address, id, orgId);

    res.json({ message: "Supplier updated successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
