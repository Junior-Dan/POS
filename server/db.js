import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { SCHEMA_STATEMENTS } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let databasePath;
if (process.env.CELLAR_DB_PATH) {
  databasePath = path.resolve(process.env.CELLAR_DB_PATH);
} else if (process.env.VERCEL) {
  databasePath = '/tmp/cellar_pos.db';
} else {
  databasePath = path.join(__dirname, '../data/cellar_pos.db');
}

const sqliteBinary = fs.existsSync('/usr/bin/sqlite3') ? '/usr/bin/sqlite3' : 'sqlite3';

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

// Turso Child Script runner
const TURSO_CHILD_SCRIPT = `
  const [endpoint, token, body] = process.argv.slice(1);
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body,
    signal: AbortSignal.timeout(${FETCH_TIMEOUT_MS})
  }).then(r => r.text())
    .then(t => { process.stdout.write(t); })
    .catch(e => { process.stdout.write(JSON.stringify({ __fetchError: e.message })); });
`;

// Supabase Child Script runner
const SUPABASE_CHILD_SCRIPT = `
  const [endpoint, key, query] = process.argv.slice(1);
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(${FETCH_TIMEOUT_MS})
  }).then(r => r.text())
    .then(t => { process.stdout.write(t); })
    .catch(e => { process.stdout.write(JSON.stringify({ __fetchError: e.message })); });
`;

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) {}
}

function runTursoPipeline(endpoint, token, payload, label) {
  const maxAttempts = 2;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let output;
    try {
      output = execFileSync(process.execPath, ['-e', TURSO_CHILD_SCRIPT, endpoint, token, payload], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: FETCH_TIMEOUT_MS + 2000,
        killSignal: 'SIGKILL'
      }).trim();
    } catch (err) {
      lastErr = new Error(`${label} failed (network/child): ${err.message}`);
      if (attempt < maxAttempts) { sleepSync(300 * attempt); continue; }
      throw lastErr;
    }

    if (!output) return null;

    let res;
    try {
      res = JSON.parse(output);
    } catch (e) {
      throw new Error(`${label} returned an unparseable response: ${output.slice(0, 200)}`);
    }

    if (res.__fetchError) {
      lastErr = new Error(`${label} fetch error: ${res.__fetchError}`);
      if (attempt < maxAttempts) { sleepSync(300 * attempt); continue; }
      throw lastErr;
    }

    return res;
  }
  throw lastErr;
}

function runSupabaseQuery(endpoint, key, query, label) {
  const maxAttempts = 2;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let output;
    try {
      output = execFileSync(process.execPath, ['-e', SUPABASE_CHILD_SCRIPT, endpoint, key, query], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: FETCH_TIMEOUT_MS + 2000,
        killSignal: 'SIGKILL'
      }).trim();
    } catch (err) {
      lastErr = new Error(`${label} failed (network/child): ${err.message}`);
      if (attempt < maxAttempts) { sleepSync(300 * attempt); continue; }
      throw lastErr;
    }

    if (!output) return [];

    let res;
    try {
      res = JSON.parse(output);
    } catch (e) {
      throw new Error(`${label} returned non-JSON output: ${output.slice(0, 200)}`);
    }

    if (res && res.__fetchError) {
      lastErr = new Error(`${label} fetch error: ${res.__fetchError}`);
      if (attempt < maxAttempts) { sleepSync(300 * attempt); continue; }
      throw lastErr;
    }

    if (res && res.error) {
      throw new Error(`Supabase SQL error: ${res.error}`);
    }

    return Array.isArray(res) ? res : (res ? [res] : []);
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
    const token = this.tursoToken;
    return !!(this.tursoUrl && token && !token.includes('your_turso') && token.trim() !== '');
  }

  get activePath() {
    return this.transactionFile || this.filePath;
  }

  _executeSupabase(sql, json = false) {
    // Adapt SQLite-specific syntax for PostgreSQL compatibility
    let pgSql = sql;

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
    return runSupabaseQuery(endpoint, this.supabaseKey, pgSql, 'Supabase request');
  }

  _executeTurso(sql, json = false) {
    const endpoint = this.tursoUrl
      .replace(/^libsql:\/\//, 'https://')
      .replace(/\/$/, '') + '/v2/pipeline';

    const payload = JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql } },
        { type: 'close' }
      ]
    });

    const res = runTursoPipeline(endpoint, this.tursoToken, payload, 'Turso request');
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
      const args = json ? ['-json', '-batch', this.activePath, sql] : ['-batch', this.activePath, sql];
      const output = execFileSync(sqliteBinary, args, { encoding: 'utf8' }).trim();
      return json && output ? JSON.parse(output) : [];
    } catch (err) {
      console.warn("DB Execute Notice:", err.message);
      return [];
    }
  }

  _execute(sql, json = false) {
    if (this.isSupabase) {
      return this._executeSupabase(sql, json);
    }
    if (this.isTurso) {
      return this._executeTurso(sql, json);
    }
    return this._executeSqlite(sql, json);
  }

  prepare(sql) {
    return {
      all: (...params) => this._execute(bind(sql, params), true),
      get: (...params) => this._execute(bind(sql, params), true)[0] || null,
      run: (...params) => {
        this._execute(bind(sql, params));
        return { changes: 1 };
      }
    };
  }

  exec(sql) {
    this._execute(sql);
  }

  execBatch(statements) {
    if (!Array.isArray(statements) || statements.length === 0) return;
    if (this.isSupabase) {
      for (const stmt of statements) {
        try { this._execute(stmt); } catch (e) { console.warn("Supabase batch item notice:", e.message); }
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
      const res = runTursoPipeline(endpoint, this.tursoToken, payload, 'Turso batch');
      if (res) {
        const errored = (res.results || []).find(r => r?.type === 'error' || r?.error);
        if (errored) throw new Error(`Turso batch SQL error: ${errored.error?.message || errored.message}`);
      }
      return;
    }
    this._execute(statements.map(s => s.trim().replace(/;+$/, '')).join(';\n') + ';');
  }

  pragma(value) {
    if (!this.isTurso && !this.isSupabase) {
      this._execute(`PRAGMA ${value}`);
    }
  }

  transaction(fn) {
    return (...args) => {
      if (this.isTurso || this.isSupabase) {
        return fn(...args);
      }
      if (this.transactionFile) return fn(...args);

      const transactionFile = `${this.filePath}.transaction-${process.pid}`;
      if (fs.existsSync(transactionFile)) fs.unlinkSync(transactionFile);
      fs.copyFileSync(this.filePath, transactionFile);
      this.transactionFile = transactionFile;

      try {
        const result = fn(...args);
        fs.renameSync(transactionFile, this.filePath);
        return result;
      } catch (error) {
        if (fs.existsSync(transactionFile)) fs.unlinkSync(transactionFile);
        throw error;
      } finally {
        this.transactionFile = null;
      }
    };
  }
}

