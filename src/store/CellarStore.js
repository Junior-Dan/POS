import { INITIAL_PRODUCTS } from '../data/initialProducts.js';
import { INITIAL_USERS } from '../data/initialUsers.js';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers.js';
import { INITIAL_BRANCHES } from '../data/initialBranches.js';

export class CellarStore {
  constructor() {
    this.listeners = [];
    this.products = INITIAL_PRODUCTS;
    this.users = INITIAL_USERS;
    this.suppliers = INITIAL_SUPPLIERS;
    this.branches = INITIAL_BRANCHES;
    this.activeBranchId = "B1";
    this.sales = [];
    this.stockMovements = [];
    this.cashMovements = [];
    this.expenses = [];
    this.auditLogs = [];
    this.purchases = [];
    this.customers = [
      { id: "C1", name: "Walk-in Customer", phone: "N/A", email: "-", visits: 0, totalSpend: 0 },
      { id: "C2", name: "David Mwangi", phone: "0712345678", email: "david@example.com", visits: 3, totalSpend: 24500 }
    ];
    this.shifts = [];
    this.currentShift = {
      id: "SHIFT-101",
      branchId: "B1",
      cashierId: "U3",
      cashierName: "John Omondi",
      startTime: new Date().toISOString(),
      openingFloat: 5000,
      status: "ACTIVE"
    };
    this.currentUser = this.users[0];


    this.businessProfile = {
      name: "Cisco Wines & Spirits",
      phone: "0722 000 111",
      email: "info@ciscowines.co.ke",
      address: "Kenyatta Avenue, Nairobi CBD",
      kraPin: "P051234567S",
      regNo: "CPR/2024/99182",
      receiptName: "CISCO WINES & SPIRITS",
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
      headerText: "CISCO WINES & SPIRITS",
      footerText: "Thank you for shopping at Cisco Wines! Quality Wines & Spirits."
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

    this.initStore();
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

    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(() => {
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
    } catch (e) {}
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

  async initStore() {
    this.loadLocalBackup();
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
    if (data) {
      this.users = data;
      if (!this.currentUser && this.users.length > 0) {
        this.currentUser = this.users[0];
      }
      this.notify();
    }
  }

  async fetchProducts() {
    const data = await this.safeFetchJson('/api/products?activeOnly=false');
    if (data) {
      this.products = data;
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

  async fetchSettings() {
    const s = await this.safeFetchJson('/api/settings');
    if (s) {
      if (s.businessProfile) this.businessProfile = s.businessProfile;
      if (s.paymentSettings) this.paymentSettings = s.paymentSettings;
      if (s.receiptSettings) this.receiptSettings = s.receiptSettings;
      if (s.shiftSettings) this.shiftSettings = s.shiftSettings;
      if (s.securitySettings) this.securitySettings = s.securitySettings;
      if (s.systemPreferences) this.systemPreferences = s.systemPreferences;
      this.notify();
    }
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
        return data.shift;
      }
    } catch (e) {}

    if (this.currentShift) {
      this.currentShift.status = 'CLOSED';
      this.currentShift.closingTime = new Date().toISOString();
      this.currentShift.closingCash = closeData.closingCash;
    }
    this.saveLocalBackup();
    this.notify();
    this.broadcastUpdate();
    return this.currentShift;
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create purchase order");
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to receive purchase order");
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save settings");
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
    return this.branches.find(b => b.id === this.activeBranchId) || this.branches[0] || { id: 'B1', name: 'Nairobi CBD Main' };
  }

  canUserAccessView(user, viewId) {
    if (!user) return false;
    if (user.role === 'owner') return true;

    if (user.permissions && (user.permissions.includes('all') || user.permissions.includes(viewId))) {
      return true;
    }

    const roleMap = {
      manager: ['dashboard', 'pos', 'products', 'inventory', 'sales', 'shift', 'suppliers', 'purchases', 'expenses', 'customers', 'compliance', 'reports', 'settings'],
      cashier: ['pos', 'sales', 'shift', 'customers'],
      inventory_officer: ['products', 'inventory', 'suppliers', 'purchases']
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

  // --- DYNAMIC CALCULATORS WITH BRANCH & DATE SCOPING ---
  getTodaySales() {
    const target = this.getSelectedDateObj();
    const tYear = target.getFullYear();
    const tMonth = target.getMonth();
    const tDate = target.getDate();

    return this.sales.filter(s => {
      const d = new Date(s.timestamp || s.created_at);
      const matchesDate = d.getFullYear() === tYear && d.getMonth() === tMonth && d.getDate() === tDate;
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
    const hours = ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const orders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const todaySales = this.getTodaySales().filter(s => !s.refunded);


    todaySales.forEach(s => {
      const h = new Date(s.timestamp || s.created_at).getHours();
      const idx = Math.floor(h / 2);
      if (idx >= 0 && idx < 12) {
        data[idx] += s.total;
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
