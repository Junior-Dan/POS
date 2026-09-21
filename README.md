# Cellar — Wines & Spirits Shop POS & Management System (V1.0)

A comprehensive Point of Sale and Shop Management System designed for licensed wines & spirits retailers in Kenya. Built according to PRD V1.0 specifications covering POS, inventory control, purchasing, Kenya compliance (Alcohol Licensing, KRA eTIMS, ODPC data protection), and financial analytics.

---

## 🌟 Key Features & Modules

### 1. Executive Dashboard
- **Live Metrics**: Today's Sales (KES), Gross Profit (calculated from historical cost snapshots), Total Transactions, Items Sold, Cash vs. M-PESA payment split.
- **Operational Alerts**: Real-time banners for items below reorder level, out-of-stock items, shift variances, eTIMS queues, and alcohol license expiry.
- **Visual Analytics**: Interactive hourly traffic line charts, sales volume by beverage category (Whisky, Vodka, Gin, Wine, Beer, Cognac, etc.), top-selling products, and slow-moving stock (0 sales in 30+ days).

### 2. Point of Sale (POS) & Checkout
- **Fast Product Lookup**: Global keyboard shortcuts (`/` for global search, `F2` for POS search focus), barcode scanner support, brand/category filters, and shorthand lookup (`JWB`, `HEN-XO`).
- **Bottle Size & Packaging**: Individual SKU support for various bottle sizes (50ml, 350ml, 500ml, 750ml, 1L, 1.5L) and case pack conversions.
- **PIN-Gated Discount Control**: Cashier discounts capped at 5%; discounts above 5% automatically prompt for Manager/Owner 4-digit PIN authorization.
- **Multi-Payment Modes**:
  - **Cash**: Tendered amount calculator with quick tender buttons (KES 500, 1000, 2000, 5000) and change display.
  - **M-PESA (Daraja API)**: Customer phone number entry with simulated STK Push workflow state machine (`PENDING` → `SUCCESS` / `FAILED`).
  - **Split Payment**: Flexible dual Cash + M-PESA allocation.
- **KRA / eTIMS Thermal Receipt**: Printable thermal receipt view (58mm/80mm) with business KRA PIN, cashier name, itemized VAT (16%), eTIMS CU invoice code, and QR simulator.

### 3. Inventory Ledger & High-Value Controls
- **Real-Time Stock Ledger**: Complete audit history for every stock movement (`PURCHASE`, `SALE`, `RETURN`, `DAMAGE`, `BREAKAGE`, `THEFT/LOSS`, `ADJUSTMENT`, `TRANSFER`, `OPENING_STOCK`).
- **High-Value Stock Controls**: Flagged high-value bottles (e.g. Hennessy XO, Don Julio) require Manager PIN authorization for stock write-offs or adjustments.
- **Damaged Bottle Logging**: Record damaged/smashing incidents with notes, manager authorization, and inventory reduction.
- **Physical Stock Count**: System vs. physical count variance audit tool.

### 4. Historical Cost Snapshotting (`cost_price_snapshot`)
- Every completed sale pins the unit cost price at the exact moment of transaction, guaranteeing that historical gross profit reports remain 100% accurate even when supplier purchasing costs fluctuate in the future.

### 5. Shift & Cash Drawer Management
- Active shift tracker showing cashier name, start time, and float.
- Cash In / Cash Out drawer movement recording (petty cash, float top-up, supplier payout) with mandatory reason.
- End-of-shift cash drawer reconciliation (Expected Cash vs. Actual Physical Cash Counted with variance logging).

### 6. Purchasing & Supplier Management
- Supplier directory with contact info, KRA PIN, address, and purchase history.
- Purchase Order lifecycle (`DRAFT` → `SENT` → `RECEIVED`).
- Goods receiving workflow with discrepancy and damaged bottle logging.

### 7. Kenyan Compliance & Licensing
- **Alcoholic Drinks Control Act**: Configurable retail liquor license details (License #, Issuing Authority, Premises, Permitted Hours, Expiry Date).
- **KRA eTIMS Transmission Feed**: Invoice transmission queue (`ACCEPTED`, `PENDING`, `REJECTED`, `RETRYING`) with manual sync for offline recovery.

### 8. Financial Profitability Reports
- Brand Profitability Matrix: Units sold, Revenue, COGS, Gross Margin, and Margin % per brand.
- Financial Statement: Gross Sales - COGS = Gross Profit; Gross Profit - Operational Expenses = Net Operating Result.

---

## 🔑 Pre-Configured Users & Default PINs

To test multi-role authorization and PIN-gated modals, use the pre-configured credentials below (or click the **"🔑 Switch User"** button in the sidebar):

| Name | Role | Email | Default 4-Digit PIN | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **David Kamau** | `owner` | `owner@cellar.co.ke` | **`0000`** | Full System Control, Authorize All |
| **Mary Wanjiku** | `manager` | `manager@cellar.co.ke` | **`1234`** | Inventory, Stock Adjustments, High Discounts, Shift Closes |
| **John Omondi** | `cashier` | `john@cellar.co.ke` | **`5555`** | POS Operator (Max 5% discount, PIN required for higher) |
| **Peter Otieno** | `inventory_officer` | `peter@cellar.co.ke` | **`8888`** | Receiving, Stock Counts, Damage Logs |

---

## 🚀 How to Run

No build step or server setup required — Cellar V1.0 runs client-side:

```bash
# Open directly in browser (macOS):
open index.html

# Or serve via standard HTTP server:
python3 -m http.server 8080
```

---

## 💾 Data Persistence & Reset

- All data (catalogue, inventory movements, sales, shift logs, audit logs, expenses) is persisted locally in the browser's `localStorage` under `cellar_v1_store`.
- To reset the store to initial demo state at any time, click **"🌱 Refresh Seed Data"** in the top header.
