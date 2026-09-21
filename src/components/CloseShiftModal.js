export function renderCloseShiftModal() {
  return `
  <div class="modal-overlay" id="closeShiftModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Shift Cash Reconciliation & Close</span>
        </div>
        <button class="modal-close" onclick="closeModal('closeShiftModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div style="background:var(--surface); padding:14px; border-radius:var(--radius-md); display:flex; flex-direction:column; gap:6px; font-size:13px;">
          <div style="display:flex; justify-content:space-between;">
            <span>Expected Cash in Drawer:</span>
            <strong id="shiftModalExpectedCash">KSh 0</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Confirmed M-PESA Sales:</span>
            <strong id="shiftModalExpectedMpesa">KSh 0</strong>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Actual Physical Cash Counted (KES)</label>
          <input type="number" class="form-input" id="shiftActualCashInput" placeholder="Enter physical cash in drawer..." style="font-size:18px; font-weight:700;">
        </div>

        <div style="background:var(--bg-elevated); border:1px solid var(--border); padding:12px; border-radius:var(--radius-md); text-align:center;">
          <div style="font-size:12px; color:var(--text-dim);">CALCULATED CASH VARIANCE</div>
          <div class="serif" id="shiftModalVariance" style="font-size:22px; font-weight:700; color:var(--green);">KSh 0 (Perfect Match)</div>
        </div>

        <div class="form-group">
          <label class="form-label">Shift Reconciliation Notes</label>
          <input type="text" class="form-input" id="shiftNotesInput" placeholder="Add any variance explanations...">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('closeShiftModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCloseShift()">Complete & Close Shift</button>
      </div>
    </div>
  </div>
  `;
}
