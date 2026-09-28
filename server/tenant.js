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

  let code = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    let taken = false;
    try { taken = !!db.prepare('SELECT id FROM branches WHERE LOWER(code) = ?').get(code); } catch (e) {}
    if (!taken) return code;
    code = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  // Final fallback: time-based suffix is effectively unique.
  return `${base}-${Date.now().toString().slice(-6)}`;
}
