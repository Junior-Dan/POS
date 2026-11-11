import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { SCHEMA_STATEMENTS } from './schema.js';

let __dirname = '';
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  __dirname = '/';
}

let databasePath;
if (process.env.CELLAR_DB_PATH) {
  databasePath = path.resolve(process.env.CELLAR_DB_PATH);
} else if (process.env.VERCEL) {
  databasePath = '/tmp/cellar_pos.db';
} else if (__dirname) {
  databasePath = path.join(__dirname, '../data/cellar_pos.db');
} else {
  databasePath = '/tmp/cellar_pos.db';
}

let sqliteBinary = 'sqlite3';
try {
  if (typeof fs.existsSync === 'function' && fs.existsSync('/usr/bin/sqlite3')) {
    sqliteBinary = '/usr/bin/sqlite3';
  }
} catch (e) {}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('SQLite values must be finite numbers.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function bind(sql, params) {
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    const named = params[0];
    return sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (placeholder, name) =>
      Object.hasOwn(named, name) ? sqlValue(named[name]) : placeholder
    );
  }

  let index = 0;
  return sql.replace(/\?/g, () => {
    if (index >= params.length) throw new Error('Not enough SQL parameters provided.');
    return sqlValue(params[index++]);
  });
}

const FETCH_TIMEOUT_MS = 8000;

