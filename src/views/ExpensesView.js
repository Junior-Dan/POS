import { store } from '../store/CellarStore.js';

export function renderExpensesView() {
  return `
  <div class="view-container" id="view-expenses">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Operational Expenses</div>
        <button class="btn btn-primary">+ Record Expense</button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Recipient / Vendor</th>
              <th>Amount (KES)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${store.expenses.map(e => `
              <tr>
                <td>${e.date}</td>
                <td><span class="badge badge-warning">${e.category}</span></td>
                <td>${e.vendor}</td>
                <td><strong>KSh ${e.amount.toLocaleString()}</strong></td>
                <td>${e.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
