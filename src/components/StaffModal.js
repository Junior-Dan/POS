export function renderStaffModal() {
  return `
  <div class="modal-overlay" id="staffModal">
    <div class="modal-card" style="max-width: 560px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
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
            <label class="form-label">Phone Number</label>
            <input type="text" class="form-input" id="staffPhoneInput" placeholder="e.g. 0722 300 400">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address * (Staff Email for Login)</label>
            <input type="email" class="form-input" id="staffEmailInput" placeholder="e.g. mary@company.com">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Assigned Role *</label>
          <select class="form-select" id="staffRoleSelect">
            <option value="manager">MANAGER (Operational admin)</option>
            <option value="cashier" selected>CASHIER (POS & assigned drawer)</option>
            <option value="inventory_officer">INVENTORY OFFICER (Stock & purchasing)</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label class="form-label">Password / Security PIN *</label>
              <button type="button" class="btn btn-secondary btn-sm" onclick="generateRandomStaffPassword()" style="padding:2px 8px; font-size:11px; font-weight:700;">🎲 Generate Temp</button>
            </div>
            <input type="text" class="form-input" id="staffPinInput" placeholder="Set a password or click Generate">
            <span style="font-size:10.5px; color:var(--text-faint);">Set manually or generate a secure temporary password.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Account Status</label>
            <select class="form-select" id="staffStatusSelect">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">SUSPENDED / INACTIVE</option>
            </select>
          </div>
        </div>
        <div id="staffModalErrorMsg" class="setup-error-msg"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('staffModal')">Cancel</button>
        <button class="btn btn-primary" id="saveStaffSubmitBtn" onclick="submitSaveStaff()">Save Staff Account</button>
      </div>
    </div>
  </div>

  <!-- SHARE STAFF LOGIN CREDENTIALS MODAL -->
  <div class="modal-overlay" id="shareStaffModal">
    <div class="modal-card" style="max-width: 520px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>Staff Login Credentials</span>
        </div>
        <button class="modal-close" onclick="closeModal('shareStaffModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
        <div style="background:var(--accent-soft); border:1px solid var(--accent-border); border-radius:10px; padding:14px;">
          <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:4px;" id="shareStaffHeaderTitle">Staff Account Created Successfully!</div>
          <div style="font-size:12px; color:var(--text-dim);" id="shareStaffHeaderDesc">Share the login credentials below with the staff member. They will log in through the main login page.</div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; background:var(--surface-hover); padding:12px; border-radius:8px; border:1px solid var(--border);">
          <div>
            <span style="font-size:11px; font-weight:700; color:var(--text-faint); text-transform:uppercase;">Staff Name & Role</span>
            <div id="shareStaffNameVal" style="font-size:13px; font-weight:700; color:var(--text-main); margin-top:2px;">-</div>
          </div>
          <div>
            <span style="font-size:11px; font-weight:700; color:var(--text-faint); text-transform:uppercase;">Login Email</span>
            <div id="shareStaffEmailVal" style="font-size:13px; font-weight:700; color:var(--text-main); margin-top:2px;">-</div>
          </div>
          <div>
            <span style="font-size:11px; font-weight:700; color:var(--text-faint); text-transform:uppercase;">Password / PIN</span>
            <div id="shareStaffPassVal" style="font-size:13px; font-weight:800; color:var(--accent); margin-top:2px; font-family:monospace;">-</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Formatted Invitation Message</label>
          <textarea id="shareStaffMessageText" readonly class="form-input" style="height:90px; font-size:11.5px; line-height:1.5; background:var(--surface); font-family:sans-serif;"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('shareStaffModal')">Done</button>
        <button class="btn btn-primary" onclick="copyStaffInviteDetails()">📋 Copy Credentials</button>
      </div>
    </div>
  </div>
  `;
}

