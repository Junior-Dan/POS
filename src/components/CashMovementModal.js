export function renderCashMovementModal() {
  return `
  <div class="modal-overlay" id="cashMovementModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
          <span>Record Cash In / Cash Out Movement</span>
        </div>
        <button class="modal-close" onclick="closeModal('cashMovementModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Movement Type</label>
          <select class="form-select" id="cashMoveTypeSelect">
            <option value="CASH_OUT">Cash Out (Petty Cash / Expense / Float Withdrawal)</option>
            <option value="CASH_IN">Cash In (Float Top-up / Supplier Deposit)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (KES)</label>
          <input type="number" class="form-input" id="cashMoveAmountInput" placeholder="e.g. 500">
        </div>
        <div class="form-group">
          <label class="form-label">Mandatory Reason / Description</label>
          <input type="text" class="form-input" id="cashMoveReasonInput" placeholder="e.g. Purchased ice & bags for shop">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('cashMovementModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCashMovement()">Log Cash Movement</button>
      </div>
    </div>
  </div>
  `;
}