async function runTursoPipeline(endpoint, token, payload, label) {
  const maxAttempts = 2;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: payload,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      const text = await res.text();
      if (!text) return null;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new Error(`${label} returned an unparseable response: ${text.slice(0, 200)}`);
      }
      if (parsed.__fetchError) {
        lastErr = new Error(`${label} fetch error: ${parsed.__fetchError}`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 300 * attempt));
          continue;
        }
        throw lastErr;
      }
      return parsed;
    } catch (err) {
      lastErr = new Error(`${label} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

async function runSupabaseQuery(endpoint, key, query, label) {
  const maxAttempts = 2;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      const text = await res.text();
      let parsed = [];
      try {
        parsed = text ? JSON.parse(text) : [];
      } catch (e) {
        throw new Error(`${label} returned non-JSON output: ${text.slice(0, 200)}`);
      }
      if (parsed && parsed.__fetchError) {
        lastErr = new Error(`${label} fetch error: ${parsed.__fetchError}`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 300 * attempt));
          continue;
        }
        throw lastErr;
      }
      if (parsed && parsed.error) {
        throw new Error(`Supabase SQL error: ${parsed.error}`);
      }
      return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    } catch (err) {
      lastErr = new Error(`${label} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

/**
 * Database adapter supporting local SQLite CLI, remote Turso libSQL, and Supabase PostgreSQL.
 */
class DatabaseAdapter {
  constructor(filePath) {
    this.filePath = filePath;
    this.transactionFile = null;
  }

  get supabaseUrl() {
    return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  }

  get supabaseKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  }

  get isSupabase() {
    if (process.env.USE_LOCAL_DB === '1' || process.env.USE_LOCAL_DB === 'true') return false;
    const key = this.supabaseKey;
    return !!(this.supabaseUrl && key && key.trim() !== '' && !key.includes('your_secret'));
  }

  get tursoUrl() {
    return process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
  }

  get tursoToken() {
    return process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;
  }

  get isTurso() {
    if (process.env.USE_LOCAL_DB === '1' || process.env.USE_LOCAL_DB === 'true') return false;
    const token = this.tursoToken;
    return !!(this.tursoUrl && token && !token.includes('your_turso') && token.trim() !== '');
  }

  get activePath() {
    return this.transactionFile || this.filePath;
  }

  async _executeSupabase(sql, json = false) {
    // Adapt SQLite-specific syntax for PostgreSQL compatibility
    let pgSql = sql;

    // SQLite's DATETIME type does not exist in PostgreSQL -> use TIMESTAMP.
    pgSql = pgSql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');

    // Convert SQLite PRAGMA statements (ignore on Postgres)
    if (pgSql.trim().toUpperCase().startsWith('PRAGMA')) {
      return [];
    }

    // Convert SQLite INSERT OR REPLACE into PostgreSQL ON CONFLICT
    if (pgSql.includes('INSERT OR REPLACE INTO settings')) {
      pgSql = pgSql.replace('INSERT OR REPLACE INTO settings (key, value) VALUES', 'INSERT INTO settings (key, value) VALUES')
        + ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
    } else if (pgSql.includes('INSERT OR REPLACE INTO')) {
      pgSql = pgSql.replace('INSERT OR REPLACE INTO', 'INSERT INTO');
    }

    const endpoint = `${this.supabaseUrl}/rest/v1/rpc/exec_sql`;
    return await runSupabaseQuery(endpoint, this.supabaseKey, pgSql, 'Supabase request');
  }

  async _executeTurso(sql, json = false) {
    const endpoint = this.tursoUrl
      .replace(/^libsql:\/\//, 'https://')
      .replace(/\/$/, '') + '/v2/pipeline';

    const payload = JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql } },
        { type: 'close' }
      ]
    });

    const res = await runTursoPipeline(endpoint, this.tursoToken, payload, 'Turso request');
    if (!res) return [];

    const first = res.results?.[0];
    if (first?.type === 'error' || first?.error) {
      const msg = first.error?.message || first.message || 'unknown Turso error';
      throw new Error(`Turso SQL error: ${msg}`);
    }

    const execRes = first?.response?.result;
    if (!execRes || !json) return [];

    const cols = execRes.cols.map(c => c.name);
    return execRes.rows.map(row => {
      const obj = {};
      cols.forEach((col, idx) => {
        const valObj = row[idx];
        obj[col] = valObj ? (valObj.value ?? valObj.text ?? null) : null;
      });
      return obj;
    });
  }

  _executeSqlite(sql, json = false) {
    try {
      if (typeof execFileSync !== 'function' || !fs.existsSync) return [];
      const args = json ? ['-json', '-batch', this.activePath, sql] : ['-batch', this.activePath, sql];
      const output = execFileSync(sqliteBinary, args, { encoding: 'utf8' }).trim();
      return json && output ? JSON.parse(output) : [];
    } catch (err) {
      console.warn("DB Execute Notice:", err.message);
      return [];
    }
  }

  async _execute(sql, json = false) {
    if (this.isSupabase) {
      return await this._executeSupabase(sql, json);
    }
    if (this.isTurso) {
      return await this._executeTurso(sql, json);
    }
    return this._executeSqlite(sql, json);
  }

  prepare(sql) {
    return {
      all: async (...params) => await this._execute(bind(sql, params), true),
      get: async (...params) => {
        const rows = await this._execute(bind(sql, params), true);
        return rows && rows[0] ? rows[0] : null;
      },
      run: async (...params) => {
        await this._execute(bind(sql, params));
        return { changes: 1 };
      }
    };
  }

  async exec(sql) {
    await this._execute(sql);
  }

  async execBatch(statements) {
    if (!Array.isArray(statements) || statements.length === 0) return;
    if (this.isSupabase) {
      for (const stmt of statements) {
        try { await this._execute(stmt); } catch (e) { console.warn("Supabase batch item notice:", e.message); }
      }
      return;
    }
    if (this.isTurso) {
      const endpoint = this.tursoUrl.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '') + '/v2/pipeline';
      const payload = JSON.stringify({
        requests: [
          ...statements.map(sql => ({ type: 'execute', stmt: { sql } })),
          { type: 'close' }
        ]
      });
      const res = await runTursoPipeline(endpoint, this.tursoToken, payload, 'Turso batch');
      if (res) {
        const errored = (res.results || []).find(r => r?.type === 'error' || r?.error);
        if (errored) throw new Error(`Turso batch SQL error: ${errored.error?.message || errored.message}`);
      }
      return;
    }
    await this._execute(statements.map(s => s.trim().replace(/;+$/, '')).join(';\n') + ';');
  }

  pragma(value) {
    if (!this.isTurso && !this.isSupabase) {
      this._executeSqlite(`PRAGMA ${value}`);
    }
  }

  transaction(fn) {
    return async (...args) => {
      if (this.isTurso || this.isSupabase) {
        return await fn(...args);
      }
      if (this.transactionFile || typeof fs.existsSync !== 'function') return await fn(...args);

      const transactionFile = `${this.filePath}.transaction-${process.pid || 'cf'}`;
      try {
        if (fs.existsSync(transactionFile)) fs.unlinkSync(transactionFile);
        fs.copyFileSync(this.filePath, transactionFile);
        this.transactionFile = transactionFile;
      } catch (e) {}

      try {
        const result = await fn(...args);
        try {
          if (fs.existsSync(transactionFile)) fs.renameSync(transactionFile, this.filePath);
        } catch (e) {}
        return result;
      } catch (error) {
        try {
          if (fs.existsSync(transactionFile)) fs.unlinkSync(transactionFile);
        } catch (e) {}
        throw error;
      } finally {
        this.transactionFile = null;
      }
    };
  }
}

export const db = new DatabaseAdapter(databasePath);

