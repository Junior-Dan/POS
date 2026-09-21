export function renderTopbar() {
  return `
  <header class="top-header">
    <div class="header-left">
      <div class="page-title" id="pageTitle">Dashboard Overview</div>
      <div class="global-search-container">
        <span class="global-search-icon">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input type="text" class="global-search-input" id="globalSearchInput" placeholder="Global search (Product, Barcode, Receipt, Supplier)... [/]">
      </div>
    </div>
    <div class="header-actions">
      <div class="status-pill online" id="networkStatusPill">
        <span class="status-dot"></span>
        <span id="networkStatusText">ONLINE</span>
      </div>
      <div class="status-pill" style="background:var(--accent-soft); color:var(--accent); border-color:var(--accent-border);">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Shift #104: Active</span>
      </div>
      <button class="btn btn-secondary btn-sm" id="quickSeedBtn">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        <span>Refresh Seed Data</span>
      </button>
    </div>
  </header>
  `;
}
