export function renderMpesaModal() {
  return `
  <div class="modal-overlay" id="mpesaPaymentModal">
    <div class="modal-card" style="max-width: 440px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>
          <span>M-PESA Payment Checkout</span>
        </div>
        <button class="modal-close" onclick="closeModal('mpesaPaymentModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
        <div style="text-align:center; background:var(--surface); padding:12px; border-radius:10px; border:1px solid var(--border-soft);">
          <div style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase;">AMOUNT PAYABLE</div>
          <div class="serif" style="font-size:32px; color:#10b981; font-weight:800;" id="mpesaModalTotal">KSh 0</div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:700;">Customer M-PESA Phone Number</label>
          <input type="text" class="form-input" id="mpesaPhoneInput" value="0712345678" placeholder="e.g. 0712345678" style="text-align:center; font-size:16px; font-weight:700;">
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:700;">M-PESA Transaction Code / Reference *</label>
          <input type="text" class="form-input" id="mpesaCodeInput" placeholder="e.g. QHK712984X" style="text-align:center; font-size:18px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px;">
          <span style="font-size:10.5px; color:var(--text-faint); margin-top:2px; display:block;">Required: Enter the M-Pesa receipt code received by the customer.</span>
        </div>

        <div id="mpesaModalErrorMsg" style="color:#ef4444; font-size:12px; font-weight:700; text-align:center; min-height:16px;"></div>

        <div id="mpesaStatusBox" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; text-align:center; display:none;">
          <div class="badge badge-warning" id="mpesaBadgeState" style="font-size:13px;">STK PUSH INITIATED</div>
          <div style="font-size:12px; margin-top:6px; color:var(--text-dim);" id="mpesaStatusText">Waiting for customer handset...</div>
        </div>
      </div>
      <div class="modal-footer" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <button class="btn btn-secondary" onclick="closeModal('mpesaPaymentModal')">Cancel</button>
        <button class="btn btn-primary" id="triggerMpesaPushBtn" style="background:#10b981; color:#fff; font-weight:800;">Complete M-PESA Sale</button>
      </div>
    </div>
  </div>
  `;
}
