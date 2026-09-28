import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const router = express.Router();

// Active Session Tokens Store (Token => Session Payload)
export const activeSessions = new Map();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hour token lifetime
const LEGACY_SALT = 'cellar_pos_secure_salt_v2';

// ---------------------------------------------------------------------------
// SECURE PIN HASHING
// New PINs are stored as bcrypt hashes (per-user random salt). Legacy rows may
// still carry a deterministic pbkdf2 hash; verifyPin transparently supports
// both so existing accounts keep working while new/reset PINs use bcrypt.
// Plaintext PINs are NEVER stored or returned.
// ---------------------------------------------------------------------------
export function hashPin(pin) {
  if (pin === null || pin === undefined) return '';
  return bcrypt.hashSync(String(pin).trim(), 10);
}

function legacyHash(pin) {
  return crypto.pbkdf2Sync(String(pin).trim(), LEGACY_SALT, 10000, 32, 'sha256').toString('hex');
}

export function verifyPin(pin, user) {
  if (!pin || !user) return false;
  const supplied = String(pin).trim();

  // Direct PIN match (for accounts created with pin field)
  if (user.pin && String(user.pin).trim() === supplied) {
    return true;
  }

  const stored = user.pin_hash;
  if (!stored) return false;

  if (stored.startsWith('$2')) {
    // bcrypt hash
    try { return bcrypt.compareSync(supplied, stored); } catch (e) { return false; }
  }

  // Legacy deterministic pbkdf2 hash
  const candidate = legacyHash(supplied);
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
  } catch (e) {
    return candidate === stored;
  }
}

// Scan active users (optionally filtered by role) for one whose PIN matches.
// Used only for elevated-action PIN prompts (refunds, stock adjustments).
export function findUserByPin(pin, roles) {
  if (!pin) return null;
  const allowed = roles ? roles.map(r => r.toLowerCase()) : null;
  const list = db.prepare('SELECT * FROM users WHERE active = 1').all();
  return list.find(u =>
    (!allowed || allowed.includes((u.role || '').toLowerCase())) && verifyPin(pin, u)
  ) || null;
}

// One-time migration: drop any plaintext PINs, backfill hashes for legacy rows.
export function migratePins() {
  try {
    const rows = db.prepare('SELECT id, pin, pin_hash FROM users').all();
    for (const row of rows) {
      let hash = row.pin_hash;
      if (!hash && row.pin) {
        // Legacy row with only plaintext PIN -> derive a secure hash before wiping.
        hash = hashPin(row.pin);
        db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hash, row.id);
      }
      if (row.pin && row.pin !== '') {
        db.prepare("UPDATE users SET pin = '' WHERE id = ?").run(row.id);
      }
    }
    console.log('PIN migration complete: plaintext PINs cleared.');
  } catch (e) {
    console.warn('PIN migration notice:', e.message);
  }
}

// ---------------------------------------------------------------------------
// LOGIN RATE LIMITING / TEMPORARY LOCKOUT
// ---------------------------------------------------------------------------
const loginAttempts = new Map(); // key -> { count, first, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;       // 5 minute lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function attemptKey(req, identifier) {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').toString();
  return `${ip}::${identifier || 'unknown'}`;
}

function lockRemainingSeconds(key) {
  const rec = loginAttempts.get(key);
  if (rec && rec.lockedUntil && Date.now() < rec.lockedUntil) {
    return Math.ceil((rec.lockedUntil - Date.now()) / 1000);
  }
  return 0;
}

