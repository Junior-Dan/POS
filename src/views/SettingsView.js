import { store } from '../store/CellarStore.js';

let activeSettingsTab = "staff";

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
    { id: "staff", label: "Staff Management", icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
    { id: "branches", label: "Branches & Outlets", icon: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>` },
    { id: "business", label: "Business Profile", icon: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>` },
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
        <p class="settings-main-subtitle">Manage your staff, roles and system settings</p>
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
    case 'branches':
      return `
        <div class="section-card">
          <div class="section-header">
            <div>
              <div class="section-title">Branches & Commodity Outlets</div>
              <span class="section-subtitle">Manage multi-store locations, water depots, and commodity outlets</span>
            </div>
            <button class="btn btn-primary" onclick="openAddBranchModal()">+ Add New Branch / Outlet</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Branch & Code</th>
                  <th>Commodity Focus</th>
                  <th>Location / Address</th>
                  <th>Contact Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${branches.length > 0 ? branches.map(b => `
                  <tr>
                    <td>
                      <strong>${b.name}</strong><br>
                      <span style="font-family:monospace; font-size:11px; color:var(--text-dim);">CODE: ${b.code || b.id}</span>
                    </td>
                    <td><span class="badge badge-info" style="font-size:11px;">${b.commodityType || b.commodity_type || 'Liquor & General'}</span></td>
                    <td>${b.location || 'N/A'}</td>
                    <td>${b.phone || 'N/A'}</td>
                    <td><span class="badge ${b.status === 'INACTIVE' ? 'badge-danger' : 'badge-success'}">${b.status || 'ACTIVE'}</span></td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="openEditBranchModal('${b.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteBranch('${b.id}')">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-faint);">No custom branches configured yet</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;

    case 'business':
      const currentOrgId = store.currentUser?.organizationId || '';
      return `
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Business Profile & Legal Configuration</div>
            <button class="btn btn-primary" onclick="submitSaveBusinessProfile()">Save Business Profile</button>
          </div>

          ${currentOrgId ? `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 18px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748b;">Store Identifier / URL Link (Small Letters)</div>
                <div style="font-size:20px; font-weight:800; font-family:monospace; color:var(--text-main, #0f172a); margin-top:2px;">/${currentOrgId.toLowerCase()}</div>
                <div style="font-size:12px; color:var(--text-muted, #64748b); margin-top:2px;">Clean lowercase business link used for your POS address and staff logins.</div>
              </div>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${currentOrgId.toLowerCase()}'); alert('Store ID copied: ${currentOrgId.toLowerCase()}');" style="font-weight:700; font-size:12px;">
                  📋 Copy Store ID
                </button>
                <button type="button" class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${typeof window !== 'undefined' ? window.location.origin : ''}/${currentOrgId.toLowerCase()}/pos'); alert('Staff POS login link copied: ${typeof window !== 'undefined' ? window.location.origin : ''}/${currentOrgId.toLowerCase()}/pos');" style="font-weight:700; font-size:12px;">
                  🔗 Copy Staff POS Link
                </button>
              </div>
            </div>
          ` : ''}

          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:22px; margin-bottom:22px; box-shadow:0 1px 4px rgba(0,0,0,0.03); display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:20px;">
            <div style="display:flex; align-items:flex-start; gap:20px; flex:1; min-width:300px;">
              <!-- Large Interactive Logo Box -->
              <div id="orgLogoPreviewBox" 
                   onclick="document.getElementById('orgLogoFileInput').click()"
                   ondragover="event.preventDefault(); this.style.borderColor='#0f172a'; this.style.background='#f1f5f9';"
                   ondragleave="this.style.borderColor='#94a3b8'; this.style.background='transparent';"
                   ondrop="event.preventDefault(); this.style.borderColor='#94a3b8'; this.style.background='transparent'; handleOrgLogoUpload({ target: { files: event.dataTransfer.files } });"
                   style="width:82px; height:82px; border-radius:50%; border:2px dashed #94a3b8; background:transparent; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.06); transition:all 0.2s ease;"
                   title="Click or drag & drop to upload logo">
                ${profile.logo ? `
                  <img id="orgLogoPreviewImg" src="${profile.logo}" alt="Organization Logo" style="width:100%; height:100%; object-fit:contain; border-radius:50%; background:transparent; display:block;" />
                ` : `
                  <div id="orgLogoPreviewPlaceholder" style="width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 30%, #1e293b 0%, #090d16 100%); color:#ffffff; font-weight:900; font-size:32px; letter-spacing:-0.5px; text-shadow:0 0 10px rgba(255,255,255,0.4);">
                    ${((profile.name || store.currentUser?.organizationName || 'O').trim().charAt(0) || 'O').toUpperCase()}
                  </div>
                `}
              </div>

              <!-- Logo Details & Sidebar Mockup -->
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:15px; font-weight:800; color:#0f172a;">Organization Logo & Brand Emblem</span>
                  <span style="font-size:10px; font-weight:750; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0; text-transform:uppercase;">Store Identity</span>
                </div>
                <div style="font-size:12.5px; color:#64748b; margin-top:4px; line-height:1.4; max-width:480px;">
                  Upload your business emblem. It is showcased on your top-left sidebar terminal and automatically formatted onto printed sales receipts.
                </div>

                <!-- Live Preview Badge -->
                <div style="margin-top:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                  <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Sidebar Header Preview:</div>
                  <div style="background:#090d16; border-radius:10px; padding:8px 14px; display:inline-flex; align-items:center; gap:10px; border:1px solid rgba(255,255,255,0.12); box-shadow:0 2px 6px rgba(0,0,0,0.3);">
                    <div id="orgLogoSidebarMiniMockup" style="width:34px; height:34px; border-radius:50%; overflow:hidden; background:transparent; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1.5px solid rgba(255,255,255,0.25); box-shadow:0 1px 4px rgba(0,0,0,0.35);">
                      ${profile.logo 
                        ? `<img src="${profile.logo}" style="width:100%; height:100%; object-fit:contain; border-radius:50%; background:transparent; display:block;" />` 
                        : `<div style="width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 30%, #1e293b 0%, #090d16 100%);"><span style="color:#ffffff; font-weight:900; font-size:16px; text-shadow:0 0 8px rgba(255,255,255,0.45);">${((profile.name || store.currentUser?.organizationName || 'O').trim().charAt(0) || 'O').toUpperCase()}</span></div>`
                      }
                    </div>
                    <div>
                      <div id="orgLogoSidebarMiniTitle" style="color:#ffffff; font-size:14px; font-weight:700; line-height:1.1; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${profile.name || store.currentUser?.organizationName || 'Your Business'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Upload Controls -->
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end; justify-content:center;">
              <input type="file" id="orgLogoFileInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none;" onchange="handleOrgLogoUpload(event)">
              <input type="hidden" id="setBizLogoVal" value="${profile.logo || ''}">
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('orgLogoFileInput').click()" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:8px 14px; font-size:12.5px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  ${profile.logo ? 'Change Logo Image' : 'Upload Organization Logo'}
                </button>
                <button type="button" id="removeOrgLogoBtn" class="btn btn-secondary btn-sm" onclick="removeOrgLogo()" style="display:${profile.logo ? 'inline-flex' : 'none'}; align-items:center; gap:4px; font-weight:600; font-size:12px; color:#ef4444;">
                  Remove Logo
                </button>
              </div>
              <span style="font-size:11px; color:#94a3b8;">Supports PNG, JPG, WEBP & SVG (Square or Crest)</span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Business Name *</label>
              <input type="text" class="form-input" id="setBizName" value="${profile.name || ''}" placeholder="e.g. Johns wines and spirit" oninput="if (!document.getElementById('setBizLogoVal')?.value) updateOrgLogoMonogramLive(this.value)">
              <span style="font-size:11px; color:var(--text-faint);">Official business name displayed across your POS and sidebar.</span>
            </div>
            <div class="form-group">
              <label class="form-label">Business Phone Number *</label>
              <input type="text" class="form-input" id="setBizPhone" value="${profile.phone || ''}" placeholder="e.g. 0722 000 111">
            </div>
            <div class="form-group">
              <label class="form-label">Business Email</label>
              <input type="email" class="form-input" id="setBizEmail" value="${profile.email || ''}" placeholder="e.g. info@cellar.co.ke">
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

    case 'staff': {
      const isOwner = store.currentUser?.role === 'owner';

      const visibleUsers = users.filter(u => {
        if (isOwner) return true;
        // Managers can ONLY see Cashiers and Inventory Officers (never managers or owners)
        return u.role === 'cashier' || u.role === 'inventory_officer';
      });

      return `
        <div class="section-card">
          <div class="section-header">
            <div>
              <div class="section-title">Staff Management & Security PINs</div>
              <span class="section-subtitle">${isOwner ? 'Create staff, assign roles, and manage passwords' : 'Manage cashiers and inventory staff'}</span>
            </div>
            <button class="btn btn-primary" onclick="openAddStaffModal()">+ Add Staff Account</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Security PIN</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${visibleUsers.length > 0 ? visibleUsers.map(u => {
                  return `
                    <tr>
                      <td>
                        <strong>${u.name}</strong><br>
                        <span style="font-size:11px; color:var(--text-dim);">${u.email || u.phone || ''}</span>
                      </td>
                      <td><span class="badge ${u.role === 'cashier' ? 'badge-info' : 'badge-primary'}" style="text-transform:uppercase;">${u.role.replace('_', ' ')}</span></td>
                      <td>
                        <span style="font-family:monospace; letter-spacing:2px; font-size:13px; color:var(--text-faint);" title="Passwords are stored securely hashed and cannot be displayed. Use Reset to issue a new one.">••••••••</span>
                      </td>
                      <td><span class="badge ${u.status === 'INACTIVE' ? 'badge-danger' : 'badge-success'}">${u.status || 'ACTIVE'}</span></td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          <button class="btn btn-secondary btn-sm" onclick="shareStaffLoginLink('${u.id}')" title="Share Custom Business Login Link">🔗 Share Link</button>
                          <button class="btn btn-secondary btn-sm" onclick="openEditStaffModal('${u.id}')">Edit</button>
                          <button class="btn btn-primary btn-sm" onclick="openResetPinModal('${u.id}')" style="background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent-border);">Reset PIN</button>
                          <button class="btn btn-danger btn-sm" onclick="deleteStaff('${u.id}')"${u.id === store.currentUser?.id ? ' disabled title="You cannot delete your own account" style="opacity:0.5; cursor:not-allowed;"' : ''}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-faint);">No staff registered yet</td></tr>'}
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
              <div style="text-align:center; font-weight:bold; font-size:14px;">${receipt.headerText || 'CELLAR POS'}</div>
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
              <div style="text-align:center; font-size:11px; font-style:italic;">${receipt.footerText || 'Thank you for shopping at Cellar POS!'}</div>
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
