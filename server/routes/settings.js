import express from 'express';
import { db } from '../db.js';
import { authenticateSession } from './auth.js';
import { settingKey } from '../tenant.js';

const router = express.Router();
router.use(authenticateSession);
// Any authenticated user may read settings (business profile, receipt config
// etc. are needed app-wide); only owner/manager may change them.
router.use((req, res, next) => {
  if (req.method !== 'GET' && !['owner', 'manager'].includes(req.authUser.role)) {
    return res.status(403).json({ error: 'Only Owner or Manager may change settings.' });
  }
  next();
});

// GET all settings for THIS organization (keys stored namespaced as
// "<orgId>::<name>"; the prefix is stripped before returning).
router.get('/', (req, res) => {
  try {
    const orgId = req.authUser.organizationId;
    const prefix = `${orgId}::`;
    const rows = db.prepare('SELECT * FROM settings WHERE key LIKE ?').all(`${prefix}%`);
    const settings = {};
    rows.forEach(r => {
      const name = r.key.startsWith(prefix) ? r.key.slice(prefix.length) : r.key;
      try {
        settings[name] = JSON.parse(r.value);
      } catch (e) {
        settings[name] = r.value;
      }
    });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update a specific settings section for THIS organization.
router.put('/:key', (req, res) => {
  const { key } = req.params;
  const value = req.body;
  const orgId = req.authUser.organizationId;

  try {
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(settingKey(orgId, key), strVal);

    // Keep the authoritative organization name in sync with the business
    // profile so owner and staff always show the exact same business name.
    if (key === 'businessProfile' && value && typeof value === 'object' && value.name) {
      try { db.prepare('UPDATE organizations SET name = ? WHERE id = ?').run(String(value.name), orgId); } catch (e) {}
    }

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'Update Settings', ?, '-', 'Updated', 'Configuration settings updated')
    `).run(`AUD-${Date.now()}`, orgId, req.authUser.name, req.authUser.role, req.authUser.branchId || '-', key);

    res.json({ success: true, key, value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
