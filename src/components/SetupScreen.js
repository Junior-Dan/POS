import { store } from '../store/CellarStore.js';

export function renderAuthLandingScreen(overrideMode = null) {
  const rosterLoaded = store.rosterLoaded === true;
  const userList = Array.isArray(store.loginUsers) && store.loginUsers.length > 0
    ? store.loginUsers
    : (store.users || []);

  const realOwnerExists = (store.currentUser && (store.currentUser.role || '').toLowerCase() === 'owner') ||
    userList.some(u => (u.role || '').toLowerCase() === 'owner');

  let cachedOwnerExists = false;
  try { cachedOwnerExists = localStorage.getItem('cellar_owner_exists') === '1'; } catch (e) {}

  const hasExistingOwner = (rosterLoaded && userList.length === 0) ? false : (realOwnerExists || cachedOwnerExists);

  let isRegisterSetup = false;
  const effectiveMode = overrideMode || window.currentAuthTab;

  if (effectiveMode === 'setup') {
    isRegisterSetup = true;
  } else if (effectiveMode === 'login') {
    isRegisterSetup = false;
  } else if (!hasExistingOwner) {
    isRegisterSetup = true;
  } else {
    isRegisterSetup = false;
  }

  const bizName = store.loginBranch?.businessName || store.businessProfile?.name || 'Cellar POS';
  const activeRoster = userList.filter(u => u.active !== 0 && (u.status || 'ACTIVE') === 'ACTIVE');

  return `
    <div class="welcome-setup-container">
      <div class="welcome-setup-card">
        <!-- LEFT PANEL: AUTH FORM -->
        <div class="welcome-auth-pane">
          <div class="welcome-brand-header">
            <div class="welcome-logo-badge">
              <img src="/logo.jpeg" alt="Cellar POS Logo" class="sys-logo-img" />
            </div>
            <span class="welcome-brand-name">${bizName}</span>
          </div>

          <div class="auth-pane-body">
            ${!hasExistingOwner ? `
              <div class="auth-tab-switcher">
                <button type="button" class="auth-tab-btn active" onclick="switchAuthMode('setup')">Owner Setup</button>
              </div>
            ` : ''}

            ${isRegisterSetup && !hasExistingOwner ? `
              <!-- CREATE INITIAL OWNER ACCOUNT SETUP FORM -->
              <div class="auth-header-section">
                <h1 class="welcome-title">Create Owner Account</h1>
                <p class="welcome-subtitle">Set up your business and owner account credentials</p>
              </div>

              <form onsubmit="event.preventDefault(); submitInitialSetup();" class="welcome-setup-form">
                <div class="form-group">
                  <label class="form-label">Business / Store Name *</label>
                  <input type="text" class="form-input" id="setupBizNameInput" placeholder="e.g. Cellar POS" value="${bizName}" required>
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
                  <span>Create Owner Account & Open Dashboard</span>
                  <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </form>
            ` : `
              <!-- UNIFIED SINGLE-BUSINESS SIGN IN FORM -->
              <div class="auth-header-section">
                <h1 class="welcome-title">Sign In to your Account</h1>
                <p class="welcome-subtitle">Enter your email and password to access your dashboard</p>
              </div>

              <!-- EMAIL & PASSWORD LOGIN ONLY -->
              <form onsubmit="event.preventDefault(); submitMainLogin();" class="welcome-setup-form">
                <div class="form-group">
                  <label class="form-label">Email Address *</label>
                  <input type="email" class="form-input" id="loginEmailInput" placeholder="e.g. owner@cellar.co.ke or staff@cellar.co.ke" required>
                </div>

                <div class="form-group">
                  <div style="display:flex; justify-space-between; align-items:center; margin-bottom:4px;">
                    <label class="form-label" style="margin:0;">Password *</label>
                    <button type="button" onclick="openForgotPasswordModal()" style="background:none; border:none; color:#3b82f6; font-size:12px; font-weight:600; cursor:pointer; text-decoration:underline; padding:0; margin-left:auto;">
                      Forgot Password?
                    </button>
                  </div>
                  <div style="position:relative;">
                    <input type="password" class="form-input" id="loginPasswordInput" placeholder="••••••••" style="padding-right:38px;" required>
                    <button type="button" onclick="togglePasswordInputVisibility()" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#64748b; cursor:pointer;" title="Toggle Password Visibility">
                      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </div>

                <div id="loginEmailErrorMsg" class="setup-error-msg"></div>

                <button type="submit" class="welcome-submit-btn" style="margin-top:12px;">
                  Sign In
                </button>
              </form>
            `}
          </div>

          <div class="welcome-footer-bar">
            <span>Copyright © 2026 ${bizName}.</span>
          </div>
        </div>

        <!-- RIGHT PANEL: HERO BANNER -->
        <div class="welcome-hero-pane">
          <div class="hero-pane-inner">
            <div class="hero-header-text">
              <h2 class="hero-title">Effortlessly manage your team and operations.</h2>
              <p class="hero-subtitle">Log in to access your POS dashboard and manage your branch operations.</p>
            </div>

            <!-- Graphic Dashboard Cards Showcase -->
            <div class="hero-mockup-stage">
              <!-- Back Main Dashboard Card -->
              <div class="hero-card hero-main-card">
                <div class="hero-card-grid">
                  <div class="hero-stat-block">
                    <div class="hero-stat-title">Total Sales</div>
                    <div class="hero-stat-val">KSh 189,374</div>
                    <span class="hero-badge badge-up">↑ 12% vs last month</span>
                  </div>
                  <div class="hero-stat-block">
                    <div class="hero-stat-title">Register Status</div>
                    <div class="hero-stat-val">ACTIVE</div>
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
                    <span>Receipt</span>
                    <span>Item</span>
                    <span>Total</span>
                    <span>Status</span>
                  </div>
                  <div class="hero-table-row">
                    <span class="code">#SLR988719</span>
                    <span>Johnnie Walker Black 1L</span>
                    <span>KSh 4,500</span>
                    <span class="status-pill status-paid">PAID</span>
                  </div>
                  <div class="hero-table-row">
                    <span class="code">#SLR988720</span>
                    <span>Jameson 750ml</span>
                    <span>KSh 3,000</span>
                    <span class="status-pill status-paid">PAID</span>
                  </div>
                </div>
              </div>

              <!-- Overlapping Floating Donut Gauge Card -->
              <div class="hero-card hero-donut-card">
                <div class="donut-card-header">
                  <div>
                    <div class="donut-card-title">Sales Categories</div>
                    <div class="donut-card-sub">Top categories by volume</div>
                  </div>
                </div>

                <div class="donut-chart-wrapper">
                  <svg viewBox="0 0 140 140" class="hero-donut-svg">
                    <circle cx="70" cy="70" r="52" stroke="rgba(0,0,0,0.06)" stroke-width="14" fill="none"/>
                    <circle cx="70" cy="70" r="52" stroke="#4f46e5" stroke-width="14" fill="none" stroke-dasharray="215 327" stroke-dashoffset="0" stroke-linecap="round"/>
                    <circle cx="70" cy="70" r="52" stroke="#3b82f6" stroke-width="14" fill="none" stroke-dasharray="65 327" stroke-dashoffset="-220" stroke-linecap="round"/>
                    <circle cx="70" cy="70" r="52" stroke="#a855f7" stroke-width="14" fill="none" stroke-dasharray="35 327" stroke-dashoffset="-290" stroke-linecap="round"/>
                  </svg>
                  <div class="donut-center-info">
                    <div class="donut-center-sub">Total Volume</div>
                    <div class="donut-center-num">6,248 Units</div>
                  </div>
                </div>

                <div class="donut-legend-list">
                  <div class="legend-row"><span class="legend-dot dot-indigo"></span><span>Whiskies & Spirits</span><span class="legend-val">3,620 U</span></div>
                  <div class="legend-row"><span class="legend-dot dot-blue"></span><span>Wines</span><span class="legend-val">1,780 U</span></div>
                  <div class="legend-row"><span class="legend-dot dot-purple"></span><span>Beers & Softs</span><span class="legend-val">848 U</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}


