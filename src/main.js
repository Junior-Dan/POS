import { store } from './store/CellarStore.js';
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
import { renderAuthLandingScreen } from './components/SetupScreen.js';

let activeViewId = 'dashboard';
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
  store.currentUser = null;
  localStorage.removeItem('cellar_token');
  sessionStorage.removeItem('cellar_session_auth');
  sessionStorage.removeItem('cellar_authenticated_user');
  initApp();
};

export function initApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  // If unauthenticated, render the standalone full-screen Auth Landing Page.
  // Main URL (no ?branch=) shows Create Account setup form only.
  // Shared branch URL (?branch=code) shows Branch Log In screen only.
  if (!store.currentUser || !store.currentUser.id) {
    root.innerHTML = renderAuthLandingScreen();
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
  // Clear PIN pad state when switching selected user account in login dropdown
  const loginSelect = document.getElementById('loginUserSelect');
  if (loginSelect) {
    loginSelect.addEventListener('change', () => {
      window.clearLoginPin();
    });
  }

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

  // Interactive Staff Login & Role Switcher
  window.loginEnteredPin = "";
  window._isSubmittingPin = false;

  window.openInitialSetupModal = () => {
    const err = document.getElementById('setupErrorMsg');
    if (err) err.textContent = "";
    window.closeModal('userLoginModal');
    window.openModal('setupModal');
  };

  window.submitInitialSetup = async () => {
    const name = document.getElementById('setupNameInput').value.trim();
    const phone = document.getElementById('setupPhoneInput')?.value.trim() || "";
    const email = document.getElementById('setupEmailInput').value.trim();
    const pin = document.getElementById('setupPinInput').value.trim();
    const confirmPin = document.getElementById('setupConfirmPinInput')?.value.trim() || "";
    const businessName = document.getElementById('setupBizNameInput').value.trim() || "Cisco Wines & Spirits";
    const branchName = document.getElementById('setupBranchNameInput')?.value.trim() || "Nairobi CBD Main";
    const branchCode = document.getElementById('setupBranchCodeInput')?.value.trim() || "cbd";
    const err = document.getElementById('setupErrorMsg');

    if (!name) {
      if (err) err.textContent = "Please enter Owner Full Name!";
      return;
    }
    if (!pin || pin.length < 4) {
      if (err) err.textContent = "Please enter a 4-digit Security PIN!";
      return;
    }
    if (confirmPin && confirmPin !== pin) {
      if (err) err.textContent = "Security PIN and Confirm PIN do not match!";
      return;
    }

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, pin, confirmPin, businessName, branchName, branchCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to setup account");
      }

      if (data.token) {
        localStorage.setItem('cellar_token', data.token);
        sessionStorage.setItem('cellar_session_auth', 'true');
      }

      store.currentUser = data.user;
      if (data.branch && data.branch.id) store.activeBranchId = data.branch.id;
      await store.fetchBranchLogin();
      await store.loadAuthenticatedData();
      store.saveLocalBackup();

      // Build the shareable login URL from the resolved branch code (works
      // both locally, e.g. http://localhost:3001, and on the deployed
      // Vercel domain — window.location.origin adapts automatically).
      const resolvedCode = (data.branch && data.branch.code) ? data.branch.code : branchCode;

      window.closeModal('setupModal');
      window.showSetupSuccess(name, resolvedCode);
    } catch (e) {
      if (err) {
        if (e.message && e.message.includes('already exists')) {
          err.innerHTML = `
            <div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); border-radius:10px; padding:12px; margin-top:12px; text-align:center;">
              <div style="color:#f87171; font-weight:800; font-size:13px; margin-bottom:8px;">⚠️ A business owner already exists for this system.</div>
              <button type="button" class="btn btn-primary btn-sm" onclick="switchAuthMode('login')" style="font-weight:700; padding:6px 14px; font-size:12px;">🔑 Log In to Account with PIN</button>
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

  // Post-registration success screen: shows the owner the shareable login URL
  // for their branch (used by the owner and staff to log in), with copy +
  // continue-to-dashboard actions. The URL is derived from the live origin so
  // it is correct on localhost and on the deployed Vercel domain alike.
  window.showSetupSuccess = (ownerName, branchCode) => {
    const loginUrl = `${window.location.origin}/?branch=${encodeURIComponent(branchCode)}`;
    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = `
      <div class="welcome-setup-container">
        <div class="welcome-setup-card">
          <div class="welcome-setup-header">
            <div class="welcome-logo-badge" style="background:rgba(34,197,94,0.15);">
              <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" style="width:28px; height:28px;"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h1 class="welcome-title">Welcome, ${ownerName}!</h1>
            <p class="welcome-subtitle">Your business owner account is ready.</p>
          </div>

          <div style="background:#0f0f12; border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:16px; margin-bottom:16px;">
            <div style="font-size:11px; font-weight:800; color:var(--accent); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">🔗 Your Login URL</div>
            <div style="font-size:12px; color:#94a3b8; margin-bottom:10px;">Bookmark this link. You and your staff use it to log in with your Security PINs — the branch code identifies the terminal, it is not a password.</div>
            <div style="display:flex; gap:8px; align-items:stretch;">
              <input type="text" id="setupLoginUrlInput" readonly value="${loginUrl}" style="flex:1; background:#000; color:#e2e8f0; border:1.5px solid rgba(255,255,255,0.2); border-radius:8px; padding:10px; font-size:12px; font-weight:600;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="copyBranchUrl('setup', '${loginUrl}')" style="white-space:nowrap; font-weight:700;">Copy</button>
            </div>
          </div>

          <button type="button" class="welcome-submit-btn" onclick="window.enterDashboardAfterSetup()">
            <span>Continue to Owner Dashboard</span>
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <div style="text-align:center; margin-top:12px;">
            <a href="${loginUrl}" target="_blank" style="font-size:12px; color:#94a3b8;">Open login page in a new tab ↗</a>
          </div>
        </div>
      </div>
    `;
  };

  window.enterDashboardAfterSetup = () => {
    activeViewId = 'dashboard';
    initApp();
  };

  window.openStaffLoginModal = (isMandatory = false) => {
    // Use the branch-scoped roster (public) so the picker lists only this
    // branch's staff (plus org owners), never other branches' users.
    const roster = (store.loginUsers && store.loginUsers.length > 0) ? store.loginUsers : (store.users || []);
    if (!roster || roster.length === 0) {
      window.openInitialSetupModal();
      return;
    }
    window._isSubmittingPin = false;
    const sel = document.getElementById('loginUserSelect');
    if (sel) {
      const currentId = store.currentUser?.id;
      sel.innerHTML = roster
        .filter(u => u.active !== 0 && (u.status || 'ACTIVE') === 'ACTIVE')
        .map(u => `<option value="${u.id}" ${u.id === currentId ? 'selected' : ''}>${u.name} (${u.role.toUpperCase()})</option>`).join('');
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
    if (window._isSubmittingPin) return;
    if ((window.loginEnteredPin || "").length < 4) {
      window.loginEnteredPin = (window.loginEnteredPin || "") + num;
      updateLoginPinDots();
      const err = document.getElementById('loginPinErrorMsg');
      if (err) err.textContent = "";

      if (window.loginEnteredPin.length === 4) {
        setTimeout(() => {
          if (window.loginEnteredPin.length === 4) {
            window.submitLoginPin();
          }
        }, 100);
      }
    }
  };

  window.clearLoginPin = () => {
    window._isSubmittingPin = false;
    window.loginEnteredPin = "";
    updateLoginPinDots();
    const err = document.getElementById('loginPinErrorMsg');
    if (err) err.textContent = "";
  };

  window.showPinDigits = true; // Show typed PIN digits clearly

  window.togglePinVisibility = () => {
    window.showPinDigits = !window.showPinDigits;
    updateLoginPinDots();
  };

  function updateLoginPinDots() {
    const val = window.loginEnteredPin || "";
    for (let i = 0; i < 4; i++) {
      const box = document.getElementById(`loginPinBox${i}`);
      if (box) {
        if (i < val.length) {
          box.classList.add('active');
          box.textContent = window.showPinDigits ? val[i] : '•';
        } else {
          box.classList.remove('active');
          box.textContent = '-';
        }
      }
    }
  }

  function normalizePin(pinVal) {
    if (pinVal === null || pinVal === undefined) return "";
    const str = String(pinVal).trim();
    if (str.length < 4 && !isNaN(str)) return str.padStart(4, '0');
    return str;
  }

  window.submitLoginPin = async () => {
    if (window._isSubmittingPin) return;
    const pin = window.loginEnteredPin;
    if (!pin || pin.length < 4) {
      const err = document.getElementById('loginPinErrorMsg');
      if (err && pin.length > 0) err.textContent = "Please enter all 4 digits.";
      return;
    }

    window._isSubmittingPin = true;
    const selectedUserId = document.getElementById('loginUserSelect')?.value;
    const branchCode = store.loginBranch?.code || null;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, userId: selectedUserId, branchCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid PIN! Access Denied.");
      }

      if (data.token) {
        localStorage.setItem('cellar_token', data.token);
        sessionStorage.setItem('cellar_session_auth', 'true');
      }

      store.currentUser = data.user;
      sessionStorage.setItem('cellar_authenticated_user', data.user.id);

      // Bind the active branch to the authenticated user (non-owners).
      if (data.user.branchId) {
        store.activeBranchId = data.user.branchId;
      }

      // Role-based view redirection (Requirement #6)
      const roleMap = {
        owner: 'dashboard',
        manager: 'dashboard',
        inventory_officer: 'inventory',
        cashier: 'pos'
      };
      activeViewId = roleMap[(data.user.role || '').toLowerCase()] || 'pos';

      window.loginEnteredPin = "";
      window._isSubmittingPin = false;
      updateLoginPinDots();
      window.closeModal('userLoginModal');

      // Now that we hold a token, load the role/branch-protected data.
      await store.loadAuthenticatedData();
      initApp();
      store.logAudit("Staff Login Successful", data.user.name, "-", data.user.role, "Authenticated via PIN");
    } catch (e) {
      const err = document.getElementById('loginPinErrorMsg');
      if (err) err.textContent = e.message || "Invalid PIN! Access Denied.";
      window.loginEnteredPin = "";
      window._isSubmittingPin = false;
      updateLoginPinDots();
    }
  };

  // Keyboard typing support for PIN Terminal (Bound once)
  if (!window._keypadKeyboardListenerAttached) {
    window._keypadKeyboardListenerAttached = true;
    window.addEventListener('keydown', (e) => {
      const isAuthLanding = !!document.querySelector('.welcome-setup-container');
      const modal = document.getElementById('userLoginModal');
      const isModalActive = modal && modal.classList.contains('active');

      if (isAuthLanding || isModalActive) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
          return;
        }
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          window.pressLoginPin(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          if ((window.loginEnteredPin || "").length > 0) {
            window.loginEnteredPin = window.loginEnteredPin.slice(0, -1);
            updateLoginPinDots();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          window.submitLoginPin();
        }
      }
    });
  }

  window.lockTerminal = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    try {
      localStorage.removeItem('cellar_token');
      sessionStorage.removeItem('cellar_session_auth');
      sessionStorage.removeItem('cellar_authenticated_user');
    } catch (e) {}
    store.currentUser = null;
    // Refresh the branch roster and return to the standalone login screen.
    await store.fetchBranchLogin();
    window.currentAuthTab = 'login';
    initApp();
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
    const branch = store.getActiveBranch();
    if (branch && (branch.code || branch.id) && window.history) {
      window.history.pushState(null, '', `/?branch=${encodeURIComponent(branch.code || branch.id)}`);
    }
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

  window.copyBranchUrl = (id, url) => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
      } else {
        const input = document.getElementById(`branchUrlInput_${id}`);
        if (input) {
          input.select();
          document.execCommand('copy');
        }
      }
      alert(`Copied Branch Login URL:\n${url}`);
    } catch (e) {
      prompt("Copy Branch Login URL:", url);
    }
  };

  window.submitSaveBranch = () => {
    const name = document.getElementById('branchNameInput').value.trim();
    const code = (document.getElementById('branchCodeInput').value.trim() || `BR-${Date.now().toString().slice(-4)}`).toLowerCase();
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

    store.saveBranches();
    window.closeModal('branchModal');
    initApp();
    alert(`Branch configuration saved! Dedicated URL: ${window.location.origin}/?branch=${code}`);
  };

  window.deleteBranch = (id) => {
    const b = store.branches.find(x => x.id === id);
    if (!b) return;
    if (confirm(`Deactivate/Delete branch "${b.name}"?`)) {
      store.branches = store.branches.filter(x => x.id !== id);
      store.logAudit("Deleted Branch", b.name, "-", "-", "Deactivated Branch");
      store.saveBranches();
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

  window.submitSaveStaff = async () => {
    const isOwner = store.currentUser?.role === 'owner';
    const name = document.getElementById('staffNameInput').value.trim();
    const phone = document.getElementById('staffPhoneInput').value.trim();
    const email = document.getElementById('staffEmailInput').value.trim();
    const role = document.getElementById('staffRoleSelect').value;
    const primaryBranchId = document.getElementById('staffPrimaryBranchSelect').value;
    const status = document.getElementById('staffStatusSelect').value;
    const pin = document.getElementById('staffPinInput').value.trim();

    if (!name || !phone) return alert("Please enter Staff Name and Phone Number!");

    if (!isOwner && (role === 'manager' || role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can register or assign Manager/Owner accounts!");
    }

    const token = localStorage.getItem('cellar_token') || store.currentUser?.token || '';
    if (!token) {
      alert("Session expired. Please log in with your PIN to perform staff management.");
      window.logoutUser();
      return;
    }

    const editId = document.getElementById('staffEditId').value;
    try {
      if (editId) {
        const res = await fetch(`/api/auth/users/${editId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, phone, email, role, primaryBranchId, status, pin })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to update staff");
        store.logAudit("Updated Staff Member", name, "-", `Role: ${role.toUpperCase()}`, "Staff Account Modified");
      } else {
        if (!pin || pin.length < 4) return alert("Please enter a 4-digit Secret Security PIN!");
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, phone, email, role, primaryBranchId, status, pin })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to create staff");
        store.logAudit("Created Staff Account", name, "-", `Role: ${role.toUpperCase()}`, "Staff Registered");
      }

      await store.fetchUsers();
      window.closeModal('staffModal');
      initApp();
      alert("Staff member configuration saved successfully!");
    } catch (e) {
      alert("Error saving staff account: " + e.message);
    }
  };

  window.deleteStaff = async (id) => {
    const u = store.users.find(x => x.id === id);
    if (!u) return;
    const isOwner = store.currentUser?.role === 'owner';
    if (!isOwner && (u.role === 'manager' || u.role === 'owner')) {
      return alert("Access Denied: Only the Business Owner can deactivate Manager or Owner accounts!");
    }

    const token = localStorage.getItem('cellar_token') || store.currentUser?.token || '';
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

    const token = localStorage.getItem('cellar_token') || store.currentUser?.token || '';
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset PIN");

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
