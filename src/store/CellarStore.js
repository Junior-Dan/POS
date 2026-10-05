import { INITIAL_PRODUCTS } from '../data/initialProducts.js';
import { INITIAL_USERS } from '../data/initialUsers.js';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers.js';
import { INITIAL_BRANCHES } from '../data/initialBranches.js';

// ---------------------------------------------------------------------------
// Attach the session token (Bearer) to every same-origin /api request so the
// backend can enforce authentication, role and branch isolation. Runs once at
// module load, before the store issues its first fetch.
// ---------------------------------------------------------------------------
// In-memory auth token: the single source of truth that survives even when
// localStorage is unavailable (Safari private mode, disabled storage) or has
// not yet been (re)written. localStorage is treated as a best-effort cache.
export function setAuthToken(token) {
  if (typeof window !== 'undefined') window._cellarAuthToken = token || null;
  try { if (token) localStorage.setItem('cellar_token', token); } catch (e) {}
}
export function getAuthToken() {
  let token = null;
  try { token = localStorage.getItem('cellar_token'); } catch (e) {}
  if (!token && typeof window !== 'undefined') token = window._cellarAuthToken || null;
  return token;
}
export function clearAuthToken() {
  if (typeof window !== 'undefined') window._cellarAuthToken = null;
  try { localStorage.removeItem('cellar_token'); } catch (e) {}
}

// Read a JSON body without throwing on empty/non-JSON responses (proxy errors,
// gateway pages, 204s). Returns {} for empty, {error:<snippet>} for non-JSON.
export async function readJsonBody(res) {
  let text = '';
  try { text = await res.text(); } catch (e) { return {}; }
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) };
  }
}

// Optional backend base URL. When VITE_API_BASE is set at build time (e.g. a
// remote Express backend hosted on Render), relative "/api/..." requests are
// rewritten to "${VITE_API_BASE}/api/...". When unset/empty, requests stay
// relative so local dev keeps using the Vite proxy and same-origin hosting
// continues to work unchanged. The Render URL is never hardcoded here.
const API_BASE = (import.meta.env.VITE_API_BASE || '')
  .toString()
  .replace(/\/+$/, '');

if (typeof window !== 'undefined' && !window._cellarFetchPatched) {
  window._cellarFetchPatched = true;
  const _origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.includes('/api/')) {
        const token = getAuthToken();
        if (token) {
          const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
          init = { ...init, headers };
        }
        // Point relative API calls at the configured backend origin, if any.
        // Only rewrite plain relative "/api/..." strings — never an already
        // absolute URL — so we can never double-prefix the base.
        if (API_BASE && typeof input === 'string' && input.startsWith('/api/')) {
          input = API_BASE + input;
        }
      }
    } catch (e) { /* fall through to normal fetch */ }
    return _origFetch(input, init);
  };
}

