export function renderPurchaseOrderModal() {
  return `
  <!-- Create Purchase Order Modal -->
  <div class="modal-overlay" id="createPoModal">
    <div class="modal-card" style="max-width: 680px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
          <span>Create Purchase Order (LPO)</span>
        </div>
        <button class="modal-close" onclick="closeModal('createPoModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Select Supplier *</label>
            <select class="form-select" id="poSupplierSelect"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Expected Delivery Date</label>
            <input type="date" class="form-input" id="poDeliveryDateInput">
          </div>
        </div>

        <div style="background:var(--surface); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-soft);">
          <div style="font-size:12px; font-weight:700; color:var(--accent); margin-bottom:8px;">Add Line Items</div>
          <div style="display:grid; grid-template-columns: 2fr 1fr 1fr auto; gap:8px; align-items:end;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Product</label>
              <select class="form-select" id="poProductSelect"></select>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Qty (Cases/Bottles)</label>
              <input type="number" class="form-input" id="poItemQtyInput" value="10" min="1">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Unit Cost (KES)</label>
              <input type="number" class="form-input" id="poItemCostInput" placeholder="Cost...">
            </div>
            <button class="btn btn-secondary" onclick="addPoLineItem()">+ Add</button>
          </div>
        </div>

        <div class="table-container" style="max-height: 180px; overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Total (KES)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="poLineItemsBody">
              <tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-faint);">No items added to PO yet</td></tr>
            </tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-elevated-2); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-soft);">
          <span style="font-size:13px; font-weight:700; color:var(--text-dim);">TOTAL PO VALUE</span>
          <span style="font-size:20px; font-weight:800; color:var(--accent);" id="poTotalValueText">KSh 0</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('createPoModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCreatePo()">Issue Purchase Order</button>
      </div>
    </div>
  </div>

  <!-- Receive Goods (GRN) Modal -->
  <div class="modal-overlay" id="receiveGoodsModal">
    <div class="modal-card" style="max-width: 540px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>Receive Goods & Auto-Restock Inventory</span>
        </div>
        <button class="modal-close" onclick="closeModal('receiveGoodsModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="receivePoId" value="">
        <div id="receivePoSummaryBox" style="background:var(--surface); padding:12px; border-radius:var(--radius-md);"></div>
        <div class="form-group">
          <label class="form-label">Supplier Delivery Note / Invoice Ref # *</label>
          <input type="text" class="form-input" id="receiveDeliveryRefInput" placeholder="e.g. DN-99882 / INV-445">
        </div>
        <div class="form-group">
          <label class="form-label">Receiving Notes / Inspection Comments</label>
          <input type="text" class="form-input" id="receiveNotesInput" placeholder="e.g. All bottles intact, seals verified by store manager">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('receiveGoodsModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitReceiveGoods()" style="background:var(--green); color:#000; font-weight:700;">Confirm Stock Receipt & Update Catalog</button>
      </div>
    </div>
  </div>
  `;
}