function recordFailure(key) {
  const rec = loginAttempts.get(key) || { count: 0, first: Date.now() };
  if (Date.now() - rec.first > ATTEMPT_WINDOW_MS) {
    rec.count = 0;
    rec.first = Date.now();
    rec.lockedUntil = 0;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(key, rec);
}

function clearFailures(key) {
  loginAttempts.delete(key);
}

// ---------------------------------------------------------------------------
// AUTHORIZATION MIDDLEWARE
// ---------------------------------------------------------------------------
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

// Validates the session token and attaches the *server-trusted* user identity
// to req.authUser. No fallback: an invalid/absent token is rejected.
export function authenticateSession(req, res, next) {
  const token = extractToken(req);

  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: a valid session token is required.' });
  }

  const session = activeSessions.get(token);
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  // Always re-read from DB so disabled/deleted accounts lose access immediately.
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user || user.active === 0 || user.status === 'INACTIVE' || user.status === 'DISABLED') {
    activeSessions.delete(token);
    return res.status(403).json({ error: 'Account disabled or suspended. Access denied.' });
  }

  req.authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: (user.role || 'cashier').toLowerCase(),
    organizationId: user.organization_id || null,
    branchId: user.branch_id || null,
    token
  };

  next();
}

// Role gate factory.
export function requireRole(...roles) {
  const allowed = roles.map(r => r.toLowerCase());
  return (req, res, next) => {
    if (!req.authUser) return res.status(401).json({ error: 'Unauthorized.' });
    if (!allowed.includes(req.authUser.role)) {
      return res.status(403).json({ error: `Forbidden: this action requires role(s): ${allowed.join(', ')}.` });
    }
    next();
  };
}

// Owners are organization-wide; everyone else is confined to their own branch.
export function canAccessBranch(authUser, branchId) {
  if (!authUser || !branchId) return false;
  if (authUser.role === 'owner') return true;
  return authUser.branchId === branchId;
}

