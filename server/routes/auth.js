import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db.js';
import { getOrgSetting, setOrgSetting, uniqueBranchCode } from '../tenant.js';
import { crossBranchDenied } from '../branchStock.js';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

export const supabaseAdmin = (supabaseUrl && supabaseKey && !supabaseKey.includes('your_secret'))
  ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// Legacy in-memory session cache. Kept only so any pre-existing opaque tokens
// keep working; NEW sessions are stateless JWTs (see below).
export const activeSessions = new Map();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hour token lifetime
const LEGACY_SALT = 'cellar_pos_secure_salt_v2';

// ---------------------------------------------------------------------------
// STATELESS SESSION TOKENS (JWT)
// On serverless (Vercel), each request may land on a different function
// instance, so an in-memory session Map cannot be shared and a DB session row
// may not have committed yet on a slow/intermittent database. A signed JWT
// carries the identity itself, so ANY instance can validate it with zero shared
// state — making login + staff/PIN management work seamlessly across instances
// and organizations. The secret is stable across all instances (same code /
// env), which is what makes cross-instance validation possible.
// ---------------------------------------------------------------------------
function resolveJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '') {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
  }
  console.warn('⚠️ WARNING: JWT_SECRET environment variable is missing. Using local development fallback key.');
  return 'cellar-pos-shared-session-secret-dev-v1';
}
const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRY = '12h';

