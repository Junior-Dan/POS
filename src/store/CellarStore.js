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

    // Live-sync polling. The backend DB layer is synchronous (each query blocks
    // the server's event loop), so polling too aggressively serializes behind
    // user actions like saving staff. Poll gently and ONLY when logged in and the
    // tab is visible.
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (!this.currentUser || !this.currentUser.id) return;
        this.syncLiveState();
      }, 20000);
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

  async syncLiveState() {
    try {
      const prevCount = (this.sales || []).length;
      await Promise.all([
        this.fetchSales(),
        this.fetchProducts(),
        this.fetchShift()
      ]);
      const newCount = (this.sales || []).length;
      if (newCount !== prevCount) {
        this.notify();
        if (window.triggerDashboardCharts) {
          window.triggerDashboardCharts();
        }
      }
    } catch (e) {
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
        const ownerExists = this.loginUsers.some(u => (u.role || '').toLowerCase() === 'owner') ||
          (this.currentUser && (this.currentUser.role || '').toLowerCase() === 'owner') ||
          localStorage.getItem('cellar_owner_exists') === '1';
        localStorage.setItem('cellar_owner_exists', ownerExists ? '1' : '0');
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
      // Owners view all branches; staff are scoped to their own branch.
      this.activeBranchId = data.user.branchId ||
        ((data.user.role || '').toLowerCase() === 'owner' ? 'ALL' : this.activeBranchId);
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
  }

  async initStore() {
    this.loadLocalBackup();
    // Load the public branch roster first so the login screen is populated
    // even before the user authenticates.
    await this.fetchBranchLogin();
    // Restore any prior session, then load protected data if authenticated.
    await this.restoreSession();

    // A shared branch/staff invite link must open THAT organization's login —
    // never a stale session from a different org left in this browser. If a link
    // is being opened and the restored session belongs to a different org (or a
    // personal ?staff link names someone else), drop the session and show the
    // branch login screen instead.
    try {
      const hasLink = !!(this.loginBranch && (this.loginStaffRef || this._hasBranchParam()));
      if (hasLink && this.currentUser && this.currentUser.id) {
        const linkOrg = this.loginBranch.organizationId || null;
        const sessionOrg = this.currentUser.organizationId || null;
        const orgMismatch = linkOrg && sessionOrg && linkOrg !== sessionOrg;
        const staffMismatch = this.loginStaffRef &&
          String(this.currentUser.id).toLowerCase() !== String(this.loginStaffRef).toLowerCase() &&
          String(this.currentUser.email || '').toLowerCase() !== String(this.loginStaffRef).toLowerCase();
        if (orgMismatch || staffMismatch) {
          clearAuthToken();
          try {
            sessionStorage.removeItem('cellar_session_auth');
            sessionStorage.removeItem('cellar_authenticated_user');
          } catch (e) {}
          this.currentUser = null;
        }
      }
    } catch (e) {}

    await this.loadAuthenticatedData();
  }

  _hasBranchParam() {
    try {
      if (typeof window === 'undefined' || !window.location) return false;
      return new URLSearchParams(window.location.search).has('branch');
    } catch (e) { return false; }
  }

  resetState() {
    this.currentUser = null;
    this.products = [];
    this.users = [];
    this.suppliers = [];
    this.branches = [];
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
  async fetchUsers() {
    const data = await this.safeFetchJson('/api/auth/users');
    if (data && Array.isArray(data)) {
      this.users = data.map(u => ({
        ...u,
        primaryBranchId: u.primaryBranchId || u.branchId || u.branch_id
      }));
      this.notify();
    }
  }

  async fetchProducts() {
    const data = await this.safeFetchJson('/api/products?activeOnly=false');
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
    const data = await this.safeFetchJson('/api/sales');
    if (data && Array.isArray(data)) {
      this.sales = data;
      this.saveLocalBackup();
      this.notify();
    }
  }

  async fetchShift() {
    const data = await this.safeFetchJson('/api/shift/current');
    if (data) {
      this.currentShift = data;
      this.cashMovements = data.cashMovements || [];
      this.saveLocalBackup();
      this.notify();
    }
  }

  async fetchInventoryMovements() {
    const data = await this.safeFetchJson('/api/inventory/movements');
    if (data) {
      this.stockMovements = data;
      this.notify();
    }
  }

  async fetchExpenses() {
    const data = await this.safeFetchJson('/api/expenses');
    if (data) {
      this.expenses = data;
      this.notify();
    }
  }

  async fetchPurchases() {
    const data = await this.safeFetchJson('/api/purchases');
    if (data) {
      this.purchases = data;
      this.notify();
    }
  }

  async fetchAuditLogs() {
    const data = await this.safeFetchJson('/api/audit-logs');
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
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productData, userName: this.currentUser?.name })
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

    const newProd = {
      id: `P-${Date.now()}`,
      brand: productData.brand,
      name: productData.name,
      category: productData.category || "Spirits",
      size: productData.size || "750ml",
      abv: productData.abv || 40,
      sku: productData.sku || `SKU-${Date.now()}`,
      barcode: productData.barcode || `${Math.floor(1000000000000 + Math.random()*9000000000000)}`,
      cost: productData.cost || 0,
      price: productData.price || 0,
      stock: productData.stock || 0,
      reorder: productData.reorder || 5,
      active: true,
      highValue: productData.highValue || false
    };
    this.products.unshift(newProd);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return { product: newProd };
  }

  async updateProduct(id, productData) {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productData, userName: this.currentUser?.name })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchProducts();
        await this.fetchAuditLogs();
        return data;
      }
    } catch (e) {}

    const prod = this.products.find(p => p.id === id);
    if (prod) {
      Object.assign(prod, productData);
      this.saveLocalBackup();
      this.notify();
      this.broadcastUpdate();
    }
    return { product: prod };
  }

  async deactivateProduct(id) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchProducts();
        return data;
      }
    } catch (e) {}

    const prod = this.products.find(p => p.id === id);
    if (prod) prod.active = false;
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return { success: true };
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

  async createSale(saleData) {
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...saleData,
          cashier: this.currentUser || { id: 'U3', name: 'John Omondi' },
          branchId: this.activeBranchId,
          shiftId: this.currentShift?.id
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        await this.fetchSales();
        await this.fetchProducts();
        await this.fetchInventoryMovements();
        await this.fetchCustomers();
        await this.fetchAuditLogs();
        this.saveLocalBackup();
        this.broadcastUpdate();
        return data.sale;
      }
    } catch (e) {
      console.warn("API server notice, running local sale engine:", e);
    }

    const cashier = this.currentUser || { id: 'U3', name: 'John Omondi' };
    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const etimsCuNum = `CU-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const etimsControlCode = `${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}`;
    
    const sale = {
      id: `SALE-${Date.now()}`,
      receiptNo,
      branchId: this.activeBranchId,
      shiftId: this.currentShift?.id || "SHIFT-101",
      cashierId: cashier.id,
      cashierName: cashier.name,
      items: saleData.items,
      subtotal: saleData.subtotal,
      discount: saleData.discount || 0,
      tax: saleData.tax,
      total: saleData.total,
      paymentMethod: saleData.paymentMethod || 'CASH',
      customer: saleData.customer || null,
      etimsCuNum,
      etimsControlCode,
      timestamp: new Date().toISOString()
    };

    saleData.items.forEach(item => {
      const prod = this.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qty);
      }
    });

    this.sales.unshift(sale);
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return sale;
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
          userName: this.currentUser?.name || 'Manager'
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
          user: this.currentUser?.name || 'Manager'
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

  getActiveBranch() {
    if (this.activeBranchId === 'ALL') {
      return { id: 'ALL', name: 'All Branches (Enterprise)' };
    }
    return (this.branches && this.branches.find(b => b.id === this.activeBranchId)) || (this.branches && this.branches[0]) || { id: null, name: 'Overall Business (No Branches Yet)', code: 'main' };
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
      const matchesBranch = this.activeBranchId === 'ALL' || !s.branchId || s.branchId === this.activeBranchId;
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
    this.sales.forEach(s => {
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
