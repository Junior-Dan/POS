import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasePath = process.env.CELLAR_DB_PATH
  ? path.resolve(process.env.CELLAR_DB_PATH)
  : path.join(__dirname, '../data/cellar_pos.db');
const sqliteBinary = '/usr/bin/sqlite3';

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
    const args = json ? ['-json', '-batch', this.activePath, sql] : ['-batch', this.activePath, sql];
    const output = execFileSync(sqliteBinary, args, { encoding: 'utf8' }).trim();
    return json && output ? JSON.parse(output) : [];
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
  console.log(`SQLite database engine active: ${databasePath}`);
}
