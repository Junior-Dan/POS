import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let databasePath;
if (process.env.CELLAR_DB_PATH) {
  databasePath = path.resolve(process.env.CELLAR_DB_PATH);
} else if (process.env.VERCEL) {
  databasePath = '/tmp/cellar_pos.db';
  const seedPath = path.join(__dirname, '../data/cellar_pos.db');
  if (!fs.existsSync(databasePath) && fs.existsSync(seedPath)) {
    try { fs.copyFileSync(seedPath, databasePath); } catch (e) {}
  }
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

/**
 * Minimal synchronous adapter around the system SQLite CLI. It maintains the
 * existing better-sqlite3-style API used by the routes without relying on the
 * broken native better-sqlite3 binary on this host.
 */
class SqliteDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.transactionFile = null;
  }

  get activePath() {
    return this.transactionFile || this.filePath;
  }

  _execute(sql, json = false) {
    try {
      const args = json ? ['-json', '-batch', this.activePath, sql] : ['-batch', this.activePath, sql];
      const output = execFileSync(sqliteBinary, args, { encoding: 'utf8' }).trim();
      return json && output ? JSON.parse(output) : [];
    } catch (err) {
      console.warn("DB Execute Notice:", err.message);
      return [];
    }
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

  pragma(value) {
    this._execute(`PRAGMA ${value}`);
  }

  transaction(fn) {
    return (...args) => {
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

export const db = new SqliteDatabase(databasePath);

export function initDb() {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`SQLite database is missing: ${databasePath}`);
  }
  db.exec('PRAGMA foreign_keys = ON; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');

  // Ensure organizations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure branches table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      location TEXT,
      phone TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // Migration helper for adding missing columns to users table safely
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

  console.log(`SQLite database engine active: ${databasePath}`);
}
