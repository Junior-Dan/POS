import { store } from '../store/CellarStore.js';

export function renderAuthLandingScreen(activeTab = 'login') {
  const isSetup = activeTab === 'setup';
  // Prefer the branch-scoped roster resolved from the branch URL; fall back to
  // the active branch only for display.
  const activeBranch = store.loginBranch || store.getActiveBranch() || { name: 'Main Branch', code: 'cbd' };
  const userList = (store.loginUsers && store.loginUsers.length > 0) ? store.loginUsers : (store.users || []);

  return `
    <div class="welcome-setup-container">
      <div class="welcome-setup-card">
        <!-- Brand Header -->
        <div class="welcome-setup-header">
          <div class="welcome-logo-badge">
            <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:28px; height:28px;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h1 class="welcome-title">${store.businessProfile?.name || 'Cellar POS'}</h1>
          <p class="welcome-subtitle">Wines & Spirits Shop POS & Inventory Management System</p>
        </div>

        <!-- Tab Selector -->
        <div class="auth-tabs-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px; background:#0f0f12; padding:4px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <button class="auth-tab-btn ${!isSetup ? 'active' : ''}" type="button" onclick="switchAuthTab('login')" style="padding:10px; font-weight:700; font-size:13px; border-radius:8px; border:none; cursor:pointer; background:${!isSetup ? 'var(--accent)' : 'transparent'}; color:${!isSetup ? '#fff' : '#94a3b8'}; transition:all 0.2s;">
            🔑 Log In to Account
          </button>
          <button class="auth-tab-btn ${isSetup ? 'active' : ''}" type="button" onclick="switchAuthTab('setup')" style="padding:10px; font-weight:700; font-size:13px; border-radius:8px; border:none; cursor:pointer; background:${isSetup ? 'var(--accent)' : 'transparent'}; color:${isSetup ? '#fff' : '#94a3b8'}; transition:all 0.2s;">
            ➕ Create New Account
          </button>
        </div>

        ${!isSetup ? `
          <!-- LOG IN TAB -->
          <div class="auth-mode-content">
            <div style="text-align:center; margin-bottom:16px;">
              <div style="font-size:13px; font-weight:800; color:var(--accent); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                📍 ${activeBranch.name.toUpperCase()} TERMINAL
              </div>
              <div style="font-size:12px; color:#94a3b8;">Select your staff account and enter your 4-digit Security PIN</div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:#cbd5e1; font-size:12px; text-transform:uppercase;">Who are you?</label>
              <select class="form-select" id="loginUserSelect" style="background:#0f0f12; color:#fff; border:1.5px solid rgba(255,255,255,0.2); font-weight:700; font-size:13px; padding:10px; border-radius:8px;">
                ${userList.filter(u => u.active !== 0 && (u.status || 'ACTIVE') === 'ACTIVE').map(u => `
                  <option value="${u.id}">${u.name} — ${u.role.toUpperCase()}</option>
                `).join('')}
              </select>
            </div>

            <div class="pin-display-container" style="justify-content:center; margin-bottom:18px;">
              <div class="pin-digit-box" id="loginPinBox0">-</div>
              <div class="pin-digit-box" id="loginPinBox1">-</div>
              <div class="pin-digit-box" id="loginPinBox2">-</div>
              <div class="pin-digit-box" id="loginPinBox3">-</div>
              <button class="pin-toggle-visibility-btn" type="button" onclick="togglePinVisibility()" title="Show/Hide PIN digits">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>

            <div class="pin-pad">
              <button class="pin-btn" onclick="pressLoginPin('1')">1</button>
              <button class="pin-btn" onclick="pressLoginPin('2')">2</button>
              <button class="pin-btn" onclick="pressLoginPin('3')">3</button>
              <button class="pin-btn" onclick="pressLoginPin('4')">4</button>
              <button class="pin-btn" onclick="pressLoginPin('5')">5</button>
              <button class="pin-btn" onclick="pressLoginPin('6')">6</button>
              <button class="pin-btn" onclick="pressLoginPin('7')">7</button>
              <button class="pin-btn" onclick="pressLoginPin('8')">8</button>
              <button class="pin-btn" onclick="pressLoginPin('9')">9</button>
              <button class="pin-btn action-clear" onclick="clearLoginPin()">Clear</button>
              <button class="pin-btn" onclick="pressLoginPin('0')">0</button>
              <button class="pin-btn action-submit" onclick="submitLoginPin()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
            </div>

            <div id="loginPinErrorMsg" style="color:#ef4444; font-size:12px; text-align:center; font-weight:700; min-height:16px; margin-top:12px;"></div>

            <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:16px; padding-top:14px; text-align:center;">
              <span style="font-size:12px; color:#94a3b8;">Need to register a new business account?</span>
              <button type="button" class="btn btn-secondary btn-sm" onclick="switchAuthTab('setup')" style="margin-left:8px; font-size:11.5px;">Create Account</button>
            </div>
          </div>
        ` : `
          <!-- CREATE ACCOUNT TAB -->
          <form onsubmit="event.preventDefault(); submitInitialSetup();" class="welcome-setup-form">
            <div class="form-group">
              <label class="form-label">Business / Store Name</label>
              <input type="text" class="form-input" id="setupBizNameInput" placeholder="e.g. Cisco Wines & Spirits" value="${store.businessProfile?.name || 'Cisco Wines & Spirits'}" required>
            </div>

            <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Owner Full Name *</label>
                <input type="text" class="form-input" id="setupNameInput" placeholder="e.g. David Kamau" required>
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="tel" class="form-input" id="setupPhoneInput" placeholder="e.g. 0722 000 111" required>
              </div>
            </div>

            <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Email Address (Optional)</label>
                <input type="email" class="form-input" id="setupEmailInput" placeholder="e.g. owner@cellar.co.ke">
              </div>
              <div class="form-group">
                <label class="form-label">Initial Main Branch Name</label>
                <input type="text" class="form-input" id="setupBranchNameInput" placeholder="e.g. Nairobi CBD Main" value="${activeBranch.name || 'Nairobi CBD Main'}" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Branch Code / URL Slug</label>
              <input type="text" class="form-input" id="setupBranchCodeInput" placeholder="e.g. cbd" value="${activeBranch.code || 'cbd'}" required>
            </div>

            <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Create 4-Digit Owner Security PIN *</label>
                <input type="password" maxlength="4" class="form-input" id="setupPinInput" placeholder="••••" style="letter-spacing:6px; font-size:20px; text-align:center; font-weight:800;" required>
              </div>
              <div class="form-group">
                <label class="form-label">Confirm Security PIN *</label>
                <input type="password" maxlength="4" class="form-input" id="setupConfirmPinInput" placeholder="••••" style="letter-spacing:6px; font-size:20px; text-align:center; font-weight:800;" required>
              </div>
            </div>

            <div id="setupErrorMsg" class="setup-error-msg"></div>

            <button type="submit" class="welcome-submit-btn">
              <span>Create Account & Open Dashboard</span>
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:12px; padding-top:12px; text-align:center;">
              <span style="font-size:12px; color:#94a3b8;">Already have an account?</span>
              <button type="button" class="btn btn-secondary btn-sm" onclick="switchAuthTab('login')" style="margin-left:8px; font-size:11.5px;">Log In with PIN</button>
            </div>
          </form>
        `}
      </div>
    </div>
  `;
}
