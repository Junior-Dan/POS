import { store } from '../store/CellarStore.js';

export function renderAuthLandingScreen(overrideMode = null) {
  const urlParams = new URLSearchParams(window.location.search);
  const hasBranchQuery = urlParams.has('branch');
  const hasExistingOwner = store.users && store.users.some(u => u.role === 'owner' || u.active === 1);
  
  // Mode decision:
  // 1. If accessing via a branch link (?branch=code), ALWAYS show Branch Staff Login. Never show Register.
  // 2. Otherwise (main URL):
  //    - If overrideMode is set ('login' or 'setup'), respect it.
  //    - If an owner account exists in DB, default to Login.
  //    - If no owner exists yet, default to Create Account registration.
  let isBranchLogin = false;
  if (hasBranchQuery) {
    isBranchLogin = true;
  } else if (overrideMode === 'login') {
    isBranchLogin = true;
  } else if (overrideMode === 'setup') {
    isBranchLogin = false;
  } else {
    isBranchLogin = hasExistingOwner && !window.forceRegisterMode;
  }

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
          <p class="welcome-subtitle">Wines & Spirits Shop POS & Management System</p>
        </div>

        ${isBranchLogin ? `
          <!-- LOG IN FORM -->
          <div class="auth-mode-content">
            <div style="text-align:center; margin-bottom:16px;">
              <div style="font-size:13px; font-weight:800; color:var(--accent); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                📍 ${hasBranchQuery ? `${(store.loginBranch?.name || activeBranch.name).toUpperCase()} TERMINAL` : 'STAFF & OWNER LOG IN'}
              </div>
              <div style="font-size:12px; color:#94a3b8;">Select your staff account and enter your 4-digit Security PIN</div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:#cbd5e1; font-size:12px; text-transform:uppercase;">Select Account</label>
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

            ${!hasBranchQuery ? `
              <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:14px; padding-top:12px; text-align:center;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="switchAuthMode('setup')" style="font-size:11.5px; opacity:0.8;">Register New Business Account</button>
              </div>
            ` : ''}
          </div>
        ` : `
          <!-- CREATE ACCOUNT SETUP FORM -->
          <form onsubmit="event.preventDefault(); submitInitialSetup();" class="welcome-setup-form">
            <div style="text-align:center; margin-bottom:16px;">
              <div style="font-size:14px; font-weight:800; color:var(--accent); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                🚀 REGISTER BUSINESS OWNER ACCOUNT
              </div>
              <div style="font-size:12px; color:#94a3b8;">Set up your business, main branch, and owner security PIN</div>
            </div>

            <div class="form-group">
              <label class="form-label">Business / Store Name *</label>
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
                <label class="form-label">Initial Main Branch Name *</label>
                <input type="text" class="form-input" id="setupBranchNameInput" placeholder="e.g. Nairobi CBD Main" value="${activeBranch.name || 'Nairobi CBD Main'}" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Branch Code / URL Slug *</label>
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

            ${hasExistingOwner ? `
              <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:14px; padding-top:12px; text-align:center;">
                <span style="font-size:12px; color:#94a3b8;">Already registered?</span>
                <button type="button" class="btn btn-secondary btn-sm" onclick="switchAuthMode('login')" style="margin-left:8px; font-size:11.5px;">Log In with PIN</button>
              </div>
            ` : ''}
          </form>
        `}
      </div>
    </div>
  `;
}