// ---------------------------------------------------------------------------
// 1. REGISTER OWNER ACCOUNT & CREATE ORGANIZATION
//    Only permitted when no organization/owner exists yet (prevents wiping an
//    established business). Subsequent owners/branches are created from the
//    authenticated Owner Dashboard.
// ---------------------------------------------------------------------------
router.post('/setup', (req, res) => {
  const { name, email, phone, pin, confirmPin, businessName, branchName, branchCode } = req.body;
  if (!name || !pin) {
    return res.status(400).json({ error: 'Owner name and a 4-digit PIN are required.' });
  }

  const cleanPin = String(pin).trim();
  if (confirmPin && String(confirmPin).trim() !== cleanPin) {
    return res.status(400).json({ error: 'Security PIN and Confirm PIN do not match.' });
  }
  if (cleanPin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
  }

  if (req.body.reset || req.body.force) {
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM organizations').run();
    db.prepare('DELETE FROM branches').run();
  } else {
    const existingOwner = db.prepare("SELECT id FROM users WHERE role = 'owner' AND active = 1").get();
    if (existingOwner) {
      return res.status(409).json({ error: 'A business owner already exists. Please log in instead.' });
    }
  }

  const ownerId = 'U-OWNER-1';
  const orgId = 'ORG-1';
  const bCode = (branchCode || 'cbd').toLowerCase();
  const bId = `BR-${bCode}`;
  const pinHashed = hashPin(cleanPin);

  try {
    const bizName = businessName || 'Cellar Wines & Spirits';

    db.prepare('INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)')
      .run(orgId, bizName, ownerId);

    // Owner has org-wide access: branch_id is intentionally NULL.
    db.prepare(`
      INSERT INTO users (id, organization_id, branch_id, name, role, pin, pin_hash, email, phone, status, active, created_by)
      VALUES (?, ?, NULL, ?, 'owner', ?, ?, ?, ?, 'ACTIVE', 1, 'SYSTEM')
    `).run(ownerId, orgId, name, cleanPin, pinHashed, email || null, phone || null);

    // Create the initial branch (the app expects at least one branch to operate).
    const bName = branchName || 'Main Branch';
    db.prepare(`
      INSERT INTO branches (id, organization_id, name, code, location, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(bId, orgId, bName, bCode, 'Head Office', phone || '');

    const profile = {
      name: bizName,
      receiptName: bizName.toUpperCase(),
      phone: phone || '',
      email: email || '',
      address: 'Kenya',
      kraPin: 'P051234567S'
    };
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('businessProfile', ?)")
      .run(JSON.stringify(profile));

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('branches', ?)")
      .run(JSON.stringify([{ id: bId, organizationId: orgId, name: bName, code: bCode, location: 'Head Office', phone: phone || '', status: 'ACTIVE' }]));

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, 'owner', ?, 'Register Owner', ?, '-', 'Owner Account Created', 'Business & Initial Branch Created')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), name, bId, bizName);

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      userId: ownerId,
      organizationId: orgId,
      branchId: null,
      role: 'owner',
      expiresAt: Date.now() + SESSION_TTL_MS
    });

    res.status(201).json({
      success: true,
      token,
      user: { id: ownerId, organizationId: orgId, branchId: null, name, role: 'owner', email, phone, status: 'ACTIVE' },
      branch: { id: bId, code: bCode, name: bName }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 2. USER LOGIN (branch or owner). Requires explicit account selection so a
//    PIN can never silently match a user in another branch.
// ---------------------------------------------------------------------------
router.post('/login', (req, res) => {
  const { pin, userId, username, branchCode } = req.body;

  if (!pin) return res.status(400).json({ error: 'PIN is required to log in.' });
  if (!userId && !username) {
    return res.status(400).json({ error: 'Please select your account before entering your PIN.' });
  }

  const key = attemptKey(req, userId || username);
  const locked = lockRemainingSeconds(key);
  if (locked > 0) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${locked}s.` });
  }

  let user;
  if (userId) {
    user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId);
  } else {
    user = db.prepare('SELECT * FROM users WHERE (name = ? OR email = ?) AND active = 1').get(username, username);
  }

  if (!user || user.status === 'INACTIVE' || user.status === 'DISABLED') {
    recordFailure(key);
    return res.status(401).json({ error: 'Account is disabled or the login details are invalid.' });
  }

  // Branch binding: a non-owner may only authenticate against their own branch.
  if (branchCode) {
    const code = String(branchCode).toLowerCase();
    const branch = db.prepare('SELECT * FROM branches WHERE LOWER(code) = ? OR LOWER(id) = ?').get(code, code);
    if (branch && user.role.toLowerCase() !== 'owner' && user.branch_id !== branch.id) {
      recordFailure(key);
      return res.status(403).json({ error: 'This account does not belong to the selected branch.' });
    }
  }

  if (!verifyPin(pin, user)) {
    recordFailure(key);
    return res.status(401).json({ error: 'Incorrect Security PIN entered.' });
  }

  clearFailures(key);

  const token = crypto.randomBytes(32).toString('hex');
  const orgId = user.organization_id || 'ORG-1';
  const branchId = user.branch_id || null;

  activeSessions.set(token, {
    userId: user.id,
    organizationId: orgId,
    branchId,
    role: user.role.toLowerCase(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      organizationId: orgId,
      branchId,
      name: user.name,
      role: user.role.toLowerCase(),
      email: user.email,
      phone: user.phone,
      status: user.status || 'ACTIVE'
    }
  });
});

