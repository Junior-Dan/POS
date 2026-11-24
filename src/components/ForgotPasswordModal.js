export function renderForgotPasswordModal() {
  return `
  <div class="modal-overlay" id="forgotPasswordModal">
    <div class="modal-card" style="max-width:440px; border-radius:20px; border:1px solid rgba(226, 232, 240, 0.8); box-shadow:0 25px 50px -12px rgba(15, 23, 42, 0.25); overflow:hidden;">
      <div class="modal-header" style="background:#ffffff; padding:20px 24px; border-bottom:1px solid #f1f5f9;">
        <div class="modal-title" style="display:flex; align-items:center; gap:10px; font-size:17px; font-weight:800; color:#0f172a;">
          <div style="width:34px; height:34px; border-radius:10px; background:#eff6ff; display:flex; align-items:center; justify-content:center; color:#2563eb;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px;">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span>Reset Account Password</span>
        </div>
        <button class="modal-close" onclick="closeModal('forgotPasswordModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="modal-body" style="padding:22px 24px; display:flex; flex-direction:column; gap:16px; background:#ffffff;">
        <p style="font-size:13px; color:#64748b; line-height:1.5; margin:0;">
          Enter your registered email address. We will send a one-time verification code to reset your account password.
        </p>

        <div class="form-group">
          <label class="form-label" style="font-weight:700; font-size:12px; color:#334155; margin-bottom:6px; display:block;">Registered Email Address *</label>
          <div class="auth-input-wrap">
            <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <input type="email" class="auth-field" id="forgotEmailInput" placeholder="name@cellarpos.com" required />
          </div>
        </div>

        <div id="forgotStep2Area" style="display:none; flex-direction:column; gap:12px; padding-top:14px; border-top:1px dashed #e2e8f0;">
          <div class="form-group">
            <label class="form-label" style="font-weight:700; font-size:12px; color:#334155; margin-bottom:6px; display:block;">Verification Code *</label>
            <div class="auth-input-wrap">
              <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <input type="text" inputmode="numeric" autocomplete="one-time-code" class="auth-field" id="resetCodeInput" placeholder="6-digit code from email" style="letter-spacing:2px; font-weight:700;" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:700; font-size:12px; color:#334155; margin-bottom:6px; display:block;">New Password *</label>
            <div class="auth-input-wrap">
              <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input type="password" class="auth-field" id="resetNewPasswordInput" placeholder="Min. 8 characters" oninput="window.updatePasswordStrengthBars(this.value, 'forgotModalStrengthBars', 'forgotModalStrengthLabel')" />
              <button type="button" class="auth-eye-btn" onclick="togglePasswordInputVisibility('resetNewPasswordInput')" title="Toggle Password Visibility">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:700; font-size:12px; color:#334155; margin-bottom:6px; display:block;">Confirm Password *</label>
            <div class="auth-input-wrap">
              <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input type="password" class="auth-field" id="resetConfirmPasswordInput" placeholder="Confirm new password" />
              <button type="button" class="auth-eye-btn" onclick="togglePasswordInputVisibility('resetConfirmPasswordInput')" title="Toggle Password Visibility">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div class="auth-strength-container" style="margin-top:2px;">
            <div class="auth-password-bars" id="forgotModalStrengthBars">
              <span class="auth-bar"></span>
              <span class="auth-bar"></span>
              <span class="auth-bar"></span>
              <span class="auth-bar"></span>
            </div>
            <div class="auth-strength-info">
              <span id="forgotModalStrengthLabel" class="strength-label" style="font-size:11px;">At least 8 characters with letters & numbers</span>
            </div>
          </div>
        </div>

        <div id="forgotModalMsg" style="font-size:12px; font-weight:700; text-align:center; min-height:18px;"></div>
      </div>

      <div class="modal-footer" style="background:#f8fafc; padding:16px 24px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9;">
        <button class="btn btn-secondary" onclick="closeModal('forgotPasswordModal')" style="padding:9px 18px; border-radius:10px; font-weight:600;">Cancel</button>
        <button class="btn btn-primary" id="submitForgotBtn" onclick="submitForgotPassword()" style="background:#2563eb; padding:9px 22px; border-radius:10px; font-weight:700; box-shadow:0 4px 12px rgba(37, 99, 235, 0.25);">Send Reset Code</button>
      </div>
    </div>
  </div>
  `;
}
