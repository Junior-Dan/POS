import { store } from '../store/CellarStore.js';

export function renderSuppliersView() {
  return `
  <div class="view-container" id="view-suppliers">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Suppliers Directory</div>
        <button class="btn btn-primary">+ Add Supplier</button>
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
                <td>${s.contact}</td>
                <td>${s.phone}</td>
                <td>${s.pin}</td>
                <td>${s.address}</td>
                <td><button class="btn btn-secondary btn-sm">Edit</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