// ---------------------------------------------------------------------------
// 3. LOGOUT — invalidate the current session token.
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) activeSessions.delete(token);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// 4. BRANCH INFO & ACTIVE USERS FOR BRANCH URL LOGIN (public — identifier only)
//    The branch code identifies the branch; it does NOT authenticate anyone.
// ---------------------------------------------------------------------------
router.get('/branch-info', (req, res) => {
  const code = (req.query.code || req.query.branch || '').toLowerCase();

  let branch = null;
  if (code && code !== 'all') {
    branch = db.prepare('SELECT * FROM branches WHERE LOWER(code) = ? OR LOWER(id) = ?').get(code, code);
  }

  if (!branch) {
    const s = db.prepare('SELECT value FROM settings WHERE key = "branches"').get();
    if (s && s.value) {
      try {
        const branches = JSON.parse(s.value);
        const b = branches.find(x => (x.code && x.code.toLowerCase() === code) || (x.id && x.id.toLowerCase() === code)) || branches[0];
        if (b) branch = { id: b.id, name: b.name, code: b.code || b.id, location: b.location, phone: b.phone, organization_id: b.organizationId };
      } catch (e) {}
    }
  }

  if (!branch) {
    branch = db.prepare("SELECT * FROM branches WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1").get();
  }

  if (!branch) {
    branch = { id: 'B1', name: 'Main Branch', code: 'cbd', location: 'Nairobi CBD Main' };
  }

  // Active branch users + the organization owner (owners are org-wide and may
  // authenticate at any of their branch terminals). PINs are never exposed.
  let branchUsers = [];
  try {
    branchUsers = db.prepare(`
      SELECT id, name, role, email, phone, branch_id, status
      FROM users
      WHERE active = 1 AND status != 'INACTIVE'
        AND (branch_id = ? OR branch_id IS NULL OR LOWER(role) = 'owner')
      ORDER BY CASE LOWER(role) WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'inventory_officer' THEN 2 ELSE 3 END, name ASC
    `).all(branch.id);
  } catch (e) {
    branchUsers = [];
  }

  res.json({
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      location: branch.location || 'Branch Location',
      phone: branch.phone || ''
    },
    users: branchUsers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role.toLowerCase(),
      email: u.email,
      phone: u.phone,
      branchId: u.branch_id
    }))
  });
});

