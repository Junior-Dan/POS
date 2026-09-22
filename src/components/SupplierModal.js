export function renderSupplierModal() {
  return `
  <div class="modal-overlay" id="supplierModal">
    <div class="modal-card" style="max-width: 520px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 18h12"/><path d="M3 22h18"/><path d="M14 2v4"/><path d="M17 2v4"/><path d="M10 2v4"/><path d="M7 2v4"/><path d="M2 6h20v12H2z"/></svg>
          <span id="supplierModalTitle">Add New Supplier</span>
        </div>
        <button class="modal-close" onclick="closeModal('supplierModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="supplierEditId" value="">
        
        <div class="form-group">
          <label class="form-label">Company Name *</label>
          <input type="text" class="form-input" id="supNameInput" placeholder="e.g. Kenya Breweries Limited (KBL)">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Contact Person</label>
            <input type="text" class="form-input" id="supContactInput" placeholder="e.g. Francis Mutua">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number *</label>
            <input type="text" class="form-input" id="supPhoneInput" placeholder="e.g. 0722000111">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">KRA PIN Number</label>
            <input type="text" class="form-input" id="supPinInput" placeholder="e.g. P000123456A">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Terms</label>
            <select class="form-select" id="supPaymentTermsSelect">
              <option value="Net 15 Days">Net 15 Days</option>
              <option value="Net 30 Days">Net 30 Days</option>
              <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
              <option value="Advance Payment">Advance Payment</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Physical Address / Depot Location</label>
          <input type="text" class="form-input" id="supAddressInput" placeholder="e.g. Ruaraka Depot, Thika Road, Nairobi">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('supplierModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitSaveSupplier()">Save Supplier</button>
      </div>
    </div>
  </div>
  `;
}
