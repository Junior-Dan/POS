export function renderSetupScreen() {
  return `
    <div class="welcome-setup-container">
      <div class="welcome-setup-card">
        <div class="welcome-setup-header">
          <div class="welcome-logo-badge">
            <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:28px; height:28px;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <h1 class="welcome-title">Welcome to Cellar POS</h1>
          <p class="welcome-subtitle">Create your Business Owner account and initial main branch register to get started</p>
        </div>

        <form onsubmit="event.preventDefault(); submitInitialSetup();" class="welcome-setup-form">
          <div class="form-group">
            <label class="form-label">Business / Store Name</label>
            <input type="text" class="form-input" id="setupBizNameInput" placeholder="e.g. Cisco Wines & Spirits" value="Cisco Wines & Spirits" required>
          </div>

          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Owner Full Name</label>
              <input type="text" class="form-input" id="setupNameInput" placeholder="e.g. David Kamau" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address (Optional)</label>
              <input type="email" class="form-input" id="setupEmailInput" placeholder="e.g. owner@cellar.co.ke">
            </div>
          </div>

          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Initial Main Branch Name</label>
              <input type="text" class="form-input" id="setupBranchNameInput" placeholder="e.g. Nairobi CBD Main" value="Nairobi CBD Main" required>
            </div>
            <div class="form-group">
              <label class="form-label">Branch Code / URL Slug</label>
              <input type="text" class="form-input" id="setupBranchCodeInput" placeholder="e.g. cbd" value="cbd" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Create 4-Digit Owner Security PIN</label>
            <input type="password" maxlength="4" class="form-input" id="setupPinInput" placeholder="0000" style="letter-spacing:6px; font-size:22px; text-align:center; font-weight:800;" required>
          </div>

          <div id="setupErrorMsg" class="setup-error-msg"></div>

          <button type="submit" class="welcome-submit-btn">
            <span>Create Account & Open Dashboard</span>
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
}
