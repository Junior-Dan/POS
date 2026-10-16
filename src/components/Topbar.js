import { store } from '../store/CellarStore.js';

export function renderTopbar(currentUser = store.currentUser) {
  const user = currentUser || store.currentUser || { name: 'Owner Account', role: 'owner' };
  const bizName = store.businessProfile?.name || "Cellar POS";
  const userInitials = (user.name || "David Kamau").split(' ').map(n => n[0]).join('');
  
  const currentDateObj = store.getSelectedDateObj();
  const formattedDate = currentDateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const isoDateVal = currentDateObj.toISOString().split('T')[0];

  const notifications = store.notifications || [];
  const unreadCount = store.getUnreadNotificationsCount();

  // Branch context control. Each branch stands alone (no aggregate view): owners
  // get a switcher to view ONE branch at a time; staff see their assigned branch
  // as a fixed, read-only label and can never switch.
  const isOwner = (user.role || '').toLowerCase() === 'owner';
  const branchList = store.branches || [];
  const activeBranch = branchList.find(x => x.id === store.activeBranchId) || branchList[0] || { name: 'Main Branch', location: 'Head Office' };

  const branchSwitcherHtml = isOwner
    ? `
      <div style="position:relative;" id="topbarBranchWrapper">
        <button type="button" class="topbar-branch-pill" id="topbarBranchBtn" onclick="toggleBranchPopover()" title="Switch outlet / branch context">
          <span class="branch-pill-name">${activeBranch.name}</span>
          <svg class="icon-sm branch-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <div class="custom-branch-popover" id="branchPopover">
          <div class="branch-popover-header">
            <span class="branch-popover-title">Store Outlets</span>
            <span class="branch-popover-badge">${branchList.length} ${branchList.length === 1 ? 'Store' : 'Stores'}</span>
          </div>

          <div class="branch-popover-list">
            ${branchList.map(b => {
              const isSelected = store.activeBranchId === b.id;
              const locationText = b.location || (b.code ? `Code: ${b.code}` : 'Store Location');
              return `
                <div class="branch-option-item ${isSelected ? 'selected' : ''}" onclick="selectBranchContext('${b.id}')">
                  <div class="branch-option-details">
                    <div class="branch-option-name">${b.name}</div>
                    <div class="branch-option-sub">${locationText}</div>
                  </div>
                  ${isSelected ? `
                    <div class="branch-option-check">
                      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div class="branch-popover-footer">
            <button type="button" class="branch-add-btn" onclick="openCreateBranchFromDropdown()">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Add New Branch</span>
            </button>
          </div>
        </div>
      </div>
    `
    : `
      <div class="topbar-branch-pill fixed-staff" title="Your assigned store outlet">
        <span class="branch-pill-name">${activeBranch.name}</span>
      </div>
    `;

  const notifItemsHtml = notifications.length > 0 ? notifications.map(n => `
    <div class="notif-item ${!n.read ? 'unread' : ''}">
      <div class="notif-icon ${n.type === 'shift' ? 'shift' : n.type === 'cash' ? 'cash' : 'alert'}">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      </div>
      <div class="notif-content">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-msg">${n.message}</div>
        <div class="notif-time">${new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${n.cashierName || 'Cashier'}</div>
      </div>
    </div>
  `).join('') : `<div style="padding:20px; text-align:center; color:var(--text-faint); font-size:12px;">No notifications yet</div>`;

  return `
  <header class="top-header">
    <div class="top-header-left">
      <!-- Search Input Pill -->
      <div class="global-search-container">
        <span class="global-search-icon">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <!-- type=search + the ignore hints stop Chrome autofill and password
             managers (1Password/LastPass/Bitwarden) from dropping the saved
             login email into this box. autocomplete="off" alone is ignored. -->
        <input type="search" class="global-search-input" id="globalSearchInput" name="cellar-product-search" value="" placeholder="Search a product..." autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-form-type="other" data-1p-ignore>
        <div class="global-search-results" id="globalSearchResultsPopover" style="display:none;"></div>
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
      <!-- Branch context switcher (owner) / fixed branch (staff) -->
      ${branchSwitcherHtml}

      <!-- Alert Notification Bell with Badge Dot & Popover Dropdown -->
      <div style="position:relative;" id="topbarNotifWrap">
        <button class="topbar-icon-btn" id="topbarNotificationBtn" title="Shift & Manager Notifications">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          ${unreadCount > 0 ? `<span class="notification-count-badge">${unreadCount}</span>` : ''}
        </button>

        <div class="notifications-popover" id="notificationsPopover">
          <div class="notif-header">
            <div class="notif-title">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color:var(--accent);"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              <span>Manager & Shift Alerts (${unreadCount} unread)</span>
            </div>
            <button class="notif-clear-btn" type="button" onclick="markAllNotificationsRead()">Mark all as read</button>
          </div>
          <div class="notif-list">
            ${notifItemsHtml}
          </div>
        </div>
      </div>
    </div>
  </header>
  `;
}