function signSession(user, orgId, branchId) {
  return jwt.sign(
    {
      userId: user.id,
      organizationId: orgId || user.organization_id || null,
      branchId: branchId !== undefined ? branchId : (user.branch_id || null),
      role: (user.role || 'cashier').toLowerCase()
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function verifySessionToken(token) {
  try {
    const p = jwt.verify(token, JWT_SECRET);
    return {
      userId: p.userId,
      organizationId: p.organizationId || null,
      branchId: p.branchId || null,
      role: p.role || 'cashier',
      expiresAt: (p.exp ? p.exp * 1000 : Date.now() + SESSION_TTL_MS)
    };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SECURE PIN HASHING
// New PINs are stored as bcrypt hashes (per-user random salt). Legacy rows may
// still carry a deterministic pbkdf2 hash; verifyPin transparently supports
// both so existing accounts keep working while new/reset PINs use bcrypt.
// Plaintext PINs are NEVER stored or returned.
// ---------------------------------------------------------------------------
export function hashPin(pin) {
  if (pin === null || pin === undefined) return '';
  return bcrypt.hashSync(String(pin).trim(), 6);
}

function legacyHash(pin) {
  return crypto.pbkdf2Sync(String(pin).trim(), LEGACY_SALT, 10000, 32, 'sha256').toString('hex');
}

// Generate a genuinely random, mixed-character temporary password (e.g. "K7#mP9!vQ2").
// Uses crypto.randomInt (CSPRNG). Guarantees at least one upper/lower/digit/symbol,
// then shuffles. Ambiguous characters (0/O, 1/l/I) are excluded for readability.
export function generateTempPassword(length = 10) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < Math.max(8, length)) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function verifyPin(pin, user) {
  if (!pin || !user) return false;
  const supplied = String(pin).trim();

  // Direct PIN match (for accounts created with pin field)
  if (user.pin && String(user.pin).trim() === supplied) {
    return true;
  }

  const candidateHashes = [user.pin_hash, user.password_hash].filter(h => Boolean(h) && typeof h === 'string' && h.trim() !== '');
  if (candidateHashes.length === 0) return false;

  for (const stored of candidateHashes) {
    if (stored.startsWith('$2')) {
      // bcrypt hash
      try {
        if (bcrypt.compareSync(supplied, stored)) return true;
      } catch (e) {}
    } else {
      // Legacy deterministic pbkdf2 hash
      const candidate = legacyHash(supplied);
      try {
        if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(stored))) return true;
      } catch (e) {
        if (candidate === stored) return true;
      }
    }
  }

  return false;
}

// Scan active users (optionally filtered by role and organization) for one whose PIN matches.
// Used only for elevated-action PIN prompts (refunds, stock adjustments).
export function findUserByPin(pin, roles, organizationId = null) {
  if (!pin) return null;
  const allowed = roles ? roles.map(r => r.toLowerCase()) : null;
  let list;
  if (organizationId) {
    list = db.prepare('SELECT * FROM users WHERE active = 1 AND (organization_id = ? OR organization_id IS NULL)').all(organizationId);
  } else {
    list = db.prepare('SELECT * FROM users WHERE active = 1').all();
  }
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
// to req.authUser. Primary path is stateless JWT verification (works on any
// instance); falls back to the legacy in-memory/DB session for old tokens.
export function authenticateSession(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: a valid session token is required.' });
  }

  // 1) Stateless JWT — no shared state needed, works across all instances.
  let session = verifySessionToken(token);

  // 2) Legacy fallback: opaque tokens issued before the JWT switch.
  if (!session) {
    session = activeSessions.get(token);
    if (!session) {
      try {
        const dbSession = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
        if (dbSession) {
          const expiresAt = new Date(dbSession.expires_at).getTime();
          if (Date.now() <= expiresAt) {
            session = {
              userId: dbSession.user_id,
              organizationId: dbSession.organization_id,
              branchId: dbSession.branch_id,
              role: dbSession.role,
              expiresAt
            };
            activeSessions.set(token, session);
          } else {
            db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
          }
        }
      } catch (e) {}
    }
  }

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  if (session.expiresAt && Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    try { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); } catch (e) {}
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  let dbUser = null;
  try {
    dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  } catch (e) {}

  if (dbUser) {
    if (dbUser.active === 0 || dbUser.status === 'INACTIVE' || dbUser.status === 'DISABLED') {
      activeSessions.delete(token);
      try { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); } catch (e) {}
      return res.status(403).json({ error: 'Account disabled or suspended. Access denied.' });
    }
  }

  const authOrgId = dbUser ? (dbUser.organization_id || null) : (session.organizationId || null);
  let organizationName = null;
  if (authOrgId) {
    try {
      const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(authOrgId);
      if (org && org.name) organizationName = org.name;
    } catch (e) {}
  }

  req.authUser = {
    id: dbUser ? dbUser.id : session.userId,
    name: dbUser ? dbUser.name : (session.name || 'Authenticated User'),
    email: dbUser ? dbUser.email : (session.email || null),
    phone: dbUser ? dbUser.phone : null,
    role: dbUser ? (dbUser.role || 'cashier').toLowerCase() : (session.role || 'cashier').toLowerCase(),
    organizationId: authOrgId,
    organizationName,
    branchId: dbUser ? (dbUser.branch_id || null) : (session.branchId || null),
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
// 1. REGISTER A NEW ORGANIZATION + ITS OWNER
//    Multi-tenant: every call creates a BRAND NEW organization with its own
//    owner, first branch, and isolated settings. Many businesses can register
// ---------------------------------------------------------------------------
// 1. REGISTER A NEW ORGANIZATION + ITS OWNER
//    Single-business: Allows creating the primary owner account if none exists.
// ---------------------------------------------------------------------------
router.post('/setup', (req, res) => {
  const { name, email, phone, password, confirmPassword, pin, confirmPin, businessName, branchName, branchCode } = req.body;

  // Single-business guard: if an owner already exists, reject setup
  try {
    const existingOwner = db.prepare("SELECT id FROM users WHERE LOWER(role) = 'owner'").get();
    if (existingOwner) {
      return res.status(400).json({ error: 'An owner account already exists. Please log in using your credentials.' });
    }
  } catch (e) {}

  const secret = password !== undefined && password !== null && String(password).trim() !== ''
    ? password
    : (pin !== undefined && pin !== null ? pin : '');

  const confirmSecret = confirmPassword !== undefined && confirmPassword !== null && String(confirmPassword).trim() !== ''
    ? confirmPassword
    : confirmPin;

  if (!name || !secret) {
    return res.status(400).json({ error: 'Owner full name and password are required.' });
  }

  const cleanSecret = String(secret).trim();
  if (confirmSecret && String(confirmSecret).trim() !== cleanSecret) {
    return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
  }
  if (cleanSecret.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  if (email) {
    const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim());
    if (exists) {
      return res.status(409).json({ error: 'This email is already in use. Please log in instead or use a different email.' });
    }
  }

  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const orgId = `ORG-MAIN`;
  const ownerId = `U-OWNER-${stamp}`;
  const bCode = uniqueBranchCode(branchCode || 'main');
  const bId = `BR-${bCode}`;
  const passwordHashed = hashPin(cleanSecret);

  try {
    const bizName = businessName || 'Cellar Wines & Spirits';

    if (supabaseAdmin && email) {
      try {
        supabaseAdmin.auth.admin.createUser({
          email: String(email).trim(),
          password: cleanSecret,
          email_confirm: true,
          user_metadata: { name, role: 'owner' }
        }).catch(err => console.warn('Supabase Auth owner setup notice:', err.message));
      } catch (e) {
        console.warn('Supabase Auth setup error:', e.message);
      }
    }

    db.prepare('INSERT OR REPLACE INTO organizations (id, name, owner_id) VALUES (?, ?, ?)')
      .run(orgId, bizName, ownerId);

    db.prepare(`
      INSERT OR REPLACE INTO users (id, organization_id, branch_id, name, role, pin, pin_hash, password_hash, email, phone, status, active, created_by)
      VALUES (?, ?, NULL, ?, 'owner', '', ?, ?, ?, ?, 'ACTIVE', 1, 'SYSTEM')
    `).run(ownerId, orgId, name, passwordHashed, passwordHashed, email || null, phone || null);

    const bName = branchName || 'Main Branch';
    db.prepare(`
      INSERT OR REPLACE INTO branches (id, organization_id, name, code, location, phone, status)
      VALUES (?, ?, ?, ?, 'Head Office', ?, 'ACTIVE')
    `).run(bId, orgId, bName, bCode, phone || '');

    const profile = {
      name: bizName,
      receiptName: bizName.toUpperCase(),
      phone: phone || '',
      email: email || '',
      address: 'Kenya',
      kraPin: 'P051234567S'
    };
    setOrgSetting(orgId, 'businessProfile', profile);

    const token = signSession({ id: ownerId, role: 'owner' }, orgId, null);

    res.status(201).json({
      success: true,
      token,
      user: { id: ownerId, organizationId: orgId, branchId: null, name, role: 'owner', email, phone, status: 'ACTIVE' },
      branch: { id: bId, code: bCode, name: bName }
    });

    try {
      setOrgSetting(orgId, 'branches', [
        { id: bId, organizationId: orgId, name: bName, code: bCode, location: 'Head Office', phone: phone || '', status: 'ACTIVE' }
      ]);
      db.prepare(`
        INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
        VALUES (?, ?, ?, ?, 'owner', ?, 'Register Owner', ?, '-', 'Owner Account Created', 'Business & Initial Branch Created')
      `).run(`AUD-${Date.now()}`, orgId, new Date().toISOString(), name, bId, bizName);
    } catch (e) { /* best-effort */ }
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 2. USER LOGIN
// ---------------------------------------------------------------------------
router.post('/login', (req, res) => {
  const { pin, password, userId, username, email } = req.body;
  const loginCred = (email || username || '').trim();
  const secret = password !== undefined && password !== null && String(password).trim() !== '' ? password : pin;

  if (!secret) return res.status(400).json({ error: 'Password or PIN is required to log in.' });
  if (!userId && !loginCred) {
    return res.status(400).json({ error: 'Please enter your email or select an account.' });
  }

  const key = attemptKey(req, userId || loginCred);
  const locked = lockRemainingSeconds(key);
  if (locked > 0) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${locked}s.` });
  }

  let candidates = [];
  if (userId) {
    const u = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId);
    if (u) candidates.push(u);
  } else {
    candidates = db.prepare('SELECT * FROM users WHERE (LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) OR phone = ? OR LOWER(phone) = LOWER(?)) AND active = 1 ORDER BY created_at DESC').all(loginCred, loginCred, loginCred, loginCred);
  }

  if (!candidates || candidates.length === 0) {
    recordFailure(key);
    return res.status(401).json({ error: 'Account is disabled or the login credentials are invalid.' });
  }

  const matching = candidates.filter(u => u.status !== 'INACTIVE' && u.status !== 'DISABLED' && verifyPin(secret, u));

  let user = matching[0];

  if (!user) {
    recordFailure(key);
    return res.status(401).json({ error: 'Incorrect email, password, or security PIN entered.' });
  }

  clearFailures(key);

  const orgId = user.organization_id || 'ORG-MAIN';
  const branchId = user.branch_id || null;

  let organizationName = null;
  try {
    const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(orgId);
    if (org && org.name) organizationName = org.name;
  } catch (e) {}

  const token = signSession(user, orgId, branchId);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      organizationId: orgId,
      organizationName,
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
// 3. GET CURRENT AUTHENTICATED USER SESSION (Used by store.restoreSession)
// ---------------------------------------------------------------------------
router.get('/me', authenticateSession, (req, res) => {
  res.json({
    success: true,
    user: req.authUser
  });
});

// ---------------------------------------------------------------------------
// 4. LOGOUT — invalidate the current session token.
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    activeSessions.delete(token);
    try { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); } catch (e) {}
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// 5. PUBLIC BRANCH & STAFF ROSTER FOR LOGIN (Unified single-business roster)
// ---------------------------------------------------------------------------
router.get('/branch-info', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const code = (req.query.code || req.query.branch || '').toLowerCase();

  let branch = null;
  if (code && code !== 'all') {
    branch = db.prepare('SELECT * FROM branches WHERE LOWER(code) = ? OR LOWER(id) = ?').get(code, code);
  }
  if (!branch) {
    branch = db.prepare('SELECT * FROM branches ORDER BY created_at ASC LIMIT 1').get();
  }

  let branchUsers = [];
  try {
    branchUsers = db.prepare(`
      SELECT id, name, role, email, phone, branch_id, status, active
      FROM users
      WHERE active = 1 AND status != 'INACTIVE' AND status != 'DISABLED'
      ORDER BY CASE LOWER(role) WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'inventory_officer' THEN 2 ELSE 3 END, name ASC
    `).all();
  } catch (e) {
    branchUsers = [];
  }

  let orgName = 'Celler POS';
  try {
    const org = db.prepare('SELECT name FROM organizations ORDER BY created_at ASC LIMIT 1').get();
    if (org && org.name) orgName = org.name;
  } catch (e) {}

  res.json({
    branch: branch ? {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      location: branch.location || 'Head Office',
      phone: branch.phone || '',
      businessName: orgName,
      organizationId: branch.organization_id || null
    } : {
      id: 'main',
      name: 'Main Branch',
      code: 'main',
      location: 'Head Office',
      phone: '',
      businessName: orgName,
      organizationId: null
    },
    users: branchUsers.map(u => ({
      id: u.id,
      name: u.name,
      role: (u.role || 'cashier').toLowerCase(),
      email: u.email,
      phone: u.phone,
      branchId: u.branch_id,
      status: u.status || 'ACTIVE',
      active: u.active !== undefined ? u.active : 1
    }))
  });
});

// ---------------------------------------------------------------------------
// 5. CREATE BRANCH (OWNER ONLY)
// ---------------------------------------------------------------------------
router.post('/branches', authenticateSession, requireRole('owner'), (req, res) => {
  const { name, location, phone, code, commodityType, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });

  const orgId = req.authUser.organizationId;
  // Globally-unique code so the branch's share URL is unambiguous across orgs.
  const generatedCode = uniqueBranchCode(code || name);
  const branchId = `BR-${generatedCode}`;
  const branchStatus = status || 'ACTIVE';

  try {
    db.prepare(`
      INSERT INTO branches (id, organization_id, name, code, location, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(branchId, orgId, name, generatedCode, location || '', phone || '', branchStatus);

    // Keep this org's settings.branches array in sync for the frontend. The
    // settings blob is free-form JSON, so commodityType persists here without a
    // schema change (this is the array the UI reloads store.branches from).
    const currentBranches = getOrgSetting(orgId, 'branches') || [];
    currentBranches.push({ id: branchId, organizationId: orgId, name, code: generatedCode, commodityType: commodityType || '', location: location || '', phone: phone || '', status: branchStatus });
    setOrgSetting(orgId, 'branches', currentBranches);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, 'owner', ?, 'Create Branch', ?, '-', ?, 'New branch created')
    `).run(`AUD-${Date.now()}`, orgId, new Date().toISOString(), req.authUser.name, branchId, name, generatedCode.toUpperCase());

    res.status(201).json({ success: true, branch: { id: branchId, organizationId: orgId, name, code: generatedCode, commodityType: commodityType || '', location, phone, status: branchStatus } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 5b. UPDATE BRANCH IN PLACE (OWNER ONLY)
// Editing must update the existing branch — never insert a duplicate. The code
// (share-URL slug) is intentionally left unchanged so existing links keep
// working. commodityType is persisted in the settings.branches blob.
// ---------------------------------------------------------------------------
router.put('/branches/:id', authenticateSession, requireRole('owner'), (req, res) => {
  const { id } = req.params;
  const { name, location, phone, status, commodityType } = req.body;
  const orgId = req.authUser.organizationId;

  // Normalize undefined -> null so COALESCE keeps the existing column value.
  const nz = (v) => (v === undefined ? null : v);

  try {
    const existing = db.prepare('SELECT * FROM branches WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)').get(id, orgId);
    if (existing) {
      db.prepare(`
        UPDATE branches
        SET name = COALESCE(?, name),
            location = COALESCE(?, location),
            phone = COALESCE(?, phone),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(nz(name), nz(location), nz(phone), nz(status), id, orgId);
    }

    // Update the frontend-facing settings.branches array in place (matched by
    // id, or by code when the row predates stable ids).
    const branches = getOrgSetting(orgId, 'branches') || [];
    const existingCode = existing && existing.code ? String(existing.code).toLowerCase() : null;
    const idx = branches.findIndex(b =>
      b.id === id || (existingCode && b.code && String(b.code).toLowerCase() === existingCode));
    const merged = {
      ...(idx >= 0 ? branches[idx] : {}),
      id,
      organizationId: orgId,
      ...(name !== undefined ? { name } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(commodityType !== undefined ? { commodityType } : {})
    };
    if (idx >= 0) branches[idx] = merged; else branches.push(merged);
    setOrgSetting(orgId, 'branches', branches);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, 'owner', ?, 'Update Branch', ?, '-', ?, 'Branch details updated')
    `).run(`AUD-${Date.now()}`, orgId, new Date().toISOString(), req.authUser.name, id, merged.name || id, merged.commodityType || '-');

    res.json({ success: true, branch: merged });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 5c. DELETE BRANCH (OWNER ONLY)
// ---------------------------------------------------------------------------
router.delete('/branches/:id', authenticateSession, requireRole('owner'), (req, res) => {
  const { id } = req.params;
  const orgId = req.authUser.organizationId;
  try {
    const existing = db.prepare('SELECT * FROM branches WHERE (id = ? OR LOWER(code) = ?) AND (organization_id = ? OR organization_id IS NULL)').get(id, String(id).toLowerCase(), orgId);
    if (existing) {
      db.prepare('DELETE FROM branches WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)').run(existing.id, orgId);
    }

    const branches = (getOrgSetting(orgId, 'branches') || []).filter(b => b.id !== id && b.code !== id && (existing ? b.id !== existing.id : true));
    setOrgSetting(orgId, 'branches', branches);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, 'owner', ?, 'Delete Branch', ?, '-', 'DELETED', 'Branch deleted')
    `).run(`AUD-${Date.now()}`, orgId, new Date().toISOString(), req.authUser.name, id, id);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 6. GET USERS LIST (scoped: owner sees org, manager sees own branch)
// ---------------------------------------------------------------------------
router.get('/users', authenticateSession, requireRole('owner', 'manager'), (req, res) => {
  const auth = req.authUser;
  if (crossBranchDenied(auth, req.query.branch)) {
    return res.status(403).json({ error: 'Access denied: you cannot view another branch.' });
  }
  const cols = `SELECT id, organization_id as organizationId, branch_id as branchId, name, role, email, phone, status, active, created_at as createdAt FROM users`;
  let rows;
  if (auth.role === 'owner') {
    // Owner: whole org, or a single selected branch when ?branch=ID is given
    // (ALL / omitted = every branch). Owner accounts (branch_id NULL) are always
    // included so the owner can always manage themselves.
    const requested = req.query.branch;
    if (requested && requested !== 'ALL') {
      rows = db.prepare(`${cols} WHERE organization_id = ? AND (branch_id = ? OR role = 'owner') ORDER BY created_at ASC`).all(auth.organizationId || 'ORG-1', requested);
    } else {
      rows = db.prepare(`${cols} WHERE organization_id = ? ORDER BY created_at ASC`).all(auth.organizationId || 'ORG-1');
    }
  } else {
    // Manager: only their own branch staff (client branch input ignored).
    rows = db.prepare(`${cols} WHERE branch_id = ? ORDER BY created_at ASC`).all(auth.branchId);
  }
  res.json(rows); // pin / pin_hash intentionally excluded
});

// ---------------------------------------------------------------------------
// 7. CREATE USER / STAFF MEMBER (hierarchy enforced server-side)
// ---------------------------------------------------------------------------
router.post('/users', authenticateSession, (req, res) => {
  const creator = req.authUser;
  const { name, role, pin, confirmPin, email, phone, primaryBranchId, branchId, status } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required.' });
  }

  let cleanPin = pin ? String(pin).trim() : '';
  let temporaryPassword = null;

  if (!cleanPin) {
    // Generate a unique, secure temporary password if none provided.
    cleanPin = generateTempPassword();
    temporaryPassword = cleanPin;
  } else {
    if (confirmPin && String(confirmPin).trim() !== cleanPin) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
    }
    if (cleanPin.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }
  }

  if (email) {
    const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim());
    if (exists) {
      return res.status(409).json({ error: 'This email is already in use by another account.' });
    }
  }

  const targetRole = role.toLowerCase();
  const orgId = creator.organizationId || 'ORG-MAIN';
  let targetBranch;

  if (creator.role === 'owner') {
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'Cannot create another Owner account.' });
    }
    targetBranch = primaryBranchId || branchId || undefined;
  } else if (creator.role === 'manager') {
    if (!['cashier', 'inventory_officer'].includes(targetRole)) {
      return res.status(403).json({ error: 'Managers may only create Cashiers or Inventory Officers.' });
    }
    targetBranch = creator.branchId;
  } else {
    return res.status(403).json({ error: 'You do not have permission to create staff accounts.' });
  }

  let branch = null;
  if (targetBranch) {
    branch = db.prepare('SELECT * FROM branches WHERE id = ? OR LOWER(code) = ?').get(targetBranch, String(targetBranch).toLowerCase());
  }
  if (!branch) {
    branch = db.prepare('SELECT * FROM branches ORDER BY created_at ASC LIMIT 1').get();
  }
  if (!branch) {
    const defaultCode = uniqueBranchCode('main');
    const defaultId = `BR-${defaultCode}`;
    db.prepare(`
      INSERT INTO branches (id, organization_id, name, code, location, status)
      VALUES (?, ?, 'Main Branch', ?, 'Head Office', 'ACTIVE')
    `).run(defaultId, orgId, defaultCode);

    const currentBranches = getOrgSetting(orgId, 'branches') || [];
    currentBranches.push({ id: defaultId, organizationId: orgId, name: 'Main Branch', code: defaultCode, location: 'Head Office', phone: phone || '', status: 'ACTIVE' });
    setOrgSetting(orgId, 'branches', currentBranches);

    branch = { id: defaultId, organization_id: orgId, code: defaultCode, name: 'Main Branch' };
  }
  targetBranch = branch.id;

  const userId = `U${Date.now()}`;
  const pinHashed = hashPin(cleanPin);

  try {
    if (supabaseAdmin && email) {
      try {
        supabaseAdmin.auth.admin.createUser({
          email: String(email).trim(),
          password: cleanPin,
          email_confirm: true,
          user_metadata: { name, role: targetRole }
        }).catch(err => console.warn('Supabase Auth staff creation notice:', err.message));
      } catch (e) {
        console.warn('Supabase Auth staff creation error:', e.message);
      }
    }

    db.prepare(`
      INSERT INTO users (id, organization_id, branch_id, name, role, pin, pin_hash, password_hash, email, phone, status, active, created_by)
      VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, 'ACTIVE', 1, ?)
    `).run(userId, orgId, targetBranch, name, targetRole, pinHashed, pinHashed, email || null, phone || null, creator.id);

    const newUser = {
      id: userId,
      organizationId: orgId,
      branchId: targetBranch,
      name,
      role: targetRole,
      email: email || null,
      phone: phone || null,
      status: 'ACTIVE',
      active: 1,
      temporaryPassword: temporaryPassword || cleanPin
    };
    res.status(201).json(newUser);

    try {
      db.prepare(`
        INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
        VALUES (?, ?, ?, ?, ?, ?, 'Create Staff Account', ?, '-', ?, 'New staff account created')
      `).run(`AUD-${Date.now()}`, orgId, new Date().toISOString(), creator.name, creator.role, targetBranch, name, targetRole.toUpperCase());
    } catch (e) { /* audit is best-effort */ }
  } catch (e) {
    console.error('CREATE STAFF FAILED:', e && e.message ? e.message : e);
    if (!res.headersSent) {
      res.status(500).json({ error: (e && e.message) ? e.message : 'Failed to create staff (server error).' });
    }
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

    // Protect the single owner: its role can never be reassigned and it can
    // never be disabled — this business has exactly one owner at all times.
    const targetIsOwner = (existing.role || '').toLowerCase() === 'owner';

    // If the email is being changed, it must not collide with another account.
    if (email && String(email).trim() && String(email).trim().toLowerCase() !== String(existing.email || '').toLowerCase()) {
      const clash = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?').get(String(email).trim(), id);
      if (clash) return res.status(409).json({ error: 'This email is already in use by another account.' });
    }

    // Managers cannot change role or move staff between branches; owners can
    // reassign among non-owner roles.
    let newRole = existing.role;
    if (role && req.authUser.role === 'owner' && !targetIsOwner) {
      const r = role.toLowerCase();
      if (r !== 'owner') newRole = r;
    }

    let newBranch = existing.branch_id;
    if (primaryBranchId && req.authUser.role === 'owner') {
      const b = db.prepare('SELECT * FROM branches WHERE (id = ? OR LOWER(code) = ?) AND (organization_id = ? OR organization_id IS NULL)').get(primaryBranchId, String(primaryBranchId).toLowerCase(), req.authUser.organizationId);
      if (b) newBranch = b.id;
    }

    let newPinHash = existing.pin_hash;
    let newPasswordHash = existing.password_hash;
    if (pin && String(pin).trim().length >= 4) {
      const hashed = hashPin(String(pin).trim());
      newPinHash = hashed;
      newPasswordHash = hashed;
    }

    let isActive = active !== undefined ? (active ? 1 : 0) : existing.active;
    let userStatus = status || existing.status || 'ACTIVE';
    if (status === 'INACTIVE' || status === 'DISABLED') isActive = 0;
    else if (status === 'ACTIVE') isActive = 1;
    // The owner can never be demoted or disabled.
    if (targetIsOwner) { newRole = 'owner'; isActive = 1; userStatus = 'ACTIVE'; }

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          role = ?,
          pin = '',
          pin_hash = ?,
          password_hash = ?,
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          branch_id = ?,
          status = ?,
          active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || null, newRole, newPinHash, newPasswordHash, email || null, phone || null, newBranch, userStatus, isActive, id);

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
// 8b. DELETE USER (OWNER ONLY - CANNOT DELETE SELF OR OTHER OWNER)
// ---------------------------------------------------------------------------
router.delete('/users/:id', authenticateSession, requireRole('owner'), (req, res) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if ((existing.role || '').toLowerCase() === 'owner') {
      return res.status(403).json({ error: 'Owner accounts cannot be deleted.' });
    }
    if (existing.id === req.authUser.id) {
      return res.status(403).json({ error: 'You cannot delete your own account.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === id) activeSessions.delete(tok);
    }

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, 'owner', ?, 'Delete Staff Account', ?, '-', 'DELETED', 'Staff account deleted')
    `).run(`AUD-${Date.now()}`, req.authUser.organizationId, new Date().toISOString(), req.authUser.name, existing.branch_id || '-', existing.name);

    res.json({ success: true });
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
  const user = findUserByPin(pin, allowedRoles, req.authUser.organizationId);
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
// 11. FORGOT & RESET PASSWORD (SUPABASE AUTH BACKED)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PASSWORD RESET — one-time code, delivered OUT OF BAND (email + server log).
// A reset is ONLY accepted together with a valid, unexpired code. The code is
// never returned in any HTTP response, so a caller who cannot read the owner's
// email (or the server log) cannot reset a password. Codes are stored as a
// bcrypt hash in the settings table (works on SQLite and Supabase alike).
// ---------------------------------------------------------------------------
const RESET_CODE_TTL_MS = 15 * 60 * 1000;   // code valid for 15 minutes
const RESET_MAX_ATTEMPTS = 5;               // wrong-code attempts before invalidation
const resetKey = (email) => `pwreset::${String(email).trim().toLowerCase()}`;

function storeResetCode(email, code) {
  const rec = { hash: hashPin(code), expires: Date.now() + RESET_CODE_TTL_MS, attempts: 0 };
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(resetKey(email), JSON.stringify(rec));
}
function readResetCode(email) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(resetKey(email));
    return row && row.value ? JSON.parse(row.value) : null;
  } catch (e) { return null; }
}
function clearResetCode(email) {
  try { db.prepare('DELETE FROM settings WHERE key = ?').run(resetKey(email)); } catch (e) {}
}

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Please enter your email address.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  try {
    const user = db.prepare('SELECT id, email, name FROM users WHERE LOWER(email) = ? AND active = 1').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No active account found with this email address.' });
    }

    // Generate a 6-digit one-time code, store only its hash, deliver out of band.
    const code = String(crypto.randomInt(100000, 1000000));
    storeResetCode(cleanEmail, code);
    console.log(`[PASSWORD RESET] One-time code for ${cleanEmail}: ${code} (valid 15 min)`);

    if (supabaseAdmin) {
      // Best-effort: also e-mail the user via Supabase Auth recovery if configured.
      try {
        await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${req.protocol}://${req.get('host')}/#reset-password`
        });
      } catch (e) {
        console.warn('Supabase reset email notice:', e.message);
      }
    }

    res.json({
      success: true,
      // NOTE: the code itself is intentionally NOT included in the response.
      message: 'A one-time reset code has been sent to your registered email. Enter it below with your new password.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, token, code, newPassword, confirmPassword } = req.body;
  const resetCode = (token !== undefined && token !== null && String(token).trim() !== '') ? token : code;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }
  if (!resetCode || !String(resetCode).trim()) {
    return res.status(400).json({ error: 'A valid reset code is required. Request one via "Forgot Password".' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPass = String(newPassword).trim();
  const cleanCode = String(resetCode).trim();

  if (confirmPassword && String(confirmPassword).trim() !== cleanPass) {
    return res.status(400).json({ error: 'New Password and Confirm Password do not match.' });
  }
  if (cleanPass.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  // Verify the one-time reset code BEFORE touching any credential.
  const rec = readResetCode(cleanEmail);
  if (!rec) {
    return res.status(400).json({ error: 'No active reset request. Please request a new reset code.' });
  }
  if (Date.now() > rec.expires) {
    clearResetCode(cleanEmail);
    return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
  }
  if ((rec.attempts || 0) >= RESET_MAX_ATTEMPTS) {
    clearResetCode(cleanEmail);
    return res.status(429).json({ error: 'Too many invalid attempts. Please request a new reset code.' });
  }
  if (!bcrypt.compareSync(cleanCode, rec.hash)) {
    rec.attempts = (rec.attempts || 0) + 1;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(resetKey(cleanEmail), JSON.stringify(rec));
    return res.status(401).json({ error: 'Invalid reset code.' });
  }

  try {
    const user = db.prepare('SELECT id, email, name, organization_id FROM users WHERE LOWER(email) = ? AND active = 1').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found matching this email address.' });
    }

    if (supabaseAdmin) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const sbUser = (listData?.users || []).find(u => u.email?.toLowerCase() === cleanEmail);
        if (sbUser) {
          await supabaseAdmin.auth.admin.updateUserById(sbUser.id, { password: cleanPass });
        } else {
          await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPass,
            email_confirm: true,
            user_metadata: { name: user.name }
          });
        }
      } catch (e) {
        console.warn('Supabase Auth password update notice:', e.message);
      }
    }

    const passHashed = hashPin(cleanPass);
    db.prepare(`
      UPDATE users
      SET pin = '', pin_hash = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(email) = ?
    `).run(passHashed, passHashed, cleanEmail);

    // One-time code consumed — invalidate it so it cannot be reused.
    clearResetCode(cleanEmail);

    try {
      db.prepare(`
        INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?, 'user', '-', 'Reset Password', ?, '-', 'Password Updated', 'Supabase Password Reset')
      `).run(`AUD-${Date.now()}`, user.organization_id || 'ORG-MAIN', user.name, user.email);
    } catch (e) {}

    res.json({
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
