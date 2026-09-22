export function renderStaffModal() {
  return `
  <div class="modal-overlay" id="staffModal">
    <div class="modal-card" style="max-width: 560px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span id="staffModalTitle">Add Staff Member</span>
        </div>
        <button class="modal-close" onclick="closeModal('staffModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="staffEditId" value="">

        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" class="form-input" id="staffNameInput" placeholder="e.g. Mary Wanjiku">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Phone Number *</label>
            <input type="text" class="form-input" id="staffPhoneInput" placeholder="e.g. 0722 300 400">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-input" id="staffEmailInput" placeholder="e.g. mary@ciscowines.co.ke">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Assigned Role *</label>
            <select class="form-select" id="staffRoleSelect">
              <option value="owner">OWNER (Business-wide full access)</option>
              <option value="manager">MANAGER (Branch operational admin)</option>
              <option value="cashier">CASHIER (POS & assigned drawer)</option>
              <option value="inventory_officer">INVENTORY OFFICER (Stock & purchasing)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Primary Assigned Branch *</label>
            <select class="form-select" id="staffPrimaryBranchSelect"></select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Additional Branch Access (Hold Ctrl/Cmd to select multiple)</label>
          <select class="form-select" id="staffAdditionalBranchesSelect" multiple style="height:70px;"></select>
          <span style="font-size:11px; color:var(--text-faint);">Allows cross-branch work without changing user role.</span>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Secret Security PIN (4 digits) *</label>
            <input type="password" class="form-input" id="staffPinInput" placeholder="••••" maxlength="4">
            <span style="font-size:10.5px; color:var(--text-faint);">PINs are securely masked and encrypted.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Account Status</label>
            <select class="form-select" id="staffStatusSelect">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">SUSPENDED / INACTIVE</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('staffModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitSaveStaff()">Save Staff Account</button>
      </div>
    </div>
  </div>
  `;
}
