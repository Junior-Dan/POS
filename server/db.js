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
 * Database adapter supporting local SQLite CLI and remote Turso libSQL cloud database.
 */
class SqliteDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.transactionFile = null;
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

    // Perform the HTTP request synchronously by running it in a short-lived
    // Node child process. This keeps the whole DB layer synchronous (the app
    // relies on it) WITHOUT depending on a `curl` binary — Vercel's serverless
    // Node runtime does not reliably ship curl, but process.execPath (node) is
    // always available.
    const childScript = `
      const [endpoint, token, body] = process.argv.slice(1);
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body
      }).then(r => r.text())
        .then(t => { process.stdout.write(t); })
        .catch(e => { process.stdout.write(JSON.stringify({ __fetchError: e.message })); });
    `;

    let output;
    try {
      output = execFileSync(process.execPath, ['-e', childScript, endpoint, this.tursoToken, payload], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024
      }).trim();
    } catch (err) {
      throw new Error(`Turso request failed (network/child): ${err.message}`);
    }

    if (!output) return [];

    let res;
    try {
      res = JSON.parse(output);
    } catch (e) {
      throw new Error(`Turso returned an unparseable response: ${output.slice(0, 200)}`);
    }

    if (res.__fetchError) {
      throw new Error(`Turso fetch error: ${res.__fetchError}`);
    }

    // Surface Turso-reported SQL/auth errors instead of silently returning [].
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

  // Run many statements. On Turso they are sent in ONE HTTP pipeline request
  // (fast cold starts); locally they run as a single batched script.
  execBatch(statements) {
    if (!Array.isArray(statements) || statements.length === 0) return;
    if (this.isTurso) {
      const endpoint = this.tursoUrl.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '') + '/v2/pipeline';
      const payload = JSON.stringify({
        requests: [
          ...statements.map(sql => ({ type: 'execute', stmt: { sql } })),
          { type: 'close' }
        ]
      });
      const childScript = `
        const [endpoint, token, body] = process.argv.slice(1);
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body })
          .then(r => r.text()).then(t => process.stdout.write(t))
          .catch(e => process.stdout.write(JSON.stringify({ __fetchError: e.message })));
      `;
      let output;
      try {
        output = execFileSync(process.execPath, ['-e', childScript, endpoint, this.tursoToken, payload], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
      } catch (err) {
        throw new Error(`Turso batch request failed: ${err.message}`);
      }
      if (output) {
        let res; try { res = JSON.parse(output); } catch (e) { throw new Error(`Turso batch unparseable: ${output.slice(0, 200)}`); }
        if (res.__fetchError) throw new Error(`Turso batch fetch error: ${res.__fetchError}`);
        const errored = (res.results || []).find(r => r?.type === 'error' || r?.error);
        if (errored) throw new Error(`Turso batch SQL error: ${errored.error?.message || errored.message}`);
      }
      return;
    }
    // Local SQLite CLI: run all statements in one invocation.
    this._execute(statements.map(s => s.trim().replace(/;+$/, '')).join(';\n') + ';');
  }

  pragma(value) {
    if (!this.isTurso) {
      this._execute(`PRAGMA ${value}`);
    }
  }

  transaction(fn) {
    return (...args) => {
      if (this.isTurso) {
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

export const db = new SqliteDatabase(databasePath);

export function initDb() {
  // On Turso the database is remote and always reachable; locally it must be a
  // real file (unless CELLAR_DB_PATH points elsewhere or we are on Vercel /tmp).
  if (!db.isTurso && !fs.existsSync(databasePath)) {
    // On a fresh environment (e.g. Vercel /tmp with no seed) create an empty
    // file so the schema can be initialised below.
    try { fs.writeFileSync(databasePath, ''); } catch (e) {
      throw new Error(`SQLite database is missing and could not be created: ${databasePath}`);
    }
  }
  if (!db.isTurso) {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');
  }

  // Create the full schema (idempotent). Sent as one batched request so a
  // Turso cold start pays a single HTTP round-trip rather than one per table.
  db.execBatch(SCHEMA_STATEMENTS);

  // Migration helper for adding missing columns to users table safely
  if (!db.isTurso) {
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
  }

  console.log(db.isTurso ? `Turso Cloud database engine active: ${db.tursoUrl}` : `SQLite database engine active: ${databasePath}`);
}
