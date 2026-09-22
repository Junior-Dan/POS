import { store } from '../store/CellarStore.js';

let activeSettingsTab = "business";

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

  return `
  <div class="view-container" id="view-settings">
    <!-- Header Admin Banner -->
    <div style="background:var(--bg-elevated); border:1px solid var(--border-soft); border-radius:var(--radius-lg); padding:16px 20px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div style="font-size:18px; font-weight:800; color:var(--text); font-family:'Fraunces', serif;">
          ${profile.name || 'Cisco Wines & Spirits'} — Administration Center
        </div>
        <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">
          Software: <strong style="color:var(--accent);">CELLAR POS v2.4 Enterprise</strong> | Account ID: <span style="font-family:monospace;">BIZ-8849-NBO</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="text-align:right;">
          <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase;">Setup Completion</div>
          <div style="font-size:16px; font-weight:800; color:var(--green);">${setup.percentage}% Configured</div>
        </div>
        <div style="width:40px; height:40px; border-radius:50%; border:3px solid var(--green); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:var(--green);">
          ${setup.percentage}%
        </div>
      </div>
    </div>

    <!-- Administration Tabs Bar -->
    <div class="settings-nav-tabs" style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:16px; border-bottom:1px solid var(--border-soft);">
      <button class="settings-tab-btn ${activeSettingsTab === 'business' ? 'active' : ''}" onclick="switchSettingsTab('business')">1. Business Profile</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'branches' ? 'active' : ''}" onclick="switchSettingsTab('branches')">2. Branches (${branches.length})</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'staff' ? 'active' : ''}" onclick="switchSettingsTab('staff')">3. Staff Management (${users.length})</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'roles' ? 'active' : ''}" onclick="switchSettingsTab('roles')">4. Roles & Permissions</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'receipt' ? 'active' : ''}" onclick="switchSettingsTab('receipt')">5. Receipt Settings</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'payment' ? 'active' : ''}" onclick="switchSettingsTab('payment')">6. Payment Settings</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'shift' ? 'active' : ''}" onclick="switchSettingsTab('shift')">7. Shift & Float</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'security' ? 'active' : ''}" onclick="switchSettingsTab('security')">8. Security & Auth</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'preferences' ? 'active' : ''}" onclick="switchSettingsTab('preferences')">9. System Preferences</button>
      <button class="settings-tab-btn ${activeSettingsTab === 'setup' ? 'active' : ''}" onclick="switchSettingsTab('setup')">10. Setup Status (${setup.percentage}%)</button>
    </div>

    <!-- Tab Contents Container -->
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
            <div>
              <div class="section-title">Multi-Branch Management</div>
              <span class="section-subtitle">Configure enterprise branches, assigned managers, and location scoping</span>
            </div>
            <button class="btn btn-primary" onclick="openAddBranchModal()">+ Add New Branch</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Branch Name</th>
                  <th>Branch Code</th>
                  <th>Location</th>
                  <th>Phone</th>
                  <th>Manager</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${branches.map(b => {
                  const manager = users.find(u => u.id === b.managerId);
                  return `
                    <tr>
                      <td><strong>${b.name}</strong></td>
                      <td><span class="size-badge">${b.code}</span></td>
                      <td>${b.location}</td>
                      <td>${b.phone || 'N/A'}</td>
                      <td>${manager ? manager.name : '<span style="color:var(--text-faint);">Unassigned</span>'}</td>
                      <td><span class="badge ${b.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${b.status}</span></td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          <button class="btn btn-secondary btn-sm" onclick="openEditBranchModal('${b.id}')">Edit</button>
                          <button class="btn btn-danger btn-sm" onclick="deleteBranch('${b.id}')">Delete</button>
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

    case 'staff':
      return `
        <div class="section-card">
          <div class="section-header">
            <div>
              <div class="section-title">Staff Management & Security PINs</div>
              <span class="section-subtitle">Manage staff accounts, primary & cross-branch access, roles, and secret PINs</span>
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
                ${users.map(u => {
                  const primBranch = branches.find(b => b.id === u.primaryBranchId);
                  const addBranches = (u.additionalBranchIds || []).map(id => branches.find(b => b.id === id)?.name).filter(Boolean);
                  return `
                    <tr>
                      <td>
                        <strong>${u.name}</strong><br>
                        <span style="font-size:11px; color:var(--text-dim);">${u.email || u.phone || ''}</span>
                      </td>
                      <td><span class="badge badge-warning" style="text-transform:uppercase;">${u.role}</span></td>
                      <td>${primBranch ? primBranch.name : 'Nairobi CBD Main'}</td>
                      <td>${addBranches.length ? addBranches.map(n => `<span class="size-badge">${n}</span>`).join(' ') : '<span style="color:var(--text-faint);">None</span>'}</td>
                      <td><span style="font-family:monospace; letter-spacing:3px; color:var(--accent);">••••</span></td>
                      <td><span class="badge ${u.status === 'INACTIVE' ? 'badge-danger' : 'badge-success'}">${u.status || 'ACTIVE'}</span></td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          <button class="btn btn-secondary btn-sm" onclick="openEditStaffModal('${u.id}')">Edit</button>
                          <button class="btn btn-primary btn-sm" onclick="openResetPinModal('${u.id}')" style="background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent-border);">Reset PIN</button>
                          ${u.role !== 'owner' ? `<button class="btn btn-danger btn-sm" onclick="deleteStaff('${u.id}')">Deactivate</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

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