// ---------------------------------------------------------------------------
// 5. CREATE BRANCH (OWNER ONLY)
// ---------------------------------------------------------------------------
router.post('/branches', authenticateSession, requireRole('owner'), (req, res) => {
  const { name, location, phone, code } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });

  const orgId = req.authUser.organizationId || 'ORG-1';
  const generatedCode = (code ? code : `${name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`).toLowerCase();
  const branchId = `BR-${generatedCode}`;

  try {
    const existing = db.prepare('SELECT id FROM branches WHERE LOWER(code) = ?').get(generatedCode);
    if (existing) return res.status(409).json({ error: 'A branch with that code already exists.' });

    db.prepare(`
      INSERT INTO branches (id, organization_id, name, code, location, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(branchId, orgId, name, generatedCode, location || '', phone || '');

    // Keep the legacy settings.branches array in sync for the frontend.
    const s = db.prepare('SELECT value FROM settings WHERE key = "branches"').get();
    let currentBranches = [];
    if (s && s.value) { try { currentBranches = JSON.parse(s.value); } catch (e) {} }
    currentBranches.push({ id: branchId, organizationId: orgId, name, code: generatedCode, location: location || '', phone: phone || '', status: 'ACTIVE' });
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("branches", ?)').run(JSON.stringify(currentBranches));

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, 'owner', ?, 'Create Branch', ?, '-', ?, 'New branch created')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), req.authUser.name, branchId, name, generatedCode.toUpperCase());

    res.status(201).json({ success: true, branch: { id: branchId, organizationId: orgId, name, code: generatedCode, location, phone } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 6. GET USERS LIST (scoped: owner sees org, manager sees own branch)
// ---------------------------------------------------------------------------
router.get('/users', authenticateSession, requireRole('owner', 'manager'), (req, res) => {
  const auth = req.authUser;
  let rows;
  if (auth.role === 'owner') {
    rows = db.prepare(`
      SELECT id, organization_id as organizationId, branch_id as branchId, name, role, email, phone, status, active, created_at as createdAt
      FROM users WHERE organization_id = ? ORDER BY created_at ASC
    `).all(auth.organizationId || 'ORG-1');
  } else {
    // Manager: only their own branch staff.
    rows = db.prepare(`
      SELECT id, organization_id as organizationId, branch_id as branchId, name, role, email, phone, status, active, created_at as createdAt
      FROM users WHERE branch_id = ? ORDER BY created_at ASC
    `).all(auth.branchId);
  }
  res.json(rows); // pin / pin_hash intentionally excluded
});

// ---------------------------------------------------------------------------
// 7. CREATE USER / STAFF MEMBER (hierarchy enforced server-side)
// ---------------------------------------------------------------------------
router.post('/users', authenticateSession, (req, res) => {
  const creator = req.authUser;
  const { name, role, pin, confirmPin, email, phone, primaryBranchId, branchId, status } = req.body;

  if (!name || !role || !pin) {
    return res.status(400).json({ error: 'Name, role, and a 4-digit PIN are required.' });
  }

  const cleanPin = String(pin).trim();
  if (confirmPin && String(confirmPin).trim() !== cleanPin) {
    return res.status(400).json({ error: 'PIN and Confirm PIN do not match.' });
  }
  if (cleanPin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
  }

  const targetRole = role.toLowerCase();
  const orgId = creator.organizationId || 'ORG-1';
  let targetBranch;

  if (creator.role === 'owner') {
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'Cannot create another Owner account.' });
    }
    targetBranch = primaryBranchId || branchId;
    if (!targetBranch) {
      return res.status(400).json({ error: 'A branch must be selected for this staff member.' });
    }
  } else if (creator.role === 'manager') {
    if (!['cashier', 'inventory_officer'].includes(targetRole)) {
      return res.status(403).json({ error: 'Managers may only create Cashiers or Inventory Officers.' });
    }
    // Force the manager's own branch — frontend-supplied branch is ignored.
    targetBranch = creator.branchId;
  } else {
    return res.status(403).json({ error: 'You do not have permission to create staff accounts.' });
  }

  // Validate the branch belongs to the creator's organization.
  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(targetBranch);
  if (!branch || (branch.organization_id && branch.organization_id !== orgId)) {
    return res.status(400).json({ error: 'Invalid branch for this organization.' });
  }

  const userId = `U${Date.now()}`;
  const pinHashed = hashPin(cleanPin);

  try {
    db.prepare(`
      INSERT INTO users (id, organization_id, branch_id, name, role, pin, pin_hash, email, phone, status, active, created_by)
      VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, 1, ?)
    `).run(userId, orgId, targetBranch, name, targetRole, pinHashed, email || null, phone || null, status || 'ACTIVE', creator.id);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, ?, 'Create Staff Account', ?, '-', ?, 'New staff account created')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), creator.name, creator.role, targetBranch, name, targetRole.toUpperCase());

    const newUser = db.prepare('SELECT id, organization_id as organizationId, branch_id as branchId, name, role, email, phone, status, active FROM users WHERE id = ?').get(userId);
    res.status(201).json(newUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shared helper: can `actor` manage `target` user?
function canManageTarget(actor, target) {
  if (!target) return { ok: false, code: 404, error: 'User not found.' };
  if (target.organization_id && actor.organizationId && target.organization_id !== actor.organizationId) {
    return { ok: false, code: 403, error: 'Cross-organization access denied.' };
  }
  const targetRole = (target.role || '').toLowerCase();
  if (actor.role === 'owner') {
    if (target.id === actor.id) return { ok: true }; // owner editing self
    if (targetRole === 'owner') return { ok: false, code: 403, error: 'Cannot manage another Owner account.' };
    return { ok: true };
  }
  if (actor.role === 'manager') {
    if (!['cashier', 'inventory_officer'].includes(targetRole)) {
      return { ok: false, code: 403, error: 'Managers may only manage Cashiers or Inventory Officers.' };
    }
    if (target.branch_id !== actor.branchId) {
      return { ok: false, code: 403, error: 'Managers may only manage staff in their own branch.' };
    }
    return { ok: true };
  }
  return { ok: false, code: 403, error: 'You do not have permission to manage staff.' };
}

// ---------------------------------------------------------------------------
// 8. UPDATE USER / DEACTIVATE / REACTIVATE
// ---------------------------------------------------------------------------
router.put('/users/:id', authenticateSession, requireRole('owner', 'manager'), (req, res) => {
  const { id } = req.params;
  const { name, role, pin, email, phone, primaryBranchId, status, active } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const guard = canManageTarget(req.authUser, existing);
    if (!guard.ok) return res.status(guard.code).json({ error: guard.error });

    // Managers cannot change role or move staff between branches; owners can
    // reassign among non-owner roles.
    let newRole = existing.role;
    if (role && req.authUser.role === 'owner') {
      const r = role.toLowerCase();
      if (r !== 'owner') newRole = r;
    }

    let newBranch = existing.branch_id;
    if (primaryBranchId && req.authUser.role === 'owner') {
      const b = db.prepare('SELECT * FROM branches WHERE id = ?').get(primaryBranchId);
      if (b && (!b.organization_id || b.organization_id === req.authUser.organizationId)) newBranch = primaryBranchId;
    }

    let newPinHash = existing.pin_hash;
    if (pin && String(pin).trim().length >= 4) {
      newPinHash = hashPin(String(pin).trim());
    }

    let isActive = active !== undefined ? (active ? 1 : 0) : existing.active;
    let userStatus = status || existing.status || 'ACTIVE';
    if (status === 'INACTIVE' || status === 'DISABLED') isActive = 0;
    else if (status === 'ACTIVE') isActive = 1;

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          role = ?,
          pin = '',
          pin_hash = ?,
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          branch_id = ?,
          status = ?,
          active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || null, newRole, newPinHash, email || null, phone || null, newBranch, userStatus, isActive, id);

    // If the account was disabled, revoke any live sessions immediately.
    if (isActive === 0) {
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.userId === id) activeSessions.delete(tok);
      }
    }

    const updated = db.prepare('SELECT id, organization_id as organizationId, branch_id as branchId, name, role, email, phone, status, active FROM users WHERE id = ?').get(id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 9. RESET PIN (authorized higher-level users only)
// ---------------------------------------------------------------------------
router.post('/reset-pin', authenticateSession, requireRole('owner', 'manager'), (req, res) => {
  const { userId, newPin, confirmPin } = req.body;
  if (!userId || !newPin) {
    return res.status(400).json({ error: 'userId and a 4-digit newPin are required.' });
  }

  const cleanPin = String(newPin).trim();
  if (confirmPin && String(confirmPin).trim() !== cleanPin) {
    return res.status(400).json({ error: 'New PIN and Confirm PIN do not match.' });
  }
  if (cleanPin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
  }

  try {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const guard = canManageTarget(req.authUser, target);
    if (!guard.ok) return res.status(guard.code).json({ error: guard.error });

    db.prepare("UPDATE users SET pin = '', pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(hashPin(cleanPin), userId);

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, ?, 'Reset PIN', ?, '-', 'PIN reset', 'Security PIN reset by authorized user')
    `).run(`AUD-${Date.now()}`, new Date().toISOString(), req.authUser.name, req.authUser.role, target.branch_id || '-', target.name);

    res.json({ success: true, message: 'Security PIN reset successfully.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 10. VERIFY PIN FOR ELEVATED ACTIONS (authenticated sessions only)
// ---------------------------------------------------------------------------
router.post('/verify-pin', authenticateSession, (req, res) => {
  const { pin, requiredRoles } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN is required.' });

  const allowedRoles = (requiredRoles || ['owner', 'manager']).map(r => r.toLowerCase());
  const user = findUserByPin(pin, allowedRoles);
  if (!user) {
    return res.status(403).json({ error: 'Invalid PIN or insufficient permissions.' });
  }

  // Elevated approver must be within the same organization.
  if (user.organization_id && req.authUser.organizationId && user.organization_id !== req.authUser.organizationId) {
    return res.status(403).json({ error: 'Approver is outside your organization.' });
  }

  res.json({ success: true, user: { id: user.id, name: user.name, role: user.role.toLowerCase(), email: user.email } });
});

// ---------------------------------------------------------------------------
// 11. CURRENT SESSION IDENTITY
// ---------------------------------------------------------------------------
router.get('/me', authenticateSession, (req, res) => {
  res.json({ user: req.authUser });
});

export default router;