export const db = new DatabaseAdapter(databasePath);

export function initDb() {
  if (db.isSupabase) {
    console.log(`Supabase Cloud PostgreSQL database engine active: ${db.supabaseUrl}`);
    // Attempt schema batch creation
    try {
      db.execBatch(SCHEMA_STATEMENTS);
    } catch (e) {
      console.warn("Supabase schema init notice:", e.message);
    }
    runTenantMigration();
    return;
  }

  if (db.isTurso) {
    console.log(`Turso Cloud database engine active: ${db.tursoUrl}`);
    db.execBatch(SCHEMA_STATEMENTS);
    runTenantMigration();
    return;
  }

  if (!fs.existsSync(databasePath)) {
    try { fs.writeFileSync(databasePath, ''); } catch (e) {
      throw new Error(`SQLite database is missing and could not be created: ${databasePath}`);
    }
  }
  db.exec('PRAGMA foreign_keys = ON; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');
  db.execBatch(SCHEMA_STATEMENTS);

  const userColumns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!userColumns.includes('organization_id')) {
    try { db.exec('ALTER TABLE users ADD COLUMN organization_id TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('branch_id')) {
    try { db.exec('ALTER TABLE users ADD COLUMN branch_id TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('phone')) {
    try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('status')) {
    try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE';"); } catch (e) {}
  }
  if (!userColumns.includes('created_by')) {
    try { db.exec('ALTER TABLE users ADD COLUMN created_by TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('pin_hash')) {
    try { db.exec('ALTER TABLE users ADD COLUMN pin_hash TEXT;'); } catch (e) {}
  }
  if (!userColumns.includes('updated_at')) {
    try { db.exec('ALTER TABLE users ADD COLUMN updated_at DATETIME;'); } catch (e) {}
  }

  runTenantMigration();
  console.log(`SQLite database engine active: ${databasePath}`);
}

const TENANT_TABLES = [
  'products', 'suppliers', 'customers', 'shifts', 'sales', 'sale_items',
  'stock_movements', 'cash_movements', 'purchases', 'purchase_items',
  'expenses', 'audit_logs', 'payments', 'categories'
];

function runTenantMigration() {
  const MIGRATION_VERSION = '4';
  let current = null;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = '__schema_v'").get();
    current = row ? row.value : null;
  } catch (e) {}
  if (current === MIGRATION_VERSION) return;

  for (const t of TENANT_TABLES) {
    try { db.exec(`ALTER TABLE ${t} ADD COLUMN organization_id TEXT`); } catch (e) {}
  }

  let orgId = null;
  try {
    const org = db.prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1').get();
    orgId = org ? org.id : null;
  } catch (e) {}
  if (orgId) {
    const safeOrg = String(orgId).replaceAll("'", "''");
    for (const t of TENANT_TABLES) {
      try { db.exec(`UPDATE ${t} SET organization_id = '${safeOrg}' WHERE organization_id IS NULL`); } catch (e) {}
    }
    try { db.exec(`UPDATE users SET organization_id = '${safeOrg}' WHERE organization_id IS NULL`); } catch (e) {}
    try { db.exec(`UPDATE branches SET organization_id = '${safeOrg}' WHERE organization_id IS NULL`); } catch (e) {}

    const LEGACY_SETTING_KEYS = [
      'businessProfile', 'branches', 'paymentSettings', 'receiptSettings',
      'shiftSettings', 'securitySettings', 'systemPreferences'
    ];
    for (const k of LEGACY_SETTING_KEYS) {
      try {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
        if (row && row.value !== undefined && row.value !== null) {
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(`${orgId}::${k}`, row.value);
          db.prepare('DELETE FROM settings WHERE key = ?').run(k);
        }
      } catch (e) {}
    }
  }

  try {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('__schema_v', ?)").run(MIGRATION_VERSION);
  } catch (e) {}
}
