import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET all settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch (e) {
        settings[r.key] = r.value;
      }
    });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update a specific settings section
router.put('/:key', (req, res) => {
  const { key } = req.params;
  const value = req.body;

  try {
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, strVal);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, CURRENT_TIMESTAMP, 'Manager', 'manager', 'B1', 'Update Settings', ?, '-', 'Updated', 'Configuration settings updated')
    `).run(`AUD-${Date.now()}`, key);

    res.json({ success: true, key, value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
