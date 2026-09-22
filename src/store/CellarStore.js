import { INITIAL_PRODUCTS } from '../data/initialProducts.js';
import { INITIAL_USERS } from '../data/initialUsers.js';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers.js';
import { INITIAL_BRANCHES } from '../data/initialBranches.js';

export class CellarStore {
  constructor() {
    this.listeners = [];
    this.loadStore();
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn());
  }

  loadStore() {
    const raw = localStorage.getItem("cellar_v1_store");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.products = parsed.products || INITIAL_PRODUCTS;
        this.users = parsed.users || INITIAL_USERS;
        this.suppliers = parsed.suppliers || INITIAL_SUPPLIERS;
        this.branches = parsed.branches || INITIAL_BRANCHES;
        this.activeBranchId = parsed.activeBranchId || "B1";
        
        this.businessProfile = parsed.businessProfile || {
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

        this.paymentSettings = parsed.paymentSettings || {
          cashEnabled: true,
          mpesaEnabled: true,
          cardEnabled: true,
          bankEnabled: true,
          creditEnabled: false
        };

        this.receiptSettings = parsed.receiptSettings || {
          showLogo: true,
          showCashierName: true,
          showTaxBreakdown: true,
          printCopies: 1,
          headerText: "CISCO WINES & SPIRITS",
          footerText: "Thank you for shopping at Cisco Wines! Quality Wines & Spirits."
        };

        this.shiftSettings = parsed.shiftSettings || {
          defaultFloat: 5000,
          requireCashDeclaration: true,
          maxVarianceThreshold: 1000,
          requireManagerVarianceApproval: true
        };

        this.securitySettings = parsed.securitySettings || {
          sessionTimeoutMinutes: 30,
          autoLogoutOnIdle: false,
          requirePinForRefunds: true,
          requirePinForPriceOverride: true,
          requirePinForStockAdjustments: true,
          maxDiscountPercentWithoutAuth: 5
        };

        this.systemPreferences = parsed.systemPreferences || {
          currencySymbol: "KSh",
          taxRate: 16,
          dateFormat: "DD/MM/YYYY",
          theme: "dark"
        };

        this.sales = parsed.sales || [];
        this.stockMovements = parsed.stockMovements || [];
        this.cashMovements = parsed.cashMovements || [];
        this.expenses = parsed.expenses || [];
        this.auditLogs = parsed.auditLogs || [];
        this.purchases = parsed.purchases || [];
        this.customers = parsed.customers || [];
        this.etimsQueue = parsed.etimsQueue || [];
        this.shifts = parsed.shifts || [];
        this.currentShift = parsed.currentShift || {
          id: "SHIFT-101",
          branchId: "B1",
          cashierId: "U3",
          cashierName: "John Omondi",
          startTime: new Date().toISOString(),
          openingFloat: 5000,
          status: "ACTIVE"
        };
        this.currentUser = this.users[0];
        return;
      } catch (e) {
        console.error("Error parsing store, re-seeding clean state", e);
      }
    }
    this.seedClean();
  }

  seedClean() {
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.suppliers = JSON.parse(JSON.stringify(INITIAL_SUPPLIERS));
    this.branches = JSON.parse(JSON.stringify(INITIAL_BRANCHES));
    this.activeBranchId = "B1";

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
    
    // Clean operational data
    this.sales = [];
    this.stockMovements = this.products.map(p => ({
      timestamp: new Date().toISOString(),
      productId: p.id,
      productName: `${p.brand} ${p.name}`,
      type: "OPENING_STOCK",
      qty: p.stock,
      ref: "INIT-CATALOG",
      user: "System",
      reason: "Initial Catalogue Opening Stock"
    }));
    this.cashMovements = [];
    this.expenses = [];
    this.auditLogs = [
      {
        timestamp: new Date().toISOString(),
        user: "System",
        action: "Store Initialized Clean",
        item: "Main Operations",
        oldVal: "-",
        newVal: "Clean State Active",
        reason: "Operational dataset reset"
      }
    ];
    this.purchases = [
      {
        id: "PO-2026-041",
        branchId: "B1",
        supplierId: "SUP1",
        supplierName: "Kenya Breweries Limited (KBL)",
        dateIssued: new Date().toISOString().split('T')[0],
        status: "ORDERED",
        deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        items: [
          { productId: "P101", name: "Johnnie Walker Black Label 750ml", qtyOrdered: 12, qtyReceived: 0, unitCost: 3200, totalCost: 38400 }
        ],
        totalValue: 38400,
        notes: "Restock order for weekend inventory"
      }
    ];
    this.customers = [
      { id: "C1", name: "Walk-in Customer", phone: "N/A", email: "-", visits: 0, totalSpend: 0 },
      { id: "C2", name: "David Mwangi", phone: "0712345678", email: "david@example.com", visits: 3, totalSpend: 24500 }
    ];
    this.etimsQueue = [];
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
    this.save();
  }

  save() {
    const data = {
      products: this.products,
      users: this.users,
      suppliers: this.suppliers,
      branches: this.branches,
      activeBranchId: this.activeBranchId,
      businessProfile: this.businessProfile,
      paymentSettings: this.paymentSettings,
      receiptSettings: this.receiptSettings,
      shiftSettings: this.shiftSettings,
      securitySettings: this.securitySettings,
      systemPreferences: this.systemPreferences,
      sales: this.sales,
      stockMovements: this.stockMovements,
      cashMovements: this.cashMovements,
      expenses: this.expenses,
      auditLogs: this.auditLogs,
      purchases: this.purchases,
      customers: this.customers,
      etimsQueue: this.etimsQueue,
      shifts: this.shifts,
      currentShift: this.currentShift
    };
    localStorage.setItem("cellar_v1_store", JSON.stringify(data));
    this.notify();
  }

  logAudit(action, item, oldVal, newVal, reason) {
    this.auditLogs.unshift({
      timestamp: new Date().toISOString(),
      user: this.currentUser.name,
      role: this.currentUser.role,
      branchId: this.activeBranchId,
      action,
      item,
      oldVal: String(oldVal),
      newVal: String(newVal),
      reason
    });
    this.save();
  }

  // --- BRANCH & SECURITY ACCESS CONTROL ---
  setActiveBranch(branchId) {
    this.activeBranchId = branchId;
    this.save();
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
      const d = new Date(s.timestamp);
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
        return acc + s.items.reduce((iAcc, item) => iAcc + (item.costSnapshot * item.qty), 0);
      }, 0);
  }

  getTodayGrossProfit() {
    return this.getTodayNetSales() - this.getTodayCogs();
  }

  getCategorySalesBreakdown() {
    const map = {};
    this.getTodaySales().filter(s => !s.refunded).forEach(s => {
      s.items.forEach(i => {
        const prod = this.products.find(p => p.id === i.productId);
        const cat = prod ? prod.category : "Other";
        if (!map[cat]) map[cat] = 0;
        map[cat] += i.total;
      });
    });
    return map;
  }

  getHourlySalesTraffic() {
    const hours = ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
    const baseData = [3500, 2200, 1800, 6500, 18500, 32000, 48000, 28000, 41000, 62000, 44000, 26000];
    const baseOrders = [1, 1, 1, 2, 4, 7, 10, 6, 9, 14, 9, 5];

    const data = [...baseData];
    const orders = [...baseOrders];

    const todaySales = this.getTodaySales().filter(s => !s.refunded);

    todaySales.forEach(s => {
      const h = new Date(s.timestamp).getHours();
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
        const prod = this.products.find(p => p.id === i.productId);
        const brand = prod ? prod.brand : "Unknown";
        if (!brandMap[brand]) {
          brandMap[brand] = { units: 0, revenue: 0, cogs: 0 };
        }
        brandMap[brand].units += i.qty;
        brandMap[brand].revenue += i.total;
        brandMap[brand].cogs += (i.costSnapshot * i.qty);
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
