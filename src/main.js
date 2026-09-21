import { store } from './store/CellarStore.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderTopbar } from './components/Topbar.js';
import { renderDashboardView } from './views/DashboardView.js';
import { renderPosView } from './views/PosView.js';
import { renderProductsView } from './views/ProductsView.js';
import { renderInventoryView } from './views/InventoryView.js';
import { renderSalesView } from './views/SalesView.js';
import { renderShiftView } from './views/ShiftView.js';
import { renderSuppliersView } from './views/SuppliersView.js';
import { renderPurchasesView } from './views/PurchasesView.js';
import { renderExpensesView } from './views/ExpensesView.js';
import { renderCustomersView } from './views/CustomersView.js';
import { renderComplianceView } from './views/ComplianceView.js';
import { renderReportsView } from './views/ReportsView.js';
import { renderAuditView } from './views/AuditView.js';
import { renderSettingsView } from './views/SettingsView.js';

import { renderPinPadModal } from './components/PinPadModal.js';
import { renderCashModal } from './components/CashModal.js';
import { renderMpesaModal } from './components/MpesaModal.js';
import { renderReceiptModal } from './components/ReceiptModal.js';
import { renderAddProductModal } from './components/AddProductModal.js';
import { renderDamageBottleModal } from './components/DamageBottleModal.js';
import { renderCashMovementModal } from './components/CashMovementModal.js';
import { renderCloseShiftModal } from './components/CloseShiftModal.js';
import { renderReturnRefundModal } from './components/ReturnRefundModal.js';

import { requestManagerAuth } from './services/authService.js';
import { MpesaDarajaService } from './services/mpesaDaraja.js';
import { KraEtimsService } from './services/kraEtims.js';

let activeViewId = 'dashboard';

