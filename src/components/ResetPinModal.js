export function renderResetPinModal() {
  return `
  <div class="modal-overlay" id="resetPinModal">
    <div class="modal-card" style="max-width: 420px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Reset Staff Security PIN</span>
        </div>
        <button class="modal-close" onclick="closeModal('resetPinModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="resetPinUserId" value="">
        <div id="resetPinTargetUserText" style="font-size:13px; font-weight:700; color:var(--accent); background:var(--surface); padding:10px; border-radius:var(--radius-md);"></div>

        <div class="form-group">
          <label class="form-label">New 4-Digit Security PIN *</label>
          <input type="password" class="form-input" id="newPinInput" placeholder="••••" maxlength="4" style="font-size:24px; font-weight:800; text-align:center; letter-spacing:8px;">
        </div>

        <div class="form-group">
          <label class="form-label">Confirm New PIN *</label>
          <input type="password" class="form-input" id="confirmNewPinInput" placeholder="••••" maxlength="4" style="font-size:24px; font-weight:800; text-align:center; letter-spacing:8px;">
        </div>
        <span style="font-size:11px; color:var(--text-faint);">Raw PINs are never shown in plaintext to preserve security compliance.</span>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('resetPinModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitResetPin()">Update Security PIN</button>
      </div>
    </div>
  </div>
  `;
}
