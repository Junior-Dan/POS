import { store } from '../store/CellarStore.js';

export function renderCustomersView() {
  return `
  <div class="view-container" id="view-customers">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Customer Registry (ODPC Compliant)</div>
        <button class="btn btn-primary">+ Add Registered Customer</button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone Number</th>
              <th>Email</th>
              <th>Total Visits</th>
              <th>Total Spend</th>
            </tr>
          </thead>
          <tbody>
            ${store.customers.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td>${c.email || 'N/A'}</td>
                <td>${c.visits}</td>
                <td>KSh ${c.totalSpend.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
