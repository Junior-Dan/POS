import { store, setAuthToken, getAuthToken, clearAuthToken } from './store/CellarStore.js';
import { INITIAL_USERS } from './data/initialUsers.js';
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
import { renderUpdateStockModal } from './components/UpdateStockModal.js';
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
import { renderStaffModal } from './components/StaffModal.js';
import { renderResetPinModal } from './components/ResetPinModal.js';
import { renderForgotPasswordModal } from './components/ForgotPasswordModal.js';
import { renderBranchModal } from './components/BranchModal.js';
import { renderAuthLandingScreen } from './components/SetupScreen.js';

// Remember the last-opened view across reloads (per tab) so a refresh keeps the
// user on the same page instead of snapping back to the Dashboard.
function readPersistedView() {
  try { return sessionStorage.getItem('cellar_active_view') || null; } catch (e) { return null; }
}
let activeViewId = readPersistedView() || 'dashboard';

// Safely read a JSON body. Some responses (proxy 401s, gateway errors, empty
// 204s, HTML error pages) have no/invalid JSON, which makes res.json() throw
// "Unexpected end of JSON input" and masks the real HTTP error. This returns
// {} for an empty body, or {error:<snippet>} for a non-JSON body, so callers
// can surface a meaningful message using res.ok / res.status instead.
async function readJsonSafe(res) {
  let text = '';
  try { text = await res.text(); } catch (e) { return {}; }
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) };
  }
}

// Auth tab is chosen at render time: LOGIN when a branch roster exists,
// otherwise CREATE ACCOUNT (first-run owner setup). null = auto-select.
window.currentAuthTab = null;

window.switchAuthTab = (tab) => {
  window.currentAuthTab = tab;
  const root = document.getElementById('app-root');
  if (root) {
    root.innerHTML = renderAuthLandingScreen(tab);
  }
};

window.logoutUser = () => {
  store.resetState();
  clearAuthToken();
  try {
    sessionStorage.removeItem('cellar_session_auth');
    sessionStorage.removeItem('cellar_authenticated_user');
    sessionStorage.removeItem('cellar_active_view');
  } catch (e) {}
  initApp();
};

