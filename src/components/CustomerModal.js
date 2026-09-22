export function renderCustomerModal() {
  return `
  <div class="modal-overlay" id="customerModal">
    <div class="modal-card" style="max-width: 500px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span id="customerModalTitle">Add Registered Customer</span>
        </div>
        <button class="modal-close" onclick="closeModal('customerModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="custEditId" value="">

        <div class="form-group">
          <label class="form-label">Customer Full Name *</label>
          <input type="text" class="form-input" id="custNameInput" placeholder="e.g. David Mwangi">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Phone Number *</label>
            <input type="text" class="form-input" id="custPhoneInput" placeholder="e.g. 0712345678">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-input" id="custEmailInput" placeholder="e.g. david@example.com">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes & Beverage Preferences</label>
          <input type="text" class="form-input" id="custNotesInput" placeholder="e.g. Prefers Single Malt Whisky, Regular weekend customer">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('customerModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitSaveCustomer()">Save Customer</button>
      </div>
    </div>
  </div>
  `;
}