export function initApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <div class="app-container">
      ${renderSidebar(store.currentUser)}
      <main class="main-wrapper">
        ${renderTopbar()}
        <div id="views-root">
          ${renderDashboardView()}
          ${renderPosView()}
          ${renderProductsView()}
          ${renderInventoryView()}
          ${renderSalesView()}
          ${renderShiftView()}
          ${renderSuppliersView()}
          ${renderPurchasesView()}
          ${renderExpensesView()}
          ${renderCustomersView()}
          ${renderComplianceView()}
          ${renderReportsView()}
          ${renderAuditView()}
          ${renderSettingsView()}
        </div>
      </main>
    </div>
    <div id="modals-root">
      ${renderPinPadModal()}
      ${renderCashModal()}
      ${renderMpesaModal()}
      ${renderReceiptModal()}
      ${renderAddProductModal()}
      ${renderDamageBottleModal()}
      ${renderCashMovementModal()}
      ${renderCloseShiftModal()}
      ${renderReturnRefundModal()}
    </div>
  `;

  bindEvents();
  switchTab(activeViewId);
}

function bindEvents() {
  // Navigation tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.view);
    });
  });

  // Global Modal Helpers
  window.openModal = (id) => document.getElementById(id)?.classList.add('active');
  window.closeModal = (id) => document.getElementById(id)?.classList.remove('active');

  // User Switcher
  const switchBtn = document.getElementById('switchUserBtn');
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      const currIdx = store.users.findIndex(u => u.id === store.currentUser.id);
      const nextIdx = (currIdx + 1) % store.users.length;
      store.currentUser = store.users[nextIdx];
      initApp();
      alert(`Switched active user to: ${store.currentUser.name} (${store.currentUser.role.toUpperCase()})`);
    });
  }

  // Quick Seed / Reset Clean
  const seedBtn = document.getElementById('quickSeedBtn');
  if (seedBtn) {
    seedBtn.addEventListener('click', () => {
      if (confirm("Reset operational dataset to clean state (0 sales, 0 expenses)?")) {
        store.seedClean();
        initApp();
        alert("Operational data reset to clean state!");
      }
    });
  }

  // Add Product Modal Trigger
  const addProdBtn = document.getElementById('addNewProductBtn');
  if (addProdBtn) {
    addProdBtn.addEventListener('click', () => {
      document.getElementById('productModalTitle').textContent = "Add New Product";
      document.getElementById('prodEditId').value = "";
      document.getElementById('prodBrandInput').value = "";
      document.getElementById('prodNameInput').value = "";
      document.getElementById('prodSkuInput').value = "";
      document.getElementById('prodBarcodeInput').value = "";
      document.getElementById('prodCostInput').value = "";
      document.getElementById('prodPriceInput').value = "";
      window.openModal('addProductModal');
    });
  }

  // Save Product Handler
  window.submitSaveProduct = () => {
    const brand = document.getElementById('prodBrandInput').value.trim();
    const name = document.getElementById('prodNameInput').value.trim();
    const category = document.getElementById('prodCategorySelect').value;
    const size = document.getElementById('prodSizeSelect').value;
    const abv = parseFloat(document.getElementById('prodAbvInput').value) || 0;
    const sku = document.getElementById('prodSkuInput').value.trim() || `SKU-${Date.now()}`;
    const barcode = document.getElementById('prodBarcodeInput').value.trim() || `${Math.floor(1000000000000 + Math.random()*9000000000000)}`;
    const stock = parseInt(document.getElementById('prodStockInput').value) || 0;
    const cost = parseFloat(document.getElementById('prodCostInput').value) || 0;
    const price = parseFloat(document.getElementById('prodPriceInput').value) || 0;
    const reorder = parseInt(document.getElementById('prodReorderInput').value) || 5;
    const highValue = document.getElementById('prodHighValueInput').checked;

    if (!brand || !name || !price) {
      return alert("Please enter Brand, Name, and Selling Price!");
    }

    const editId = document.getElementById('prodEditId').value;
    if (editId) {
      const prod = store.products.find(p => p.id === editId);
      if (prod) {
        const oldPrice = prod.price;
        const oldCost = prod.cost;

        prod.brand = brand; prod.name = name; prod.category = category; prod.size = size;
        prod.abv = abv; prod.sku = sku; prod.barcode = barcode; prod.cost = cost; prod.price = price;
        prod.reorder = reorder; prod.highValue = highValue;

        store.logAudit(
          "Price & Specification Edit",
          `${prod.brand} ${prod.name} (${prod.size})`,
          `Sell: KES ${oldPrice.toLocaleString()} | Cost: KES ${oldCost.toLocaleString()}`,
          `Sell: KES ${price.toLocaleString()} | Cost: KES ${cost.toLocaleString()}`,
          "Manager Authorized Price Modification"
        );
      }
    } else {
      const newProd = {
        id: `P${100 + store.products.length + 1}`,
        brand, name, category, abv, size, caseUnits: 12, barcode, sku, cost, price,
        minPrice: Math.round(price * 0.9), stock, reorder, highValue, active: true
      };
      store.products.push(newProd);
      store.stockMovements.unshift({
        timestamp: new Date().toISOString(),
        productId: newProd.id,
        productName: `${brand} ${name}`,
        type: "OPENING_STOCK",
        qty: stock,
        ref: "NEW-PROD",
        user: store.currentUser.name,
        reason: "New Product Created"
      });
      store.logAudit("Created New Product", `${brand} ${name}`, "-", `Stock: ${stock}`, "Added to catalog");
    }

    store.save();
    window.closeModal('addProductModal');
    initApp();
    alert("Product saved successfully!");
  };

  // Record Damage Modal Handlers
  window.handleRecordDamage = () => {
    requestManagerAuth("Record Damaged or Broken Bottle Write-Off", () => {
      window.openModal('damageBottleModal');
    });
  };

  window.submitDamageLog = () => {
    const prodId = document.getElementById('damageProdSelect').value;
    const qty = parseInt(document.getElementById('damageQtyInput').value) || 1;
    const reason = document.getElementById('damageReasonInput').value.trim() || "Damaged/Broken Bottle";

    const prod = store.products.find(p => p.id === prodId);
    if (!prod) return;
    if (prod.stock < qty) return alert("Quantity exceeds physical stock!");

    prod.stock -= qty;
    store.stockMovements.unshift({
      timestamp: new Date().toISOString(),
      productId: prod.id,
      productName: `${prod.brand} ${prod.name}`,
      type: "DAMAGE",
      qty: -qty,
      ref: "DMG-LOG",
      user: store.currentUser.name,
      reason
    });
    store.logAudit("Recorded Damaged Stock", prod.name, `Stock -${qty}`, prod.stock, reason);
    store.save();

    window.closeModal('damageBottleModal');
    initApp();
    alert(`Damaged stock logged for ${prod.name}.`);
  };

  // Cash Movement Modal Handlers
  window.handleRecordCashMovement = () => {
    requestManagerAuth("Authorize Cash Drawer Movement (Cash In / Cash Out)", () => {
      window.openModal('cashMovementModal');
    });
  };

  window.submitCashMovement = () => {
    const type = document.getElementById('cashMoveTypeSelect').value;
    const amount = parseFloat(document.getElementById('cashMoveAmountInput').value) || 0;
    const reason = document.getElementById('cashMoveReasonInput').value.trim();

    if (amount <= 0) return alert("Please enter valid amount!");
    if (!reason) return alert("Mandatory reason required!");

    store.cashMovements.unshift({
      timestamp: new Date().toISOString(),
      type,
      amount: type === 'CASH_OUT' ? -amount : amount,
      user: store.currentUser.name,
      reason
    });
    store.logAudit("Recorded Cash Movement", type, "-", `KES ${amount}`, reason);
    store.save();

    window.closeModal('cashMovementModal');
    initApp();
    alert("Cash Movement logged successfully.");
  };

  // Close Shift Modal Handlers
  window.handleCloseShift = () => {
    requestManagerAuth("Reconcile Cash & Close Active Shift", () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const cashSales = store.sales.filter(s => s.paymentMethod === 'CASH' && s.timestamp.startsWith(todayStr)).reduce((a,s)=>a+s.total, 0);
      const mpesaSales = store.sales.filter(s => s.paymentMethod === 'M-PESA' && s.timestamp.startsWith(todayStr)).reduce((a,s)=>a+s.total, 0);
      const cashMovementsTotal = store.cashMovements.reduce((a,c)=>a+c.amount, 0);
      const expectedCash = 5000 + cashSales + cashMovementsTotal;

      document.getElementById('shiftModalExpectedCash').textContent = `KSh ${expectedCash.toLocaleString()}`;
      document.getElementById('shiftModalExpectedMpesa').textContent = `KSh ${mpesaSales.toLocaleString()}`;
      document.getElementById('shiftActualCashInput').value = expectedCash;
      window.openModal('closeShiftModal');
    });
  };

  window.submitCloseShift = () => {
    const actualCash = parseFloat(document.getElementById('shiftActualCashInput').value) || 0;
    const notes = document.getElementById('shiftNotesInput').value.trim();

    const todayStr = new Date().toISOString().split('T')[0];
    const cashSales = store.sales.filter(s => s.paymentMethod === 'CASH' && s.timestamp.startsWith(todayStr)).reduce((a,s)=>a+s.total, 0);
    const cashMovementsTotal = store.cashMovements.reduce((a,c)=>a+c.amount, 0);
    const expectedCash = 5000 + cashSales + cashMovementsTotal;
    const variance = actualCash - expectedCash;

    store.shifts.unshift({
      id: store.currentShift.id,
      cashierName: store.currentShift.cashierName,
      startTime: store.currentShift.startTime,
      endTime: new Date().toISOString(),
      expectedCash,
      actualCash,
      variance,
      notes
    });

    store.logAudit("Closed Shift", store.currentShift.id, `Expected KES ${expectedCash}`, `Actual KES ${actualCash}`, `Variance: KES ${variance}`);
    store.currentShift = {
      id: `SHIFT-${102 + store.shifts.length}`,
      cashierId: store.currentUser.id,
      cashierName: store.currentUser.name,
      startTime: new Date().toISOString(),
      openingFloat: 5000,
      status: "ACTIVE"
    };
    store.save();

    window.closeModal('closeShiftModal');
    initApp();
    alert(`Shift closed successfully! Variance: KSh ${variance.toLocaleString()}`);
  };

  // Return Refund Handlers
  window.handleProcessReturn = () => {
    requestManagerAuth("Authorize Product Return / Refund", () => {
      window.openModal('returnRefundModal');
    });
  };

  window.submitProcessRefund = () => {
    const receiptNo = document.getElementById('returnReceiptNoInput').value.trim();
    const reason = document.getElementById('returnReasonSelect').value;
    const amount = parseFloat(document.getElementById('refundAmountInput').value) || 0;

    if (!receiptNo || amount <= 0) return alert("Please enter valid Receipt # and Refund Amount!");

    const sale = store.sales.find(s => s.receiptNo.toLowerCase() === receiptNo.toLowerCase());
    if (!sale) return alert("Original receipt not found!");

    store.logAudit("Processed Refund", receiptNo, `Sale KES ${sale.total}`, `Refund KES ${amount}`, reason);
    alert(`Refund of KSh ${amount.toLocaleString()} approved for Receipt ${receiptNo}.`);
    window.closeModal('returnRefundModal');
    initApp();
  };

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('globalSearchInput')?.focus();
    }
    if (e.key === 'F2') {
      e.preventDefault();
      switchTab('pos');
      document.getElementById('posSearchInput')?.focus();
    }
  });
}

export function switchTab(viewId) {
  activeViewId = viewId;
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewId}`);
  const targetBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  const titleEl = document.getElementById('pageTitle');
  if (titleEl && targetBtn) {
    titleEl.textContent = targetBtn.querySelector('span:last-child').textContent;
  }
}

window.switchTab = switchTab;
window.renderAllApp = initApp;

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initApp();
}
