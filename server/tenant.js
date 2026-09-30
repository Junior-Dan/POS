import { db } from './db.js';

// ---------------------------------------------------------------------------
// Multi-tenant helpers shared across routes.
// ---------------------------------------------------------------------------

// Per-organization settings are stored in the single settings table under a
// namespaced key: "<orgId>::<name>". This keeps each organization's business
// profile, branches list, payment/receipt/shift settings fully isolated.
export function settingKey(orgId, name) {
  return `${orgId || 'ORG'}::${name}`;
}

// Read a per-org setting value (parsed JSON) or null.
export function getOrgSetting(orgId, name) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey(orgId, name));
    if (row && row.value) return JSON.parse(row.value);
  } catch (e) {}
  return null;
}

// Write a per-org setting value (stored as JSON).
export function setOrgSetting(orgId, name, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(settingKey(orgId, name), JSON.stringify(value));
}

// Generate a globally-unique branch code. Branch codes double as the share-URL
// slug (?branch=code), so they must be unique across ALL organizations for the
// link to unambiguously identify one org's terminal.
export function uniqueBranchCode(desired) {
  const base = String(desired || 'store')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'store';

  try {
    const existing = db.prepare('SELECT code FROM branches WHERE LOWER(code) LIKE ?').all(`${base}%`);
    const codeSet = new Set((existing || []).map(r => (r.code || '').toLowerCase()));
    if (!codeSet.has(base)) return base;

    let code = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    for (let i = 0; i < 10; i++) {
      if (!codeSet.has(code)) return code;
      code = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  } catch (e) {}

  return `${base}-${Date.now().toString().slice(-6)}`;
}
