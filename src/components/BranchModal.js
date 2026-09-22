export function renderBranchModal() {
  return `
  <div class="modal-overlay" id="branchModal">
    <div class="modal-card" style="max-width: 520px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span id="branchModalTitle">Add New Branch</span>
        </div>
        <button class="modal-close" onclick="closeModal('branchModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="branchEditId" value="">

        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Branch Name *</label>
            <input type="text" class="form-input" id="branchNameInput" placeholder="e.g. Westlands Branch">
          </div>
          <div class="form-group">
            <label class="form-label">Branch Code *</label>
            <input type="text" class="form-input" id="branchCodeInput" placeholder="e.g. NBO-WST">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Location / Physical Address *</label>
          <input type="text" class="form-input" id="branchLocationInput" placeholder="e.g. Waiyaki Way, Westlands, Nairobi">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" class="form-input" id="branchPhoneInput" placeholder="e.g. 0733 444 555">
          </div>
          <div class="form-group">
            <label class="form-label">Branch Manager</label>
            <select class="form-select" id="branchManagerSelect"></select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Operating Hours</label>
            <input type="text" class="form-input" id="branchHoursInput" placeholder="e.g. 08:00 AM - 11:00 PM">
          </div>
          <div class="form-group">
            <label class="form-label">Operational Status</label>
            <select class="form-select" id="branchStatusSelect">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE / CLOSED</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('branchModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitSaveBranch()">Save Branch</button>
      </div>
    </div>
  </div>
  `;
}