export async function initDb() {
  if (db.isSupabase) {
    console.log(`Supabase Cloud PostgreSQL database engine active: ${db.supabaseUrl}`);
    // Attempt schema batch creation
    try {
      await db.execBatch(SCHEMA_STATEMENTS);
    } catch (e) {
      console.warn("Supabase schema init notice:", e.message);
    }
    await runTenantMigration();
    return;
  }

  if (db.isTurso) {
    console.log(`Turso Cloud database engine active: ${db.tursoUrl}`);
    await db.execBatch(SCHEMA_STATEMENTS);
    await runTenantMigration();
    return;
  }

  if (typeof fs.existsSync === 'function') {
    if (!fs.existsSync(databasePath)) {
      try { fs.writeFileSync(databasePath, ''); } catch (e) {
        throw new Error(`SQLite database is missing and could not be created: ${databasePath}`);
      }
    }
  }
  await db.exec('PRAGMA foreign_keys = ON; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');
  await db.execBatch(SCHEMA_STATEMENTS);

  const userColumns = (await db.prepare('PRAGMA table_info(users)').all()).map(c => c.name);
  if (!userColumns.includes('organization_id')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN organization_id TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('branch_id')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN branch_id TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('phone')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN phone TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('status')) {
    try { await db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE';"); } catch (e) {}
  }
  if (!userColumns.includes('created_by')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN created_by TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('pin_hash')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN pin_hash TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('password_hash')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('updated_at')) {
    try { await db.exec('ALTER TABLE users ADD COLUMN updated_at DATETIME;'); } catch (e) {}
  }

  await runTenantMigration();
  console.log(`SQLite database engine active: ${databasePath}`);
}

const TENANT_TABLES = [
  'products', 'suppliers', 'customers', 'shifts', 'sales', 'sale_items',
  'stock_movements', 'cash_movements', 'purchases', 'purchase_items',
  'expenses', 'audit_logs', 'payments', 'categories'
];

async function runTenantMigration() {
  const MIGRATION_VERSION = '7';
  let current = null;
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = '__schema_v'").get();
    current = row ? row.value : null;
  } catch (e) {}

  try { await db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch (e) {}
  try { await db.exec('ALTER TABLE users ADD COLUMN pin_hash TEXT'); } catch (e) {}
  try { await db.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch (e) {}
  try { await db.exec('ALTER TABLE users ADD COLUMN organization_id TEXT'); } catch (e) {}
  try { await db.exec('ALTER TABLE users ADD COLUMN branch_id TEXT'); } catch (e) {}
  // v7: expenses become branch-owned.
  try { await db.exec('ALTER TABLE expenses ADD COLUMN branch_id TEXT'); } catch (e) {}

  if (current === MIGRATION_VERSION) return;

  for (const t of TENANT_TABLES) {
    try { await db.exec(`ALTER TABLE ${t} ADD COLUMN organization_id TEXT`); } catch (e) {}
  }

  let orgId = null;
  try {
    const org = await db.prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1').get();
    orgId = org ? org.id : null;
  } catch (e) {}
  if (orgId) {
    const safeOrg = String(orgId).replaceAll("'", "''");
    for (const t of TENANT_TABLES) {
      try { await db.exec(`UPDATE ${t} SET organization_id = '${safeOrg}' WHERE organization_id IS NULL`); } catch (e) {}
    }
    try { await db.exec(`UPDATE users SET organization_id = '${safeOrg}' WHERE organization_id IS NULL`); } catch (e) {}
    try { await db.exec(`UPDATE branches SET organization_id = '${safeOrg}' WHERE organization_id IS NULL`); } catch (e) {}

    const LEGACY_SETTING_KEYS = [
      'businessProfile', 'branches', 'paymentSettings', 'receiptSettings',
      'shiftSettings', 'securitySettings', 'systemPreferences'
    ];
    for (const k of LEGACY_SETTING_KEYS) {
      try {
        const row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
        if (row && row.value !== undefined && row.value !== null) {
          await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(`${orgId}::${k}`, row.value);
          await db.prepare('DELETE FROM settings WHERE key = ?').run(k);
        }
      } catch (e) {}
    }
  }

  try { await db.exec('ALTER TABLE stock_movements ADD COLUMN branch_id TEXT'); } catch (e) {}

  let allOrgs = [];
  try { allOrgs = (await db.prepare('SELECT id FROM organizations').all()) || []; } catch (e) {}

  for (const org of allOrgs) {
    const oid = org.id;
    if (!oid) continue;

    let primary = null;
    try { primary = await db.prepare('SELECT id FROM branches WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1').get(oid); } catch (e) {}
    if (!primary || !primary.id) continue;
    const branchId = primary.id;

    let prods = [];
    try { prods = (await db.prepare('SELECT id, current_stock, min_stock, reorder_level FROM products WHERE organization_id = ?').all(oid)) || []; } catch (e) {}

    for (const p of prods) {
      let exists = null;
      try { exists = await db.prepare('SELECT id FROM product_branch_stock WHERE organization_id = ? AND product_id = ? AND branch_id = ?').get(oid, p.id, branchId); } catch (e) {}
      if (exists) continue;
      const pbsId = `PBS-${p.id}-${branchId}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
      try {
        await db.prepare(`INSERT INTO product_branch_stock (id, organization_id, product_id, branch_id, current_stock, min_stock, reorder_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(pbsId, oid, p.id, branchId, p.current_stock || 0, p.min_stock || 5, p.reorder_level || 10);
      } catch (e) {}
    }

    const safeOid = String(oid).replaceAll("'", "''");
    const safeBranch = String(branchId).replaceAll("'", "''");
    const LEGACY = `(branch_id IS NULL OR branch_id = '' OR branch_id = 'B1')`;
    for (const t of ['stock_movements', 'sales', 'shifts', 'purchases', 'audit_logs', 'expenses']) {
      try {
        await db.exec(`UPDATE ${t} SET branch_id = '${safeBranch}' WHERE organization_id = '${safeOid}' AND ${LEGACY}`);
      } catch (e) {}
    }
  }

  try {
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('__schema_v', ?)").run(MIGRATION_VERSION);
  } catch (e) {}
}
