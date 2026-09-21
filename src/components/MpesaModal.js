export function renderMpesaModal() {
  return `
  <div class="modal-overlay" id="mpesaPaymentModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>
          <span>Safaricom M-PESA STK Push</span>
        </div>
        <button class="modal-close" onclick="closeModal('mpesaPaymentModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;">
          <div style="font-size:12px; color:var(--text-dim);">AMOUNT PAYABLE</div>
          <div class="serif" style="font-size:30px; color:#00a040; font-weight:700;" id="mpesaModalTotal">KSh 0</div>
        </div>
        <div class="form-group">
          <label class="form-label">Customer M-PESA Phone Number</label>
          <input type="text" class="form-input" id="mpesaPhoneInput" value="0712345678" placeholder="e.g. 0712345678" style="text-align:center; font-size:18px; font-weight:700;">
        </div>
        <div id="mpesaStatusBox" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; text-align:center; display:none;">
          <div class="badge badge-warning" id="mpesaBadgeState" style="font-size:13px;">STK PUSH INITIATED</div>
          <div style="font-size:12.5px; margin-top:8px; color:var(--text-dim);" id="mpesaStatusText">Waiting for customer to enter PIN on handset...</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('mpesaPaymentModal')">Cancel</button>
        <button class="btn btn-primary" id="triggerMpesaPushBtn" style="background:#00a040; color:#fff;">Send STK Push Prompt</button>
        <button class="btn btn-secondary" id="simMpesaSuccessBtn" style="display:none; background:var(--green); color:#111;">Simulate Success Callback</button>
      </div>
    </div>
  </div>
  `;
}