export class CellarStore {
  constructor() {
    this.listeners = [];
    this.products = [];
    this.users = INITIAL_USERS;
    this.suppliers = INITIAL_SUPPLIERS;
    this.branches = INITIAL_BRANCHES;
    this.activeBranchId = "main";
    // Branch-scoped login roster (populated from the public branch-info
    // endpoint — used to render the "Who are you?" account picker).
    this.loginUsers = [];
    this.loginBranch = null;
    this.rosterLoaded = false;
    this.sales = [];
    this.stockMovements = [];
    this.cashMovements = [];
    this.expenses = [];
    this.auditLogs = [];
    this.purchases = [];
    this.customers = [];
    this.shifts = [];
    this.notifications = [];
    this.currentShift = null;
    // No implicit login: unauthenticated until a valid session token is
    // restored or a PIN login succeeds.
    this.currentUser = null;

    // While a user-initiated mutation (add/edit/stock) is in flight, pause the
    // background live-sync poll so it can't overwrite the just-saved row with a
    // momentarily-stale server snapshot (which previously forced a manual
    // refresh before new/edited products showed up).
    this._syncPauseCount = 0;


    this.businessProfile = {
      name: "Celler POS",
      phone: "0722 000 111",
      email: "info@celler.co.ke",
      address: "Kenyatta Avenue, Nairobi CBD",
      kraPin: "P051234567S",
      regNo: "CPR/2024/99182",
      receiptName: "CELLER POS",
      receiptPhone: "0722 000 111",
      receiptAddress: "Kenyatta Avenue, Nairobi CBD"
    };

    this.paymentSettings = {
      cashEnabled: true,
      mpesaEnabled: true,
      cardEnabled: true,
      bankEnabled: true,
      creditEnabled: false
    };

    this.receiptSettings = {
      showLogo: true,
      showCashierName: true,
      showTaxBreakdown: true,
      printCopies: 1,
      headerText: "CELLER POS",
      footerText: "Thank you for shopping at Celler POS! Quality Wines & Spirits."
    };

    this.shiftSettings = {
      defaultFloat: 5000,
      requireCashDeclaration: true,
      maxVarianceThreshold: 1000,
      requireManagerVarianceApproval: true
    };

    this.securitySettings = {
      sessionTimeoutMinutes: 30,
      autoLogoutOnIdle: false,
      requirePinForRefunds: true,
      requirePinForPriceOverride: true,
      requirePinForStockAdjustments: true,
      maxDiscountPercentWithoutAuth: 5
    };

    this.systemPreferences = {
      currencySymbol: "KSh",
      taxRate: 16,
      dateFormat: "DD/MM/YYYY",
      theme: "dark"
    };

    // Expose readiness so the UI can render once the session/roster is loaded.
    this.readyPromise = this.initStore();
    this.setupRealtimeSync();
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn());
  }

  setupRealtimeSync() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.syncChannel = new BroadcastChannel('cellar_live_sync');
        this.syncChannel.onmessage = (e) => {
          if (e.data && e.data.type === 'REFRESH_STATE') {
            this.syncLiveState();
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel notice:", e);
      }
    }

    window.addEventListener('storage', (ev) => {
      if (ev.key === 'cellar_sync_ping') {
        this.syncLiveState();
      }
    });

    // Recovery: immediately re-sync authoritative data when the tab regains
    // focus or the network reconnects, so the dashboard can never sit on stale
    // numbers after a disconnect or being backgrounded.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.currentUser && this.currentUser.id) this.syncLiveState();
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.currentUser && this.currentUser.id) this.syncLiveState();
      });
    }

    // Live-sync polling for cross-device updates (e.g. owner dashboard on a
    // different device than the cashier's POS). Same-browser tabs already get
    // an instant push via BroadcastChannel/storage ping on each sale. The DB
    // layer is synchronous, so we poll on a short-but-gentle interval, only when
    // logged in AND the tab is visible.
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (!this.currentUser || !this.currentUser.id) return;
        this.syncLiveState();
      }, 3000);
    }
  }

  broadcastUpdate() {
    try {
      localStorage.setItem('cellar_sync_ping', Date.now().toString());
      if (this.syncChannel) {
        this.syncChannel.postMessage({ type: 'REFRESH_STATE', time: Date.now() });
      }
    } catch (e) {}
  }

  // Signature of overall store state (sales, stock, shifts, expenses, users) so we re-render whenever ANY data changes
  _stateSignature() {
    const list = this.sales || [];
    let total = 0;
    for (const s of list) total += Number(s.total || 0) + (s.refunded ? 1 : 0);

    const prods = this.products || [];
    let pStock = 0;
    for (const p of prods) pStock += Number(p.stock !== undefined ? p.stock : (p.current_stock || 0));

    const shiftId = this.currentShift?.id || '';
    const shiftStatus = this.currentShift?.status || '';

    const expList = this.expenses || [];
    const userList = this.users || [];

    return `${list.length}:${total}:${prods.length}:${pStock}:${shiftId}:${shiftStatus}:${expList.length}:${userList.length}`;
  }

  async syncLiveState() {
    // Don't clobber optimistic local state while a save is still committing.
    if (this._syncPauseCount > 0) return;
    try {
      const prevSig = this._stateSignature();
      await Promise.all([
        this.fetchSales(),
        this.fetchProducts(),
        this.fetchShift(),
        this.fetchExpenses(),
        this.fetchUsers()
      ]);
      const newSig = this._stateSignature();
      if (window.triggerDashboardCharts) window.triggerDashboardCharts();
      if (newSig !== prevSig) {
        this.notify();
      }
    } catch (e) {
      // A failed poll is non-fatal; the next tick (or focus/online event) recovers.
      console.warn("Sync error:", e);
    }
  }

  saveLocalBackup() {
    try {
      localStorage.setItem('cellar_sales_backup', JSON.stringify(this.sales || []));
      localStorage.setItem('cellar_products_backup', JSON.stringify(this.products || []));
      localStorage.setItem('cellar_shift_backup', JSON.stringify(this.currentShift || {}));
      localStorage.setItem('cellar_notifications_backup', JSON.stringify(this.notifications || []));
      if (this.businessProfile) localStorage.setItem('cellar_biz_profile_backup', JSON.stringify(this.businessProfile));
      if (this.branches) localStorage.setItem('cellar_branches_backup', JSON.stringify(this.branches));
      if (this.currentUser) localStorage.setItem('cellar_current_user_backup', JSON.stringify(this.currentUser));
    } catch (e) {}
  }

  loadLocalBackup() {
    try {
      const sales = localStorage.getItem('cellar_sales_backup');
      if (sales) this.sales = JSON.parse(sales);

      const products = localStorage.getItem('cellar_products_backup');
      if (products) this.products = JSON.parse(products);

      const shift = localStorage.getItem('cellar_shift_backup');
      if (shift) this.currentShift = JSON.parse(shift);

      const notifs = localStorage.getItem('cellar_notifications_backup');
      if (notifs) this.notifications = JSON.parse(notifs);

      const bizProf = localStorage.getItem('cellar_biz_profile_backup');
      if (bizProf) this.businessProfile = JSON.parse(bizProf);

      const branches = localStorage.getItem('cellar_branches_backup');
      if (branches) this.branches = JSON.parse(branches);

      const user = localStorage.getItem('cellar_current_user_backup');
      if (user) this.currentUser = JSON.parse(user);
    } catch (e) {}
  }

  addNotification(notifData) {
    const notif = {
      id: `NOTIF-${Date.now()}`,
      type: notifData.type || 'shift',
      title: notifData.title,
      message: notifData.message,
      branchId: notifData.branchId || this.activeBranchId,
      cashierName: notifData.cashierName || (this.currentUser ? this.currentUser.name : 'Cashier'),
      timestamp: new Date().toISOString(),
      read: false
    };
    if (!this.notifications) this.notifications = [];
    this.notifications.unshift(notif);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    if (window.showToastNotification) {
      window.showToastNotification(notif);
    }
    return notif;
  }

  markNotificationsRead() {
    if (this.notifications) {
      this.notifications.forEach(n => n.read = true);
      this.saveLocalBackup();
      this.notify();
    }
  }

  getUnreadNotificationsCount() {
    if (!this.notifications) return 0;
    return this.notifications.filter(n => !n.read).length;
  }

  async safeFetchJson(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }

  // Public branch roster for the login screen (no auth token required).
  async fetchBranchLogin() {
    let code = '';
    let staff = '';
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      code = params.get('branch') || '';
      staff = params.get('staff') || params.get('u') || '';
    }
    // A personal invite link (?staff=…) restricts the terminal to that one account.
    this.loginStaffRef = staff || null;
    const staffQ = staff ? `&staff=${encodeURIComponent(staff)}` : '';
    const data = await this.safeFetchJson(`/api/auth/branch-info?code=${encodeURIComponent(code)}${staffQ}&_t=${Date.now()}`, { cache: 'no-store' });
    if (data && data.branch) {
      this.loginBranch = data.branch;
      this.loginUsers = Array.isArray(data.users) ? data.users : [];
      this.rosterLoaded = true;
      try {
        const ownerExists = (this.loginUsers || []).some(u => (u.role || '').toLowerCase() === 'owner') ||
          (this.currentUser && (this.currentUser.role || '').toLowerCase() === 'owner');
        if (ownerExists) {
          localStorage.setItem('cellar_owner_exists', '1');
        } else {
          localStorage.removeItem('cellar_owner_exists');
        }
      } catch (e) {}
      this.notify();
    } else {
      this.rosterLoaded = true;
      this.notify();
    }
  }

  // Restore a persisted session (page reload) from the stored token.
  async restoreSession() {
    const token = getAuthToken();
    if (!token) return false;
    // Keep the in-memory token authoritative even if it only lived in storage.
    setAuthToken(token);
    const data = await this.safeFetchJson('/api/auth/me');
    if (data && data.user && data.user.id) {
      // Preserve the token on currentUser so staff-management guards always
      // have a fallback even if localStorage is later cleared.
      this.currentUser = { ...data.user, token: data.user.token || token };
      if (data.user.organizationName) {
        this.businessProfile = { ...this.businessProfile, name: data.user.organizationName, receiptName: String(data.user.organizationName).toUpperCase() };
      }
      // Every branch stands alone — there is no aggregate "ALL" view. Staff are
      // pinned to their own branch; owners view ONE branch at a time. The exact
      // branch is resolved once branches load (see resolveActiveBranch): the
      // last-viewed branch if still valid, otherwise the primary branch.
      const isOwner = (data.user.role || '').toLowerCase() === 'owner';
      if (isOwner) {
        let saved = null;
        try { saved = sessionStorage.getItem('cellar_active_branch'); } catch (e) {}
        this.activeBranchId = (saved && saved !== 'ALL') ? saved : null;
      } else {
        this.activeBranchId = data.user.branchId || this.activeBranchId;
      }
      try { sessionStorage.setItem('cellar_session_auth', 'true'); } catch (e) {}
      return true;
    }
    // Token invalid/expired — clear it.
    clearAuthToken();
    try { sessionStorage.removeItem('cellar_session_auth'); } catch (e) {}
    this.currentUser = null;
    return false;
  }

  // Fetch all role/branch-protected resources (only meaningful once logged in).
  async loadAuthenticatedData() {
    try {
      await Promise.all([
        this.fetchUsers(),
        this.fetchProducts(),
        this.fetchSuppliers(),
        this.fetchCustomers(),
        this.fetchSales(),
        this.fetchShift(),
        this.fetchInventoryMovements(),
        this.fetchExpenses(),
        this.fetchPurchases(),
        this.fetchAuditLogs(),
        this.fetchSettings()
      ]);
    } catch (err) {
      console.warn("API server fetch notice, using local backup", err);
    }
    // Branches are now loaded — pin the owner to a concrete branch (no "ALL").
    this.resolveActiveBranch();
  }

  // Ensure activeBranchId is a real branch. Staff are pinned server-side, so
  // this only resolves the owner's view: keep the last-viewed branch when it is
  // still valid, otherwise fall back to the primary (first) branch. There is no
  // aggregate "ALL" — each branch is viewed on its own.
  resolveActiveBranch() {
    const isOwner = (this.currentUser?.role || '').toLowerCase() === 'owner';
    if (!isOwner) return;
    const branches = Array.isArray(this.branches) ? this.branches : [];
    const valid = this.activeBranchId && this.activeBranchId !== 'ALL'
      && branches.some(b => b.id === this.activeBranchId);
    if (!valid) {
      this.activeBranchId = branches.length ? branches[0].id : null;
    }
    try {
      if (this.activeBranchId) sessionStorage.setItem('cellar_active_branch', this.activeBranchId);
    } catch (e) {}
  }

  async initStore() {
    this.loadLocalBackup();
    await this.fetchBranchLogin();
    await this.restoreSession();
    await this.loadAuthenticatedData();
  }

  resetState() {
    this.currentUser = null;
    this.products = [];
    this.users = [];
    this.suppliers = [];
    this.branches = [];
    this.loginUsers = [];
    this.sales = [];
    this.stockMovements = [];
    this.cashMovements = [];
    this.expenses = [];
    this.auditLogs = [];
    this.purchases = [];
    this.customers = [];
    this.shifts = [];
    this.notifications = [];
    this.currentShift = null;
    try {
      localStorage.removeItem('cellar_owner_exists');
      localStorage.removeItem('cellar_sales_backup');
      localStorage.removeItem('cellar_products_backup');
      localStorage.removeItem('cellar_shift_backup');
      localStorage.removeItem('cellar_notifications_backup');
      localStorage.removeItem('cellar_biz_profile_backup');
      localStorage.removeItem('cellar_branches_backup');
      localStorage.removeItem('cellar_current_user_backup');
    } catch (e) {}
  }

  seedFallback() {
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.suppliers = JSON.parse(JSON.stringify(INITIAL_SUPPLIERS));
    this.branches = JSON.parse(JSON.stringify(INITIAL_BRANCHES));
    this.currentUser = this.users[0];
    this.saveLocalBackup();
    this.notify();
  }

  // --- API FETCHERS ---
  // Branch query string for the active branch. Empty for ALL / unset (owner
  // org-wide view). For non-owners the server ignores this and forces their own
  // branch, so sending it is always safe.
  _branchQS() {
    return (this.activeBranchId && this.activeBranchId !== 'ALL')
      ? `branch=${encodeURIComponent(this.activeBranchId)}`
      : '';
  }

  async fetchUsers() {
    const q = this._branchQS();
    const data = await this.safeFetchJson(`/api/auth/users${q ? '?' + q : ''}`);
    if (data && Array.isArray(data)) {
      this.users = data.map(u => ({
        ...u,
        primaryBranchId: u.primaryBranchId || u.branchId || u.branch_id
      }));
      this.notify();
    }
  }

  async fetchProducts() {
    // When a specific branch is active, ask for that branch's stock; 'ALL'
    // (owner org-wide view) or no branch returns the aggregate — preserving the
    // original single-branch behaviour.
    const bid = (this.activeBranchId && this.activeBranchId !== 'ALL')
      ? `&branch=${encodeURIComponent(this.activeBranchId)}`
      : '';
    const data = await this.safeFetchJson(`/api/products?activeOnly=false${bid}`);
    if (data && Array.isArray(data)) {
      this.products = data.map(p => ({
        ...p,
        price: p.price !== undefined && p.price !== null ? Number(p.price) : Number(p.selling_price || 0),
        cost: p.cost !== undefined && p.cost !== null ? Number(p.cost) : Number(p.cost_price || 0),
        stock: p.stock !== undefined && p.stock !== null ? Number(p.stock) : Number(p.current_stock || 0),
        reorder: p.reorder !== undefined && p.reorder !== null ? Number(p.reorder) : Number(p.reorder_level || 5)
      }));
      this.saveLocalBackup();
      this.notify();
    }
  }

  async fetchSuppliers() {
    const data = await this.safeFetchJson('/api/suppliers');
    if (data) {
      this.suppliers = data;
      this.notify();
    }
  }

  async fetchCustomers() {
    const data = await this.safeFetchJson('/api/customers');
    if (data) {
      this.customers = data;
      this.notify();
    }
  }

  async fetchSales() {
    const q = this._branchQS();
    const data = await this.safeFetchJson(`/api/sales${q ? '?' + q : ''}`);
    if (data && Array.isArray(data)) {
      this.sales = data;
      this.saveLocalBackup();
      this.notify();
    }
  }

  async fetchShift() {
    // Shift endpoint scopes by branchId (owner selected branch); non-owners are
    // forced to their own branch server-side.
    const bid = (this.activeBranchId && this.activeBranchId !== 'ALL')
      ? `?branchId=${encodeURIComponent(this.activeBranchId)}`
      : '';
    const data = await this.safeFetchJson(`/api/shift/current${bid}`);
    if (data) {
      this.currentShift = data;
      this.cashMovements = data.cashMovements || [];
      this.saveLocalBackup();
      this.notify();
    }
  }

  async fetchInventoryMovements() {
    const q = this._branchQS();
    const data = await this.safeFetchJson(`/api/inventory/movements${q ? '?' + q : ''}`);
    if (data) {
      this.stockMovements = data;
      this.notify();
    }
  }

  async fetchExpenses() {
    const q = this._branchQS();
    const data = await this.safeFetchJson(`/api/expenses${q ? '?' + q : ''}`);
    if (data) {
      this.expenses = data;
      this.notify();
    }
  }

  async fetchPurchases() {
    const q = this._branchQS();
    const data = await this.safeFetchJson(`/api/purchases${q ? '?' + q : ''}`);
    if (data) {
      this.purchases = data;
      this.notify();
    }
  }

  async fetchAuditLogs() {
    const q = this._branchQS();
    const data = await this.safeFetchJson(`/api/audit-logs${q ? '?' + q : ''}`);
    if (data) {
      this.auditLogs = data;
      this.notify();
    }
  }

  initActiveBranchFromUrl() {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const bQuery = params.get('branch');
      if (bQuery && this.branches && this.branches.length > 0) {
        const found = this.branches.find(b =>
          (b.code && b.code.toLowerCase() === bQuery.toLowerCase()) ||
          (b.id && b.id.toLowerCase() === bQuery.toLowerCase())
        );
        if (found) {
          this.activeBranchId = found.id;
        }
      }
    }
  }

  async fetchSettings() {
    const s = await this.safeFetchJson('/api/settings');
    if (s) {
      if (s.businessProfile) this.businessProfile = s.businessProfile;
      if (s.branches && Array.isArray(s.branches) && s.branches.length > 0) {
        this.branches = s.branches;
        this.initActiveBranchFromUrl();
      }
      if (s.paymentSettings) this.paymentSettings = s.paymentSettings;
      if (s.receiptSettings) this.receiptSettings = s.receiptSettings;
      if (s.shiftSettings) this.shiftSettings = s.shiftSettings;
      if (s.securitySettings) this.securitySettings = s.securitySettings;
      if (s.systemPreferences) this.systemPreferences = s.systemPreferences;
      this.notify();
    }
  }

  async createBranch(branchData) {
    const rawCode = branchData.code || branchData.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const code = rawCode.toLowerCase();
    const id = branchData.id || `BR-${code}-${Date.now()}`;
    const newBranch = {
      id,
      organizationId: this.currentUser?.organizationId,
      name: branchData.name,
      code,
      commodityType: branchData.commodityType || 'Water & Beverages',
      location: branchData.location || '',
      phone: branchData.phone || '',
      manager: branchData.manager || '',
      operatingHours: branchData.operatingHours || '08:00 AM - 10:00 PM',
      status: branchData.status || 'ACTIVE'
    };

    if (!Array.isArray(this.branches)) this.branches = [];
    const idx = this.branches.findIndex(b => b.id === id || (b.code && b.code.toLowerCase() === code));
    if (idx >= 0) {
      this.branches[idx] = newBranch;
    } else {
      this.branches.push(newBranch);
    }

    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();

    try {
      const res = await fetch('/api/auth/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: branchData.name,
          code,
          commodityType: branchData.commodityType,
          location: branchData.location,
          phone: branchData.phone,
          status: branchData.status
        })
      });
      if (!res.ok) {
        await this.saveBranches();
      }
    } catch (e) {
      await this.saveBranches();
    }

    return { branch: newBranch };
  }

  // Update an existing branch IN PLACE (edit). Uses the dedicated PUT endpoint
  // so the server updates the row rather than inserting a duplicate; the branch
  // code is kept stable so its share-URL keeps working.
  async updateBranch(id, branchData) {
    if (!Array.isArray(this.branches)) this.branches = [];
    const idx = this.branches.findIndex(b => b.id === id);
    const existing = idx >= 0 ? this.branches[idx] : {};
    const updated = {
      ...existing,
      id,
      organizationId: this.currentUser?.organizationId || existing.organizationId,
      name: branchData.name,
      // Preserve the existing code on edit (never re-slug a live branch).
      code: existing.code || branchData.code,
      commodityType: branchData.commodityType,
      location: branchData.location || '',
      phone: branchData.phone || '',
      manager: branchData.manager || existing.manager || '',
      operatingHours: branchData.operatingHours || existing.operatingHours || '08:00 AM - 10:00 PM',
      status: branchData.status || 'ACTIVE'
    };

    if (idx >= 0) {
      this.branches[idx] = updated;
    } else {
      this.branches.push(updated);
    }

    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();

    try {
      const res = await fetch(`/api/auth/branches/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchData.name,
          location: branchData.location,
          phone: branchData.phone,
          status: branchData.status,
          commodityType: branchData.commodityType
        })
      });
      if (!res.ok) {
        await this.saveBranches();
      }
    } catch (e) {
      await this.saveBranches();
    }

    return { branch: updated };
  }

  async saveBranches() {
    try {
      await fetch('/api/settings/branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.branches)
      });
      this.saveLocalBackup();
      this.notify();
      this.broadcastUpdate();
    } catch (e) {
      console.warn("Branch save notice:", e);
    }
  }

  async deleteBranch(id) {
    if (!Array.isArray(this.branches)) this.branches = [];
    this.branches = this.branches.filter(b => b.id !== id && b.code !== id);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();

    try {
      await fetch(`/api/auth/branches/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.currentUser?.token || ''}`
        }
      });
    } catch (e) {
      console.warn("API server delete branch notice", e);
    }
    await this.saveBranches();
    return { success: true };
  }


  async saveBusinessProfile(profileData) {
    this.businessProfile = { ...(this.businessProfile || {}), ...profileData };
    try {
      await fetch('/api/settings/business-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.businessProfile)
      });
    } catch (e) {
      console.warn("Save business profile notice:", e);
    }
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
  }

  async updateProductActive(id, active) {
    const prod = this.products.find(p => p.id === id);
    if (prod) prod.active = active;
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();

    // Persist; throw on failure so the caller can revert the optimistic UI.
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: active ? 1 : 0 })
    });
    if (!res.ok) {
      const data = await readJsonBody(res);
      throw new Error(data.error || `Failed to update status (HTTP ${res.status}).`);
    }
    return true;
  }

  // --- API MUTATION METHODS ---
  async addProduct(productData) {
    this._syncPauseCount++;
    try {
      const tempId = productData.id || `P-${Date.now()}`;
      const newProd = {
        id: tempId,
        brand: productData.brand || '',
        name: productData.name || '',
        category: productData.category || "Spirits",
        size: productData.size || "750 ml",
        abv: productData.abv !== undefined ? Number(productData.abv) : 40,
        sku: productData.sku || `SKU-${Date.now()}`,
        barcode: productData.barcode || `${Math.floor(1000000000000 + Math.random()*9000000000000)}`,
        cost: productData.cost !== undefined ? Number(productData.cost) : 0,
        cost_price: productData.cost !== undefined ? Number(productData.cost) : 0,
        price: productData.price !== undefined ? Number(productData.price) : 0,
        selling_price: productData.price !== undefined ? Number(productData.price) : 0,
        stock: productData.stock !== undefined ? Number(productData.stock) : 0,
        current_stock: productData.stock !== undefined ? Number(productData.stock) : 0,
        reorder: productData.reorder !== undefined ? Number(productData.reorder) : 5,
        reorder_level: productData.reorder !== undefined ? Number(productData.reorder) : 5,
        active: true,
        highValue: !!productData.highValue
      };

      const existingIdx = this.products.findIndex(p => p.id === tempId);
      if (existingIdx >= 0) {
        this.products[existingIdx] = newProd;
      } else {
        this.products.unshift(newProd);
      }
      this.saveLocalBackup();
      this.notify();
      this.broadcastUpdate();

      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...productData, userName: this.currentUser?.name })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const saved = await res.json();
          if (saved && saved.id) {
            newProd.id = saved.id;
          }
          // Pull the authoritative catalogue back so the new row is present and
          // correct the instant the view re-renders — no manual refresh needed.
          await this.fetchProducts();
          this.fetchInventoryMovements().catch(() => {});
          this.fetchAuditLogs().catch(() => {});
          return { product: newProd };
        }
      } catch (e) {
        console.warn("Add product sync notice:", e);
      }
      return { product: newProd };
    } finally {
      this._syncPauseCount = Math.max(0, this._syncPauseCount - 1);
    }
  }

  async updateProduct(id, productData) {
    this._syncPauseCount++;
    try {
      const prod = this.products.find(p => p.id === id);
      if (prod) {
        if (productData.brand !== undefined) prod.brand = productData.brand;
        if (productData.name !== undefined) prod.name = productData.name;
        if (productData.category !== undefined) prod.category = productData.category;
        if (productData.size !== undefined) prod.size = productData.size;
        if (productData.abv !== undefined) prod.abv = Number(productData.abv);
        if (productData.sku !== undefined) prod.sku = productData.sku;
        if (productData.barcode !== undefined) prod.barcode = productData.barcode;
        if (productData.cost !== undefined) { prod.cost = Number(productData.cost); prod.cost_price = Number(productData.cost); }
        if (productData.price !== undefined) { prod.price = Number(productData.price); prod.selling_price = Number(productData.price); }
        if (productData.reorder !== undefined) { prod.reorder = Number(productData.reorder); prod.reorder_level = Number(productData.reorder); }
        if (productData.highValue !== undefined) prod.highValue = !!productData.highValue;

        this.saveLocalBackup();
        this.notify();
        this.broadcastUpdate();
      }

      try {
        const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...productData, userName: this.currentUser?.name })
        });
        if (res.ok) {
          // Refresh from the server so the edited row reflects persisted values
          // immediately, without waiting for a manual page refresh.
          await this.fetchProducts();
          this.fetchAuditLogs().catch(() => {});
        }
      } catch (e) {
        console.warn("Update product sync notice:", e);
      }
      return { product: prod };
    } finally {
      this._syncPauseCount = Math.max(0, this._syncPauseCount - 1);
    }
  }

  async updateProductStock(id, newStock, reason = 'Manual Stock Adjustment') {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;

    this._syncPauseCount++;
    try {
      const numStock = Number(newStock);
      prod.stock = numStock;
      prod.current_stock = numStock;

      this.saveLocalBackup();
      this.notify();
      this.broadcastUpdate();

      try {
        const res = await fetch('/api/inventory/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: id,
            newStock: numStock,
            reason,
            userName: this.currentUser?.name,
            // Owners act on the selected branch; the server forces a scoped
            // user to their own branch regardless of what is sent here.
            branchId: this.activeBranchId
          })
        });
        if (res.ok) {
          // Refresh the catalogue so the adjusted stock value is authoritative
          // on the next render without a manual refresh.
          await this.fetchProducts();
          this.fetchInventoryMovements().catch(() => {});
          this.fetchAuditLogs().catch(() => {});
        }
      } catch (e) {
        console.warn("Update stock sync notice:", e);
      }
    } finally {
      this._syncPauseCount = Math.max(0, this._syncPauseCount - 1);
    }
  }

  async deleteProduct(id) {
    this.products = this.products.filter(p => p.id !== id);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();

    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Delete product sync notice:", e);
    }
    return { success: true };
  }

  async deactivateProduct(id) {
    return this.deleteProduct(id);
  }

  async deleteAllProducts() {
    try {
      await fetch('/api/products/all', { method: 'DELETE' });
    } catch (e) {}
    this.products = [];
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return { success: true };
  }

  // The backend/database is the single source of truth for a sale. We persist
  // FIRST, confirm the server accepted it, and only then refresh authoritative
  // state and notify. A failed persist throws so the POS can surface the error
  // and keep the cart — a sale that did not save must NEVER look successful,
  // and we never fabricate a local "offline" sale (that caused phantom totals).
  async createSale(saleData) {
    // Owners must sell against a specific branch — never a silent B1/primary
    // default. Convenience: if the org has exactly one branch, use it so
    // single-branch setups keep working without a manual pick.
    let saleBranch = this.activeBranchId;
    const isOwner = (this.currentUser?.role || '').toLowerCase() === 'owner';
    if (isOwner && (!saleBranch || saleBranch === 'ALL')) {
      if (Array.isArray(this.branches) && this.branches.length === 1) {
        saleBranch = this.branches[0].id;
      } else {
        throw new Error('Please select a branch before completing a sale.');
      }
    }

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...saleData,
        cashier: this.currentUser || null,
        branchId: saleBranch,
        shiftId: this.currentShift?.id
      })
    });

    const data = await readJsonBody(res);
    if (!res.ok || !data.sale) {
      throw new Error(data.error || `Sale could not be saved (HTTP ${res.status}).`);
    }

    // Persistence confirmed — pull the authoritative state back from the server.
    await Promise.all([
      this.fetchSales(),
      this.fetchProducts(),
      this.fetchInventoryMovements(),
      this.fetchCustomers(),
      this.fetchAuditLogs()
    ]);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate(); // nudge other open tabs/dashboards to refresh now
    return data.sale;
  }

  async processRefund(saleId, refundData) {
    try {
      const res = await fetch(`/api/sales/${saleId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refundData)
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchSales();
        await this.fetchProducts();
        await this.fetchInventoryMovements();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const sale = this.sales.find(s => s.id === saleId || s.receiptNo === saleId);
    if (sale) {
      sale.status = 'REFUNDED';
    }
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return { success: true };
  }

  async logCashMovement(movementData) {
    const branch = this.getActiveBranch();
    const cashierName = this.currentUser ? this.currentUser.name : 'Cashier';

    this.addNotification({
      type: 'cash',
      title: `Drawer Cash Movement (${movementData.type || 'IN'})`,
      message: `${cashierName} logged KSh ${(movementData.amount || 0).toLocaleString()} ${movementData.type === 'OUT' || movementData.type === 'CASH_OUT' ? 'Cash Out' : 'Cash In'} at ${branch.name}. Reason: "${movementData.reason || 'No reason specified'}"`,
      branchId: branch.id,
      cashierName: cashierName
    });

    try {
      const res = await fetch('/api/shift/cash-movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...movementData,
          shiftId: this.currentShift?.id,
          userName: this.currentUser?.name || 'John Omondi'
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchShift();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const move = {
      id: `CM-${Date.now()}`,
      type: movementData.type,
      amount: movementData.amount,
      reason: movementData.reason,
      timestamp: new Date().toISOString()
    };
    if (!this.cashMovements) this.cashMovements = [];
    this.cashMovements.push(move);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return { success: true };
  }

  async closeShift(closeData) {
    const expectedCash = this.getExpectedCashInDrawer();
    const actualCash = closeData.closingCash || 0;
    const variance = actualCash - expectedCash;
    const branch = this.getActiveBranch();
    const cashierName = this.currentUser ? this.currentUser.name : 'Cashier';

    const notif = this.addNotification({
      type: 'shift',
      title: 'Shift Reconciled & Closed',
      message: `${cashierName} reconciled & closed shift at ${branch.name}. Actual Cash: KSh ${actualCash.toLocaleString()}, Expected: KSh ${expectedCash.toLocaleString()}, Variance: KSh ${variance.toLocaleString()}${variance === 0 ? ' (Perfect Match)' : ''}. Notes: "${closeData.notes || 'None'}"`,
      branchId: branch.id,
      cashierName: cashierName
    });

    let shiftResult = null;
    try {
      const res = await fetch('/api/shift/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...closeData,
          shiftId: this.currentShift?.id
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchShift();
        await this.fetchAuditLogs();
        shiftResult = data.shift;
      }
    } catch (e) {}

    if (!shiftResult && this.currentShift) {
      this.currentShift.status = 'CLOSED';
      this.currentShift.closingTime = new Date().toISOString();
      this.currentShift.closingCash = closeData.closingCash;
      shiftResult = this.currentShift;
    }
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return shiftResult || { variance, closingCash: actualCash };
  }

  async recordStockDamage(damageData) {
    try {
      const res = await fetch('/api/inventory/damage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...damageData,
          userName: this.currentUser?.name || 'Manager',
          // Owners act on the selected branch; scoped users are forced to their
          // own branch server-side regardless of this value.
          branchId: damageData.branchId || this.activeBranchId
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchProducts();
        await this.fetchInventoryMovements();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const prod = this.products.find(p => p.id === damageData.productId);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - (damageData.qtyDamaged || 1));
    }
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return { success: true };
  }

  async addExpense(expenseData) {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseData,
          user: this.currentUser?.name || 'Manager',
          // Expenses are branch-owned; owners log against the active branch,
          // scoped users are forced to their own branch server-side.
          branchId: expenseData.branchId || this.activeBranchId
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchExpenses();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const exp = {
      id: `EXP-${Date.now()}`,
      category: expenseData.category,
      amount: expenseData.amount,
      description: expenseData.description,
      receiptRef: expenseData.receiptRef,
      paymentMethod: expenseData.paymentMethod || 'CASH',
      timestamp: new Date().toISOString()
    };
    if (!this.expenses) this.expenses = [];
    this.expenses.unshift(exp);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return exp;
  }

  async addSupplier(supplierData) {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData)
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchSuppliers();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const sup = {
      id: `SUP-${Date.now()}`,
      name: supplierData.name,
      contactPerson: supplierData.contactPerson,
      phone: supplierData.phone,
      address: supplierData.address
    };
    if (!this.suppliers) this.suppliers = [];
    this.suppliers.unshift(sup);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return sup;
  }

  async addCustomer(customerData) {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchCustomers();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const cust = {
      id: `C-${Date.now()}`,
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      visits: 0,
      totalSpend: 0
    };
    if (!this.customers) this.customers = [];
    this.customers.unshift(cust);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return cust;
  }

  async createPurchaseOrder(poData) {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...poData,
        branchId: this.activeBranchId
      })
    });
    const data = await readJsonBody(res);
    if (!res.ok) throw new Error(data.error || `Failed to create purchase order (HTTP ${res.status}).`);
    await this.fetchPurchases();
    await this.fetchAuditLogs();
    return data.purchaseOrder;
  }

  async receivePurchaseOrder(poId, receiveData) {
    const res = await fetch(`/api/purchases/${poId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...receiveData,
        userName: this.currentUser?.name || 'Inventory Officer'
      })
    });
    const data = await readJsonBody(res);
    if (!res.ok) throw new Error(data.error || `Failed to receive purchase order (HTTP ${res.status}).`);
    await this.fetchPurchases();
    await this.fetchProducts();
    await this.fetchInventoryMovements();
    await this.fetchAuditLogs();
    return data;
  }

  async updateSettings(sectionKey, settingsData) {
    const res = await fetch(`/api/settings/${sectionKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData)
    });
    const data = await readJsonBody(res);
    if (!res.ok) throw new Error(data.error || `Failed to save settings (HTTP ${res.status}).`);
    await this.fetchSettings();
    await this.fetchAuditLogs();
    return data;
  }

  logAudit(action, item, oldVal, newVal, reason) {
    fetch('/api/audit-logs').then(() => this.fetchAuditLogs()).catch(() => {});
  }

  setActiveBranch(branchId) {
    this.activeBranchId = branchId;
    this.notify();
  }

  // Owner-only: switch the ENTIRE app context to another (standalone) branch.
  // Persists the choice and reloads every branch-scoped dataset so sales,
  // inventory, purchases, expenses, staff, shifts, audit and reports all follow.
  async switchBranch(branchId) {
    // Only owners may switch; everyone else is permanently pinned server-side.
    if ((this.currentUser?.role || '').toLowerCase() !== 'owner') return;
    this.activeBranchId = branchId;
    try { sessionStorage.setItem('cellar_active_branch', branchId); } catch (e) {}
    this.notify();
    await this.loadAuthenticatedData();
    this.notify();
    this.broadcastUpdate();
  }

  getActiveBranch() {
    return (this.branches && this.branches.find(b => b.id === this.activeBranchId)) || (this.branches && this.branches[0]) || { id: 'BR-main', name: 'Main Branch', code: 'main' };
  }

  canUserAccessView(user, viewId) {
    if (!user) return false;
    if (user.role === 'owner') return true;

    if (user.permissions && (user.permissions.includes('all') || user.permissions.includes(viewId))) {
      return true;
    }

    // Everyone can see the Dashboard (their org's live data). Other views stay
    // role-scoped.
    const roleMap = {
      manager: ['dashboard', 'pos', 'products', 'inventory', 'sales', 'shift', 'suppliers', 'purchases', 'expenses', 'customers', 'compliance', 'reports', 'settings'],
      cashier: ['dashboard', 'pos', 'sales', 'shift', 'customers'],
      inventory_officer: ['dashboard', 'products', 'inventory', 'suppliers', 'purchases']
    };

    const allowedViews = roleMap[user.role] || [];
    return allowedViews.includes(viewId);
  }

  getSetupStatus() {
    const steps = [
      { key: "businessProfile", name: "Business Profile", status: (this.businessProfile && this.businessProfile.name && this.businessProfile.phone && this.businessProfile.kraPin) ? "COMPLETE" : "WARNING" },
      { key: "ownerAccount", name: "Owner Account", status: this.users.some(u => u.role === 'owner') ? "COMPLETE" : "WARNING" },
      { key: "firstBranch", name: "Branches Configured", status: this.branches.length > 0 ? "COMPLETE" : "WARNING" },
      { key: "staffMembers", name: "Staff & Roles", status: this.users.length >= 3 ? "COMPLETE" : "WARNING" },
      { key: "paymentMethods", name: "Payment Methods", status: (this.paymentSettings.cashEnabled || this.paymentSettings.mpesaEnabled) ? "COMPLETE" : "WARNING" },
      { key: "receiptSettings", name: "Receipt Settings", status: (this.receiptSettings.headerText && this.receiptSettings.footerText) ? "COMPLETE" : "WARNING" },
      { key: "shiftSettings", name: "Shift & Float Rules", status: this.shiftSettings.defaultFloat > 0 ? "COMPLETE" : "WARNING" },
      { key: "taxEtims", name: "eTIMS Queue Status", status: "COMPLETE" }
    ];

    const completed = steps.filter(s => s.status === "COMPLETE").length;
    const percentage = Math.round((completed / steps.length) * 100);

    return { steps, percentage };
  }

  setSelectedDate(dateStr) {
    this.selectedDate = dateStr || null;
    this.notify();
  }

  getSelectedDateObj() {
    if (this.selectedDate) {
      const parts = this.selectedDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    return new Date();
  }

  // --- KENYA (Africa/Nairobi, UTC+3, no DST) TIME HELPERS ------------------
  // DB timestamps are stored in UTC (often as "YYYY-MM-DD HH:MM:SS" with no
  // timezone marker). Parse them as UTC, then shift to Nairobi wall-clock so the
  // dashboard's "today" and hourly buckets are correct regardless of the
  // browser's or server's timezone.
  _toUtcDate(ts) {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    if (typeof ts === 'number') return new Date(ts);
    let s = String(ts).trim();
    const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
    if (!hasTz) s += 'Z'; // treat naive DB timestamps as UTC
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    const fallback = new Date(String(ts));
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  }

  // Returns Nairobi wall-clock parts {y, m (0-11), day, hour} for a timestamp.
  kenyaParts(ts) {
    const d = this._toUtcDate(ts);
    const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return {
      y: shifted.getUTCFullYear(),
      m: shifted.getUTCMonth(),
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours()
    };
  }

  // --- DYNAMIC CALCULATORS WITH BRANCH & DATE SCOPING ---
  getTodaySales() {
    // Target day in Kenyan time (selected date, or "today" in Nairobi).
    let ty, tm, td;
    if (this.selectedDate) {
      const parts = this.selectedDate.split('-');
      ty = parseInt(parts[0], 10);
      tm = parseInt(parts[1], 10) - 1;
      td = parseInt(parts[2], 10);
    } else {
      const now = this.kenyaParts(Date.now());
      ty = now.y; tm = now.m; td = now.day;
    }

    return this.sales.filter(s => {
      const k = this.kenyaParts(s.timestamp || s.created_at);
      const matchesDate = k.y === ty && k.m === tm && k.day === td;
      const matchesBranch = !s.branchId || s.branchId === this.activeBranchId;
      return matchesDate && matchesBranch;
    });
  }

  getTodayGrossSales() {
    return this.getTodaySales().reduce((acc, s) => acc + s.total, 0);
  }

  getTodayRefunds() {
    return this.getTodaySales()
      .filter(s => s.refunded)
      .reduce((acc, s) => acc + (s.refundAmount !== undefined ? s.refundAmount : s.total), 0);
  }

  getTodayRevenue() {
    return this.getTodayGrossSales() - this.getTodayRefunds();
  }

  getTodayNetSales() {
    return this.getTodayRevenue();
  }

  getTodayItemsSold() {
    return this.getTodaySales()
      .filter(s => !s.refunded)
      .reduce((acc, s) => {
        return acc + s.items.reduce((iAcc, item) => iAcc + item.qty, 0);
      }, 0);
  }

  getTodayCashSales() {
    return this.getTodaySales()
      .filter(s => s.paymentMethod === 'CASH')
      .reduce((acc, s) => acc + s.total, 0);
  }

  getTodayCashRefunds() {
    return this.getTodaySales()
      .filter(s => s.paymentMethod === 'CASH' && s.refunded)
      .reduce((acc, s) => acc + (s.refundAmount !== undefined ? s.refundAmount : s.total), 0);
  }

  getTodayNetCashSales() {
    return this.getTodayCashSales() - this.getTodayCashRefunds();
  }

  getTodayCashTotal() {
    return this.getTodayNetCashSales();
  }

  getTodayMpesaSales() {
    return this.getTodaySales()
      .filter(s => s.paymentMethod === 'M-PESA')
      .reduce((acc, s) => acc + s.total, 0);
  }

  getTodayMpesaRefunds() {
    return this.getTodaySales()
      .filter(s => s.paymentMethod === 'M-PESA' && s.refunded)
      .reduce((acc, s) => acc + (s.refundAmount !== undefined ? s.refundAmount : s.total), 0);
  }

  getTodayNetMpesaSales() {
    return this.getTodayMpesaSales() - this.getTodayMpesaRefunds();
  }

  getTodayMpesaTotal() {
    return this.getTodayNetMpesaSales();
  }

  getTodayCashMovementsTotal() {
    return this.cashMovements.reduce((acc, c) => acc + c.amount, 0);
  }

  getExpectedCashInDrawer() {
    const floatAmt = this.currentShift?.openingFloat || 5000;
    return floatAmt + this.getTodayNetCashSales() + this.getTodayCashMovementsTotal();
  }

  getTodayCogs() {
    return this.getTodaySales()
      .filter(s => !s.refunded)
      .reduce((acc, s) => {
        return acc + s.items.reduce((iAcc, item) => iAcc + ((item.costSnapshot || 0) * item.qty), 0);
      }, 0);
  }

  getTodayGrossProfit() {
    return this.getTodayNetSales() - this.getTodayCogs();
  }

  getCategorySalesBreakdown() {
    const map = {};
    this.getTodaySales().filter(s => !s.refunded).forEach(s => {
      s.items.forEach(i => {
        const prod = this.products.find(p => p.id === (i.productId || i.id));
        const cat = prod ? prod.category : "Other";
        if (!map[cat]) map[cat] = 0;
        map[cat] += i.total;
      });
    });
    return map;
  }

  getHourlySalesTraffic() {
    const todaySales = this.getTodaySales().filter(s => !s.refunded);

    // Default trading window (Kenyan hours); widen it to include any real sales.
    let startHour = 8;
    let endHour = 22;

    todaySales.forEach(s => {
      const h = this.kenyaParts(s.timestamp || s.created_at).hour;
      if (!isNaN(h)) {
        startHour = Math.min(startHour, h);
        endHour = Math.max(endHour, h);
      }
    });

    const hours = [];
    const data = [];
    const orders = [];

    for (let h = startHour; h <= endHour; h++) {
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      hours.push(label);
      data.push(0);
      orders.push(0);
    }

    todaySales.forEach(s => {
      const h = this.kenyaParts(s.timestamp || s.created_at).hour;
      const idx = h - startHour;
      if (idx >= 0 && idx < data.length) {
        data[idx] += (s.total || 0);
        orders[idx] += 1;
      }
    });

    return { hours, data, orders };
  }

  getBrandProfitabilityMatrix() {
    const brandMap = {};
    // Branch-scope the sales (this.sales is already server-scoped to the active
    // branch; this is a defensive client filter so a selected branch shows only
    // its own sales, matching getTodaySales()). No aggregate "ALL" view.
    const scoped = (this.sales || []).filter(s =>
      !s.branchId || s.branchId === this.activeBranchId);
    scoped.forEach(s => {
      s.items.forEach(i => {
        const prod = this.products.find(p => p.id === (i.productId || i.id));
        const brand = prod ? prod.brand : "Unknown";
        if (!brandMap[brand]) {
          brandMap[brand] = { units: 0, revenue: 0, cogs: 0 };
        }
        brandMap[brand].units += i.qty;
        brandMap[brand].revenue += i.total;
        brandMap[brand].cogs += ((i.costSnapshot || 0) * i.qty);
      });
    });
    return Object.entries(brandMap).map(([brand, val]) => {
      const margin = val.revenue - val.cogs;
      const marginPct = val.revenue > 0 ? ((margin / val.revenue) * 100).toFixed(1) : 0;
      return { brand, units: val.units, revenue: val.revenue, cogs: val.cogs, margin, marginPct };
    });
  }
}

export const store = new CellarStore();
