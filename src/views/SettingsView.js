import { store } from '../store/CellarStore.js';

let activeSettingsTab = "branches";

export function renderSettingsView() {
  const profile = store.businessProfile || {};
  const branches = store.branches || [];
  const users = store.users || [];
  const payment = store.paymentSettings || {};
  const receipt = store.receiptSettings || {};
  const shift = store.shiftSettings || {};
  const security = store.securitySettings || {};
  const pref = store.systemPreferences || {};
  const setup = store.getSetupStatus();

  setTimeout(() => {
    bindSettingsTabEvents();
  }, 50);

  const tabs = [
    { id: "business", label: "Business Profile", icon: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>` },
    { id: "branches", label: "Branches", icon: `<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 13v2"/>` },
    { id: "staff", label: "Staff Management", icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
    { id: "receipt", label: "Receipt Settings", icon: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><line x1="8" x2="16" y1="8" y2="8"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="8" x2="12" y1="16" y2="16"/>` },
    { id: "payment", label: "Payment Settings", icon: `<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>` },
    { id: "shift", label: "Shift & Float", icon: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>` },
    { id: "security", label: "Security & Auth", icon: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>` },
    { id: "preferences", label: "System Preferences", icon: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>` }
  ];

  return `
  <div class="view-container" id="view-settings">
    <!-- Top Header Title Section (Matches Reference Image) -->
    <div class="settings-title-header">
      <div class="settings-title-icon-box">
        <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </div>
      <div>
        <h1 class="settings-main-title">Staff & Settings</h1>
        <p class="settings-main-subtitle">Manage your staff, branches and system settings</p>
      </div>
    </div>

    <!-- Elevated Settings Tabs Bar (Matches Reference Image Card) -->
    <div class="settings-nav-tabs-card">
      ${tabs.map(t => `
        <button class="settings-tab-btn ${t.id === activeSettingsTab ? 'active' : ''}" onclick="switchSettingsTab('${t.id}')">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">${t.icon}</svg>
          <span>${t.label}</span>
        </button>
      `).join('')}
    </div>

    <!-- Main Content Container -->
    <div id="settingsTabContentRoot">
      ${renderSettingsTabContentHtml(activeSettingsTab, profile, branches, users, payment, receipt, shift, security, pref, setup)}
    </div>
  </div>
  `;
}

function renderSettingsTabContentHtml(tab, profile, branches, users, payment, receipt, shift, security, pref, setup) {
  switch (tab) {
    case 'business':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Business Profile & Legal Configuration</div>
            <button class="btn btn-primary" onclick="submitSaveBusinessProfile()">Save Business Profile</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Business Name *</label>
              <input type="text" class="form-input" id="setBizName" value="${profile.name || ''}" placeholder="e.g. Cisco Wines & Spirits">
              <span style="font-size:11px; color:var(--text-faint);">Official registered business identity (CELLAR remains software branding).</span>
            </div>
            <div class="form-group">
              <label class="form-label">Business Phone Number *</label>
              <input type="text" class="form-input" id="setBizPhone" value="${profile.phone || ''}" placeholder="e.g. 0722 000 111">
            </div>
            <div class="form-group">
              <label class="form-label">Business Email</label>
              <input type="email" class="form-input" id="setBizEmail" value="${profile.email || ''}" placeholder="e.g. info@ciscowines.co.ke">
            </div>
            <div class="form-group">
              <label class="form-label">Physical Headquarters Address *</label>
              <input type="text" class="form-input" id="setBizAddress" value="${profile.address || ''}" placeholder="e.g. Kenyatta Avenue, Nairobi CBD">
            </div>
            <div class="form-group">
              <label class="form-label">KRA PIN Number *</label>
              <input type="text" class="form-input" id="setKraPin" value="${profile.kraPin || ''}" placeholder="e.g. P051234567S">
            </div>
            <div class="form-group">
              <label class="form-label">Business Registration / Certificate No.</label>
              <input type="text" class="form-input" id="setBizRegNo" value="${profile.regNo || ''}" placeholder="e.g. CPR/2024/99182">
            </div>
          </div>

          <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border-soft);">
            <div style="font-size:14px; font-weight:700; color:var(--accent); margin-bottom:12px;">POS Receipt Printing Profile</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Receipt Header Business Name</label>
                <input type="text" class="form-input" id="setReceiptName" value="${profile.receiptName || profile.name || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Receipt Phone</label>
                <input type="text" class="form-input" id="setReceiptPhone" value="${profile.receiptPhone || profile.phone || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Receipt Address</label>
                <input type="text" class="form-input" id="setReceiptAddress" value="${profile.receiptAddress || profile.address || ''}">
              </div>
            </div>
          </div>
        </div>
      `;

    case 'branches':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title-box">
              <div class="section-title-icon-yellow">
                <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 13v2"/></svg>
              </div>
              <div>
                <div class="section-title">Multi-Branch Management</div>
                <span class="section-subtitle">Configure enterprise branches, assigned managers, and location scoping</span>
              </div>
            </div>
            <button class="btn btn-yellow-accent" onclick="openAddBranchModal()">+ Add New Branch</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>BRANCH NAME</th>
                  <th>BRANCH CODE</th>
                  <th>LOCATION</th>
                  <th>PHONE</th>
                  <th>MANAGER</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                ${branches.map((b, idx) => {
                  const isOwner = store.currentUser?.role === 'owner';
                  const manager = isOwner ? users.find(u => u.id === b.managerId) : (b.managerId === store.currentUser?.id ? store.currentUser : null);
                  const subLabel = idx === 0 ? 'Main' : 'Branch';
                  return `
                    <tr>
                      <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <div class="branch-icon-pin">
                            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <div>
                            <strong>${b.name}</strong><br>
                            <span style="font-size:11px; color:var(--text-faint);">${subLabel}</span>
                          </div>
                        </div>
                      </td>
                      <td><span class="size-badge">${b.code}</span></td>
                      <td>${b.location}</td>
                      <td>${b.phone || 'N/A'}</td>
                      <td>${manager ? manager.name : '<span style="color:var(--text-faint);">Branch Admin</span>'}</td>
                      <td><span class="badge badge-success">• ACTIVE</span></td>
                      <td>
                        <div style="display:flex; gap:8px;">
                          <button class="btn btn-secondary btn-sm" onclick="openEditBranchModal('${b.id}')">
                            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> Edit
                          </button>
                          <button class="btn btn-danger-soft btn-sm" onclick="deleteBranch('${b.id}')">
                            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-faint);">No branches configured</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;

    case 'staff': {
      const isOwner = store.currentUser?.role === 'owner';
      const userBranchIds = [store.currentUser?.primaryBranchId, ...(store.currentUser?.additionalBranchIds || [])].filter(Boolean);

      const visibleUsers = users.filter(u => {
        if (isOwner) return true;
        // Managers can ONLY see Cashiers and Inventory Officers assigned to their branch (never managers or owners)
        const isCashierOrInventory = u.role === 'cashier' || u.role === 'inventory_officer';
        const isSameBranch = userBranchIds.length === 0 || userBranchIds.includes(u.primaryBranchId) || !u.primaryBranchId;
        return isCashierOrInventory && isSameBranch;
      });

      return `
        <div class="section-card">
          <div class="section-header">
            <div>
              <div class="section-title">Staff Management & Security PINs</div>
              <span class="section-subtitle">${isOwner ? 'Manage enterprise staff, branch access, roles, and PINs' : 'Manage your branch cashiers and inventory staff'}</span>
            </div>
            <button class="btn btn-primary" onclick="openAddStaffModal()">+ Add Staff Account</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Primary Branch</th>
                  <th>Additional Branch Access</th>
                  <th>Security PIN</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${visibleUsers.length > 0 ? visibleUsers.map(u => {
                  const primBranch = branches.find(b => b.id === u.primaryBranchId);
                  const addBranches = (u.additionalBranchIds || []).map(id => branches.find(b => b.id === id)?.name).filter(Boolean);

                  return `
                    <tr>
                      <td>
                        <strong>${u.name}</strong><br>
                        <span style="font-size:11px; color:var(--text-dim);">${u.email || u.phone || ''}</span>
                      </td>
                      <td><span class="badge ${u.role === 'cashier' ? 'badge-info' : 'badge-primary'}" style="text-transform:uppercase;">${u.role.replace('_', ' ')}</span></td>
                      <td>${primBranch ? primBranch.name : 'Nairobi CBD Main'}</td>
                      <td>${addBranches.length ? addBranches.map(n => `<span class="size-badge">${n}</span>`).join(' ') : '<span style="color:var(--text-faint);">None</span>'}</td>
                      <td><span style="font-family:monospace; letter-spacing:3px; color:var(--accent);">••••</span></td>
                      <td><span class="badge ${u.status === 'INACTIVE' ? 'badge-danger' : 'badge-success'}">${u.status || 'ACTIVE'}</span></td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          <button class="btn btn-secondary btn-sm" onclick="openEditStaffModal('${u.id}')">Edit</button>
                          <button class="btn btn-primary btn-sm" onclick="openResetPinModal('${u.id}')" style="background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent-border);">Reset PIN</button>
                          <button class="btn btn-danger btn-sm" onclick="deleteStaff('${u.id}')">Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-faint);">No cashier or inventory staff registered for this branch yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    case 'roles':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Roles & Default Module Access Matrix</div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>System Module</th>
                  <th>OWNER</th>
                  <th>MANAGER</th>
                  <th>CASHIER</th>
                  <th>INVENTORY OFFICER</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Dashboard Overview</td><td>✓ Full Access</td><td>✓ Own Branch</td><td>✗ Restricted</td><td>✗ Restricted</td></tr>
                <tr><td>Point of Sale (POS)</td><td>✓ Full Access</td><td>✓ Full Access</td><td>✓ Assigned Shift</td><td>✗ Restricted</td></tr>
                <tr><td>Products & Stock Catalog</td><td>✓ Full Access</td><td>✓ Full Access</td><td>✗ Restricted</td><td>✓ Full Access</td></tr>
                <tr><td>Inventory Ledger & Audit</td><td>✓ Full Access</td><td>✓ Full Access</td><td>✗ Restricted</td><td>✓ Full Access</td></tr>
                <tr><td>Sales & Returns</td><td>✓ Full Access</td><td>✓ Own Branch</td><td>✓ Own Sales</td><td>✗ Restricted</td></tr>
                <tr><td>Shift & Drawer Reconciliation</td><td>✓ Full Access</td><td>✓ Own Branch</td><td>✓ Assigned Shift</td><td>✗ Restricted</td></tr>
                <tr><td>Suppliers Directory</td><td>✓ Full Access</td><td>✓ Full Access</td><td>✗ Restricted</td><td>✓ Full Access</td></tr>
                <tr><td>Purchase Orders (LPO / GRN)</td><td>✓ Full Access</td><td>✓ Full Access</td><td>✗ Restricted</td><td>✓ Full Access</td></tr>
                <tr><td>Operational Expenses</td><td>✓ Full Access</td><td>✓ Own Branch</td><td>✗ Restricted</td><td>✗ Restricted</td></tr>
                <tr><td>Customers Registry</td><td>✓ Full Access</td><td>✓ Full Access</td><td>✓ Checkout Access</td><td>✗ Restricted</td></tr>
                <tr><td>Licensing & eTIMS</td><td>✓ Full Access</td><td>✓ Read Only</td><td>✗ Restricted</td><td>✗ Restricted</td></tr>
                <tr><td>Reports & Profit Analytics</td><td>✓ Full Access</td><td>✓ Own Branch</td><td>✗ Restricted</td><td>✗ Restricted</td></tr>
                <tr><td>Audit Trail Log</td><td>✓ Full Access</td><td>✓ Own Branch</td><td>✗ Restricted</td><td>✗ Restricted</td></tr>
                <tr><td>Staff & Enterprise Settings</td><td>✓ Full Access</td><td>✓ Branch Staff</td><td>✗ Restricted</td><td>✗ Restricted</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

    case 'receipt':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Receipt Printing & Branding Configuration</div>
            <button class="btn btn-primary" onclick="submitSaveReceiptSettings()">Save Receipt Settings</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div>
              <div class="form-group">
                <label class="form-label">Receipt Top Header Text *</label>
                <input type="text" class="form-input" id="recHeaderInput" value="${receipt.headerText || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Receipt Bottom Footer Note *</label>
                <input type="text" class="form-input" id="recFooterInput" value="${receipt.footerText || ''}">
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
                <div class="form-group">
                  <label class="form-label">Number of Copies</label>
                  <input type="number" class="form-input" id="recCopiesInput" value="${receipt.printCopies || 1}" min="1" max="5">
                </div>
                <div class="form-group">
                  <label class="form-label">Show Cashier Name</label>
                  <select class="form-select" id="recShowCashierSelect">
                    <option value="true" ${receipt.showCashierName ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!receipt.showCashierName ? 'selected' : ''}>No</option>
                  </select>
                </div>
              </div>
            </div>
            <div style="background:#fff; color:#000; padding:16px; border-radius:var(--radius-md); font-family:monospace; font-size:12px; border:1px solid #ccc;">
              <div style="text-align:center; font-weight:bold; font-size:14px;">${receipt.headerText || 'CISCO WINES & SPIRITS'}</div>
              <div style="text-align:center;">Kenyatta Avenue, Nairobi CBD</div>
              <div style="text-align:center;">TEL: 0722 000 111 | PIN: P051234567S</div>
              <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>
              <div>REC: REC-2026-8812</div>
              <div>DATE: ${new Date().toLocaleString()}</div>
              <div>CASHIER: John Omondi</div>
              <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>
              <div style="display:flex; justify-content:space-between;"><span>1x Johnnie Walker Black 750ml</span><span>KSh 3,800</span></div>
              <div style="display:flex; justify-content:space-between; font-weight:bold; margin-top:8px;"><span>TOTAL PAID (CASH)</span><span>KSh 3,800</span></div>
              <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>
              <div style="text-align:center; font-size:11px; font-style:italic;">${receipt.footerText || 'Thank you for shopping at Cisco Wines!'}</div>
            </div>
          </div>
        </div>
      `;

    case 'payment':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Enabled POS Payment Options</div>
            <button class="btn btn-primary" onclick="submitSavePaymentSettings()">Save Payment Settings</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div style="background:var(--surface); padding:14px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
              <div>
                <strong style="color:var(--accent);">Cash Payments</strong>
                <div style="font-size:11px; color:var(--text-dim);">Accept physical cash in register drawer</div>
              </div>
              <input type="checkbox" id="payOptCash" ${payment.cashEnabled ? 'checked' : ''} style="width:20px; height:20px;">
            </div>
            <div style="background:var(--surface); padding:14px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
              <div>
                <strong style="color:var(--green);">M-PESA STK Push & Till</strong>
                <div style="font-size:11px; color:var(--text-dim);">Direct Safaricom Daraja API integration</div>
              </div>
              <input type="checkbox" id="payOptMpesa" ${payment.mpesaEnabled ? 'checked' : ''} style="width:20px; height:20px;">
            </div>
            <div style="background:var(--surface); padding:14px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
              <div>
                <strong style="color:var(--blue);">Visa / Mastercard Debit Card</strong>
                <div style="font-size:11px; color:var(--text-dim);">PDQ card terminal processing</div>
              </div>
              <input type="checkbox" id="payOptCard" ${payment.cardEnabled ? 'checked' : ''} style="width:20px; height:20px;">
            </div>
            <div style="background:var(--surface); padding:14px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
              <div>
                <strong style="color:var(--purple);">Direct Bank Transfer / EFT</strong>
                <div style="font-size:11px; color:var(--text-dim);">Bank account deposits</div>
              </div>
              <input type="checkbox" id="payOptBank" ${payment.bankEnabled ? 'checked' : ''} style="width:20px; height:20px;">
            </div>
          </div>
        </div>
      `;

    case 'shift':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Shift & Cash Drawer Policy Rules</div>
            <button class="btn btn-primary" onclick="submitSaveShiftSettings()">Save Shift Rules</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Default Opening Cash Float (KES)</label>
              <input type="number" class="form-input" id="shiftFloatInput" value="${shift.defaultFloat || 5000}">
            </div>
            <div class="form-group">
              <label class="form-label">Max Allowed Cash Variance Without Manager Approval (KES)</label>
              <input type="number" class="form-input" id="shiftVarianceInput" value="${shift.maxVarianceThreshold || 1000}">
            </div>
          </div>
        </div>
      `;

    case 'security':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Security & Sensitive Action Policy</div>
            <button class="btn btn-primary" onclick="submitSaveSecuritySettings()">Save Security Rules</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Session Timeout (Minutes)</label>
              <input type="number" class="form-input" id="secTimeoutInput" value="${security.sessionTimeoutMinutes || 30}">
            </div>
            <div class="form-group">
              <label class="form-label">Max Allowed Discount Without Manager PIN (%)</label>
              <input type="number" class="form-input" id="secDiscountInput" value="${security.maxDiscountPercentWithoutAuth || 5}">
            </div>
          </div>
        </div>
      `;

    case 'preferences':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">System Preferences</div>
            <button class="btn btn-primary" onclick="submitSaveSystemPreferences()">Save Preferences</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Currency Symbol</label>
              <input type="text" class="form-input" id="prefCurrencyInput" value="${pref.currencySymbol || 'KSh'}">
            </div>
            <div class="form-group">
              <label class="form-label">VAT Tax Rate (%)</label>
              <input type="number" class="form-input" id="prefTaxRateInput" value="${pref.taxRate || 16}">
            </div>
          </div>
        </div>
      `;

    case 'setup':
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Real System Setup Status Checklist</div>
            <span class="section-subtitle">${setup.percentage}% Configured</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Setup Step</th>
                  <th>Requirement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${setup.steps.map(s => `
                  <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>Real enterprise system requirement</td>
                    <td><span class="badge ${s.status === 'COMPLETE' ? 'badge-success' : 'badge-warning'}">${s.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

    default:
      return `<div>Select a tab above</div>`;
  }
}

function bindSettingsTabEvents() {
  window.switchSettingsTab = function(tabName) {
    activeSettingsTab = tabName;
    const root = document.getElementById('view-settings');
    if (root) {
      const container = document.getElementById('settingsTabContentRoot');
      if (container) {
        container.innerHTML = renderSettingsTabContentHtml(
          activeSettingsTab,
          store.businessProfile || {},
          store.branches || [],
          store.users || [],
          store.paymentSettings || {},
          store.receiptSettings || {},
          store.shiftSettings || {},
          store.securitySettings || {},
          store.systemPreferences || {},
          store.getSetupStatus()
        );
      }
      document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.querySelector(`.settings-tab-btn[onclick="switchSettingsTab('${tabName}')"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }
  };
}
