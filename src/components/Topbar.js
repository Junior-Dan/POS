import { store } from '../store/CellarStore.js';

export function renderTopbar(currentUser = store.currentUser) {
  const bizName = store.businessProfile?.name || "Hypebeast Store";
  const userInitials = (currentUser?.name || "Hypebeast Store").split(' ').map(n => n[0]).join('');
  
  const currentDateObj = store.getSelectedDateObj();
  const formattedDate = currentDateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const isoDateVal = currentDateObj.toISOString().split('T')[0];

  // Branch selector options based on user role and assigned branches
  let availableBranches = store.branches;
  if (currentUser.role !== 'owner') {
    const allowedBranchIds = [currentUser.primaryBranchId, ...(currentUser.additionalBranchIds || [])].filter(Boolean);
    availableBranches = store.branches.filter(b => allowedBranchIds.includes(b.id));
    if (availableBranches.length === 0) availableBranches = [store.branches[0]];
  }

  const activeBranch = store.getActiveBranch();

  return `
  <header class="top-header">
    <div class="top-header-left">
      <!-- Search Input Pill -->
      <div class="global-search-container">
        <span class="global-search-icon">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input type="text" class="global-search-input" id="globalSearchInput" placeholder="Search a product...">
      </div>

      <!-- Custom Date Dropdown Pill with Popover Modal -->
      <div class="topbar-date-pill" id="topbarDatePickerBtn" title="Click to choose a date to inspect historical sales data">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <span id="topbarDateText">${formattedDate}</span>
        <svg class="icon-sm chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>

        <!-- Custom Calendar Popover Dropdown Card -->
        <div class="custom-calendar-popover" id="calendarPopover">
          <div class="cal-header">
            <button class="cal-nav-btn" id="calPrevMonthBtn" type="button" title="Previous Month">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span class="cal-month-title" id="calMonthTitle">September 2026</span>
            <button class="cal-nav-btn" id="calNextMonthBtn" type="button" title="Next Month">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div class="cal-presets-row">
            <button class="cal-preset-btn" id="calPresetToday" type="button">Today</button>
            <button class="cal-preset-btn" id="calPresetYesterday" type="button">Yesterday</button>
            <button class="cal-preset-btn" id="calPresetLast7" type="button">Last 7 Days</button>
          </div>

          <div class="cal-day-names">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div class="cal-days-grid" id="calDaysGrid"></div>

          <div class="cal-footer">
            <span class="cal-footer-text">Select date for sales history</span>
            <button class="btn btn-secondary btn-sm" id="calCancelBtn" type="button" style="padding:3px 8px; font-size:11px;">Close</button>
          </div>
        </div>
      </div>
      ${store.selectedDate ? `<button class="btn btn-secondary btn-sm" id="resetDateTodayBtn" style="padding:4px 10px; font-size:11px;">Reset Today</button>` : ''}
    </div>

    <div class="top-header-right">
      <!-- Message Notification Button with Badge Dot -->
      <button class="topbar-icon-btn" title="Messages">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        <span class="notification-badge-dot"></span>
      </button>

      <!-- Alert Notification Bell with Badge Dot -->
      <button class="topbar-icon-btn" title="Notifications">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        <span class="notification-badge-dot"></span>
      </button>

      <!-- Interactive Branch Switcher Dropdown (Company Name Top, Tiny Branch Below - Image 1 & 3) -->
      <div class="topbar-branch-badge" id="topbarBranchContainer" title="Click to switch branch">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color:var(--accent); flex-shrink:0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        
        <div class="topbar-branch-text-wrap">
          <span class="topbar-company-name">${bizName}</span>
          <span class="topbar-branch-sub">${activeBranch.name}</span>
        </div>

        <select id="topbarBranchSelect" onchange="switchActiveBranch(this.value)" class="topbar-branch-select-overlay">
          ${currentUser.role === 'owner' ? `<option value="ALL" ${store.activeBranchId === 'ALL' ? 'selected' : ''}>All Branches (Enterprise View)</option>` : ''}
          ${availableBranches.map(b => `<option value="${b.id}" ${store.activeBranchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
        </select>

        <div class="topbar-avatar-pill">${userInitials[0] || 'D'}</div>
        <svg class="icon-sm chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  </header>
  `;
}

