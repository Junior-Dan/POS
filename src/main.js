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

  if (!store.canUserAccessView(store.currentUser, activeViewId)) {
    const allowedModules = ['pos', 'sales', 'shift', 'customers', 'dashboard', 'products', 'inventory', 'suppliers', 'purchases', 'expenses', 'compliance', 'reports', 'audit', 'settings'];
    const fallback = allowedModules.find(id => store.canUserAccessView(store.currentUser, id));
    activeViewId = fallback || 'pos';
  }

  root.innerHTML = `
    <div class="app-container">
      ${renderSidebar(store.currentUser, activeViewId)}
      <main class="main-wrapper">
        ${renderTopbar(store.currentUser)}
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

  // Auto-Lock Terminal on Launch: Require PIN Login if unauthenticated session
  const isSessionAuth = sessionStorage.getItem('cellar_session_auth') === 'true';
  if (!isSessionAuth) {
    setTimeout(() => {
      if (window.openStaffLoginModal) {
        window.openStaffLoginModal(true);
      }
    }, 150);
  }
}

function bindEvents() {
  // Navigation tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.view);
    });
  });

  // Sidebar Collapse Toggle Triggers (Square buttons inside header / topbar)
  document.querySelectorAll('.sidebar-toggle-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = document.querySelector('.app-container');
      if (container) {
        container.classList.toggle('collapsed');
      }
    });
  });

  // Custom Calendar Popover Modal (Task 2)
  const datePillBtn = document.getElementById('topbarDatePickerBtn');
  const calPopover = document.getElementById('calendarPopover');
  if (datePillBtn && calPopover) {
    let calViewYear = store.getSelectedDateObj().getFullYear();
    let calViewMonth = store.getSelectedDateObj().getMonth();

    const renderCalGrid = () => {
      const container = document.getElementById('calDaysGrid');
      const title = document.getElementById('calMonthTitle');
      if (!container || !title) return;

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      title.textContent = `${monthNames[calViewMonth]} ${calViewYear}`;

      const firstDayIndex = new Date(calViewYear, calViewMonth, 1).getDay();
      const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
      const prevMonthDays = new Date(calViewYear, calViewMonth, 0).getDate();

      const selectedObj = store.getSelectedDateObj();
      const selYear = selectedObj.getFullYear();
      const selMonth = selectedObj.getMonth();
      const selDate = selectedObj.getDate();

      const todayObj = new Date();
      const tYear = todayObj.getFullYear();
      const tMonth = todayObj.getMonth();
      const tDate = todayObj.getDate();

      let html = '';

      for (let i = firstDayIndex - 1; i >= 0; i--) {
        html += `<div class="cal-day-cell other-month">${prevMonthDays - i}</div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === tDate && calViewMonth === tMonth && calViewYear === tYear;
        const isSelected = day === selDate && calViewMonth === selMonth && calViewYear === selYear;

        let classes = ['cal-day-cell'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');

        const formattedIso = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        html += `<div class="${classes.join(' ')}" data-date="${formattedIso}">${day}</div>`;
      }

      container.innerHTML = html;

      container.querySelectorAll('.cal-day-cell:not(.other-month)').forEach(cell => {
        cell.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const dVal = cell.dataset.date;
          if (dVal) {
            store.setSelectedDate(dVal);
            calPopover.classList.remove('active');
            initApp();
          }
        });
      });
    };

    datePillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isAct = calPopover.classList.contains('active');
      if (!isAct) {
        calPopover.classList.add('active');
        renderCalGrid();
      } else {
        calPopover.classList.remove('active');
      }
    });

    calPopover.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
      if (calPopover && calPopover.classList.contains('active') && !datePillBtn.contains(e.target)) {
        calPopover.classList.remove('active');
      }
    });

    document.getElementById('calPrevMonthBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      calViewMonth--;
      if (calViewMonth < 0) {
        calViewMonth = 11;
        calViewYear--;
      }
      renderCalGrid();
    });

    document.getElementById('calNextMonthBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      calViewMonth++;
      if (calViewMonth > 11) {
        calViewMonth = 0;
        calViewYear++;
      }
      renderCalGrid();
    });

    document.getElementById('calPresetToday')?.addEventListener('click', (e) => {
      e.stopPropagation();
      store.setSelectedDate(null);
      calPopover.classList.remove('active');
      initApp();
    });

    document.getElementById('calPresetYesterday')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const iso = y.toISOString().split('T')[0];
      store.setSelectedDate(iso);
      calPopover.classList.remove('active');
      initApp();
    });

    document.getElementById('calPresetLast7')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const y = new Date();
      y.setDate(y.getDate() - 7);
      const iso = y.toISOString().split('T')[0];
      store.setSelectedDate(iso);
      calPopover.classList.remove('active');
      initApp();
    });

    document.getElementById('calCancelBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      calPopover.classList.remove('active');
    });
  }

  const resetDateBtn = document.getElementById('resetDateTodayBtn');
  if (resetDateBtn) {
    resetDateBtn.addEventListener('click', () => {
      store.setSelectedDate(null);
      initApp();
    });
  }

  // Auto-Hiding Scrollbar Behavior (Shows scrollbar thumb only when actively scrolling)
  if (!window._scrollListenerAttached) {
    window._scrollListenerAttached = true;
    document.addEventListener('scroll', (e) => {
      const target = e.target;
      if (target && target.classList) {
        target.classList.add('is-scrolling');
        clearTimeout(target._scrollHideTimer);
        target._scrollHideTimer = setTimeout(() => {
          target.classList.remove('is-scrolling');
        }, 800);
      }
    }, true);
  }

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

  // Interactive Staff Login & Role Switcher
  window.loginEnteredPin = "";

  window.openStaffLoginModal = (isMandatory = false) => {
    const sel = document.getElementById('loginUserSelect');
    if (sel) {
      sel.innerHTML = store.users.map(u => `<option value="${u.id}" ${u.id === store.currentUser.id ? 'selected' : ''}>${u.name} (${u.role.toUpperCase()})</option>`).join('');
    }
    window.loginEnteredPin = "";
    updateLoginPinDots();
    const err = document.getElementById('loginPinErrorMsg');
    if (err) err.textContent = "";

    const closeBtn = document.querySelector('#userLoginModal .modal-close');
    if (closeBtn) {
      closeBtn.style.display = isMandatory ? 'none' : 'block';
    }

    const modal = document.getElementById('userLoginModal');
    if (modal) {
      modal.classList.add('active');
    }
  };

  window.pressLoginPin = (num) => {
    if (window.loginEnteredPin.length < 4) {
      window.loginEnteredPin += num;
      updateLoginPinDots();
    }
    if (window.loginEnteredPin.length === 4) {
      window.submitLoginPin();
    }
  };

  window.clearLoginPin = () => {
    window.loginEnteredPin = "";
    updateLoginPinDots();
    const err = document.getElementById('loginPinErrorMsg');
    if (err) err.textContent = "";
  };

  function updateLoginPinDots() {
    const dots = document.querySelectorAll('#loginPinDots .pin-dot');
    dots.forEach((dot, idx) => {
      if (idx < window.loginEnteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  window.submitLoginPin = () => {
    const pin = window.loginEnteredPin;
    const selectedUserId = document.getElementById('loginUserSelect')?.value;

    let targetUser = null;

    // 1. Direct PIN Matching
    if (pin) {
      targetUser = store.users.find(u => u.pin === pin);
    }

    // 2. Dropdown Fallback Matching
    if (!targetUser && selectedUserId) {
      const u = store.users.find(x => x.id === selectedUserId);
      if (u && u.pin === pin) {
        targetUser = u;
      }
    }

    if (targetUser) {
      store.currentUser = targetUser;
      sessionStorage.setItem('cellar_session_auth', 'true');
      sessionStorage.setItem('cellar_authenticated_user', targetUser.id);

      if (targetUser.primaryBranchId) {
        store.setActiveBranch(targetUser.primaryBranchId);
      }
      window.closeModal('userLoginModal');
      initApp();
      store.logAudit("Staff Login Successful", targetUser.name, "-", targetUser.role, "Authenticated via PIN");
    } else {
      const err = document.getElementById('loginPinErrorMsg');
      if (err) err.textContent = "Invalid PIN! Access Denied.";
      window.loginEnteredPin = "";
      updateLoginPinDots();
    }
  };

  window.lockTerminal = () => {
    sessionStorage.removeItem('cellar_session_auth');
    window.openStaffLoginModal(true);
  };

  const switchBtn = document.getElementById('switchUserBtn');
  if (switchBtn) {
    switchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.openStaffLoginModal();
    });
  }

  const lockBtn = document.getElementById('lockTerminalBtn');
  if (lockBtn) {
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.openStaffLoginModal();
    });
  }

  const topUserBadge = document.querySelector('.topbar-user-badge');
  if (topUserBadge) {
    topUserBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      window.openStaffLoginModal();
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
  window.submitSaveProduct = async () => {
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
    try {
      if (editId) {
        await store.updateProduct(editId, { brand, name, category, size, abv, sku, barcode, cost, price, reorder, highValue });
      } else {
        await store.addProduct({ brand, name, category, size, abv, sku, barcode, stock, cost, price, reorder, highValue });
      }
      window.closeModal('addProductModal');
      initApp();
      alert("Product saved successfully!");
    } catch (e) {
      alert("Error saving product: " + e.message);
    }
  };


  // Record Damage Modal Handlers
  window.handleRecordDamage = () => {
    requestManagerAuth("Record Damaged or Broken Bottle Write-Off", () => {
      window.openModal('damageBottleModal');
    });
  };

  window.submitDamageLog = async () => {
    const prodId = document.getElementById('damageProdSelect').value;
    const qty = parseInt(document.getElementById('damageQtyInput').value) || 1;
    const reason = document.getElementById('damageReasonInput').value.trim() || "Damaged/Broken Bottle";

    try {
      await store.recordStockDamage({ productId: prodId, qtyDamaged: qty, reason });
      window.closeModal('damageBottleModal');
      initApp();
      alert(`Damaged stock logged successfully.`);
    } catch (e) {
      alert("Error logging damage: " + e.message);
    }
  };

  // Cash Movement Modal Handlers
  window.handleRecordCashMovement = () => {
    requestManagerAuth("Authorize Cash Drawer Movement (Cash In / Cash Out)", () => {
      window.openModal('cashMovementModal');
    });
  };

  window.submitCashMovement = async () => {
    const type = document.getElementById('cashMoveTypeSelect').value;
    const amount = parseFloat(document.getElementById('cashMoveAmountInput').value) || 0;
    const reason = document.getElementById('cashMoveReasonInput').value.trim();

    if (amount <= 0) return alert("Please enter valid amount!");
    if (!reason) return alert("Mandatory reason required!");

    try {
      await store.logCashMovement({ type: type === 'CASH_OUT' ? 'OUT' : 'IN', amount, reason });
      window.closeModal('cashMovementModal');
      initApp();
      alert("Cash Movement logged successfully.");
    } catch (e) {
      alert("Error logging cash movement: " + e.message);
    }
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

  window.submitCloseShift = async () => {
    const actualCash = parseFloat(document.getElementById('shiftActualCashInput').value) || 0;
    const notes = document.getElementById('shiftNotesInput').value.trim();

    try {
      const result = await store.closeShift({ closingCash: actualCash, notes });
      window.closeModal('closeShiftModal');
      initApp();
      alert(`Shift closed successfully! Variance: KSh ${(result.variance || 0).toLocaleString()}`);
    } catch (e) {
      alert("Error closing shift: " + e.message);
    }
  };

  // Return Refund Handlers
  window.handleProcessReturn = () => {
    requestManagerAuth("Authorize Product Return / Refund", () => {
      window.openModal('returnRefundModal');
    });
  };

  window.submitProcessRefund = async () => {
    const receiptNo = document.getElementById('returnReceiptNoInput').value.trim();
    const reason = document.getElementById('returnReasonSelect').value;
    const amount = parseFloat(document.getElementById('refundAmountInput').value) || 0;

    if (!receiptNo || amount <= 0) return alert("Please enter valid Receipt # and Refund Amount!");

    try {
      await store.processRefund(receiptNo, { refundAmount: amount, reason, managerPin: '0000' });
      window.closeModal('returnRefundModal');
      initApp();
      alert(`Refund of KSh ${amount.toLocaleString()} approved for Receipt ${receiptNo}. Items restocked to database inventory!`);
    } catch (e) {
      alert("Error processing refund: " + e.message);
    }
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

  window.submitSaveSupplier = async () => {
    const name = document.getElementById('supNameInput').value.trim();
    const contact = document.getElementById('supContactInput').value.trim();
    const phone = document.getElementById('supPhoneInput').value.trim();
    const address = document.getElementById('supAddressInput').value.trim();

    if (!name || !phone) return alert("Please enter Supplier Name and Phone Number!");

    try {
      await store.addSupplier({ name, contactPerson: contact, phone, address });
      window.closeModal('supplierModal');
      initApp();
      alert("Supplier details saved successfully!");
    } catch (e) {
      alert("Error saving supplier: " + e.message);
    }
  };

  window.deleteSupplier = (id) => {
    const s = store.suppliers.find(x => x.id === id);
    if (!s) return;
    if (confirm(`Are you sure you want to delete supplier "${s.name}"?`)) {
      store.suppliers = store.suppliers.filter(x => x.id !== id);
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
        <option value="${s.id}" ${s.id === preselectSupplierId ? 'selected' : ''}>${s.name} (${s.phone || 'No Phone'})</option>
      `).join('') || '<option value="">No suppliers available</option>';
    }

    const prodSelect = document.getElementById('poProductSelect');
    if (prodSelect) {
      prodSelect.innerHTML = store.products.map(p => `
        <option value="${p.id}">${p.brand} ${p.name} (${p.size}) - Cost: KSh ${p.cost}</option>
      `).join('') || '<option value="">No products available</option>';
    }

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

  window.submitCreatePo = async () => {
    const supId = document.getElementById('poSupplierSelect').value;
    const sup = store.suppliers.find(s => s.id === supId);
    if (!sup) return alert("Please select a valid supplier!");

    if (window.poLineItems.length === 0) return alert("Please add at least one line item to PO!");

    const deliveryDate = document.getElementById('poDeliveryDateInput').value || new Date(Date.now() + 86400000*2).toISOString().split('T')[0];

    try {
      const po = await store.createPurchaseOrder({
        supplierId: sup.id,
        supplierName: sup.name,
        deliveryDate,
        items: window.poLineItems
      });
      window.closeModal('createPoModal');
      initApp();
      alert(`Purchase Order ${po.poNumber || po.id} issued to ${sup.name} successfully!`);
    } catch (e) {
      alert("Error creating PO: " + e.message);
    }
  };

  window.openReceiveGoodsModal = (poId) => {
    const po = store.purchases.find(p => p.id === poId);
    if (!po) return;

    document.getElementById('receivePoId').value = po.id;
    document.getElementById('receivePoSummaryBox').innerHTML = `
      <div style="font-size:13px; font-weight:700; color:var(--accent);">LPO: ${po.poNumber || po.id} — ${po.supplierName}</div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">
        Items to receive: ${(po.items || []).map(i => `<strong>${i.qtyOrdered}x ${i.name || i.productName}</strong>`).join(', ')}<br>
        Total Delivery Value: <strong>KSh ${(po.totalValue || 0).toLocaleString()}</strong>
      </div>
    `;
    window.openModal('receiveGoodsModal');
  };

  window.submitReceiveGoods = async () => {
    const poId = document.getElementById('receivePoId').value;
    const deliveryRef = document.getElementById('receiveDeliveryRefInput').value.trim();
    const notes = document.getElementById('receiveNotesInput').value.trim() || "Goods Received OK";

    if (!deliveryRef) return alert("Please enter Delivery Note / Invoice Ref Number!");

    try {
      await store.receivePurchaseOrder(poId, { deliveryRef, notes });
      window.closeModal('receiveGoodsModal');
      initApp();
      alert(`Goods Receipt Voucher GRN confirmed! Physical stock auto-replenished in database catalog.`);
    } catch (e) {
      alert("Error receiving goods: " + e.message);
    }
  };

  window.viewGoodsReceiptVoucher = (poId) => {
    const po = store.purchases.find(p => p.id === poId);
    if (!po) return;
    alert(`[GRN RECEIPT VOUCHER - ${po.poNumber || po.id}]\nSupplier: ${po.supplierName}\nStatus: ${po.status}\nTotal Value: KSh ${(po.totalValue || 0).toLocaleString()}`);
  };

  window.deletePurchaseOrder = (poId) => {
    if (confirm(`Delete purchase order ${poId}?`)) {
      store.purchases = store.purchases.filter(p => p.id !== poId);
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

  window.submitRecordExpense = async () => {
    const category = document.getElementById('expCategorySelect').value;
    const vendor = document.getElementById('expVendorInput').value.trim();
    const amount = parseFloat(document.getElementById('expAmountInput').value) || 0;
    const paymentMethod = document.getElementById('expPaymentMethodSelect').value;
    const notes = document.getElementById('expNotesInput').value.trim();

    if (!vendor || amount <= 0) return alert("Please enter valid Vendor and Amount!");

    try {
      await store.addExpense({ category, amount, description: `${vendor} - ${notes}`, receiptRef: vendor, paymentMethod });
      window.closeModal('expenseModal');
      initApp();
      alert(`Expense of KSh ${amount.toLocaleString()} logged under ${category}.`);
    } catch (e) {
      alert("Error logging expense: " + e.message);
    }
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

  window.submitSaveCustomer = async () => {
    const name = document.getElementById('custNameInput').value.trim();
    const phone = document.getElementById('custPhoneInput').value.trim();
    const email = document.getElementById('custEmailInput').value.trim();

    if (!name || !phone) return alert("Please enter Customer Name and Phone Number!");

    try {
      await store.addCustomer({ name, phone, email });
      window.closeModal('customerModal');
      initApp();
      alert("Customer saved successfully!");
    } catch (e) {
      alert("Error saving customer: " + e.message);
    }
  };

  window.deleteCustomer = (id) => {
    const c = store.customers.find(x => x.id === id);
    if (!c) return;
    if (confirm(`Delete customer "${c.name}"?`)) {
      store.customers = store.customers.filter(x => x.id !== id);
      initApp();
    }
  };

  // --- BRANCH & ENTERPRISE HANDLERS ---
  window.switchActiveBranch = (branchId) => {
    store.setActiveBranch(branchId);
    initApp();
  };

  // --- ADMINISTRATION CENTER HANDLERS ---
  window.submitSaveBusinessProfile = async () => {
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

    try {
      await store.updateSettings('businessProfile', {
        name, phone, email, address, kraPin, regNo, receiptName, receiptPhone, receiptAddress
      });
      initApp();
      alert("Business Profile saved successfully!");
    } catch (e) {
      alert("Error saving business profile: " + e.message);
    }
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
    const isOwner = store.currentUser?.role === 'owner';
    document.getElementById('staffModalTitle').textContent = "Add Staff Account";
    document.getElementById('staffEditId').value = "";
    document.getElementById('staffNameInput').value = "";
    document.getElementById('staffPhoneInput').value = "";
    document.getElementById('staffEmailInput').value = "";
    document.getElementById('staffPinInput').value = "";

    const roleSelect = document.getElementById('staffRoleSelect');
    if (roleSelect) {
      roleSelect.innerHTML = `
        ${isOwner ? '<option value="owner">OWNER (Business-wide full access)</option>' : ''}
        ${isOwner ? '<option value="manager">MANAGER (Branch operational admin)</option>' : ''}
        <option value="cashier" selected>CASHIER (POS & assigned drawer)</option>
        <option value="inventory_officer">INVENTORY OFFICER (Stock & purchasing)</option>
      `;
    }

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

    const isOwner = store.currentUser?.role === 'owner';
    if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can edit Manager or Owner staff accounts!");
    }

    document.getElementById('staffModalTitle').textContent = "Edit Staff Account";
    document.getElementById('staffEditId').value = u.id;
    document.getElementById('staffNameInput').value = u.name;
    document.getElementById('staffPhoneInput').value = u.phone || "";
    document.getElementById('staffEmailInput').value = u.email || "";

    const roleSelect = document.getElementById('staffRoleSelect');
    if (roleSelect) {
      roleSelect.innerHTML = `
        ${isOwner ? `<option value="owner" ${u.role === 'owner' ? 'selected' : ''}>OWNER (Business-wide full access)</option>` : ''}
        ${isOwner ? `<option value="manager" ${u.role === 'manager' ? 'selected' : ''}>MANAGER (Branch operational admin)</option>` : ''}
        <option value="cashier" ${u.role === 'cashier' ? 'selected' : ''}>CASHIER (POS & assigned drawer)</option>
        <option value="inventory_officer" ${u.role === 'inventory_officer' ? 'selected' : ''}>INVENTORY OFFICER (Stock & purchasing)</option>
      `;
    }

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
    const isOwner = store.currentUser?.role === 'owner';
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

    if (!isOwner && (role === 'manager' || role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can register or assign Manager/Owner accounts!");
    }

    const editId = document.getElementById('staffEditId').value;
    if (editId) {
      const u = store.users.find(x => x.id === editId);
      if (u) {
        if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
          return alert("Access Denied: Managers cannot modify Manager or Owner accounts!");
        }
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
    const isOwner = store.currentUser?.role === 'owner';
    if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can deactivate Manager or Owner accounts!");
    }
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
    const isOwner = store.currentUser?.role === 'owner';
    if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can reset Security PINs for Manager or Owner accounts!");
    }

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
