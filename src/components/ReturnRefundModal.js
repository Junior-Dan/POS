export function renderReturnRefundModal() {
  return `
  <div class="modal-overlay" id="returnRefundModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg>
          <span>Process Sales Return & Refund</span>
        </div>
        <button class="modal-close" onclick="closeModal('returnRefundModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Original Receipt Number</label>
          <input type="text" class="form-input" id="returnReceiptNoInput" placeholder="e.g. RCP-2026-0001">
        </div>
        <div class="form-group">
          <label class="form-label">Return Reason</label>
          <select class="form-select" id="returnReasonSelect">
            <option value="Damaged Bottle">Damaged / Corked Bottle</option>
            <option value="Wrong Item Purchased">Wrong Item Purchased by Customer</option>
            <option value="Shop Operator Error">Shop Cashier Error</option>
            <option value="Expired / Faulty Seal">Faulty Factory Seal</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Refund Amount (KES)</label>
          <input type="number" class="form-input" id="refundAmountInput" placeholder="Enter refund amount...">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('returnRefundModal')">Cancel</button>
        <button class="btn btn-danger" onclick="submitProcessRefund()">Approve Refund & Restock Item</button>
      </div>
    </div>
  </div>
  `;
}
