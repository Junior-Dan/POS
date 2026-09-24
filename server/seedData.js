import { db } from './db.js';

export function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log("Database already seeded. Skipping automatic re-seeding.");
    return;
  }

  console.log("Seeding fresh database state...");

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, role, pin, email, active)
    VALUES (@id, @name, @role, @pin, @email, 1)
  `);

  const users = [
    { id: "U1", name: "David Kamau", role: "owner", pin: "0000", email: "owner@cellar.co.ke" },
    { id: "U2", name: "Mary Wanjiku", role: "manager", pin: "1234", email: "manager@cellar.co.ke" },
    { id: "U3", name: "John Omondi", role: "cashier", pin: "5555", email: "john@cellar.co.ke" },
    { id: "U4", name: "Peter Otieno", role: "inventory_officer", pin: "8888", email: "peter@cellar.co.ke" }
  ];

  for (const u of users) {
    insertUser.run(u);
  }

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, description)
    VALUES (@id, @name, @description)
  `);

  const categories = [
    { id: "CAT1", name: "Whisky", description: "Blended & Single Malt Whiskies" },
    { id: "CAT2", name: "Vodka", description: "Premium & Standard Vodkas" },
    { id: "CAT3", name: "Gin", description: "Dry & Flavored Gins" },
    { id: "CAT4", name: "Cognac", description: "VS, VSOP, & XO Cognacs" },
    { id: "CAT5", name: "Beer", description: "Lagers, Stouts, & Craft Beers" },
    { id: "CAT6", name: "Liqueur", description: "Cream & Herbal Liqueurs" },
    { id: "CAT7", name: "Wine", description: "Red, White, & Sweet Wines" },
    { id: "CAT8", name: "Non-Alcoholic", description: "Soft Drinks, Juices, Energy Drinks & Water" },
    { id: "CAT9", name: "Snacks", description: "Nuts, Chips, & Retail Snacks" },
    { id: "CAT10", name: "Accessories", description: "Bottle openers, Corkscrews, Glasses, & Accessories" }
  ];

  for (const c of categories) {
    insertCategory.run(c);
  }

  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, contact_person, phone, email, address)
    VALUES (@id, @name, @contact_person, @phone, @email, @address)
  `);

  const suppliers = [
    { id: "SUP1", name: "Kenya Breweries Limited (KBL)", contact_person: "Main Orders Desk", phone: "+254 722 000 000", email: "orders@kbl.co.ke", address: "Ruaraka Industrial Area, Nairobi" },
    { id: "SUP2", name: "UDV Kenya", contact_person: "Accounts Dept", phone: "+254 733 111 222", email: "sales@udv.co.ke", address: "Commercial Street, Nairobi" },
    { id: "SUP3", name: "Wine & Spirits Distributors Ltd", contact_person: "James Kariuki", phone: "+254 711 999 888", email: "info@wsd.co.ke", address: "Mombasa Road, Nairobi" },
    { id: "SUP4", name: "East African Soft Drinks Ltd", contact_person: "Sarah Chen", phone: "+254 700 444 333", email: "orders@easd.co.ke", address: "Industrial Area, Nairobi" }
  ];

  for (const s of suppliers) {
    insertSupplier.run(s);
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, brand, name, category, product_type, unit, abv, size, case_units,
      barcode, sku, cost_price, selling_price, wholesale_price, min_price,
      tax_rate, current_stock, min_stock, reorder_level, supplier_id, high_value, active
    ) VALUES (
      @id, @brand, @name, @category, @product_type, @unit, @abv, @size, @case_units,
      @barcode, @sku, @cost_price, @selling_price, @wholesale_price, @min_price,
      @tax_rate, @current_stock, @min_stock, @reorder_level, @supplier_id, @high_value, 1
    )
  `);

  const products = [
    { id: "P101", brand: "Johnnie Walker", name: "Black Label 12YO", category: "Whisky", product_type: "retail", unit: "bottle", abv: 40, size: "750 ml", case_units: 12, barcode: "5000267014005", sku: "JWB-750", cost_price: 3400, selling_price: 4500, wholesale_price: 4300, min_price: 4200, tax_rate: 16, current_stock: 24, min_stock: 5, reorder_level: 6, supplier_id: "SUP2", high_value: 0 },
    { id: "P102", brand: "Johnnie Walker", name: "Red Label", category: "Whisky", product_type: "retail", unit: "bottle", abv: 40, size: "750 ml", case_units: 12, barcode: "5000267013008", sku: "JWR-750", cost_price: 1800, selling_price: 2400, wholesale_price: 2300, min_price: 2200, tax_rate: 16, current_stock: 18, min_stock: 5, reorder_level: 8, supplier_id: "SUP2", high_value: 0 },
    { id: "P103", brand: "Jameson", name: "Irish Whiskey", category: "Whisky", product_type: "retail", unit: "bottle", abv: 40, size: "750 ml", case_units: 12, barcode: "5000281008400", sku: "JMS-750", cost_price: 2200, selling_price: 3000, wholesale_price: 2900, min_price: 2800, tax_rate: 16, current_stock: 30, min_stock: 5, reorder_level: 10, supplier_id: "SUP3", high_value: 0 },
    { id: "P104", brand: "Smirnoff", name: "Red Label Vodka", category: "Vodka", product_type: "retail", unit: "bottle", abv: 40, size: "750 ml", case_units: 12, barcode: "5000267020006", sku: "SMR-750", cost_price: 1000, selling_price: 1450, wholesale_price: 1400, min_price: 1350, tax_rate: 16, current_stock: 40, min_stock: 5, reorder_level: 12, supplier_id: "SUP2", high_value: 0 },
    { id: "P105", brand: "Smirnoff", name: "Red Label Vodka", category: "Vodka", product_type: "retail", unit: "bottle", abv: 40, size: "350 ml", case_units: 24, barcode: "5000267020013", sku: "SMR-350", cost_price: 500, selling_price: 750, wholesale_price: 720, min_price: 700, tax_rate: 16, current_stock: 50, min_stock: 10, reorder_level: 15, supplier_id: "SUP2", high_value: 0 },
    { id: "P106", brand: "Gilbey's", name: "Special Dry Gin", category: "Gin", product_type: "retail", unit: "bottle", abv: 37.5, size: "750 ml", case_units: 12, barcode: "5000267031002", sku: "GLB-750", cost_price: 950, selling_price: 1350, wholesale_price: 1300, min_price: 1250, tax_rate: 16, current_stock: 35, min_stock: 5, reorder_level: 10, supplier_id: "SUP2", high_value: 0 },
    { id: "P107", brand: "Hennessy", name: "Hennessy VS Cognac", category: "Cognac", product_type: "retail", unit: "bottle", abv: 40, size: "750 ml", case_units: 12, barcode: "3245980001211", sku: "HEN-VS", cost_price: 4200, selling_price: 5500, wholesale_price: 5350, min_price: 5200, tax_rate: 16, current_stock: 12, min_stock: 3, reorder_level: 4, supplier_id: "SUP3", high_value: 0 },
    { id: "P108", brand: "Hennessy", name: "Hennessy XO Prestige", category: "Cognac", product_type: "retail", unit: "bottle", abv: 40, size: "750 ml", case_units: 6, barcode: "3245980009999", sku: "HEN-XO", cost_price: 21000, selling_price: 27000, wholesale_price: 26500, min_price: 26000, tax_rate: 16, current_stock: 3, min_stock: 1, reorder_level: 2, supplier_id: "SUP3", high_value: 1 },
    { id: "P109", brand: "Tusker", name: "Tusker Lager", category: "Beer", product_type: "retail", unit: "bottle", abv: 4.2, size: "500 ml", case_units: 25, barcode: "6001234567890", sku: "TSK-500", cost_price: 180, selling_price: 250, wholesale_price: 240, min_price: 240, tax_rate: 16, current_stock: 120, min_stock: 20, reorder_level: 40, supplier_id: "SUP1", high_value: 0 },
    { id: "P110", brand: "Tusker", name: "Tusker Malt Lager", category: "Beer", product_type: "retail", unit: "bottle", abv: 5.0, size: "500 ml", case_units: 25, barcode: "6001234567891", sku: "TSKM-500", cost_price: 200, selling_price: 270, wholesale_price: 260, min_price: 260, tax_rate: 16, current_stock: 85, min_stock: 15, reorder_level: 30, supplier_id: "SUP1", high_value: 0 },
    { id: "P111", brand: "Baileys", name: "Original Irish Cream", category: "Liqueur", product_type: "retail", unit: "bottle", abv: 17, size: "750 ml", case_units: 12, barcode: "5000267040004", sku: "BLY-750", cost_price: 2100, selling_price: 2850, wholesale_price: 2750, min_price: 2700, tax_rate: 16, current_stock: 15, min_stock: 3, reorder_level: 5, supplier_id: "SUP2", high_value: 0 },
    { id: "P112", brand: "Nederburg", name: "Pinotage Sweet Red", category: "Wine", product_type: "retail", unit: "bottle", abv: 14, size: "750 ml", case_units: 6, barcode: "6001452001122", sku: "NED-RED", cost_price: 1100, selling_price: 1600, wholesale_price: 1550, min_price: 1500, tax_rate: 16, current_stock: 20, min_stock: 4, reorder_level: 6, supplier_id: "SUP3", high_value: 0 },
    { id: "P113", brand: "Coca Cola", name: "Coca Cola Classic 500ml", category: "Non-Alcoholic", product_type: "retail", unit: "can/bottle", abv: 0, size: "500 ml", case_units: 24, barcode: "5449000000996", sku: "COKE-500", cost_price: 60, selling_price: 90, wholesale_price: 80, min_price: 80, tax_rate: 16, current_stock: 100, min_stock: 20, reorder_level: 30, supplier_id: "SUP4", high_value: 0 },
    { id: "P114", brand: "Red Bull", name: "Energy Drink 250ml", category: "Non-Alcoholic", product_type: "retail", unit: "can", abv: 0, size: "250 ml", case_units: 24, barcode: "9002490100070", sku: "RDB-250", cost_price: 180, selling_price: 250, wholesale_price: 230, min_price: 230, tax_rate: 16, current_stock: 60, min_stock: 10, reorder_level: 20, supplier_id: "SUP4", high_value: 0 }
  ];

  for (const p of products) {
    insertProduct.run(p);
  }

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (id, product_id, product_name, type, qty, previous_stock, new_stock, ref, user_name, reason)
    VALUES (@id, @product_id, @product_name, @type, @qty, @previous_stock, @new_stock, @ref, @user_name, @reason)
  `);

  for (const p of products) {
    insertMovement.run({
      id: `MOV-INIT-${p.id}`,
      product_id: p.id,
      product_name: `${p.brand} ${p.name}`,
      type: "OPENING_STOCK",
      qty: p.current_stock,
      previous_stock: 0,
      new_stock: p.current_stock,
      ref: "INIT-CATALOG",
      user_name: "System",
      reason: "Initial Catalogue Opening Stock"
    });
  }

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, phone, email, visits, total_spend)
    VALUES (@id, @name, @phone, @email, @visits, @total_spend)
  `);

  const customers = [
    { id: "C1", name: "Walk-in Customer", phone: "N/A", email: "-", visits: 0, total_spend: 0 },
    { id: "C2", name: "David Mwangi", phone: "0712345678", email: "david@example.com", visits: 3, total_spend: 24500 }
  ];

  for (const c of customers) {
    insertCustomer.run(c);
  }

  const insertShift = db.prepare(`
    INSERT INTO shifts (id, branch_id, cashier_id, cashier_name, start_time, opening_float, status)
    VALUES (@id, @branch_id, @cashier_id, @cashier_name, @start_time, @opening_float, @status)
  `);

  insertShift.run({
    id: "SHIFT-101",
    branch_id: "B1",
    cashier_id: "U3",
    cashier_name: "John Omondi",
    start_time: new Date().toISOString(),
    opening_float: 5000,
    status: "ACTIVE"
  });

  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)
  `);

  const defaultSettings = [
    { key: "businessProfile", value: JSON.stringify({
      name: "Cisco Wines & Spirits",
      phone: "0722 000 111",
      email: "info@ciscowines.co.ke",
      address: "Kenyatta Avenue, Nairobi CBD",
      kraPin: "P051234567S",
      regNo: "CPR/2024/99182",
      receiptName: "CISCO WINES & SPIRITS",
      receiptPhone: "0722 000 111",
      receiptAddress: "Kenyatta Avenue, Nairobi CBD"
    })},
    { key: "paymentSettings", value: JSON.stringify({
      cashEnabled: true,
      mpesaEnabled: true,
      cardEnabled: true,
      bankEnabled: true,
      creditEnabled: false
    })},
    { key: "receiptSettings", value: JSON.stringify({
      showLogo: true,
      showCashierName: true,
      showTaxBreakdown: true,
      printCopies: 1,
      headerText: "CISCO WINES & SPIRITS",
      footerText: "Thank you for shopping at Cisco Wines! Quality Wines & Spirits."
    })},
    { key: "shiftSettings", value: JSON.stringify({
      defaultFloat: 5000,
      requireCashDeclaration: true,
      maxVarianceThreshold: 1000,
      requireManagerVarianceApproval: true
    })},
    { key: "securitySettings", value: JSON.stringify({
      sessionTimeoutMinutes: 30,
      autoLogoutOnIdle: false,
      requirePinForRefunds: true,
      requirePinForPriceOverride: true,
      requirePinForStockAdjustments: true,
      maxDiscountPercentWithoutAuth: 5
    })},
    { key: "systemPreferences", value: JSON.stringify({
      currencySymbol: "KSh",
      taxRate: 16,
      dateFormat: "DD/MM/YYYY",
      theme: "dark"
    })}
  ];

  for (const st of defaultSettings) {
    insertSetting.run(st);
  }

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, timestamp, user_name, role, branch_id, action, item, old_val, new_val, reason)
    VALUES (@id, @timestamp, @user_name, @role, @branch_id, @action, @item, @old_val, @new_val, @reason)
  `);

  insertAudit.run({
    id: "AUD-INIT",
    timestamp: new Date().toISOString(),
    user_name: "System",
    role: "owner",
    branch_id: "B1",
    action: "Database Initialized Clean",
    item: "Database Engine",
    old_val: "-",
    new_val: "SQLite DB Active",
    reason: "Production end-to-end database initialization"
  });

  console.log("Database seeded successfully!");
}