export function initApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  // If unauthenticated, render the single full-screen Auth Landing Page:
  // first run (no owner yet) shows Owner Setup; otherwise the one unified
  // email + password Sign In form used by the owner and all staff alike.
  if (!store.currentUser || !store.currentUser.id) {
    root.innerHTML = `
      ${renderAuthLandingScreen()}
      <div id="modals-root">
        ${renderForgotPasswordModal()}
      </div>
    `;
    bindEvents();
    return;
  }

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
      ${renderUpdateStockModal()}
      ${renderDamageBottleModal()}
      ${renderCashMovementModal()}
      ${renderCloseShiftModal()}
      ${renderReturnRefundModal()}
      ${renderSupplierModal()}
      ${renderPurchaseOrderModal()}
      ${renderExpenseModal()}
      ${renderCustomerModal()}
      ${renderStaffModal()}
      ${renderResetPinModal()}
      ${renderForgotPasswordModal()}
      ${renderBranchModal()}
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

  // Notifications Popover & Toast Banner Engine
  const notifBtn = document.getElementById('topbarNotificationBtn');
  const notifPopover = document.getElementById('notificationsPopover');
  if (notifBtn && notifPopover) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPopover.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (notifPopover && notifPopover.classList.contains('active') && !notifPopover.contains(e.target) && !notifBtn.contains(e.target)) {
        notifPopover.classList.remove('active');
      }
    });
  }

  window.markAllNotificationsRead = () => {
    store.markNotificationsRead();
    initApp();
  };

  window.showToastNotification = (notif) => {
    let container = document.getElementById('globalToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'globalToastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-banner ${notif.type || 'shift'}`;
    toast.innerHTML = `
      <div style="width:32px; height:32px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      </div>
      <div class="toast-body">
        <div class="toast-title">🔔 ${notif.title}</div>
        <div class="toast-desc">${notif.message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentElement) toast.remove();
    }, 6000);
  };

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

  window.submitInitialSetup = async () => {
    const name = document.getElementById('setupNameInput')?.value.trim();
    const phone = document.getElementById('setupPhoneInput')?.value.trim() || "";
    const email = document.getElementById('setupEmailInput')?.value.trim() || "";
    const password = document.getElementById('setupPasswordInput')?.value.trim() || document.getElementById('setupPinInput')?.value.trim() || "";
    const confirmPassword = document.getElementById('setupConfirmPasswordInput')?.value.trim() || document.getElementById('setupConfirmPinInput')?.value.trim() || "";
    const businessName = document.getElementById('setupBizNameInput')?.value.trim() || "Celler POS";
    const err = document.getElementById('setupErrorMsg');

    if (!name) {
      if (err) err.textContent = "Please enter Owner Full Name!";
      return;
    }
    if (!email) {
      if (err) err.textContent = "Please enter Email Address!";
      return;
    }
    if (!password || password.length < 4) {
      if (err) err.textContent = "Please enter a password (at least 4 characters)!";
      return;
    }
    if (confirmPassword && confirmPassword !== password) {
      if (err) err.textContent = "Password and Confirm Password do not match!";
      return;
    }

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password, confirmPassword, businessName })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Failed to set up account (HTTP ${res.status}).`);
      }

      if (data.token) {
        setAuthToken(data.token);
        try { sessionStorage.setItem('cellar_session_auth', 'true'); } catch (e) {}
      }

      try { localStorage.setItem('cellar_owner_exists', '1'); } catch (e) {}
      window.forceRegisterMode = false;

      store.currentUser = { ...data.user, token: data.token || getAuthToken() };
      if (data.user && data.user.organizationName) {
        store.businessProfile = { ...store.businessProfile, name: data.user.organizationName, receiptName: String(data.user.organizationName).toUpperCase() };
      }
      if (!store.loginUsers || store.loginUsers.length === 0) {
        store.loginUsers = [store.currentUser];
      }
      if (data.branch && data.branch.id) store.activeBranchId = data.branch.id;

      activeViewId = 'dashboard';
      await store.loadAuthenticatedData();
      store.fetchBranchLogin();
      store.saveLocalBackup();
      initApp();
    } catch (e) {
      if (err) {
        if (e.message && (e.message.includes('already exists') || e.message.includes('already in use'))) {
          err.innerHTML = `
            <div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); border-radius:10px; padding:12px; margin-top:12px; text-align:center;">
              <div style="color:#ef4444; font-weight:800; font-size:13px; margin-bottom:8px;">⚠️ ${e.message}</div>
              <button type="button" class="btn btn-primary btn-sm" onclick="switchAuthMode('login')" style="font-weight:700; padding:6px 14px; font-size:12px;">🔑 Switch to Log In</button>
            </div>
          `;
        } else {
          err.textContent = e.message;
        }
      }
    }
  };

  window.switchAuthMode = (mode) => {
    if (mode === 'setup') {
      window.forceRegisterMode = true;
    } else {
      window.forceRegisterMode = false;
    }
    const root = document.getElementById('app-root');
    if (root) {
      root.innerHTML = renderAuthLandingScreen(mode);
      bindEvents();
    }
  };

  window.enterDashboardAfterSetup = () => {
    activeViewId = 'dashboard';
    initApp();
  };

  window.togglePasswordInputVisibility = () => {
    const input = document.getElementById('loginPasswordInput');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  };

  window.submitMainLogin = async () => {
    if (window._isSubmittingMainLogin) return;
    const emailInput = document.getElementById('loginEmailInput');
    const passwordInput = document.getElementById('loginPasswordInput');
    const errDiv = document.getElementById('loginEmailErrorMsg');

    const email = (emailInput?.value || '').trim();
    const password = (passwordInput?.value || '').trim();

    if (!email || !password) {
      if (errDiv) errDiv.textContent = 'Please enter both email and password.';
      return;
    }

    window._isSubmittingMainLogin = true;
    if (errDiv) errDiv.textContent = 'Authenticating...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: email, password, pin: password })
      });

      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Invalid credentials! Access Denied. (HTTP ${res.status})`);
      }

      if (data.token) {
        setAuthToken(data.token);
        try { sessionStorage.setItem('cellar_session_auth', 'true'); } catch (e) {}
      }

      store.currentUser = { ...data.user, token: data.token || getAuthToken() };
      if (data.user && data.user.organizationName) {
        store.businessProfile = { ...store.businessProfile, name: data.user.organizationName, receiptName: String(data.user.organizationName).toUpperCase() };
      }
      try { sessionStorage.setItem('cellar_authenticated_user', data.user.id); } catch (e) {}

      store.activeBranchId = data.user.branchId || (String(data.user.role||"").toLowerCase() === "owner" ? "ALL" : store.activeBranchId);

      const roleMap = {
        owner: 'dashboard',
        manager: 'dashboard',
        inventory_officer: 'inventory',
        cashier: 'pos'
      };
      activeViewId = roleMap[(data.user.role || '').toLowerCase()] || 'pos';

      window._isSubmittingMainLogin = false;
      if (errDiv) errDiv.textContent = '';

      await store.loadAuthenticatedData();
      initApp();
      store.logAudit("Main Account Login", data.user.name, "-", data.user.role, "Authenticated via Email/Password");
    } catch (e) {
      window._isSubmittingMainLogin = false;
      if (errDiv) errDiv.textContent = e.message || 'Invalid email or password! Access Denied.';
    }
  };

  window.openForgotPasswordModal = () => {
    const emailIn = document.getElementById('loginEmailInput');
    const forgotEmail = document.getElementById('forgotEmailInput');
    const msg = document.getElementById('forgotModalMsg');
    const step2 = document.getElementById('forgotStep2Area');
    const submitBtn = document.getElementById('submitForgotBtn');

    if (forgotEmail && emailIn && emailIn.value) {
      forgotEmail.value = emailIn.value.trim();
    }
    if (msg) msg.textContent = '';
    if (step2) step2.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Code';
      submitBtn.onclick = () => window.submitForgotPassword();
    }
    window.openModal('forgotPasswordModal');
  };

  window.submitForgotPassword = async () => {
    const email = document.getElementById('forgotEmailInput')?.value.trim();
    const msg = document.getElementById('forgotModalMsg');
    const step2 = document.getElementById('forgotStep2Area');
    const submitBtn = document.getElementById('submitForgotBtn');

    if (!email) {
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = 'Please enter your email address.';
      }
      return;
    }

    if (msg) {
      msg.style.color = '#6366f1';
      msg.textContent = 'Sending one-time reset code...';
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Request failed (HTTP ${res.status}).`);
      }

      if (msg) {
        msg.style.color = '#10b981';
        msg.textContent = '✅ A one-time reset code was sent to your email. Enter the code and your new password below.';
      }
      if (step2) step2.style.display = 'flex';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
        submitBtn.onclick = () => window.submitResetPasswordDirect();
      }
    } catch (e) {
      if (submitBtn) submitBtn.disabled = false;
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = e.message;
      }
    }
  };

  window.submitResetPasswordDirect = async () => {
    const email = document.getElementById('forgotEmailInput')?.value.trim();
    const resetCode = document.getElementById('resetCodeInput')?.value.trim();
    const newPassword = document.getElementById('resetNewPasswordInput')?.value.trim();
    const confirmPassword = document.getElementById('resetConfirmPasswordInput')?.value.trim();
    const msg = document.getElementById('forgotModalMsg');
    const submitBtn = document.getElementById('submitForgotBtn');

    if (!resetCode) {
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = 'Please enter the reset code sent to your email.';
      }
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = 'Password must be at least 4 characters.';
      }
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = 'New Password and Confirm Password do not match.';
      }
      return;
    }

    if (msg) {
      msg.style.color = '#6366f1';
      msg.textContent = 'Updating password in Supabase Auth & database...';
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetCode, newPassword, confirmPassword })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Failed to reset password (HTTP ${res.status}).`);
      }

      alert('Password reset successfully! You can now sign in with your new password.');
      window.closeModal('forgotPasswordModal');
      const loginPassInput = document.getElementById('loginPasswordInput');
      if (loginPassInput) loginPassInput.value = newPassword;
    } catch (e) {
      if (submitBtn) submitBtn.disabled = false;
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = e.message;
      }
    }
  };

  window.lockTerminal = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    clearAuthToken();
    try {
      sessionStorage.removeItem('cellar_session_auth');
      sessionStorage.removeItem('cellar_authenticated_user');
    } catch (e) {}
    store.currentUser = null;
    // Refresh the branch roster and return to the standalone login screen.
    await store.fetchBranchLogin();
    window.currentAuthTab = 'login';
    initApp();
  };

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
    let category = document.getElementById('prodCategorySelect').value;
    if (category === '__custom__') {
      category = (document.getElementById('prodCustomCategoryInput')?.value || '').trim();
      if (!category) {
        return alert("Please enter the custom category name!");
      }
    }
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

  // Update Stock Modal Handlers
  window.openUpdateStockModal = (id) => {
    const p = store.products.find(x => x.id === id);
    if (!p) return;
    requestManagerAuth(`Update Stock Quantity for ${p.brand || ''} ${p.name || ''}`, () => {
      document.getElementById('stockUpdateProdId').value = p.id;
      document.getElementById('stockUpdateProdDisplay').textContent = `${p.brand || ''} ${p.name || ''} (${p.size || '750 ml'})`;
      document.getElementById('stockUpdateQtyInput').value = p.stock !== undefined ? p.stock : (p.current_stock || 0);
      document.getElementById('stockUpdateReasonInput').value = "";
      window.openModal('updateStockModal');
    });
  };

  window.submitStockUpdate = async () => {
    const prodId = document.getElementById('stockUpdateProdId').value;
    const newQty = parseInt(document.getElementById('stockUpdateQtyInput').value);
    const reason = document.getElementById('stockUpdateReasonInput').value.trim() || "Manual Stock Adjustment";

    if (!prodId) return;
    if (isNaN(newQty) || newQty < 0) {
      return alert("Please enter a valid non-negative quantity.");
    }

    try {
      await store.updateProductStock(prodId, newQty, reason);
      window.closeModal('updateStockModal');
      initApp();
      alert("Stock quantity updated successfully!");
    } catch (e) {
      alert("Error updating stock quantity: " + e.message);
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


  window.openAddStaffModal = () => {
    window._isSubmittingStaff = false;
    const isOwner = store.currentUser?.role === 'owner';
    const title = document.getElementById('staffModalTitle');
    if (title) title.textContent = "Add Staff Account";
    const editId = document.getElementById('staffEditId');
    if (editId) editId.value = "";
    const nameIn = document.getElementById('staffNameInput');
    if (nameIn) nameIn.value = "";
    const phoneIn = document.getElementById('staffPhoneInput');
    if (phoneIn) phoneIn.value = "";
    const emailIn = document.getElementById('staffEmailInput');
    if (emailIn) emailIn.value = "";
    const pinIn = document.getElementById('staffPinInput');
    if (pinIn) pinIn.value = "";

    const errDiv = document.getElementById('staffModalErrorMsg');
    if (errDiv) errDiv.textContent = "";

    const saveBtn = document.getElementById('saveStaffSubmitBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Staff Account';
    }

    const roleSelect = document.getElementById('staffRoleSelect');
    if (roleSelect) {
      roleSelect.innerHTML = `
        ${isOwner ? '<option value="manager">MANAGER (Operational admin)</option>' : ''}
        <option value="cashier" selected>CASHIER (POS & assigned drawer)</option>
        <option value="inventory_officer">INVENTORY OFFICER (Stock & purchasing)</option>
      `;
    }

    const branchSelect = document.getElementById('staffBranchSelect');
    if (branchSelect) {
      const branches = store.branches || [];
      // Owners may pick any branch; managers can only add staff to their own.
      const preferred = isOwner
        ? (branches[0] && branches[0].id)
        : (store.currentUser?.branchId || (branches[0] && branches[0].id));
      branchSelect.innerHTML = branches.length
        ? branches.map(b => `<option value="${b.id}" ${b.id === preferred ? 'selected' : ''}>${b.name}${b.code ? ` (${b.code})` : ''}</option>`).join('')
        : `<option value="">No branches configured</option>`;
      branchSelect.disabled = !isOwner;
    }

    window.openModal('staffModal');
  };

  window.openEditStaffModal = (id) => {
    window._isSubmittingStaff = false;
    const u = store.users.find(x => x.id === id);
    if (!u) return;

    const isOwner = store.currentUser?.role === 'owner';
    if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can edit Manager or Owner staff accounts!");
    }

    const errDiv = document.getElementById('staffModalErrorMsg');
    if (errDiv) errDiv.textContent = "";

    const saveBtn = document.getElementById('saveStaffSubmitBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Staff Account';
    }

    const title = document.getElementById('staffModalTitle');
    if (title) title.textContent = "Edit Staff Account";
    const editId = document.getElementById('staffEditId');
    if (editId) editId.value = u.id;
    const nameIn = document.getElementById('staffNameInput');
    if (nameIn) nameIn.value = u.name;
    const phoneIn = document.getElementById('staffPhoneInput');
    if (phoneIn) phoneIn.value = u.phone || "";
    const emailIn = document.getElementById('staffEmailInput');
    if (emailIn) emailIn.value = u.email || "";

    const roleSelect = document.getElementById('staffRoleSelect');
    if (roleSelect) {
      if (u.role === 'owner') {
        // The owner's own role is fixed — shown read-only, never reassignable.
        roleSelect.innerHTML = `<option value="owner" selected>OWNER (Full access)</option>`;
      } else {
        roleSelect.innerHTML = `
          ${isOwner ? `<option value="manager" ${u.role === 'manager' ? 'selected' : ''}>MANAGER (Operational admin)</option>` : ''}
          <option value="cashier" ${u.role === 'cashier' ? 'selected' : ''}>CASHIER (POS & assigned drawer)</option>
          <option value="inventory_officer" ${u.role === 'inventory_officer' ? 'selected' : ''}>INVENTORY OFFICER (Stock & purchasing)</option>
        `;
      }
    }

    const branchSelect = document.getElementById('staffBranchSelect');
    if (branchSelect) {
      const branches = store.branches || [];
      const current = u.branchId || u.primaryBranchId || u.branch_id || '';
      branchSelect.innerHTML = branches.length
        ? branches.map(b => `<option value="${b.id}" ${b.id === current ? 'selected' : ''}>${b.name}${b.code ? ` (${b.code})` : ''}</option>`).join('')
        : `<option value="">No branches configured</option>`;
      // Only owners may move staff between branches (backend enforces this too).
      branchSelect.disabled = !isOwner;
    }

    document.getElementById('staffStatusSelect').value = u.status || "ACTIVE";
    document.getElementById('staffPinInput').value = ""; // Masked PIN!

    window.openModal('staffModal');
  };

  window.generateRandomStaffPassword = () => {
    const passInput = document.getElementById('staffPinInput');
    if (!passInput) return;
    // Genuinely random, mixed-character password (CSPRNG when available).
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*?';
    const all = upper + lower + digits + symbols;
    const rnd = (n) => (window.crypto && window.crypto.getRandomValues)
      ? window.crypto.getRandomValues(new Uint32Array(1))[0] % n
      : Math.floor(Math.random() * n);
    const pick = (set) => set[rnd(set.length)];
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < 10) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    passInput.value = chars.join('');
  };

  window.shareStaffLoginLink = (userOrId, suppliedPin = '') => {
    let user = typeof userOrId === 'object' && userOrId ? userOrId : (store.users || []).find(u => u.id === userOrId);
    if (!user) {
      user = {
        id: userOrId,
        email: document.getElementById('staffEmailInput')?.value || '',
        name: document.getElementById('staffNameInput')?.value || '',
        role: document.getElementById('staffRoleSelect')?.value || 'cashier'
      };
    }

    const bizName = store.businessProfile?.name || 'Celler POS';

    const pass = suppliedPin || user.temporaryPassword || user.pin || '••••';

    const nameVal = document.getElementById('shareStaffNameVal');
    const emailVal = document.getElementById('shareStaffEmailVal');
    const passVal = document.getElementById('shareStaffPassVal');
    const msgText = document.getElementById('shareStaffMessageText');

    if (nameVal) nameVal.textContent = `${user.name} (${(user.role || 'cashier').toUpperCase()})`;
    if (emailVal) emailVal.textContent = user.email || 'Not set';
    if (passVal) passVal.textContent = pass;

    const formattedMsg = `Welcome to ${bizName}!\nHere are your staff login credentials:\n\nRole: ${(user.role || 'cashier').toUpperCase()}\nEmail: ${user.email || 'your email'}\nPassword / Temporary Password: ${pass}\n\nLog in at: ${window.location.origin}`;
    if (msgText) msgText.value = formattedMsg;

    window.openModal('shareStaffModal');
  };

  window.copyStaffInviteDetails = () => {
    const msgText = document.getElementById('shareStaffMessageText');
    if (msgText && msgText.value) {
      navigator.clipboard.writeText(msgText.value);
      alert('Staff login credentials copied to clipboard!');
    }
  };

  window.submitSaveStaff = async () => {
    if (window._isSubmittingStaff) return;
    const isOwner = store.currentUser?.role === 'owner';
    const name = document.getElementById('staffNameInput')?.value.trim() || '';
    const phone = document.getElementById('staffPhoneInput')?.value.trim() || '';
    const email = document.getElementById('staffEmailInput')?.value.trim() || '';
    const role = document.getElementById('staffRoleSelect')?.value || 'cashier';
    const status = document.getElementById('staffStatusSelect')?.value || 'ACTIVE';
    const pin = document.getElementById('staffPinInput')?.value.trim() || '';
    const branchId = document.getElementById('staffBranchSelect')?.value || '';
    const errDiv = document.getElementById('staffModalErrorMsg');

    if (errDiv) errDiv.textContent = '';

    if (!name) {
      if (errDiv) errDiv.textContent = "Please enter Staff Name!";
      else alert("Please enter Staff Name!");
      return;
    }
    if (!email) {
      if (errDiv) errDiv.textContent = "Please enter Staff Email Address so they can log in!";
      else alert("Please enter Staff Email Address so they can log in!");
      return;
    }

    if (!isOwner && (role === 'manager' || role === 'owner')) {
      if (errDiv) errDiv.textContent = "Access Denied: Only the Business Owner can register or assign Manager/Owner accounts!";
      else alert("Access Denied: Only the Business Owner can register or assign Manager/Owner accounts!");
      return;
    }

    const token = getAuthToken() || store.currentUser?.token || '';
    if (!token) {
      alert("Session expired. Please log in to manage staff.");
      window.logoutUser();
      return;
    }

    const editId = document.getElementById('staffEditId')?.value || '';
    const saveBtn = document.getElementById('saveStaffSubmitBtn');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving Staff Account...';
    }
    window._isSubmittingStaff = true;
    let savedUser = null;

    try {
      if (editId) {
        const res = await fetch(`/api/auth/users/${editId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, phone, email, role, status, pin, primaryBranchId: branchId })
        });
        const data = await readJsonSafe(res);
        if (!res.ok) throw new Error(data.error || `Failed to update staff (HTTP ${res.status}).`);
        savedUser = data;
        store.logAudit("Updated Staff Member", name, "-", `Role: ${role.toUpperCase()}`, "Staff Account Modified");
      } else {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, phone, email, role, status, pin, primaryBranchId: branchId })
        });
        const data = await readJsonSafe(res);
        if (!res.ok) throw new Error(data.error || `Failed to create staff (HTTP ${res.status}).`);
        savedUser = data;
        store.logAudit("Created Staff Account", name, "-", `Role: ${role.toUpperCase()}`, "Staff Registered");
      }

      if (savedUser) {
        const existingIdx = (store.users || []).findIndex(u => u.id === savedUser.id);
        if (existingIdx >= 0) {
          store.users[existingIdx] = { ...store.users[existingIdx], ...savedUser };
        } else {
          if (!store.users) store.users = [];
          store.users.unshift(savedUser);
        }
      }

      window.closeModal('staffModal');
      initApp();

      if (savedUser) {
        const displayPass = pin || savedUser.temporaryPassword || '••••';
        window.shareStaffLoginLink(savedUser, displayPass);
      }

      store.fetchUsers().catch(() => {});
    } catch (e) {
      const currentErrDiv = document.getElementById('staffModalErrorMsg');
      if (currentErrDiv) currentErrDiv.textContent = e.message;
      else alert("Error saving staff account: " + e.message);
    } finally {
      window._isSubmittingStaff = false;
      const currentBtn = document.getElementById('saveStaffSubmitBtn');
      if (currentBtn) {
        currentBtn.disabled = false;
        currentBtn.textContent = 'Save Staff Account';
      }
    }
  };

  window.deleteStaff = async (id) => {
    const u = store.users.find(x => x.id === id);
    if (!u) return;
    const isOwner = store.currentUser?.role === 'owner';
    if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can deactivate Manager or Owner accounts!");
    }

    const token = getAuthToken() || store.currentUser?.token || '';
    if (!token) {
      alert("Session expired. Please log in with your PIN to perform staff management.");
      window.logoutUser();
      return;
    }

    if (confirm(`Deactivate staff account "${u.name}"?`)) {
      try {
        await fetch(`/api/auth/users/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: "INACTIVE", active: 0 })
        });
        store.logAudit("Deactivated Staff Account", u.name, "-", "-", "Account Deactivated");
        await store.fetchUsers();
        initApp();
      } catch (e) {
        alert("Error deactivating staff: " + e.message);
      }
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

  window.submitResetPin = async () => {
    const userId = document.getElementById('resetPinUserId').value;
    const newPin = document.getElementById('newPinInput').value.trim();
    const confirmPin = document.getElementById('confirmNewPinInput').value.trim();

    if (!newPin || newPin.length < 4) return alert("Please enter a 4-digit new PIN!");
    if (confirmPin && newPin !== confirmPin) return alert("New PIN and Confirm PIN do not match!");

    const token = getAuthToken() || store.currentUser?.token || '';
    if (!token) {
      alert("Session expired. Please log in with your PIN to reset staff PINs.");
      window.logoutUser();
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, newPin, confirmPin })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data.error || `Failed to reset PIN (HTTP ${res.status}).`);

      await store.fetchUsers();
      window.closeModal('resetPinModal');
      alert("Security PIN reset successfully!");
    } catch (e) {
      alert("Error resetting PIN: " + e.message);
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
      headerText: headerText || "CELLER POS",
      footerText: footerText || "Thank you for shopping at Celler POS!"
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

  // Branch & Commodity Outlet Handlers
  window.openAddBranchModal = () => {
    document.getElementById('branchModalTitle').textContent = "Add New Branch / Commodity Outlet";
    document.getElementById('branchEditId').value = "";
    document.getElementById('branchNameInput').value = "";
    document.getElementById('branchCodeInput').value = "";
    document.getElementById('branchCommoditySelect').value = "Water & Beverages";
    document.getElementById('branchCustomCommodityContainer').style.display = "none";
    document.getElementById('branchLocationInput').value = "";
    document.getElementById('branchPhoneInput').value = "";
    document.getElementById('branchHoursInput').value = "08:00 AM - 10:00 PM";
    document.getElementById('branchStatusSelect').value = "ACTIVE";

    const mgrSelect = document.getElementById('branchManagerSelect');
    if (mgrSelect) {
      mgrSelect.innerHTML = `<option value="">-- Assign Manager (Optional) --</option>` +
        (store.users || []).map(u => `<option value="${u.name}">${u.name} (${u.role})</option>`).join('');
    }

    window.openModal('branchModal');
  };

  window.openEditBranchModal = (id) => {
    const b = (store.branches || []).find(x => x.id === id);
    if (!b) return;
    document.getElementById('branchModalTitle').textContent = `Edit Branch: ${b.name}`;
    document.getElementById('branchEditId').value = b.id;
    document.getElementById('branchNameInput').value = b.name || "";
    document.getElementById('branchCodeInput').value = b.code || "";
    
    const commSelect = document.getElementById('branchCommoditySelect');
    const existingType = b.commodityType || b.commodity_type || 'Water & Beverages';
    const hasOpt = Array.from(commSelect.options).some(o => o.value === existingType);
    if (hasOpt) {
      commSelect.value = existingType;
      document.getElementById('branchCustomCommodityContainer').style.display = "none";
    } else {
      commSelect.value = "__custom__";
      document.getElementById('branchCustomCommodityContainer').style.display = "block";
      document.getElementById('branchCustomCommodityInput').value = existingType;
    }

    document.getElementById('branchLocationInput').value = b.location || "";
    document.getElementById('branchPhoneInput').value = b.phone || "";
    document.getElementById('branchHoursInput').value = b.operatingHours || "08:00 AM - 10:00 PM";
    document.getElementById('branchStatusSelect').value = b.status || "ACTIVE";

    window.openModal('branchModal');
  };

  window.submitSaveBranch = async () => {
    const name = document.getElementById('branchNameInput').value.trim();
    const code = document.getElementById('branchCodeInput').value.trim();
    let commodityType = document.getElementById('branchCommoditySelect').value;
    if (commodityType === '__custom__') {
      commodityType = (document.getElementById('branchCustomCommodityInput')?.value || '').trim();
      if (!commodityType) {
        return alert("Please enter the custom commodity name!");
      }
    }
    const location = document.getElementById('branchLocationInput').value.trim();
    const phone = document.getElementById('branchPhoneInput').value.trim();
    const manager = document.getElementById('branchManagerSelect')?.value || "";
    const operatingHours = document.getElementById('branchHoursInput').value.trim() || "08:00 AM - 10:00 PM";
    const status = document.getElementById('branchStatusSelect').value;
    const editId = document.getElementById('branchEditId').value;

    if (!name) return alert("Please enter Branch Name!");

    try {
      if (editId) {
        // Edit → update in place (never create a duplicate branch).
        await store.updateBranch(editId, { name, code, commodityType, location, phone, manager, operatingHours, status });
      } else {
        await store.createBranch({ name, code, commodityType, location, phone, manager, operatingHours, status });
      }
      window.closeModal('branchModal');
      initApp();
      alert("Branch configured successfully!");
    } catch (e) {
      alert("Error saving branch: " + e.message);
    }
  };

  // Global Universal Topbar Search Logic
  const globalInput = document.getElementById('globalSearchInput');
  const globalPopover = document.getElementById('globalSearchResultsPopover');

  window.handleGlobalSearchSelect = (productId) => {
    if (globalPopover) globalPopover.style.display = 'none';
    if (globalInput) globalInput.value = '';
    
    if (store.canUserAccessView(store.currentUser, 'pos')) {
      switchTab('pos');
      if (window.addToCart) {
        window.addToCart(productId);
      }
    } else {
      switchTab('products');
    }
  };

  if (globalInput) {
    const handleGlobalSearch = () => {
      const q = globalInput.value.trim().toLowerCase();

      // Synchronize with POS search input if on POS view
      const posInput = document.getElementById('posSearchInput');
      if (posInput && activeViewId === 'pos') {
        posInput.value = globalInput.value;
        const grid = document.getElementById('posProductGrid');
        if (grid && window.renderProductGridHtml) {
          grid.innerHTML = window.renderProductGridHtml();
        }
      }

      // Synchronize with Products Table filter if on Products view
      if (activeViewId === 'products') {
        const rows = document.querySelectorAll('#productsTableBody tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = !q || text.includes(q) ? '' : 'none';
        });
      }

      // Show floating popover results if query is typed
      if (!q || !globalPopover) {
        if (globalPopover) globalPopover.style.display = 'none';
        return;
      }

      const matches = (store.products || []).filter(p => {
        if (!p.active) return false;
        const nameStr = (p.name || '').toLowerCase();
        const brandStr = (p.brand || '').toLowerCase();
        const catStr = (p.category || '').toLowerCase();
        const skuStr = (p.sku || '').toLowerCase();
        const barcodeStr = String(p.barcode || '').toLowerCase();
        return nameStr.includes(q) || brandStr.includes(q) || catStr.includes(q) || skuStr.includes(q) || barcodeStr.includes(q);
      }).slice(0, 8);

      if (matches.length === 0) {
        globalPopover.innerHTML = `<div style="padding:12px; text-align:center; color:var(--text-faint); font-size:12px;">No matching products found</div>`;
      } else {
        globalPopover.innerHTML = matches.map(p => {
          const price = p.price !== undefined ? p.price : (p.selling_price || 0);
          const stock = p.stock !== undefined ? p.stock : (p.current_stock || 0);
          return `
            <div class="global-search-item" onclick="handleGlobalSearchSelect('${p.id}')">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--text);">${p.brand || ''} ${p.name || ''}</div>
                <div style="font-size:11px; color:var(--text-faint);">${p.category || 'Spirits'} • ${p.size || '750ml'} • SKU: ${p.sku || 'N/A'}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:800; font-size:13px; color:var(--accent);">KSh ${Number(price).toLocaleString()}</div>
                <div style="font-size:10.5px; color:${stock > 0 ? 'var(--green-text)' : 'var(--red-text)'};">${stock > 0 ? `Stock: ${stock}` : 'Out of stock'}</div>
              </div>
            </div>
          `;
        }).join('');
      }
      globalPopover.style.display = 'block';
    };

    globalInput.addEventListener('input', handleGlobalSearch);
    globalInput.addEventListener('focus', handleGlobalSearch);

    globalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = globalInput.value.trim().toLowerCase();
        if (!q) return;
        if (globalPopover) globalPopover.style.display = 'none';
        
        if (activeViewId !== 'pos') {
          switchTab('pos');
        }
        const posInput = document.getElementById('posSearchInput');
        if (posInput) {
          posInput.value = globalInput.value;
          const grid = document.getElementById('posProductGrid');
          if (grid && window.renderProductGridHtml) {
            grid.innerHTML = window.renderProductGridHtml();
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-search-container') && globalPopover) {
        globalPopover.style.display = 'none';
      }
    });
  }

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
  // Persist so a page refresh reopens this same view instead of the Dashboard.
  try { sessionStorage.setItem('cellar_active_view', viewId); } catch (e) {}
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

// Bootstrap: paint immediately, then re-render once the store has resolved the
// session/branch roster (session restore + branch-info are async).
function bootstrap() {
  initApp();
  if (store.readyPromise && typeof store.readyPromise.then === 'function') {
    store.readyPromise.then(() => initApp()).catch(() => {});
  }
}
document.addEventListener('DOMContentLoaded', bootstrap);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  bootstrap();
}
