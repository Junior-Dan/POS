// Canonical schema for Cellar POS. Each statement is idempotent
// (CREATE TABLE IF NOT EXISTS) and is executed individually so it works
// against both the local SQLite CLI and the remote Turso/libSQL HTTP API
// (which runs one statement per request). A fresh Turso database has none of
// these tables, so this is what makes the deployed backend functional.

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    location TEXT,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // users includes every column the app relies on (no ALTER needed on Turso).
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin TEXT DEFAULT '',
    email TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    organization_id TEXT,
    branch_id TEXT,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_by TEXT,
    pin_hash TEXT,
    updated_at DATETIME
  )`,

  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    active INTEGER DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    brand TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    product_type TEXT DEFAULT 'retail',
    unit TEXT DEFAULT 'bottle',
    abv REAL DEFAULT 0,
    size TEXT,
    case_units INTEGER DEFAULT 12,
    barcode TEXT,
    sku TEXT,
    cost_price REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    wholesale_price REAL DEFAULT 0,
    min_price REAL DEFAULT 0,
    tax_rate REAL DEFAULT 16,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    reorder_level INTEGER DEFAULT 10,
    supplier_id TEXT,
    image_url TEXT,
    high_value INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    visits INTEGER DEFAULT 0,
    total_spend REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    branch_id TEXT DEFAULT 'B1',
    cashier_id TEXT NOT NULL,
    cashier_name TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    opening_float REAL DEFAULT 5000,
    closing_cash REAL,
    expected_cash REAL,
    variance REAL,
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    receipt_no TEXT UNIQUE NOT NULL,
    branch_id TEXT DEFAULT 'B1',
    cashier_id TEXT NOT NULL,
    cashier_name TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    mpesa_code TEXT,
    status TEXT DEFAULT 'COMPLETED',
    refunded INTEGER DEFAULT 0,
    refund_amount REAL DEFAULT 0,
    refund_reason TEXT,
    shift_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    cost_snapshot REAL NOT NULL,
    total REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL,
    qty INTEGER NOT NULL,
    previous_stock INTEGER,
    new_stock INTEGER,
    ref TEXT,
    user_name TEXT,
    reason TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    shift_id TEXT,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    user_name TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    po_number TEXT UNIQUE NOT NULL,
    branch_id TEXT DEFAULT 'B1',
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    date_issued TEXT NOT NULL,
    delivery_date TEXT,
    status TEXT DEFAULT 'ORDERED',
    total_value REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    purchase_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    qty_ordered INTEGER NOT NULL,
    qty_received INTEGER DEFAULT 0,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    user_name TEXT NOT NULL,
    receipt_ref TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_name TEXT NOT NULL,
    role TEXT,
    branch_id TEXT DEFAULT 'B1',
    action TEXT NOT NULL,
    item TEXT,
    old_val TEXT,
    new_val TEXT,
    reason TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    sale_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    reference_code TEXT,
    status TEXT DEFAULT 'SUCCESS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    branch_id TEXT,
    role TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];
