import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Verify user login / PIN authentication
router.post('/login', (req, res) => {
  const { pin, username } = req.body;
  
  if (!pin) {
    return res.status(400).json({ error: "PIN is required" });
  }

  let user;
  if (username) {
    user = db.prepare('SELECT * FROM users WHERE (name = ? OR email = ?) AND pin = ? AND active = 1').get(username, username, pin);
  } else {
    user = db.prepare('SELECT * FROM users WHERE pin = ? AND active = 1').get(pin);
  }

  if (!user) {
    return res.status(401).json({ error: "Invalid PIN or username" });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    }
  });
});

// Verify PIN for sensitive operations (e.g., manager / owner authorization)
router.post('/verify-pin', (req, res) => {
  const { pin, requiredRoles } = req.body;
  if (!pin) {
    return res.status(400).json({ error: "PIN is required" });
  }

  const user = db.prepare('SELECT * FROM users WHERE pin = ? AND active = 1').get(pin);
  if (!user) {
    return res.status(401).json({ error: "Invalid PIN entered!" });
  }

  const allowedRoles = requiredRoles || ['owner', 'manager'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: `Unauthorized: User role '${user.role}' lacks permission.` });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    }
  });
});

// GET all users
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, name, role, email, active FROM users').all();
  res.json(users);
});

// POST create user
router.post('/users', (req, res) => {
  const { name, role, pin, email } = req.body;
  if (!name || !role || !pin) {
    return res.status(400).json({ error: "Name, role, and PIN are required" });
  }

  const id = `U${Date.now()}`;
  try {
    db.prepare('INSERT INTO users (id, name, role, pin, email, active) VALUES (?, ?, ?, ?, ?, 1)')
      .run(id, name, role, pin, email || null);
    
    // Log audit
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, 'System', 'owner', 'B1', 'Create User', ?, '-', ?, 'New staff member added')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), name, role);

    const newUser = db.prepare('SELECT id, name, role, email, active FROM users WHERE id = ?').get(id);
    res.status(201).json(newUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update user
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, pin, email, active } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          role = COALESCE(?, role),
          pin = COALESCE(?, pin),
          email = COALESCE(?, email),
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(name, role, pin, email, active, id);

    const updated = db.prepare('SELECT id, name, role, email, active FROM users WHERE id = ?').get(id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reset PIN
router.post('/reset-pin', (req, res) => {
  const { userId, newPin } = req.body;
  if (!userId || !newPin) {
    return res.status(400).json({ error: "userId and newPin are required" });
  }

  try {
    db.prepare('UPDATE users SET pin = ? WHERE id = ?').run(newPin, userId);
    res.json({ success: true, message: "PIN reset successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
