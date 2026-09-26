import { store } from '../store/CellarStore.js';

export function renderSidebar(currentUser, activeViewId = 'dashboard') {
  const user = currentUser || store.currentUser || { name: 'David Kamau', role: 'owner' };
  const avatarText = (user.name || 'Owner').split(' ').map(n => n[0]).join('');
  const bizName = store.businessProfile?.name || "Cisco Wines & Spirits";
  const activeBranch = store.getActiveBranch();

  // Branch selector options based on user role and assigned branches
  let availableBranches = store.branches || [];
  if (user.role !== 'owner') {
    const allowedBranchIds = [user.primaryBranchId, ...(user.additionalBranchIds || [])].filter(Boolean);
    availableBranches = (store.branches || []).filter(b => allowedBranchIds.includes(b.id));
    if (availableBranches.length === 0) availableBranches = [store.branches[0]];
  }


  // Navigation tabs with role permission validation
  const allNavItems = [
    { section: "Main Operations", items: [
      { id: "dashboard", label: "Dashboard", icon: `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>` },
      { id: "pos", label: "Point of Sale", icon: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>` },
      { id: "products", label: "Products & Stock", icon: `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 12v9.5"/>` },
      { id: "inventory", label: "Inventory Ledger", icon: `<path d="M16 16h6"/><path d="M19 13v6"/><path d="M21 10V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 6v12a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m3.3 6 8.7 5 8.7-5"/><path d="M12 11v10.5"/>` },
      { id: "sales", label: "Sales & Returns", icon: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/>` },
      { id: "shift", label: "Shift & Drawer", icon: `<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>` }
    ]},
    { section: "Purchasing & Ops", items: [
      { id: "suppliers", label: "Suppliers", icon: `<path d="M6 18h12"/><path d="M3 22h18"/><path d="M14 2v4"/><path d="M17 2v4"/><path d="M10 2v4"/><path d="M7 2v4"/><path d="M2 6h20v12H2z"/>` },
      { id: "purchases", label: "Purchase Orders", icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>` },
      { id: "expenses", label: "Expenses", icon: `<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
      { id: "customers", label: "Customers", icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` }
    ]},
    { section: "Compliance", items: [
      { id: "compliance", label: "Licensing & eTIMS", icon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>` },
      { id: "reports", label: "Reports & Profit", icon: `<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>` },
      { id: "audit", label: "Audit Trail", icon: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>` },
      { id: "settings", label: "Staff & Settings", icon: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>` }
    ]}
  ];

  return `
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="brand-box">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8M12 15v7M12 15a7 7 0 0 0 7-7c0-2-1-3.5-2-4.5V2H7v1.5C6 4.5 5 6 5 8a7 7 0 0 0 7 7z"/></svg>
        </div>
        <div class="brand-info-wrap">
          <div class="brand-title">CELLAR POS</div>
        </div>
      </div>
      <button class="sidebar-toggle-btn-sq sidebar-toggle-trigger" id="sidebarToggleBtn" title="Toggle Sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="3"/>
          <path d="M9 3v18"/>
          <path d="m14 9-3 3 3 3"/>
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      ${allNavItems.map(sec => {
        const visibleItems = sec.items.filter(item => store.canUserAccessView(user, item.id));
        if (visibleItems.length === 0) return '';
        return `
          <div class="nav-section">
            <div class="nav-section-title">${sec.section}</div>
            ${visibleItems.map(item => `
              <button class="nav-btn ${item.id === activeViewId ? 'active' : ''}" data-view="${item.id}">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">${item.icon}</svg>
                <span>${item.label}</span>
              </button>
            `).join('')}
          </div>
        `;
      }).join('')}
    </nav>

    <div class="sidebar-footer">
      <div class="user-card">
        <div class="user-avatar" id="userAvatar">${avatarText}</div>
        <div class="user-details">
          <span class="user-name-text" id="userNameText">${user.name}</span>
          <span class="user-role-badge" id="userRoleBadge" style="text-transform:uppercase;">${user.role}</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="switchUserBtn" title="Switch User Role">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/></svg>
        </button>
      </div>
    </div>
  </aside>
  `;
}
