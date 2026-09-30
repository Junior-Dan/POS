import { store } from '../store/CellarStore.js';

export function renderAuthLandingScreen(overrideMode = null) {
  const urlParams = new URLSearchParams(window.location.search);
  const hasBranchQuery = urlParams.has('branch');

  const rosterLoaded = store.rosterLoaded === true;
  let cachedOwnerExists = false;
  try { cachedOwnerExists = localStorage.getItem('cellar_owner_exists') === '1'; } catch (e) {}

  const hasExistingOwner = (store.currentUser && (store.currentUser.role || '').toLowerCase() === 'owner') ||
    (store.loginUsers || []).some(u => (u.role || '').toLowerCase() === 'owner') ||
    cachedOwnerExists;

  // Determine landing screen mode:
  // 1. If accessing via a branch query link (?branch=code), ALWAYS show Branch Terminal PIN Login.
  // 2. Otherwise (main URL like http://localhost:5173/ or http://localhost:3000/):
  //    - If overrideMode === 'setup' OR no owner account registered yet, show Register Owner form.
  //    - Otherwise default to Email & Password Main Login.
  let isBranchLogin = false;
  let isRegisterSetup = false;

  if (hasBranchQuery) {
    isBranchLogin = true;
  } else if (overrideMode === 'setup') {
    isRegisterSetup = true;
  } else if (overrideMode === 'login') {
    isBranchLogin = false; // Main email login
  } else if (!hasExistingOwner) {
    isRegisterSetup = true;
  } else {
    isBranchLogin = false; // Main email login
  }

  const activeBranch = store.loginBranch || store.getActiveBranch() || { name: 'Main Branch', code: 'cbd' };
  const userList = Array.isArray(store.loginUsers) ? store.loginUsers : [];

  return `
    <div class="welcome-setup-container">
      <div class="welcome-setup-card">
        <!-- LEFT PANEL: AUTH FORM -->
        <div class="welcome-auth-pane">
          <div class="welcome-brand-header">
            <div class="welcome-logo-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:24px; height:24px;">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <span class="welcome-brand-name">${store.loginBranch?.businessName || store.businessProfile?.name || 'Cellar POS'}</span>
          </div>

          <div class="auth-pane-body">
            ${isRegisterSetup ? `
              <!-- CREATE ACCOUNT SETUP FORM (NO BRANCH INPUTS OR PINS) -->
              <div class="auth-header-section">
                <h1 class="welcome-title">Create Owner Account</h1>
                <p class="welcome-subtitle">Set up your business and owner account credentials</p>
              </div>

              <form onsubmit="event.preventDefault(); submitInitialSetup();" class="welcome-setup-form">
                <div class="form-group">
                  <label class="form-label">Business / Store Name *</label>
                  <input type="text" class="form-input" id="setupBizNameInput" placeholder="e.g. Cisco Wines & Spirits" value="${store.businessProfile?.name || 'Cisco Wines & Spirits'}" required>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Owner Full Name *</label>
                    <input type="text" class="form-input" id="setupNameInput" placeholder="e.g. David Kamau" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Phone Number *</label>
                    <input type="tel" class="form-input" id="setupPhoneInput" placeholder="e.g. 0722 000 111" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Email Address *</label>
                  <input type="email" class="form-input" id="setupEmailInput" placeholder="e.g. owner@cellar.co.ke" required>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Password *</label>
                    <input type="password" class="form-input" id="setupPasswordInput" placeholder="••••••••" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Confirm Password *</label>
                    <input type="password" class="form-input" id="setupConfirmPasswordInput" placeholder="••••••••" required>
                  </div>
                </div>

                <div id="setupErrorMsg" class="setup-error-msg"></div>

                <button type="submit" class="welcome-submit-btn">
                  <span>Create Account & Open Dashboard</span>
                  <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                <div class="auth-switch-prompt">
                  <span>Already registered?</span>
                  <button type="button" class="auth-switch-link" onclick="switchAuthMode('login')">Log In</button>
                </div>
              </form>
            ` : isBranchLogin ? `
              <!-- SHARED UNIQUE BRANCH TERMINAL LOGIN (CUSTOM BUSINESS NAME + EMAIL & PASSWORD / PIN) -->
              <div class="auth-header-section">
                <h1 class="welcome-title">${store.loginBranch?.businessName || store.businessProfile?.name || 'Cellar POS'}</h1>
                <p class="welcome-subtitle">
                  📍 ${(store.loginBranch?.name || activeBranch.name).toUpperCase()} TERMINAL (${(store.loginBranch?.code || activeBranch.code).toUpperCase()})
                </p>
              </div>

              <div class="auth-mode-content">
                <!-- PRIMARY: STAFF EMAIL & PASSWORD LOGIN FORM -->
                <form onsubmit="event.preventDefault(); submitBranchTerminalLogin();" class="welcome-setup-form">
                  <div class="form-group">
                    <label class="form-label">STAFF EMAIL ADDRESS *</label>
                    <input type="email" class="form-input" id="branchStaffEmailInput" placeholder="e.g. staff@company.com" required>
                  </div>

                  <div class="form-group">
                    <label class="form-label">PASSWORD / SECURITY PIN *</label>
                    <div style="position:relative;">
                      <input type="password" class="form-input" id="branchStaffCodeInput" placeholder="••••••••" style="padding-right:38px;" required>
                      <button type="button" onclick="toggleBranchCodeVisibility()" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#64748b; cursor:pointer;" title="Toggle Password Visibility">
                        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                    </div>
                  </div>

                  <div id="branchLoginErrorMsg" class="setup-error-msg"></div>

                  <button type="submit" class="welcome-submit-btn" style="margin-top:12px;">
                    Log In to Dashboard
                  </button>
                </form>
              </div>
            ` : `
              <!-- MAIN STORE LOGIN (EMAIL & PASSWORD) -->
              <div class="auth-header-section">
                <h1 class="welcome-title">Welcome Back</h1>
                <p class="welcome-subtitle">Enter your email and password to access your account.</p>
              </div>

              <form onsubmit="event.preventDefault(); submitMainLogin();" class="welcome-setup-form">
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-input" id="loginEmailInput" placeholder="sellostore@company.com" required>
                </div>

                <div class="form-group">
                  <label class="form-label">Password</label>
                  <div style="position:relative;">
                    <input type="password" class="form-input" id="loginPasswordInput" placeholder="••••••••" style="padding-right:38px;" required>
                    <button type="button" onclick="togglePasswordInputVisibility()" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#64748b; cursor:pointer;" title="Toggle Password Visibility">
                      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; margin-top:2px;">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer; color:#475569; font-weight:600;">
                    <input type="checkbox" id="rememberMeCheckbox" checked style="accent-color:#4f46e5;">
                    <span>Remember Me</span>
                  </label>
                  <a href="#" onclick="event.preventDefault(); alert('Please contact your administrator to reset your password or PIN.');" style="color:#4f46e5; font-weight:700; text-decoration:none;">Forgot Your Password?</a>
                </div>

                <div id="loginEmailErrorMsg" class="setup-error-msg"></div>

                <button type="submit" class="welcome-submit-btn" style="margin-top:6px;">
                  Log In
                </button>

                <div class="auth-switch-prompt" style="margin-top:14px;">
                  <span>Don't Have An Account?</span>
                  <button type="button" class="auth-switch-link" onclick="switchAuthMode('setup')">Register Now.</button>
                </div>
              </form>
            `}
          </div>

          <div class="welcome-footer-bar">
            <span>Copyright © 2026 ${store.businessProfile?.name || 'Cellar POS Enterprises LTD'}.</span>
            <a href="#" onclick="event.preventDefault();" class="footer-link">Privacy Policy</a>
          </div>
        </div>

        <!-- RIGHT PANEL: HERO BANNER (MATCHING REFERENCE IMAGE) -->
        <div class="welcome-hero-pane">
          <div class="hero-pane-inner">
            <div class="hero-header-text">
              <h2 class="hero-title">Effortlessly manage your team and operations.</h2>
              <p class="hero-subtitle">Log in to access your CRM dashboard and manage your team.</p>
            </div>

            <!-- Graphic Dashboard Cards Showcase -->
            <div class="hero-mockup-stage">
              <!-- Back Main Dashboard Card -->
              <div class="hero-card hero-main-card">
                <div class="hero-card-grid">
                  <div class="hero-stat-block">
                    <div class="hero-stat-title">Total Sales</div>
                    <div class="hero-stat-val">$189,374</div>
                    <span class="hero-badge badge-up">↑ 12% vs last month</span>
                  </div>
                  <div class="hero-stat-block">
                    <div class="hero-stat-title">Chat Performance</div>
                    <div class="hero-stat-val">00:01:30</div>
                    <div class="hero-mini-chart">
                      <svg viewBox="0 0 100 30" fill="none" style="width:100%; height:26px;">
                        <path d="M0 22 Q 25 28, 50 12 T 100 8" stroke="#6366f1" stroke-width="2.5" fill="none"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <!-- Main Sales Overview sparkline area -->
                <div class="hero-sales-overview">
                  <div class="hero-sales-header">
                    <span class="hero-sales-title">Sales Overview</span>
                    <span class="hero-sales-sub">Weekly ▾</span>
                  </div>
                  <div class="hero-sales-graph">
                    <svg viewBox="0 0 280 65" fill="none" style="width:100%; height:100%;">
                      <path d="M0 50 C 40 45, 70 15, 110 30 C 150 45, 190 10, 230 22 C 260 34, 270 12, 280 18" stroke="#3b82f6" stroke-width="3" fill="none"/>
                      <path d="M0 50 C 40 45, 70 15, 110 30 C 150 45, 190 10, 230 22 C 260 34, 270 12, 280 18 L280 65 L0 65 Z" fill="url(#heroGraphGrad)" opacity="0.12"/>
                      <defs>
                        <linearGradient id="heroGraphGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#3b82f6"/>
                          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                <!-- Table Preview -->
                <div class="hero-table-preview">
                  <div class="hero-table-row header">
                    <span>Order ID</span>
                    <span>Product Name</span>
                    <span>Total Price</span>
                    <span>Status</span>
                  </div>
                  <div class="hero-table-row">
                    <span class="code">#SLR988719</span>
                    <span>Johnnie Walker Black 1L</span>
                    <span>$48.00</span>
                    <span class="status-pill status-paid">In Paid</span>
                  </div>
                  <div class="hero-table-row">
                    <span class="code">#SLR988720</span>
                    <span>Glenfiddich 12 Year</span>
                    <span>$65.00</span>
                    <span class="status-pill status-pending">Pending</span>
                  </div>
                </div>
              </div>

              <!-- Overlapping Floating Donut Gauge Card -->
              <div class="hero-card hero-donut-card">
                <div class="donut-card-header">
                  <div>
                    <div class="donut-card-title">Sales Categories</div>
                    <div class="donut-card-sub">Your select product categories</div>
                  </div>
                  <div class="donut-card-filter">Monthly ▾</div>
                </div>

                <div class="donut-chart-wrapper">
                  <svg viewBox="0 0 140 140" class="hero-donut-svg">
                    <circle cx="70" cy="70" r="52" stroke="rgba(0,0,0,0.06)" stroke-width="14" fill="none"/>
                    <circle cx="70" cy="70" r="52" stroke="#4f46e5" stroke-width="14" fill="none" stroke-dasharray="215 327" stroke-dashoffset="0" stroke-linecap="round"/>
                    <circle cx="70" cy="70" r="52" stroke="#3b82f6" stroke-width="14" fill="none" stroke-dasharray="65 327" stroke-dashoffset="-220" stroke-linecap="round"/>
                    <circle cx="70" cy="70" r="52" stroke="#a855f7" stroke-width="14" fill="none" stroke-dasharray="35 327" stroke-dashoffset="-290" stroke-linecap="round"/>
                  </svg>
                  <div class="donut-center-info">
                    <div class="donut-center-sub">Total Sales</div>
                    <div class="donut-center-num">6,248 Units</div>
                  </div>
                </div>

                <div class="donut-legend-list">
                  <div class="legend-row"><span class="legend-dot dot-indigo"></span><span>Spirits & Whiskies</span><span class="legend-val">3,620 U</span></div>
                  <div class="legend-row"><span class="legend-dot dot-blue"></span><span>Fine Wines</span><span class="legend-val">1,780 U</span></div>
                  <div class="legend-row"><span class="legend-dot dot-purple"></span><span>Beer & Beverages</span><span class="legend-val">848 U</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

