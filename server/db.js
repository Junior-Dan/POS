import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const jsonPath = path.join(dataDir, 'cellar_db.json');

// Pure JavaScript Database Engine (Zero C++ Native Dependencies, Zero Segfault Risk)
class PureJsDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      users: [],
      categories: [],
      suppliers: [],
      products: [],
      customers: [],
      shifts: [],
      sales: [],
      sale_items: [],
      payments: [],
      stock_movements: [],
      cash_movements: [],
      purchases: [],
      purchase_items: [],
      expenses: [],
      audit_logs: [],
      settings: []
    };
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      } catch (e) {
        console.error("Error loading JSON database file", e);
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error("Error saving JSON database file", e);
    }
  }

  exec(sql) {
    // Schema creation no-op for pure JS store
  }

  pragma(p) {}

  transaction(fn) {
    const self = this;
    return (...args) => {
      const snapshot = JSON.stringify(self.data);
      try {
        const result = fn(...args);
        self.save();
        return result;
      } catch (err) {
        self.data = JSON.parse(snapshot);
        throw err;
      }
    };
  }

  prepare(sqlStr) {
    const self = this;
    const cleanSql = sqlStr.trim();
    const lower = cleanSql.toLowerCase();

    return {
      all(...params) {
        let table = self._extractTable(lower);
        let items = self.data[table] ? [...self.data[table]] : [];

        if (table === 'products' && lower.includes('suppliers')) {
          items = items.map(p => {
            const sup = self.data.suppliers.find(s => s.id === p.supplier_id);
            return { ...p, supplier_name: sup ? sup.name : null };
          });
        }

        // Handle simple WHERE filtering
        if (lower.includes('where')) {
          items = self._applyWhereFilter(table, items, lower, params);
        }

        // Handle ORDER BY
        if (lower.includes('order by')) {
          items = self._applyOrderBy(items, lower);
        }

        // Handle LIMIT
        if (lower.includes('limit')) {
          const match = lower.match(/limit\s+(\d+)/);
          if (match) {
            const lim = parseInt(match[1], 10);
            items = items.slice(0, lim);
          }
        }

        return items;
      },

      get(...params) {
        if (lower.includes('count(')) {
          let table = self._extractTable(lower);
          let items = self.data[table] || [];
          if (lower.includes('where')) {
            items = self._applyWhereFilter(table, items, lower, params);
          }
          return { count: items.length };
        }

        if (lower.includes('sum(')) {
          let table = self._extractTable(lower);
          let items = self.data[table] || [];
          if (lower.includes('where')) {
            items = self._applyWhereFilter(table, items, lower, params);
          }
          if (lower.includes('totalcash')) {
            const sum = items.reduce((acc, i) => acc + (i.total || 0), 0);
            return { totalCash: sum };
          }
          if (lower.includes('netmov')) {
            const sum = items.reduce((acc, i) => acc + (i.amount || 0), 0);
            return { netMov: sum };
          }
          if (lower.includes('cogs')) {
            const sum = items.reduce((acc, i) => acc + ((i.cost_snapshot || 0) * (i.qty || 0)), 0);
            return { cogs: sum };
          }
        }

        const list = this.all(...params);
        return list[0] || null;
      },

      run(...params) {
        if (lower.startsWith('insert')) {
          self._handleInsert(lower, cleanSql, params);
        } else if (lower.startsWith('update')) {
          self._handleUpdate(lower, cleanSql, params);
        } else if (lower.startsWith('delete')) {
          self._handleDelete(lower, cleanSql, params);
        }
        self.save();
        return { changes: 1 };
      }
    };
  }

  _extractTable(lowerSql) {
    if (lowerSql.includes('from users') || lowerSql.includes('into users') || lowerSql.includes('update users') || lowerSql.includes('delete from users')) return 'users';
    if (lowerSql.includes('from categories') || lowerSql.includes('into categories') || lowerSql.includes('update categories')) return 'categories';
    if (lowerSql.includes('from suppliers') || lowerSql.includes('into suppliers') || lowerSql.includes('update suppliers')) return 'suppliers';
    if (lowerSql.includes('from products') || lowerSql.includes('into products') || lowerSql.includes('update products')) return 'products';
    if (lowerSql.includes('from customers') || lowerSql.includes('into customers') || lowerSql.includes('update customers')) return 'customers';
    if (lowerSql.includes('from shifts') || lowerSql.includes('into shifts') || lowerSql.includes('update shifts')) return 'shifts';
    if (lowerSql.includes('from sale_items') || lowerSql.includes('into sale_items')) return 'sale_items';
    if (lowerSql.includes('from sales') || lowerSql.includes('into sales') || lowerSql.includes('update sales')) return 'sales';
    if (lowerSql.includes('from payments') || lowerSql.includes('into payments')) return 'payments';
    if (lowerSql.includes('from stock_movements') || lowerSql.includes('into stock_movements')) return 'stock_movements';
    if (lowerSql.includes('from cash_movements') || lowerSql.includes('into cash_movements')) return 'cash_movements';
    if (lowerSql.includes('from purchase_items') || lowerSql.includes('into purchase_items')) return 'purchase_items';
    if (lowerSql.includes('from purchases') || lowerSql.includes('into purchases') || lowerSql.includes('update purchases')) return 'purchases';
    if (lowerSql.includes('from expenses') || lowerSql.includes('into expenses')) return 'expenses';
    if (lowerSql.includes('from audit_logs') || lowerSql.includes('into audit_logs')) return 'audit_logs';
    if (lowerSql.includes('from settings') || lowerSql.includes('into settings')) return 'settings';
    return 'products';
  }

  _applyWhereFilter(table, items, lower, params) {
    let pIdx = 0;

    return items.filter(item => {
      if (table === 'users') {
        if (lower.includes('(name = ? or email = ?) and pin = ?')) {
          const nameEmail = params[0];
          const pin = params[2] || params[1];
          return (item.name === nameEmail || item.email === nameEmail) && item.pin === pin && item.active == 1;
        }
        if (lower.includes('pin = ?') && params[0]) {
          return item.pin === params[0] && item.active == 1;
        }
        if (lower.includes('id = ?') && params[0]) {
          return item.id === params[0];
        }
      }

      if (table === 'products') {
        if (lower.includes('barcode = ? or sku = ? or id = ?')) {
          const q = params[0];
          return item.barcode === q || item.sku === q || item.id === q;
        }
        if (lower.includes('barcode = ?')) return item.barcode === params[0];
        if (lower.includes('sku = ?')) return item.sku === params[0];
        if (lower.includes('id = ?')) return item.id === params[0];
        if (lower.includes('current_stock <= min_stock')) return item.current_stock <= item.min_stock && item.active == 1;
        if (lower.includes('current_stock = 0')) return item.current_stock === 0 && item.active == 1;
        if (lower.includes('p.active = 1') || lower.includes('active = 1')) {
          if (!item.active) return false;
        }
        if (lower.includes('category = ?')) {
          const cat = params[pIdx++];
          if (item.category !== cat) return false;
        }
      }

      if (table === 'sales') {
        if (lower.includes('id = ? or receipt_no = ?')) {
          return item.id === params[0] || item.receipt_no === params[0] || item.id === params[1] || item.receipt_no === params[1];
        }
        if (lower.includes('id = ?')) return item.id === params[0];
        if (lower.includes('payment_method = \'cash\'')) {
          if (item.payment_method !== 'CASH' || item.refunded) return false;
        }
      }

      if (table === 'sale_items') {
        if (lower.includes('sale_id = ?')) return item.sale_id === params[0];
      }

      if (table === 'shifts') {
        if (lower.includes('status = "active"') || lower.includes("status = 'active'")) {
          return item.status === 'ACTIVE';
        }
        if (lower.includes('id = ?')) return item.id === params[0];
      }

      if (table === 'purchases') {
        if (lower.includes('id = ? or po_number = ?')) {
          return item.id === params[0] || item.po_number === params[0] || item.id === params[1] || item.po_number === params[1];
        }
        if (lower.includes('id = ?')) return item.id === params[0];
      }

      if (table === 'purchase_items') {
        if (lower.includes('purchase_id = ?')) return item.purchase_id === params[0];
      }

      if (table === 'suppliers') {
        if (lower.includes('id = ?')) return item.id === params[0];
      }

      if (table === 'customers') {
        if (lower.includes('id = ?')) return item.id === params[0];
      }

      if (table === 'settings') {
        if (lower.includes('key = ?')) return item.key === params[0];
      }

      return true;
    });
  }

  _applyOrderBy(items, lower) {
    if (lower.includes('order by name asc')) {
      return items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (lower.includes('order by created_at desc') || lower.includes('order by start_time desc') || lower.includes('order by timestamp desc')) {
      return items.sort((a, b) => new Date(b.created_at || b.start_time || b.timestamp || 0) - new Date(a.created_at || a.start_time || a.timestamp || 0));
    }
    return items;
  }

  _handleInsert(lower, sqlStr, params) {
    const table = this._extractTable(lower);
    if (!this.data[table]) this.data[table] = [];

    if (table === 'users') {
      this.data.users.push({ id: params[0], name: params[1], role: params[2], pin: params[3], email: params[4], active: 1, created_at: new Date().toISOString() });
    } else if (table === 'categories') {
      if (!this.data.categories.some(c => c.id === params[0] || c.name === params[1])) {
        this.data.categories.push({ id: params[0], name: params[1], description: params[2], active: 1 });
      }
    } else if (table === 'suppliers') {
      this.data.suppliers.push({ id: params[0], name: params[1], contact_person: params[2], phone: params[3], email: params[4], address: params[5], active: 1 });
    } else if (table === 'products') {
      this.data.products.push({
        id: params[0], brand: params[1], name: params[2], category: params[3], product_type: params[4], unit: params[5],
        abv: params[6], size: params[7], case_units: params[8], barcode: params[9], sku: params[10],
        cost_price: params[11], selling_price: params[12], wholesale_price: params[13], min_price: params[14],
        tax_rate: params[15], current_stock: params[16], min_stock: params[17], reorder_level: params[18],
        supplier_id: params[19], high_value: params[20], active: 1, created_at: new Date().toISOString()
      });
    } else if (table === 'customers') {
      this.data.customers.push({ id: params[0], name: params[1], phone: params[2], email: params[3], visits: params[4] || 0, total_spend: params[5] || 0, created_at: new Date().toISOString() });
    } else if (table === 'shifts') {
      this.data.shifts.push({ id: params[0], branch_id: params[1], cashier_id: params[2], cashier_name: params[3], start_time: new Date().toISOString(), opening_float: params[4], status: 'ACTIVE' });
    } else if (table === 'sales') {
      this.data.sales.unshift({
        id: params[0], receipt_no: params[1], branch_id: params[2], cashier_id: params[3], cashier_name: params[4],
        customer_id: params[5], customer_name: params[6], subtotal: params[7], discount: params[8], tax: params[9],
        total: params[10], payment_method: params[11], mpesa_code: params[12], status: 'COMPLETED', shift_id: params[13],
        refunded: 0, refund_amount: 0, created_at: new Date().toISOString()
      });
    } else if (table === 'sale_items') {
      this.data.sale_items.unshift({ id: params[0], sale_id: params[1], product_id: params[2], product_name: params[3], qty: params[4], unit_price: params[5], cost_snapshot: params[6], total: params[7] });
    } else if (table === 'payments') {
      this.data.payments.unshift({ id: params[0], sale_id: params[1], method: params[2], amount: params[3], reference_code: params[4], status: 'SUCCESS', created_at: new Date().toISOString() });
    } else if (table === 'stock_movements') {
      this.data.stock_movements.unshift({ id: params[0], product_id: params[1], product_name: params[2], type: params[3], qty: params[4], previous_stock: params[5], new_stock: params[6], ref: params[7], user_name: params[8], reason: params[9], timestamp: new Date().toISOString() });
    } else if (table === 'cash_movements') {
      this.data.cash_movements.unshift({ id: params[0], shift_id: params[1], type: params[2], amount: params[3], reason: params[4], user_name: params[5], timestamp: new Date().toISOString() });
    } else if (table === 'purchases') {
      this.data.purchases.unshift({ id: params[0], po_number: params[1], branch_id: params[2], supplier_id: params[3], supplier_name: params[4], date_issued: params[5], delivery_date: params[6], status: 'ORDERED', total_value: params[7], notes: params[8], created_at: new Date().toISOString() });
    } else if (table === 'purchase_items') {
      this.data.purchase_items.unshift({ id: params[0], purchase_id: params[1], product_id: params[2], product_name: params[3], qty_ordered: params[4], qty_received: 0, unit_cost: params[5], total_cost: params[6] });
    } else if (table === 'expenses') {
      this.data.expenses.unshift({ id: params[0], category: params[1], amount: params[2], description: params[3], user_name: params[4], receipt_ref: params[5], created_at: new Date().toISOString() });
    } else if (table === 'audit_logs') {
      this.data.audit_logs.unshift({ id: params[0], timestamp: new Date().toISOString(), user_name: params[1], role: params[2], branch_id: params[3], action: params[4], item: params[5], old_val: params[6], new_val: params[7], reason: params[8] });
    } else if (table === 'settings') {
      const idx = this.data.settings.findIndex(s => s.key === params[0]);
      if (idx >= 0) this.data.settings[idx] = { key: params[0], value: params[1] };
      else this.data.settings.push({ key: params[0], value: params[1] });
    }
  }

  _handleUpdate(lower, sqlStr, params) {
    const table = this._extractTable(lower);
    const targetId = params[params.length - 1];

    if (table === 'products') {
      const prod = this.data.products.find(p => p.id === targetId);
      if (prod) {
        if (lower.includes('current_stock = ?')) {
          prod.current_stock = params[0];
        } else {
          if (params[0] !== undefined) prod.brand = params[0];
          if (params[1] !== undefined) prod.name = params[1];
          if (params[2] !== undefined) prod.category = params[2];
          if (params[10] !== undefined) prod.cost_price = params[10];
          if (params[11] !== undefined) prod.selling_price = params[11];
          if (params[14] !== undefined) prod.current_stock = params[14];
        }
      }
    } else if (table === 'sales') {
      const sale = this.data.sales.find(s => s.id === targetId || s.receipt_no === targetId);
      if (sale) {
        if (lower.includes('refunded = 1')) {
          sale.refunded = 1;
          sale.refund_amount = params[0];
          sale.refund_reason = params[1];
        }
      }
    } else if (table === 'shifts') {
      const shift = this.data.shifts.find(s => s.id === targetId || s.status === 'ACTIVE');
      if (shift && lower.includes("status = 'closed'")) {
        shift.closing_cash = params[0];
        shift.expected_cash = params[1];
        shift.variance = params[2];
        shift.notes = params[3];
        shift.status = 'CLOSED';
        shift.end_time = new Date().toISOString();
      }
    } else if (table === 'purchases') {
      const po = this.data.purchases.find(p => p.id === targetId || p.po_number === targetId);
      if (po && lower.includes("status = 'received'")) {
        po.status = 'RECEIVED';
        po.notes = params[0] || po.notes;
      }
    } else if (table === 'purchase_items') {
      const item = this.data.purchase_items.find(i => i.id === targetId);
      if (item) {
        item.qty_received = params[0];
      }
    } else if (table === 'customers') {
      const cust = this.data.customers.find(c => c.id === targetId);
      if (cust) {
        cust.visits = (cust.visits || 0) + 1;
        cust.total_spend = (cust.total_spend || 0) + params[0];
      }
    }
  }

  _handleDelete(lower, sqlStr, params) {
    const table = this._extractTable(lower);
    this.data[table] = [];
  }
}

export const db = new PureJsDatabase(jsonPath);

export function initDb() {
  console.log("Pure JS Database Engine Active (Zero Native C++ Dependencies, Segfault-Proof).");
}
