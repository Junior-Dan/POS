import { store } from '../store/CellarStore.js';

export function renderAuthLandingScreen(overrideMode = null) {
  let isRegisterSetup = false;
  const effectiveMode = overrideMode || window.currentAuthTab;

  if (typeof window !== 'undefined' && (window.location.hash === '#login' || window.location.search.includes('auth=login'))) {
    isRegisterSetup = false;
  } else if (typeof window !== 'undefined' && (window.location.hash === '#register' || window.location.hash === '#setup' || window.location.search.includes('auth=register'))) {
    isRegisterSetup = true;
  } else if (effectiveMode === 'setup' || effectiveMode === 'register') {
    isRegisterSetup = true;
  } else if (effectiveMode === 'login') {
    isRegisterSetup = false;
  } else if (window.forceRegisterMode) {
    isRegisterSetup = true;
  } else {
    const hasUsers = Array.isArray(store.loginUsers) && store.loginUsers.length > 0;
    isRegisterSetup = !hasUsers;
  }

  const currentHour = new Date().getHours();
  let greeting = "Good Morning!";
  if (currentHour >= 12 && currentHour < 17) {
    greeting = "Good Afternoon!";
  } else if (currentHour >= 17) {
    greeting = "Good Evening!";
  }

  return `
    <div class="welcome-setup-container">
      <div class="welcome-setup-card">
        <!-- LEFT PANEL: AUTH FORM (Matches Reference Design) -->
        <div class="welcome-auth-pane ${isRegisterSetup ? 'auth-mode-register' : 'auth-mode-login'}">
          <!-- Top-Left Brand Logo & Name -->
          <div class="welcome-brand-header">
            <div class="welcome-logo-badge">
              <img src="/logo.jpeg" alt="Cellar POS Logo" class="sys-logo-img" />
            </div>
            <span class="welcome-brand-name">Cellar POS</span>
          </div>

          <!-- Centered Auth Form Box -->
          <div class="auth-pane-content">
            <div class="auth-header-section">
              <h1 class="welcome-title">${isRegisterSetup ? 'Create Account' : 'Welcome Back'}</h1>
              <p class="welcome-subtitle">
                ${isRegisterSetup
                  ? 'Enter your details to create your organization account.'
                  : 'Enter your email and password to access your account.'
                }
              </p>
            </div>

            ${isRegisterSetup ? `
              <!-- CREATE NEW BUSINESS / ORGANIZATION ACCOUNT -->
              <form onsubmit="event.preventDefault(); submitInitialSetup();" class="welcome-setup-form">
                <div class="form-group">
                  <label class="form-label">Business / Store Name *</label>
                  <div class="auth-input-wrap">
                    <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>
                    </svg>
                    <input type="text" class="auth-field" id="setupBizNameInput" placeholder="Store or business name" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Owner Name *</label>
                    <div class="auth-input-wrap">
                      <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input type="text" class="auth-field" id="setupNameInput" placeholder="Full name" required />
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Phone *</label>
                    <div class="auth-input-wrap">
                      <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      <input type="tel" class="auth-field" id="setupPhoneInput" placeholder="Phone number" required />
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Email *</label>
                  <div class="auth-input-wrap">
                    <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <input type="email" class="auth-field" id="setupEmailInput" placeholder="Email address" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Password *</label>
                    <div class="auth-input-wrap">
                      <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <input type="password" class="auth-field" id="setupPasswordInput" placeholder="Min. 8 characters" required oninput="window.updatePasswordStrengthBars(this.value, 'setupStrengthBars')" />
                      <button type="button" class="auth-eye-btn" onclick="togglePasswordInputVisibility('setupPasswordInput')" title="Toggle Password Visibility">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Confirm Password *</label>
                    <div class="auth-input-wrap">
                      <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <input type="password" class="auth-field" id="setupConfirmPasswordInput" placeholder="Confirm password" required />
                    </div>
                  </div>
                </div>

                <div class="auth-strength-container">
                  <div class="auth-password-bars" id="setupStrengthBars">
                    <span class="auth-bar"></span>
                    <span class="auth-bar"></span>
                    <span class="auth-bar"></span>
                    <span class="auth-bar"></span>
                  </div>
                  <div class="auth-strength-info">
                    <span id="setupStrengthLabel" class="strength-label">At least 8 characters with letters & numbers</span>
                  </div>
                </div>

                <div id="setupErrorMsg" class="setup-error-msg"></div>

                <button type="submit" class="welcome-submit-btn">
                  <span>Sign Up</span>
                </button>

                <p class="auth-switch-footer">
                  Already Have An Account? <button type="button" class="auth-toggle-link" onclick="switchAuthMode('login')">Sign In.</button>
                </p>
              </form>
            ` : `
              <!-- UNIFIED SIGN IN FORM -->
              <form onsubmit="event.preventDefault(); submitMainLogin();" class="welcome-setup-form">
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <div class="auth-input-wrap">
                    <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <input type="email" class="auth-field" id="loginEmailInput" placeholder="Email address" required />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Password</label>
                  <div class="auth-input-wrap">
                    <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input type="password" class="auth-field" id="loginPasswordInput" placeholder="Password" required />
                    <button type="button" class="auth-eye-btn" onclick="togglePasswordInputVisibility('loginPasswordInput')" title="Toggle Password Visibility">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </div>

                <div class="auth-remember-row">
                  <label class="auth-checkbox-label">
                    <input type="checkbox" id="loginRememberMe" checked />
                    <span>Remember Me</span>
                  </label>
                  <button type="button" onclick="openForgotPasswordModal()" class="auth-forgot-link">
                    Forgot Your Password?
                  </button>
                </div>

                <div id="loginEmailErrorMsg" class="setup-error-msg"></div>

                <button type="submit" class="welcome-submit-btn">
                  <span>Log In</span>
                </button>

                <p class="auth-switch-footer">
                  Don't Have An Account? <button type="button" class="auth-toggle-link" onclick="switchAuthMode('setup')">Register Now.</button>
                </p>
              </form>
            `}
          </div>

          <!-- Bottom Footer Bar -->
          <div class="welcome-footer-bar">
            <span>Copyright © 2026 Cellar POS. All rights reserved.</span>
            <span class="footer-privacy-link">Privacy Policy</span>
          </div>
        </div>

        <!-- RIGHT PANEL: HERO BANNER -->
        <div class="welcome-hero-wrapper">
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
                  <div class="hero-table-row">
                    <span class="code">#SLR988721</span>
                    <span>Baileys Irish Cream 1L</span>
                    <span>KSh 3,200</span>
                    <span class="status-pill status-pending">PENDING</span>
                  </div>
                  <div class="hero-table-row">
                    <span class="code">#SLR988722</span>
                    <span>Hennessy VS 700ml</span>
                    <span>KSh 6,800</span>
                    <span class="status-pill status-paid">PAID</span>
                  </div>
                  <div class="hero-table-row">
                    <span class="code">#SLR988723</span>
                    <span>Tanqueray Dry Gin 750ml</span>
                    <span>KSh 2,850</span>
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
                  <div class="legend-row"><span class="legend-dot dot-blue"></span><span>Wines & Fizz</span><span class="legend-val">1,780 U</span></div>
                  <div class="legend-row"><span class="legend-dot dot-purple"></span><span>Beers & Softs</span><span class="legend-val">848 U</span></div>
                  <div class="legend-row"><span class="legend-dot dot-amber"></span><span>Liqueurs</span><span class="legend-val">420 U</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}


