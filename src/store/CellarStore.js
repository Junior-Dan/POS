import { INITIAL_PRODUCTS } from '../data/initialProducts.js';
import { INITIAL_USERS } from '../data/initialUsers.js';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers.js';

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
    
    // Clean operational data: ZERO dummy sales/expenses/movements
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
    this.purchases = [];
    this.customers = [
      { id: "C1", name: "Walk-in Customer", phone: "N/A", visits: 0, totalSpend: 0 }
    ];
    this.etimsQueue = [];
    this.shifts = [];
    this.currentShift = {
      id: "SHIFT-101",
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
      action,
      item,
      oldVal: String(oldVal),
      newVal: String(newVal),
      reason
    });
    this.save();
  }

  // --- DYNAMIC CALCULATORS ---
  getTodaySales() {
    const now = new Date();
    const tYear = now.getFullYear();
    const tMonth = now.getMonth();
    const tDate = now.getDate();

    return this.sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getFullYear() === tYear && d.getMonth() === tMonth && d.getDate() === tDate;
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
    const hours = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM', '12 AM', '2 AM', '4 AM', '6 AM'];
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const orders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    const todaySales = this.getTodaySales().filter(s => !s.refunded);

    todaySales.forEach(s => {
      const h = new Date(s.timestamp).getHours();
      let idx = 0;
      if (h >= 8 && h < 10) idx = 0;
      else if (h >= 10 && h < 12) idx = 1;
      else if (h >= 12 && h < 14) idx = 2;
      else if (h >= 14 && h < 16) idx = 3;
      else if (h >= 16 && h < 18) idx = 4;
      else if (h >= 18 && h < 20) idx = 5;
      else if (h >= 20 && h < 22) idx = 6;
      else if (h >= 22 && h < 24) idx = 7;
      else if (h >= 0 && h < 2) idx = 8;
      else if (h >= 2 && h < 4) idx = 9;
      else if (h >= 4 && h < 6) idx = 10;
      else if (h >= 6 && h < 8) idx = 11;

      data[idx] += s.total;
      orders[idx] += 1;
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
