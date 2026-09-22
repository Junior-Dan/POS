import { store } from '../store/CellarStore.js';

export function renderSuppliersView() {
  const totalSuppliers = store.suppliers.length;
  const poCount = store.purchases.length;

  return `
  <div class="view-container" id="view-suppliers">
    <!-- Stat Summary Header -->
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="stat-card accent">
        <div class="stat-header">
          <span class="stat-title">Active Suppliers</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 18h12"/><path d="M3 22h18"/><path d="M2 6h20v12H2z"/></svg></span>
        </div>
        <div class="stat-value">${totalSuppliers} Vendors</div>
        <div class="stat-subtext">Registered beverage distributors</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">Purchase Orders</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></span>
        </div>
        <div class="stat-value">${poCount} Issued</div>
        <div class="stat-subtext">LPOs in system</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">Compliance Status</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg></span>
        </div>
        <div class="stat-value">KRA PIN Verified</div>
        <div class="stat-subtext">eTIMS compliant invoicing</div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Suppliers Directory</div>
        <button class="btn btn-primary" onclick="openAddSupplierModal()">+ Add Supplier</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>KRA PIN</th>
              <th>Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${store.suppliers.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.contact || 'N/A'}</td>
                <td>${s.phone || 'N/A'}</td>
                <td><span class="size-badge">${s.pin || 'N/A'}</span></td>
                <td>${s.address || 'N/A'}</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="openEditSupplierModal('${s.id}')">Edit</button>
                    <button class="btn btn-primary btn-sm" onclick="openCreatePoForSupplier('${s.id}')">+ PO</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s.id}')">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-faint);">No suppliers registered yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
