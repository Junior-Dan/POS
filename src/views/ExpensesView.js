import { store } from '../store/CellarStore.js';

export function renderExpensesView() {
  const totalExp = store.expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const count = store.expenses.length;

  // Find top category
  const catMap = {};
  store.expenses.forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });
  const topCat = Object.entries(catMap).sort((a,b) => b[1] - a[1])[0];
  const topCatName = topCat ? topCat[0] : 'None';

  return `
  <div class="view-container" id="view-expenses">
    <!-- Header Summary Cards -->
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="stat-card red">
        <div class="stat-header">
          <span class="stat-title">Total Operational Expenses</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
        </div>
        <div class="stat-value">KSh ${totalExp.toLocaleString()}</div>
        <div class="stat-subtext">Across ${count} recorded vouchers</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-header">
          <span class="stat-title">Highest Cost Category</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/></svg></span>
        </div>
        <div class="stat-value" style="font-size:16px; font-weight:700;">${topCatName}</div>
        <div class="stat-subtext">KSh ${(topCat ? topCat[1] : 0).toLocaleString()} spent</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">Petty Cash Status</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg></span>
        </div>
        <div class="stat-value">Drawer Reconciled</div>
        <div class="stat-subtext">Auto-deducted on cash payout</div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Operational Expenses</div>
        <button class="btn btn-primary" onclick="openExpenseModal()">+ Record Expense</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Recipient / Vendor</th>
              <th>Payment Method</th>
              <th>Amount (KES)</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${store.expenses.map(e => `
              <tr>
                <td>${e.date}</td>
                <td><span class="badge badge-warning">${e.category}</span></td>
                <td><strong>${e.vendor}</strong></td>
                <td><span class="size-badge">${e.paymentMethod || 'CASH'}</span></td>
                <td><strong style="color:var(--red);">KSh ${(e.amount || 0).toLocaleString()}</strong></td>
                <td>${e.notes || '-'}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')">Delete</button></td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-faint);">No operational expenses logged yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
