export function renderSidebar(currentUser) {
  const avatarText = currentUser.name.split(' ').map(n=>n[0]).join('');
  return `
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="brand-box">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8M12 15v7M12 15a7 7 0 0 0 7-7c0-2-1-3.5-2-4.5V2H7v1.5C6 4.5 5 6 5 8a7 7 0 0 0 7 7z"/></svg>
        </div>
        <div>
          <div class="brand-title">CELLAR</div>
          <div class="brand-subtitle">Wines & Spirits POS</div>
        </div>
      </div>
      <div class="branch-selector">
        <div class="branch-info">
          <span class="branch-label">Active Branch</span>
          <span class="branch-name" id="currentBranchName">Nairobi CBD Main</span>
        </div>
        <span style="font-size:12px; color:var(--text-faint)">▼</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <!-- Main Operations -->
      <div class="nav-section">
        <div class="nav-section-title">Main Operations</div>
        <button class="nav-btn active" data-view="dashboard">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          <span>Dashboard</span>
        </button>
        <button class="nav-btn" data-view="pos">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span>Point of Sale</span>
        </button>
        <button class="nav-btn" data-view="products">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 12v9.5"/></svg>
          <span>Products & Stock</span>
        </button>
        <button class="nav-btn" data-view="inventory">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 16h6"/><path d="M19 13v6"/><path d="M21 10V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 6v12a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m3.3 6 8.7 5 8.7-5"/><path d="M12 11v10.5"/></svg>
          <span>Inventory Ledger</span>
          <span class="nav-badge" id="sidebarLowStockCount" style="display:none">0</span>
        </button>
        <button class="nav-btn" data-view="sales">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg>
          <span>Sales & Returns</span>
        </button>
        <button class="nav-btn" data-view="shift">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
          <span>Shift & Drawer</span>
        </button>
      </div>

      <!-- Supply & Purchasing -->
      <div class="nav-section">
        <div class="nav-section-title">Purchasing & Ops</div>
        <button class="nav-btn" data-view="suppliers">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 18h12"/><path d="M3 22h18"/><path d="M14 2v4"/><path d="M17 2v4"/><path d="M10 2v4"/><path d="M7 2v4"/><path d="M2 6h20v12H2z"/></svg>
          <span>Suppliers</span>
        </button>
        <button class="nav-btn" data-view="purchases">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
          <span>Purchase Orders</span>
        </button>
        <button class="nav-btn" data-view="expenses">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Expenses</span>
        </button>
        <button class="nav-btn" data-view="customers">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Customers</span>
        </button>
      </div>

      <!-- Compliance & Intelligence -->
      <div class="nav-section">
        <div class="nav-section-title">Compliance & Intelligence</div>
        <button class="nav-btn" data-view="compliance">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
          <span>Licensing & eTIMS</span>
        </button>
        <button class="nav-btn" data-view="reports">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <span>Reports & Profit</span>
        </button>
        <button class="nav-btn" data-view="audit">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
          <span>Audit Trail</span>
        </button>
        <button class="nav-btn" data-view="settings">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>Staff & Settings</span>
        </button>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-card">
        <div class="user-avatar" id="userAvatar">${avatarText}</div>
        <div class="user-details">
          <span class="user-name-text" id="userNameText">${currentUser.name}</span>
          <span class="user-role-badge" id="userRoleBadge">${currentUser.role}</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="switchUserBtn" title="Switch User">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/></svg>
        </button>
      </div>
    </div>
  </aside>
  `;
}
