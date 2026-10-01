export function renderForgotPasswordModal() {
  return `
  <div class="modal-overlay" id="forgotPasswordModal">
    <div class="modal-card" style="max-width:420px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-2 2l-2 2m2-2l2 2m-2-2l-2-2M3 11a8 8 0 1 0 16 0A8 8 0 0 0 3 11z"/></svg>
          <span>Reset Account Password</span>
        </div>
        <button class="modal-close" onclick="closeModal('forgotPasswordModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
        <div style="font-size:12.5px; color:var(--text-dim); line-height:1.5;">
          Enter your registered email address. We will send a one-time reset code to that email — enter the code below with your new password.
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:700;">Email Address *</label>
          <input type="email" class="form-input" id="forgotEmailInput" placeholder="e.g. owner@celler.co.ke" required style="font-size:14px;">
        </div>

        <div id="forgotStep2Area" style="display:none; flex-direction:column; gap:12px; padding-top:12px; border-top:1px dashed var(--border-soft);">
          <div class="form-group">
            <label class="form-label" style="font-weight:700;">Reset Code *</label>
            <input type="text" inputmode="numeric" autocomplete="one-time-code" class="form-input" id="resetCodeInput" placeholder="6-digit code from your email" style="font-size:14px; letter-spacing:3px;">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:700;">New Password *</label>
            <input type="password" class="form-input" id="resetNewPasswordInput" placeholder="••••••••" style="font-size:14px;">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:700;">Confirm New Password *</label>
            <input type="password" class="form-input" id="resetConfirmPasswordInput" placeholder="••••••••" style="font-size:14px;">
          </div>
        </div>

        <div id="forgotModalMsg" style="font-size:12px; font-weight:700; text-align:center; min-height:18px;"></div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:8px;">
        <button class="btn btn-secondary" onclick="closeModal('forgotPasswordModal')">Cancel</button>
        <button class="btn btn-primary" id="submitForgotBtn" onclick="submitForgotPassword()" style="font-weight:800;">Verify Email</button>
      </div>
    </div>
  </div>
  `;
}
