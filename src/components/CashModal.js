export function renderCashModal() {
  return `
  <div class="modal-overlay" id="cashPaymentModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
          <span>Cash Payment</span>
        </div>
        <button class="modal-close" onclick="closeModal('cashPaymentModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;">
          <div style="font-size:12px; color:var(--text-dim);">TOTAL DUE</div>
          <div class="serif" style="font-size:32px; color:var(--accent); font-weight:700;" id="cashModalTotalDue">KSh 0</div>
        </div>
        <div class="form-group">
          <label class="form-label">Tendered Amount (KES)</label>
          <input type="number" class="form-input" id="cashTenderedInput" placeholder="Enter amount received..." style="font-size:20px; font-weight:700; text-align:center;">
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
          <button class="btn btn-secondary" onclick="setQuickTender(500)">KSh 500</button>
          <button class="btn btn-secondary" onclick="setQuickTender(1000)">KSh 1,000</button>
          <button class="btn btn-secondary" onclick="setQuickTender(2000)">KSh 2,000</button>
          <button class="btn btn-secondary" onclick="setQuickTender(5000)">KSh 5,000</button>
        </div>
        <div style="background:var(--surface); padding:14px; border-radius:var(--radius-md); text-align:center;">
          <div style="font-size:12px; color:var(--text-dim);">CHANGE TO RETURN</div>
          <div class="serif" style="font-size:24px; color:var(--green); font-weight:700;" id="cashModalChange">KSh 0</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('cashPaymentModal')">Cancel</button>
        <button class="btn btn-primary" id="confirmCashPayBtn">Complete Cash Sale</button>
      </div>
    </div>
  </div>
  `;
}
