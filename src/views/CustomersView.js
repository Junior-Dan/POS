import { store } from '../store/CellarStore.js';

export function renderCustomersView() {
  const totalCust = store.customers.length;
  const totalSpend = store.customers.reduce((acc, c) => acc + (c.totalSpend || 0), 0);
  const totalVisits = store.customers.reduce((acc, c) => acc + (c.visits || 0), 0);

  return `
  <div class="view-container" id="view-customers">
    <!-- Header Summary Cards -->
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="stat-card accent">
        <div class="stat-header">
          <span class="stat-title">Registered Customers</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>
        </div>
        <div class="stat-value">${totalCust} Members</div>
        <div class="stat-subtext">ODPC privacy compliant registry</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">Total Customer Spend</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
        </div>
        <div class="stat-value">KSh ${totalSpend.toLocaleString()}</div>
        <div class="stat-subtext">Lifetime revenue generated</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">Store Visits</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/></svg></span>
        </div>
        <div class="stat-value">${totalVisits} Visits</div>
        <div class="stat-subtext">Repeat customer check-ins</div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Customer Registry & Loyalty</div>
        <button class="btn btn-primary" onclick="openCustomerModal()">+ Add Registered Customer</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone Number</th>
              <th>Email</th>
              <th>Total Visits</th>
              <th>Total Spend (KES)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${store.customers.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone || 'N/A'}</td>
                <td>${c.email || '-'}</td>
                <td><span class="badge badge-success">${c.visits || 0} visits</span></td>
                <td><strong>KSh ${(c.totalSpend || 0).toLocaleString()}</strong></td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="openEditCustomerModal('${c.id}')">Edit</button>
                    ${c.id !== 'C1' ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">Delete</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-faint);">No customers registered yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
