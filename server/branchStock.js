import { db } from './db.js';

// ---------------------------------------------------------------------------
// Per-branch inventory helpers.
//
// The product catalogue is shared org-wide (products table). The AUTHORITATIVE
// quantity for each (product, branch) lives in product_branch_stock.
// products.current_stock is kept as the org-wide AGGREGATE (sum across all
// branches) for backward compatibility — every mutation here re-syncs it.
//
// All functions are deliberately SELECT-before-write (no INSERT OR IGNORE /
// ON CONFLICT) so they behave identically on SQLite, Turso/libSQL and Supabase
// Postgres. They are meant to be called INSIDE an existing db.transaction()
// where the caller provides one.
// ---------------------------------------------------------------------------

// Earliest-created branch for an org = its primary/default branch.
export function primaryBranchId(orgId) {
  try {
    const b = db.prepare('SELECT id FROM branches WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1').get(orgId);
    if (b && b.id) return b.id;
    const any = db.prepare('SELECT id FROM branches ORDER BY created_at ASC LIMIT 1').get();
    return any ? any.id : null;
  } catch (e) {
    return null;
  }
}

// Resolve the branch a READ should be scoped to.
//
// There is NO aggregate "ALL" view: every branch stands alone, so a read is
// ALWAYS scoped to exactly one branch.
//  - Non-owner: ALWAYS their own assigned branch (client input ignored).
//  - Owner: the requested branch, or the org's primary branch as a fallback
//    (a stale/legacy 'ALL' request is treated as "no branch requested").
// `all` is retained in the return shape for call-site compatibility but is now
// always false.
export function resolveViewBranch(authUser, requestedBranch) {
  if (!authUser) return { branch: null, all: false };
  if (authUser.role !== 'owner') return { branch: authUser.branchId || null, all: false };
  const orgId = authUser.organizationId;
  if (requestedBranch && requestedBranch !== 'ALL' && branchExists(orgId, requestedBranch)) {
    return { branch: requestedBranch, all: false };
  }
  return { branch: primaryBranchId(orgId), all: false };
}

// True when a NON-owner is explicitly addressing a branch that is not their own
// (a forged branch id). Owners are never cross-branch-denied.
export function crossBranchDenied(authUser, requested) {
  return authUser && authUser.role !== 'owner'
    && requested && requested !== 'ALL'
    && requested !== authUser.branchId;
}

// Resolve the branch a WRITE must land on, or throw. Scoped users are forced to
// their own branch and REJECTED if they forge a different branch id; owners must
// pass a real, accessible branch (never ALL). `canAccess` is auth.canAccessBranch,
// passed in to avoid a cycle. Thrown errors carry `.status` for the route.
export function assertWriteBranch(authUser, orgId, requestedBranch, canAccess) {
  if (authUser.role !== 'owner') {
    if (!authUser.branchId) { const e = new Error('Your account is not assigned to a branch.'); e.status = 403; throw e; }
    if (crossBranchDenied(authUser, requestedBranch)) {
      const e = new Error('Access denied: you cannot operate on another branch.'); e.status = 403; throw e;
    }
    return authUser.branchId;
  }
  if (!requestedBranch || requestedBranch === 'ALL') {
    throw new Error('Please select a specific branch for this operation.');
  }
  if (!branchExists(orgId, requestedBranch)) {
    throw new Error('Selected branch was not found for your organization.');
  }
  if (canAccess && !canAccess(authUser, requestedBranch)) {
    throw new Error('You do not have access to the selected branch.');
  }
  return requestedBranch;
}

// True if branchId is a real branch belonging to this org.
export function branchExists(orgId, branchId) {
  if (!branchId) return false;
  try {
    const b = db.prepare('SELECT id FROM branches WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)').get(branchId, orgId);
    return !!b;
  } catch (e) {
    return false;
  }
}

// Read a branch's stock row, or a virtual zero row (falling back to the
// product-level min/reorder defaults) when none exists yet.
export function getBranchStock(orgId, productId, branchId) {
  const row = db.prepare('SELECT * FROM product_branch_stock WHERE organization_id = ? AND product_id = ? AND branch_id = ?').get(orgId, productId, branchId);
  if (row) return row;
  const prod = db.prepare('SELECT min_stock, reorder_level FROM products WHERE id = ? AND organization_id = ?').get(productId, orgId);
  return {
    id: null,
    organization_id: orgId,
    product_id: productId,
    branch_id: branchId,
    current_stock: 0,
    min_stock: prod ? prod.min_stock : 5,
    reorder_level: prod ? prod.reorder_level : 10,
    _virtual: true
  };
}

// Ensure a (product, branch) row exists; returns its id. SELECT-first so it is
// idempotent and portable.
export function ensureBranchStock(orgId, productId, branchId, initialStock = 0) {
  const existing = db.prepare('SELECT id FROM product_branch_stock WHERE organization_id = ? AND product_id = ? AND branch_id = ?').get(orgId, productId, branchId);
  if (existing) return existing.id;
  const prod = db.prepare('SELECT min_stock, reorder_level FROM products WHERE id = ? AND organization_id = ?').get(productId, orgId);
  const id = `PBS-${productId}-${branchId}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  db.prepare(`INSERT INTO product_branch_stock (id, organization_id, product_id, branch_id, current_stock, min_stock, reorder_level)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, orgId, productId, branchId, initialStock, prod ? prod.min_stock : 5, prod ? prod.reorder_level : 10);
  return id;
}

// Recompute products.current_stock as the org-wide aggregate (sum of branches).
export function syncAggregate(orgId, productId) {
  const row = db.prepare('SELECT COALESCE(SUM(current_stock), 0) AS total FROM product_branch_stock WHERE organization_id = ? AND product_id = ?').get(orgId, productId);
  const total = row ? Number(row.total) : 0;
  db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?').run(total, productId, orgId);
  return total;
}

// Set a branch's ABSOLUTE stock (manual adjustment). Returns { previous, next }.
export function setBranchStock(orgId, productId, branchId, nextStock) {
  const cur = getBranchStock(orgId, productId, branchId);
  ensureBranchStock(orgId, productId, branchId, 0);
  db.prepare('UPDATE product_branch_stock SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND product_id = ? AND branch_id = ?')
    .run(nextStock, orgId, productId, branchId);
  syncAggregate(orgId, productId);
  return { previous: cur.current_stock, next: nextStock };
}

// Apply a DELTA to a branch's stock (+receive/return, -sale/damage).
// Returns { previous, next }.
export function adjustBranchStock(orgId, productId, branchId, delta) {
  const cur = getBranchStock(orgId, productId, branchId);
  ensureBranchStock(orgId, productId, branchId, 0);
  const next = Number(cur.current_stock) + Number(delta);
  db.prepare('UPDATE product_branch_stock SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND product_id = ? AND branch_id = ?')
    .run(next, orgId, productId, branchId);
  syncAggregate(orgId, productId);
  return { previous: cur.current_stock, next };
}
