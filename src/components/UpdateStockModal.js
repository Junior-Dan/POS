export function renderUpdateStockModal() {
  return `
  <div class="modal-overlay" id="updateStockModal">
    <div class="modal-card" style="max-width: 460px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
          <span>Update Product Stock Quantity</span>
        </div>
        <button class="modal-close" onclick="closeModal('updateStockModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="stockUpdateProdId" value="">
        <div class="form-group" style="margin-bottom: 14px; background: var(--bg-hover); padding: 12px; border-radius: 8px; border: 1fr solid var(--border-color);">
          <label class="form-label" style="font-size: 11px; text-transform: uppercase; color: var(--text-faint);">Selected Product</label>
          <div style="font-weight: 700; font-size: 15px; color: var(--text-bright);" id="stockUpdateProdDisplay">--</div>
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label">New Stock Quantity (Units)</label>
          <input type="number" class="form-input" id="stockUpdateQtyInput" min="0" value="0" placeholder="Enter updated bottle count">
        </div>
        <div class="form-group">
          <label class="form-label">Adjustment Reason / Reference</label>
          <input type="text" class="form-input" id="stockUpdateReasonInput" placeholder="e.g. Stock restock delivery, physical count adjustment">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('updateStockModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitStockUpdate()">Save Stock Quantity</button>
      </div>
    </div>
  </div>
  `;
}
