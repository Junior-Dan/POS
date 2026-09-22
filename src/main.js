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

import { renderSupplierModal } from './components/SupplierModal.js';
import { renderPurchaseOrderModal } from './components/PurchaseOrderModal.js';
import { renderExpenseModal } from './components/ExpenseModal.js';
import { renderCustomerModal } from './components/CustomerModal.js';
import { renderBranchModal } from './components/BranchModal.js';
import { renderStaffModal } from './components/StaffModal.js';
import { renderResetPinModal } from './components/ResetPinModal.js';

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
      ${renderSupplierModal()}
      ${renderPurchaseOrderModal()}
      ${renderExpenseModal()}
      ${renderCustomerModal()}
      ${renderBranchModal()}
      ${renderStaffModal()}
      ${renderResetPinModal()}
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

  // Real-time Live Store Subscription & Ticker
  if (!window._liveTickerStarted) {
    window._liveTickerStarted = true;
    store.subscribe(() => {
      if (window.triggerDashboardCharts) {
        window.triggerDashboardCharts();
      }
    });

    setInterval(() => {
      if (window.triggerDashboardCharts) {
        window.triggerDashboardCharts();
      }
    }, 2000);
  }

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
      const expectedCash = store.getExpectedCashInDrawer();
      const mpesaSales = store.getTodayNetMpesaSales();

      document.getElementById('shiftModalExpectedCash').textContent = `KSh ${expectedCash.toLocaleString()}`;
      document.getElementById('shiftModalExpectedMpesa').textContent = `KSh ${mpesaSales.toLocaleString()}`;
      document.getElementById('shiftActualCashInput').value = expectedCash;
      window.openModal('closeShiftModal');
    });
  };

  window.submitCloseShift = () => {
    const actualCash = parseFloat(document.getElementById('shiftActualCashInput').value) || 0;
    const notes = document.getElementById('shiftNotesInput').value.trim();

    const expectedCash = store.getExpectedCashInDrawer();
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

    if (sale.refunded) return alert("This sale has already been refunded!");

    sale.refunded = true;
    sale.refundAmount = amount;
    sale.refundReason = reason;

    // Restock items to inventory
    sale.items.forEach(item => {
      const prod = store.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.qty;
        store.stockMovements.unshift({
          timestamp: new Date().toISOString(),
          productId: prod.id,
          productName: `${prod.brand} ${prod.name}`,
          type: "REFUND_RESTOCK",
          qty: item.qty,
          ref: sale.receiptNo,
          user: store.currentUser.name,
          reason: `Restocked on Refund: ${reason}`
        });
      }
    });

    store.logAudit("Processed Refund", receiptNo, `Sale KES ${sale.total}`, `Refund KES ${amount}`, reason);
    store.save();

    window.closeModal('returnRefundModal');
    initApp();
    alert(`Refund of KSh ${amount.toLocaleString()} approved for Receipt ${receiptNo}. Items restocked to inventory!`);
  };

  // --- SUPPLIERS HANDLERS ---
  window.openAddSupplierModal = () => {
    document.getElementById('supplierModalTitle').textContent = "Add New Supplier";
    document.getElementById('supplierEditId').value = "";
    document.getElementById('supNameInput').value = "";
    document.getElementById('supContactInput').value = "";
    document.getElementById('supPhoneInput').value = "";
    document.getElementById('supPinInput').value = "";
    document.getElementById('supAddressInput').value = "";
    window.openModal('supplierModal');
  };

  window.openEditSupplierModal = (id) => {
    const s = store.suppliers.find(x => x.id === id);
    if (!s) return;
    document.getElementById('supplierModalTitle').textContent = "Edit Supplier";
    document.getElementById('supplierEditId').value = s.id;
    document.getElementById('supNameInput').value = s.name;
    document.getElementById('supContactInput').value = s.contact || "";
    document.getElementById('supPhoneInput').value = s.phone || "";
    document.getElementById('supPinInput').value = s.pin || "";
    document.getElementById('supAddressInput').value = s.address || "";
    window.openModal('supplierModal');
  };

  window.submitSaveSupplier = () => {
    const name = document.getElementById('supNameInput').value.trim();
    const contact = document.getElementById('supContactInput').value.trim();
    const phone = document.getElementById('supPhoneInput').value.trim();
    const pin = document.getElementById('supPinInput').value.trim();
    const paymentTerms = document.getElementById('supPaymentTermsSelect').value;
    const address = document.getElementById('supAddressInput').value.trim();

    if (!name || !phone) return alert("Please enter Supplier Name and Phone Number!");

    const editId = document.getElementById('supplierEditId').value;
    if (editId) {
      const s = store.suppliers.find(x => x.id === editId);
      if (s) {
        s.name = name; s.contact = contact; s.phone = phone; s.pin = pin;
        s.paymentTerms = paymentTerms; s.address = address;
        store.logAudit("Updated Supplier", s.name, "-", `Phone: ${phone}`, "Supplier Details Modified");
      }
    } else {
      const newSup = {
        id: `SUP${store.suppliers.length + 1}`,
        name, contact, phone, pin, paymentTerms, address
      };
      store.suppliers.push(newSup);
      store.logAudit("Added New Supplier", name, "-", `PIN: ${pin}`, "Registered Distributor");
    }

    store.save();
    window.closeModal('supplierModal');
    initApp();
    alert("Supplier details saved successfully!");
  };

  window.deleteSupplier = (id) => {
    const s = store.suppliers.find(x => x.id === id);
    if (!s) return;
    if (confirm(`Are you sure you want to delete supplier "${s.name}"?`)) {
      store.suppliers = store.suppliers.filter(x => x.id !== id);
      store.logAudit("Deleted Supplier", s.name, "-", "-", "Removed from Supplier Directory");
      store.save();
      initApp();
    }
  };

  window.openCreatePoForSupplier = (supplierId) => {
    switchTab('purchases');
    window.openCreatePoModal(supplierId);
  };

  // --- PURCHASE ORDERS & GOODS RECEIVING HANDLERS ---
  window.poLineItems = [];

  window.openCreatePoModal = (preselectSupplierId = null) => {
    const supSelect = document.getElementById('poSupplierSelect');
    if (supSelect) {
      supSelect.innerHTML = store.suppliers.map(s => `
        <option value="${s.id}" ${s.id === preselectSupplierId ? 'selected' : ''}>${s.name} (${s.pin || 'No PIN'})</option>
      `).join('') || '<option value="">No suppliers available</option>';
    }

    const prodSelect = document.getElementById('poProductSelect');
    if (prodSelect) {
      prodSelect.innerHTML = store.products.map(p => `
        <option value="${p.id}">${p.brand} ${p.name} (${p.size}) - Cost: KSh ${p.cost}</option>
      `).join('') || '<option value="">No products available</option>';
    }

    // Default line items from low stock items
    window.poLineItems = store.products.filter(p => p.stock <= p.reorder).slice(0, 3).map(p => ({
      productId: p.id,
      name: `${p.brand} ${p.name} (${p.size})`,
      qty: 12,
      unitCost: p.cost,
      totalCost: p.cost * 12
    }));

    renderPoLineItemsTable();
    window.openModal('createPoModal');
  };

  window.addPoLineItem = () => {
    const prodId = document.getElementById('poProductSelect').value;
    const qty = parseInt(document.getElementById('poItemQtyInput').value) || 1;
    const prod = store.products.find(p => p.id === prodId);
    if (!prod) return;

    const unitCost = parseFloat(document.getElementById('poItemCostInput').value) || prod.cost;

    const existing = window.poLineItems.find(i => i.productId === prodId);
    if (existing) {
      existing.qty += qty;
      existing.totalCost = existing.qty * existing.unitCost;
    } else {
      window.poLineItems.push({
        productId: prod.id,
        name: `${prod.brand} ${prod.name} (${prod.size})`,
        qty,
        unitCost,
        totalCost: qty * unitCost
      });
    }

    renderPoLineItemsTable();
  };

  window.removePoLineItem = (idx) => {
    window.poLineItems.splice(idx, 1);
    renderPoLineItemsTable();
  };

  function renderPoLineItemsTable() {
    const body = document.getElementById('poLineItemsBody');
    const totalEl = document.getElementById('poTotalValueText');
    const totalVal = window.poLineItems.reduce((acc, i) => acc + i.totalCost, 0);

    if (totalEl) totalEl.textContent = `KSh ${totalVal.toLocaleString()}`;

    if (body) {
      body.innerHTML = window.poLineItems.map((item, idx) => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>${item.qty} units</td>
          <td>KSh ${item.unitCost.toLocaleString()}</td>
          <td><strong>KSh ${item.totalCost.toLocaleString()}</strong></td>
          <td><button class="btn btn-danger btn-sm" onclick="removePoLineItem(${idx})">Remove</button></td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-faint);">No items added to PO yet</td></tr>';
    }
  }

  window.submitCreatePo = () => {
    const supId = document.getElementById('poSupplierSelect').value;
    const sup = store.suppliers.find(s => s.id === supId);
    if (!sup) return alert("Please select a valid supplier!");

    if (window.poLineItems.length === 0) return alert("Please add at least one line item to PO!");

    const deliveryDate = document.getElementById('poDeliveryDateInput').value || new Date(Date.now() + 86400000*2).toISOString().split('T')[0];
    const totalVal = window.poLineItems.reduce((acc, i) => acc + i.totalCost, 0);

    const po = {
      id: `PO-2026-${Math.floor(100 + store.purchases.length + 1)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      dateIssued: new Date().toISOString().split('T')[0],
      deliveryDate,
      status: "ORDERED",
      items: window.poLineItems.map(i => ({
        productId: i.productId,
        name: i.name,
        qtyOrdered: i.qty,
        qtyReceived: 0,
        unitCost: i.unitCost,
        totalCost: i.totalCost
      })),
      totalValue: totalVal,
      notes: "Issued via Purchasing Module"
    };

    store.purchases.unshift(po);
    store.logAudit("Created Purchase Order", po.id, "-", `Supplier: ${sup.name} | Value: KES ${totalVal.toLocaleString()}`, "LPO Issued");
    store.save();

    window.closeModal('createPoModal');
    initApp();
    alert(`Purchase Order ${po.id} issued to ${sup.name} successfully!`);
  };

  window.openReceiveGoodsModal = (poId) => {
    const po = store.purchases.find(p => p.id === poId);
    if (!po) return;

    document.getElementById('receivePoId').value = po.id;
    document.getElementById('receivePoSummaryBox').innerHTML = `
      <div style="font-size:13px; font-weight:700; color:var(--accent);">LPO: ${po.id} — ${po.supplierName}</div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">
        Items to receive: ${po.items.map(i => `<strong>${i.qtyOrdered}x ${i.name}</strong>`).join(', ')}<br>
        Total Delivery Value: <strong>KSh ${po.totalValue.toLocaleString()}</strong>
      </div>
    `;
    window.openModal('receiveGoodsModal');
  };

  window.submitReceiveGoods = () => {
    const poId = document.getElementById('receivePoId').value;
    const deliveryRef = document.getElementById('receiveDeliveryRefInput').value.trim();
    const notes = document.getElementById('receiveNotesInput').value.trim() || "Goods Received OK";

    if (!deliveryRef) return alert("Please enter Delivery Note / Invoice Ref Number!");

    const po = store.purchases.find(p => p.id === poId);
    if (!po) return;

    // AUTO-RESTOCK Inventory Catalog & Record Stock Ledger!
    po.items.forEach(item => {
      const prod = store.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.qtyOrdered;
        item.qtyReceived = item.qtyOrdered;

        store.stockMovements.unshift({
          timestamp: new Date().toISOString(),
          productId: prod.id,
          productName: `${prod.brand} ${prod.name}`,
          type: "PO_RECEIPT",
          qty: item.qtyOrdered,
          ref: po.id,
          user: store.currentUser.name,
          reason: `Goods Received GRN (${deliveryRef}): ${notes}`
        });
      }
    });

    po.status = "RECEIVED";
    po.receivedDate = new Date().toISOString().split('T')[0];
    po.deliveryRef = deliveryRef;
    po.receivedNotes = notes;

    store.logAudit("Received LPO Stock", po.id, "Status: ORDERED", "Status: RECEIVED", `DN: ${deliveryRef} - Inventory Restocked`);
    store.save();

    window.closeModal('receiveGoodsModal');
    initApp();
    alert(`Goods Receipt Voucher GRN confirmed for ${po.id}! Physical stock auto-replenished in catalog.`);
  };

  window.viewGoodsReceiptVoucher = (poId) => {
    const po = store.purchases.find(p => p.id === poId);
    if (!po) return;
    alert(`[GRN RECEIPT VOUCHER - ${po.id}]\nSupplier: ${po.supplierName}\nDelivery Ref: ${po.deliveryRef || 'N/A'}\nStatus: RECEIVED (${po.receivedDate || po.dateIssued})\nTotal Received Value: KSh ${po.totalValue.toLocaleString()}\nItems Replenished:\n${po.items.map(i => `- ${i.qtyOrdered} units ${i.name}`).join('\n')}`);
  };

  window.deletePurchaseOrder = (poId) => {
    if (confirm(`Delete purchase order ${poId}?`)) {
      store.purchases = store.purchases.filter(p => p.id !== poId);
      store.save();
      initApp();
    }
  };

  // --- EXPENSES HANDLERS ---
  window.openExpenseModal = () => {
    document.getElementById('expVendorInput').value = "";
    document.getElementById('expAmountInput').value = "";
    document.getElementById('expNotesInput').value = "";
    window.openModal('expenseModal');
  };

  window.submitRecordExpense = () => {
    const category = document.getElementById('expCategorySelect').value;
    const vendor = document.getElementById('expVendorInput').value.trim();
    const amount = parseFloat(document.getElementById('expAmountInput').value) || 0;
    const paymentMethod = document.getElementById('expPaymentMethodSelect').value;
    const notes = document.getElementById('expNotesInput').value.trim();

    if (!vendor || amount <= 0) return alert("Please enter valid Vendor and Amount!");

    const exp = {
      id: `EXP-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category,
      vendor,
      amount,
      paymentMethod,
      notes: notes || category,
      user: store.currentUser.name
    };

    store.expenses.unshift(exp);

    // Deduct cash from cash drawer if paid out of petty cash
    if (paymentMethod === 'CASH') {
      store.cashMovements.unshift({
        timestamp: new Date().toISOString(),
        type: 'CASH_OUT',
        amount: -amount,
        user: store.currentUser.name,
        reason: `Petty Cash Expense: ${category} (${vendor})`
      });
    }

    store.logAudit("Recorded Expense", category, "-", `KES ${amount.toLocaleString()}`, `Paid to ${vendor} via ${paymentMethod}`);
    store.save();

    window.closeModal('expenseModal');
    initApp();
    alert(`Expense of KSh ${amount.toLocaleString()} logged under ${category}.`);
  };

  window.deleteExpense = (id) => {
    if (confirm("Delete this expense record?")) {
      store.expenses = store.expenses.filter(e => e.id !== id);
      store.save();
      initApp();
    }
  };

  // --- CUSTOMERS HANDLERS ---
  window.openCustomerModal = () => {
    document.getElementById('customerModalTitle').textContent = "Add Registered Customer";
    document.getElementById('custEditId').value = "";
    document.getElementById('custNameInput').value = "";
    document.getElementById('custPhoneInput').value = "";
    document.getElementById('custEmailInput').value = "";
    document.getElementById('custNotesInput').value = "";
    window.openModal('customerModal');
  };

  window.openEditCustomerModal = (id) => {
    const c = store.customers.find(x => x.id === id);
    if (!c) return;
    document.getElementById('customerModalTitle').textContent = "Edit Customer Details";
    document.getElementById('custEditId').value = c.id;
    document.getElementById('custNameInput').value = c.name;
    document.getElementById('custPhoneInput').value = c.phone || "";
    document.getElementById('custEmailInput').value = c.email || "";
    document.getElementById('custNotesInput').value = c.notes || "";
    window.openModal('customerModal');
  };

  window.submitSaveCustomer = () => {
    const name = document.getElementById('custNameInput').value.trim();
    const phone = document.getElementById('custPhoneInput').value.trim();
    const email = document.getElementById('custEmailInput').value.trim();
    const notes = document.getElementById('custNotesInput').value.trim();

    if (!name || !phone) return alert("Please enter Customer Name and Phone Number!");

    const editId = document.getElementById('custEditId').value;
    if (editId) {
      const c = store.customers.find(x => x.id === editId);
      if (c) {
        c.name = name; c.phone = phone; c.email = email; c.notes = notes;
        store.logAudit("Updated Customer Profile", name, "-", `Phone: ${phone}`, "ODPC Registry Updated");
      }
    } else {
      const newCust = {
        id: `C${store.customers.length + 1}`,
        name, phone, email, notes, visits: 0, totalSpend: 0
      };
      store.customers.push(newCust);
      store.logAudit("Registered Customer", name, "-", `Phone: ${phone}`, "Added to Customer Loyalty Registry");
    }

    store.save();
    window.closeModal('customerModal');
    initApp();
    alert("Customer saved successfully!");
  };

  window.deleteCustomer = (id) => {
    const c = store.customers.find(x => x.id === id);
    if (!c) return;
    if (confirm(`Delete customer "${c.name}"?`)) {
      store.customers = store.customers.filter(x => x.id !== id);
      store.save();
      initApp();
    }
  };

  // --- BRANCH & ENTERPRISE HANDLERS ---
  window.switchActiveBranch = (branchId) => {
    store.setActiveBranch(branchId);
    store.logAudit("Switched Active Branch", branchId, "-", store.getActiveBranch().name, "User Branch Switch");
    initApp();
  };

  // --- ADMINISTRATION CENTER HANDLERS ---
  window.submitSaveBusinessProfile = () => {
    const name = document.getElementById('setBizName').value.trim();
    const phone = document.getElementById('setBizPhone').value.trim();
    const email = document.getElementById('setBizEmail').value.trim();
    const address = document.getElementById('setBizAddress').value.trim();
    const kraPin = document.getElementById('setKraPin').value.trim();
    const regNo = document.getElementById('setBizRegNo').value.trim();
    const receiptName = document.getElementById('setReceiptName').value.trim() || name;
    const receiptPhone = document.getElementById('setReceiptPhone').value.trim() || phone;
    const receiptAddress = document.getElementById('setReceiptAddress').value.trim() || address;

    if (!name || !phone || !kraPin) return alert("Please enter Business Name, Phone, and KRA PIN!");

    store.businessProfile = {
      name, phone, email, address, kraPin, regNo, receiptName, receiptPhone, receiptAddress
    };

    store.logAudit("Saved Business Profile", name, "-", `PIN: ${kraPin}`, "Updated Business Identity");
    store.save();
    initApp();
    alert("Business Profile saved successfully!");
  };

  window.openAddBranchModal = () => {
    document.getElementById('branchModalTitle').textContent = "Add New Branch";
    document.getElementById('branchEditId').value = "";
    document.getElementById('branchNameInput').value = "";
    document.getElementById('branchCodeInput').value = "";
    document.getElementById('branchLocationInput').value = "";
    document.getElementById('branchPhoneInput').value = "";
    document.getElementById('branchHoursInput').value = "08:00 AM - 10:00 PM";

    const mgrSelect = document.getElementById('branchManagerSelect');
    if (mgrSelect) {
      mgrSelect.innerHTML = `<option value="">None (Unassigned)</option>` + store.users.map(u => `<option value="${u.id}">${u.name} (${u.role.toUpperCase()})</option>`).join('');
    }

    window.openModal('branchModal');
  };

  window.openEditBranchModal = (id) => {
    const b = store.branches.find(x => x.id === id);
    if (!b) return;

    document.getElementById('branchModalTitle').textContent = "Edit Branch Details";
    document.getElementById('branchEditId').value = b.id;
    document.getElementById('branchNameInput').value = b.name;
    document.getElementById('branchCodeInput').value = b.code || "";
    document.getElementById('branchLocationInput').value = b.location || "";
    document.getElementById('branchPhoneInput').value = b.phone || "";
    document.getElementById('branchHoursInput').value = b.hours || "08:00 AM - 10:00 PM";
    document.getElementById('branchStatusSelect').value = b.status || "ACTIVE";

    const mgrSelect = document.getElementById('branchManagerSelect');
    if (mgrSelect) {
      mgrSelect.innerHTML = `<option value="">None (Unassigned)</option>` + store.users.map(u => `<option value="${u.id}" ${u.id === b.managerId ? 'selected' : ''}>${u.name} (${u.role.toUpperCase()})</option>`).join('');
    }

    window.openModal('branchModal');
  };

  window.submitSaveBranch = () => {
    const name = document.getElementById('branchNameInput').value.trim();
    const code = document.getElementById('branchCodeInput').value.trim() || `BR-${Date.now().toString().slice(-4)}`;
    const location = document.getElementById('branchLocationInput').value.trim();
    const phone = document.getElementById('branchPhoneInput').value.trim();
    const managerId = document.getElementById('branchManagerSelect').value;
    const hours = document.getElementById('branchHoursInput').value.trim();
    const status = document.getElementById('branchStatusSelect').value;

    if (!name || !location) return alert("Please enter Branch Name and Location!");

    const editId = document.getElementById('branchEditId').value;
    if (editId) {
      const b = store.branches.find(x => x.id === editId);
      if (b) {
        b.name = name; b.code = code; b.location = location; b.phone = phone;
        b.managerId = managerId; b.hours = hours; b.status = status;
        store.logAudit("Updated Branch", name, "-", `Code: ${code}`, "Branch Configuration Saved");
      }
    } else {
      const newBranch = {
        id: `B${store.branches.length + 1}`,
        name, code, location, phone, managerId, hours, status
      };
      store.branches.push(newBranch);
      store.logAudit("Created New Branch", name, "-", `Code: ${code}`, "Added Branch to Enterprise");
    }

    store.save();
    window.closeModal('branchModal');
    initApp();
    alert("Branch configuration saved!");
  };

  window.deleteBranch = (id) => {
    const b = store.branches.find(x => x.id === id);
    if (!b) return;
    if (confirm(`Deactivate/Delete branch "${b.name}"?`)) {
      store.branches = store.branches.filter(x => x.id !== id);
      store.logAudit("Deleted Branch", b.name, "-", "-", "Deactivated Branch");
      store.save();
      initApp();
    }
  };

  window.openAddStaffModal = () => {
    document.getElementById('staffModalTitle').textContent = "Add Staff Account";
    document.getElementById('staffEditId').value = "";
    document.getElementById('staffNameInput').value = "";
    document.getElementById('staffPhoneInput').value = "";
    document.getElementById('staffEmailInput').value = "";
    document.getElementById('staffPinInput').value = "";

    const primSelect = document.getElementById('staffPrimaryBranchSelect');
    if (primSelect) {
      primSelect.innerHTML = store.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    const addSelect = document.getElementById('staffAdditionalBranchesSelect');
    if (addSelect) {
      addSelect.innerHTML = store.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    window.openModal('staffModal');
  };

  window.openEditStaffModal = (id) => {
    const u = store.users.find(x => x.id === id);
    if (!u) return;

    document.getElementById('staffModalTitle').textContent = "Edit Staff Account";
    document.getElementById('staffEditId').value = u.id;
    document.getElementById('staffNameInput').value = u.name;
    document.getElementById('staffPhoneInput').value = u.phone || "";
    document.getElementById('staffEmailInput').value = u.email || "";
    document.getElementById('staffRoleSelect').value = u.role;
    document.getElementById('staffStatusSelect').value = u.status || "ACTIVE";
    document.getElementById('staffPinInput').value = ""; // Masked PIN!

    const primSelect = document.getElementById('staffPrimaryBranchSelect');
    if (primSelect) {
      primSelect.innerHTML = store.branches.map(b => `<option value="${b.id}" ${b.id === u.primaryBranchId ? 'selected' : ''}>${b.name}</option>`).join('');
    }

    const addSelect = document.getElementById('staffAdditionalBranchesSelect');
    if (addSelect) {
      addSelect.innerHTML = store.branches.map(b => `<option value="${b.id}" ${(u.additionalBranchIds || []).includes(b.id) ? 'selected' : ''}>${b.name}</option>`).join('');
    }

    window.openModal('staffModal');
  };

  window.submitSaveStaff = () => {
    const name = document.getElementById('staffNameInput').value.trim();
    const phone = document.getElementById('staffPhoneInput').value.trim();
    const email = document.getElementById('staffEmailInput').value.trim();
    const role = document.getElementById('staffRoleSelect').value;
    const primaryBranchId = document.getElementById('staffPrimaryBranchSelect').value;
    const status = document.getElementById('staffStatusSelect').value;
    const pin = document.getElementById('staffPinInput').value.trim();

    const addSelect = document.getElementById('staffAdditionalBranchesSelect');
    const additionalBranchIds = Array.from(addSelect.selectedOptions).map(opt => opt.value);

    if (!name || !phone) return alert("Please enter Staff Name and Phone Number!");

    const editId = document.getElementById('staffEditId').value;
    if (editId) {
      const u = store.users.find(x => x.id === editId);
      if (u) {
        u.name = name; u.phone = phone; u.email = email; u.role = role;
        u.primaryBranchId = primaryBranchId; u.additionalBranchIds = additionalBranchIds;
        u.status = status;
        if (pin && pin.length === 4) u.pin = pin;
        store.logAudit("Updated Staff Member", name, "-", `Role: ${role.toUpperCase()}`, "Staff Account Modified");
      }
    } else {
      if (!pin || pin.length !== 4) return alert("Please enter a 4-digit Secret Security PIN!");
      const newStaff = {
        id: `U${store.users.length + 1}`,
        name, phone, email, role, primaryBranchId, additionalBranchIds, status, pin,
        permissions: []
      };
      store.users.push(newStaff);
      store.logAudit("Created Staff Account", name, "-", `Role: ${role.toUpperCase()}`, "Staff Registered");
    }

    store.save();
    window.closeModal('staffModal');
    initApp();
    alert("Staff member configuration saved successfully!");
  };

  window.deleteStaff = (id) => {
    const u = store.users.find(x => x.id === id);
    if (!u) return;
    if (confirm(`Deactivate staff account "${u.name}"?`)) {
      u.status = "INACTIVE";
      store.logAudit("Deactivated Staff Account", u.name, "-", "-", "Account Deactivated");
      store.save();
      initApp();
    }
  };

  window.openResetPinModal = (id) => {
    const u = store.users.find(x => x.id === id);
    if (!u) return;

    document.getElementById('resetPinUserId').value = u.id;
    document.getElementById('resetPinTargetUserText').textContent = `Staff: ${u.name} (${u.role.toUpperCase()})`;
    document.getElementById('newPinInput').value = "";
    document.getElementById('confirmNewPinInput').value = "";
    window.openModal('resetPinModal');
  };

  window.submitResetPin = () => {
    const userId = document.getElementById('resetPinUserId').value;
    const newPin = document.getElementById('newPinInput').value.trim();
    const confirmPin = document.getElementById('confirmNewPinInput').value.trim();

    if (!newPin || newPin.length !== 4 || isNaN(newPin)) {
      return alert("PIN must be exactly 4 digits!");
    }

    if (newPin !== confirmPin) {
      return alert("PIN confirmation does not match!");
    }

    const u = store.users.find(x => x.id === userId);
    if (u) {
      u.pin = newPin;
      store.logAudit("Reset Security PIN", u.name, "••••", "••••", "Staff Security PIN Reset (Masked)");
      store.save();
      window.closeModal('resetPinModal');
      alert(`Security PIN updated successfully for ${u.name}!`);
    }
  };

  window.submitSaveReceiptSettings = () => {
    const headerText = document.getElementById('recHeaderInput').value.trim();
    const footerText = document.getElementById('recFooterInput').value.trim();
    const printCopies = parseInt(document.getElementById('recCopiesInput').value) || 1;
    const showCashierName = document.getElementById('recShowCashierSelect').value === 'true';

    store.receiptSettings = {
      showLogo: true,
      showCashierName,
      showTaxBreakdown: true,
      printCopies,
      headerText: headerText || "CISCO WINES & SPIRITS",
      footerText: footerText || "Thank you for shopping at Cisco Wines!"
    };

    store.logAudit("Updated Receipt Settings", "POS Receipt", "-", `Header: ${headerText}`, "Receipt Settings Saved");
    store.save();
    initApp();
    alert("Receipt printing configuration saved!");
  };

  window.submitSavePaymentSettings = () => {
    const cashEnabled = document.getElementById('payOptCash').checked;
    const mpesaEnabled = document.getElementById('payOptMpesa').checked;
    const cardEnabled = document.getElementById('payOptCard').checked;
    const bankEnabled = document.getElementById('payOptBank').checked;

    store.paymentSettings = { cashEnabled, mpesaEnabled, cardEnabled, bankEnabled, creditEnabled: false };
    store.logAudit("Updated Payment Methods", "POS Checkout", "-", `Cash:${cashEnabled}, M-PESA:${mpesaEnabled}, Card:${cardEnabled}`, "Payment Options Configured");
    store.save();
    initApp();
    alert("Payment settings saved successfully!");
  };

  window.submitSaveShiftSettings = () => {
    const defaultFloat = parseFloat(document.getElementById('shiftFloatInput').value) || 5000;
    const maxVarianceThreshold = parseFloat(document.getElementById('shiftVarianceInput').value) || 1000;

    store.shiftSettings = {
      defaultFloat,
      requireCashDeclaration: true,
      maxVarianceThreshold,
      requireManagerVarianceApproval: true
    };

    store.logAudit("Updated Shift Rules", "Shift & Drawer", "-", `Float: KES ${defaultFloat}`, "Shift Rules Configured");
    store.save();
    initApp();
    alert("Shift rules saved successfully!");
  };

  window.submitSaveSecuritySettings = () => {
    const sessionTimeoutMinutes = parseInt(document.getElementById('secTimeoutInput').value) || 30;
    const maxDiscountPercentWithoutAuth = parseInt(document.getElementById('secDiscountInput').value) || 5;

    store.securitySettings = {
      sessionTimeoutMinutes,
      autoLogoutOnIdle: false,
      requirePinForRefunds: true,
      requirePinForPriceOverride: true,
      requirePinForStockAdjustments: true,
      maxDiscountPercentWithoutAuth
    };

    store.logAudit("Updated Security Policy", "System Security", "-", `Timeout: ${sessionTimeoutMinutes}m`, "Security Rules Saved");
    store.save();
    initApp();
    alert("Security policies saved successfully!");
  };

  window.submitSaveSystemPreferences = () => {
    const currencySymbol = document.getElementById('prefCurrencyInput').value.trim() || 'KSh';
    const taxRate = parseFloat(document.getElementById('prefTaxRateInput').value) || 16;

    store.systemPreferences = { currencySymbol, taxRate, dateFormat: "DD/MM/YYYY", theme: "dark" };
    store.logAudit("Updated System Preferences", "System Config", "-", `Currency: ${currencySymbol}`, "Preferences Saved");
    store.save();
    initApp();
    alert("System preferences saved!");
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
  if (!store.canUserAccessView(store.currentUser, viewId)) {
    alert(`Access Denied: Your assigned role (${store.currentUser.role.toUpperCase()}) does not have permission to access module "${viewId.toUpperCase()}".`);
    return;
  }

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

  if (viewId === 'dashboard' && window.triggerDashboardCharts) {
    setTimeout(() => window.triggerDashboardCharts(), 50);
  }
}

window.switchTab = switchTab;
window.renderAllApp = initApp;

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initApp();
}
