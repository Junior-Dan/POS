import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { getOrgSetting, setOrgSetting, uniqueBranchCode } from '../tenant.js';

const router = express.Router();

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
//    on the same deployment; each is fully partitioned by organization_id.
// ---------------------------------------------------------------------------
router.post('/setup', (req, res) => {
  const { name, email, phone, password, confirmPassword, pin, confirmPin, businessName, branchName, branchCode } = req.body;
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

  // Email must be unique across the whole system — login is by email, so a
  // duplicate would make sign-in ambiguous.
  if (email) {
    const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim());
    if (exists) {
      return res.status(409).json({ error: 'This email is already in use. Please log in instead or use a different email.' });
    }
  }

  // Unique identifiers per organization so many businesses coexist safely.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const orgId = `ORG-${stamp}`;
  const ownerId = `U-OWNER-${stamp}`;
  const bCode = uniqueBranchCode(branchCode || 'main');
  const bId = `BR-${bCode}`;
  const passwordHashed = hashPin(cleanSecret);

  try {
    const bizName = businessName || 'Cellar Wines & Spirits';

    db.prepare('INSERT OR REPLACE INTO organizations (id, name, owner_id) VALUES (?, ?, ?)')
      .run(orgId, bizName, ownerId);

    // Owner has org-wide access: branch_id is intentionally NULL.
    // Store in both pin_hash and password_hash for multi-way authentication compatibility.
    db.prepare(`
      INSERT OR REPLACE INTO users (id, organization_id, branch_id, name, role, pin, pin_hash, password_hash, email, phone, status, active, created_by)
      VALUES (?, ?, NULL, ?, 'owner', '', ?, ?, ?, ?, 'ACTIVE', 1, 'SYSTEM')
    `).run(ownerId, orgId, name, passwordHashed, passwordHashed, email || null, phone || null);

    // Create the initial branch NOW (one-time) so later staff creation is fast
    // (no per-staff branch auto-creation round-trips).
    const bName = branchName || 'Main Branch';
    db.prepare(`
      INSERT INTO branches (id, organization_id, name, code, location, phone, status)
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

    // Stateless JWT session — valid on any serverless instance immediately.
    const token = signSession({ id: ownerId, role: 'owner' }, orgId, null);

    res.status(201).json({
      success: true,
      token,
      user: { id: ownerId, organizationId: orgId, branchId: null, name, role: 'owner', email, phone, status: 'ACTIVE' },
      branch: { id: bId, code: bCode, name: bName }
    });

    // Non-critical writes AFTER the response (client isn't blocked on them).
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
// 2. USER LOGIN (branch or owner). Requires explicit account selection so a
//    PIN can never silently match a user in another branch.
// ---------------------------------------------------------------------------
router.post('/login', (req, res) => {
  const { pin, password, userId, username, email, branchCode } = req.body;
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

  // Among all PIN-matching candidates (an email/name can unfortunately be on
  // more than one account), prefer the account for the selected branch first,
  // then the highest-privilege role (owner > manager > inventory > cashier), so
  // logging in lands on the user's primary account — not a stray duplicate.
  const matching = candidates.filter(u => u.status !== 'INACTIVE' && u.status !== 'DISABLED' && verifyPin(secret, u));

  let preferredBranchId = null;
  if (branchCode) {
    const code = String(branchCode).toLowerCase();
    const br = db.prepare('SELECT id FROM branches WHERE LOWER(code) = ? OR LOWER(id) = ?').get(code, code);
    preferredBranchId = br ? br.id : null;
  }
  const roleRank = { owner: 0, manager: 1, inventory_officer: 2, cashier: 3 };
  matching.sort((a, b) => {
    const aBr = preferredBranchId && a.branch_id === preferredBranchId ? 0 : 1;
    const bBr = preferredBranchId && b.branch_id === preferredBranchId ? 0 : 1;
    if (aBr !== bBr) return aBr - bBr;
    const ar = roleRank[(a.role || '').toLowerCase()] ?? 9;
    const br = roleRank[(b.role || '').toLowerCase()] ?? 9;
    return ar - br;
  });
  let user = matching[0];

  if (!user) {
    recordFailure(key);
    return res.status(401).json({ error: 'Incorrect email, password, or security PIN entered.' });
  }

  // Branch binding: a non-owner may only authenticate against their own branch.
  if (branchCode) {
    const code = String(branchCode).toLowerCase();
    const branch = db.prepare('SELECT * FROM branches WHERE LOWER(code) = ? OR LOWER(id) = ?').get(code, code);
    if (branch && user.role.toLowerCase() !== 'owner' && user.branch_id && user.branch_id !== branch.id) {
      recordFailure(key);
      return res.status(403).json({ error: 'This account does not belong to the selected branch terminal.' });
    }
  }

  clearFailures(key);

  const orgId = user.organization_id || 'ORG-1';
  const branchId = user.branch_id || null;

  // Authoritative organization name so owner and every staff member show the
  // exact same business name immediately, regardless of settings load timing.
  let organizationName = null;
  try {
    const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(orgId);
    if (org && org.name) organizationName = org.name;
  } catch (e) {}

  // Stateless JWT session — valid on any serverless instance immediately
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
// 4. BRANCH INFO & ACTIVE USERS FOR BRANCH URL LOGIN (public — identifier only)
//    The branch code identifies the branch; it does NOT authenticate anyone.
// ---------------------------------------------------------------------------
router.get('/branch-info', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const code = (req.query.code || req.query.branch || '').toLowerCase();

  let branch = null;
  if (code && code !== 'all') {
    branch = db.prepare('SELECT * FROM branches WHERE LOWER(code) = ? OR LOWER(id) = ?').get(code, code);
  }

  // Multi-tenant safety: with no branch code (main URL) or an unknown code, we
  // must NOT fall back to some other organization's branch — that would leak a
  // different business's staff onto this terminal. Return an empty terminal so
  // the frontend offers Business Registration / asks for a valid branch link.
  if (!branch) {
    return res.json({ branch: null, users: [] });
  }

  // Active branch users + THIS organization's owner (owners are org-wide and
  // may authenticate at any of their own branch terminals). Scoped by
  // organization so one org's staff/owner never appear on another org's branch
  // login — essential when the deployment serves many organizations. PINs are
  // never exposed.
  const branchOrgId = branch.organization_id || branch.organizationId || null;
  let branchUsers = [];
  try {
    if (branchOrgId) {
      branchUsers = db.prepare(`
        SELECT id, name, role, email, phone, branch_id, status, active
        FROM users
        WHERE active = 1 AND status != 'INACTIVE' AND status != 'DISABLED'
          AND organization_id = ?
          AND (branch_id = ? OR LOWER(role) = 'owner')
        ORDER BY CASE LOWER(role) WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'inventory_officer' THEN 2 ELSE 3 END, name ASC
      `).all(branchOrgId, branch.id);
    } else {
      // Legacy single-org data with no organization_id recorded.
      branchUsers = db.prepare(`
        SELECT id, name, role, email, phone, branch_id, status, active
        FROM users
        WHERE active = 1 AND status != 'INACTIVE' AND status != 'DISABLED'
          AND (branch_id = ? OR branch_id IS NULL OR LOWER(role) = 'owner')
        ORDER BY CASE LOWER(role) WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'inventory_officer' THEN 2 ELSE 3 END, name ASC
      `).all(branch.id);
    }
  } catch (e) {
    branchUsers = [];
  }

  // Fallback: if no staff are bound to this branch yet, include the owner(s) of
  // THIS organization so the terminal is never left with an empty login list.
  if (branchUsers.length === 0) {
    try {
      branchUsers = branchOrgId
        ? db.prepare(`
            SELECT id, name, role, email, phone, branch_id, status, active
            FROM users
            WHERE active = 1 AND status != 'INACTIVE' AND status != 'DISABLED'
              AND LOWER(role) = 'owner' AND organization_id = ?
          `).all(branchOrgId)
        : db.prepare(`
            SELECT id, name, role, email, phone, branch_id, status, active
            FROM users
            WHERE active = 1 AND status != 'INACTIVE' AND status != 'DISABLED' AND LOWER(role) = 'owner'
          `).all();
    } catch (e) {}
  }

  // Personal staff invite link (?staff=<id|email>): restrict the terminal to
  // ONLY that one account so the link the owner shared opens that staff member's
  // login and nobody else's. The account must still belong to this branch/org.
  const staffRef = (req.query.staff || req.query.u || '').toString().trim().toLowerCase();
  if (staffRef) {
    const only = branchUsers.filter(u =>
      String(u.id).toLowerCase() === staffRef ||
      (u.email && String(u.email).toLowerCase() === staffRef)
    );
    branchUsers = only; // may be empty if the ref doesn't match this branch/org
  }

  let orgName = 'Celler POS';
  if (branchOrgId) {
    try {
      const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(branchOrgId);
      if (org && org.name) orgName = org.name;
    } catch (e) {}
  }

  res.json({
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      location: branch.location || 'Branch Location',
      phone: branch.phone || '',
      businessName: orgName,
      organizationId: branchOrgId || null
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
  const { name, location, phone, code } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });

  const orgId = req.authUser.organizationId;
  // Globally-unique code so the branch's share URL is unambiguous across orgs.
  const generatedCode = uniqueBranchCode(code || name);
  const branchId = `BR-${generatedCode}`;

  try {
    db.prepare(`
      INSERT INTO branches (id, organization_id, name, code, location, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(branchId, orgId, name, generatedCode, location || '', phone || '');

    // Keep this org's settings.branches array in sync for the frontend.
    const currentBranches = getOrgSetting(orgId, 'branches') || [];
    currentBranches.push({ id: branchId, organizationId: orgId, name, code: generatedCode, location: location || '', phone: phone || '', status: 'ACTIVE' });
    setOrgSetting(orgId, 'branches', currentBranches);

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
      VALUES (?, ?, ?, ?, 'owner', ?, 'Create Branch', ?, '-', ?, 'New branch created')
    `).run(`AUD-${Date.now()}`, orgId, new Date().toISOString(), req.authUser.name, branchId, name, generatedCode.toUpperCase());

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

  // Enforce a unique email (login is by email, so it cannot be shared).
  if (email) {
    const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim());
    if (exists) {
      return res.status(409).json({ error: 'This email is already in use by another account.' });
    }
  }

  const targetRole = role.toLowerCase();
  const orgId = creator.organizationId || 'ORG-1';
  let targetBranch;

  if (creator.role === 'owner') {
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'Cannot create another Owner account.' });
    }
    // Honor the branch the owner picked (if any).
    targetBranch = primaryBranchId || branchId || undefined;
  } else if (creator.role === 'manager') {
    if (!['cashier', 'inventory_officer'].includes(targetRole)) {
      return res.status(403).json({ error: 'Managers may only create Cashiers or Inventory Officers.' });
    }
    // Force the manager's own branch — frontend-supplied branch is ignored.
    targetBranch = creator.branchId;
  } else {
    return res.status(403).json({ error: 'You do not have permission to create staff accounts.' });
  }

  // Validate and resolve the target branch for the creator's organization.
  let branch = null;
  if (targetBranch) {
    branch = db.prepare('SELECT * FROM branches WHERE (id = ? OR LOWER(code) = ?) AND (organization_id = ? OR organization_id IS NULL)').get(targetBranch, String(targetBranch).toLowerCase(), orgId);
  }
  if (!branch) {
    // Fall back to the organization's primary branch
    branch = db.prepare('SELECT * FROM branches WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1').get(orgId);
  }
  if (!branch) {
    // Auto-create initial default branch if missing so staff creation never fails
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
      active: 1
    };
    // Respond immediately; the audit entry is written best-effort AFTER the
    // response so the client isn't blocked on an extra DB round-trip.
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

    // If the email is being changed, it must not collide with another account.
    if (email && String(email).trim() && String(email).trim().toLowerCase() !== String(existing.email || '').toLowerCase()) {
      const clash = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?').get(String(email).trim(), id);
      if (clash) return res.status(409).json({ error: 'This email is already in use by another account.' });
    }

    // Managers cannot change role or move staff between branches; owners can
    // reassign among non-owner roles.
    let newRole = existing.role;
    if (role && req.authUser.role === 'owner') {
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
// 11. CURRENT SESSION IDENTITY
// ---------------------------------------------------------------------------
router.get('/me', authenticateSession, (req, res) => {
  res.json({ user: req.authUser });
});

export default router;
