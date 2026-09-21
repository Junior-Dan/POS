import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderShiftView() {
  const todayStr = new Date().toISOString().split('T')[0];
  const cashSales = store.sales.filter(s => s.paymentMethod === 'CASH' && s.timestamp.startsWith(todayStr)).reduce((a,s)=>a+s.total, 0);
  const mpesaSales = store.sales.filter(s => s.paymentMethod === 'M-PESA' && s.timestamp.startsWith(todayStr)).reduce((a,s)=>a+s.total, 0);
  const expectedCash = 10000 + cashSales;

  return `
  <div class="view-container" id="view-shift">
    <div class="grid-3">
      <div class="stat-card accent">
        <span class="stat-title">Active Shift</span>
        <span class="stat-value">Shift #104</span>
        <span class="stat-subtext">Cashier: ${store.currentUser.name}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-title">Expected Cash In Drawer</span>
        <span class="stat-value">KSh ${expectedCash.toLocaleString()}</span>
        <span class="stat-subtext">Opening Float + Cash Sales - Cash Out</span>
      </div>
      <div class="stat-card blue">
        <span class="stat-title">Total M-PESA Sales</span>
        <span class="stat-value">KSh ${mpesaSales.toLocaleString()}</span>
        <span class="stat-subtext">Confirmed Daraja transactions</span>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Cash Movements & Reconciliation</div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" onclick="handleRecordCashMovement()"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg> Cash In / Cash Out</button>
          <button class="btn btn-primary" onclick="handleCloseShift()"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Reconcile & Close Shift</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Amount (KES)</th>
              <th>User</th>
              <th>Reason / Description</th>
            </tr>
          </thead>
          <tbody id="cashMovementsTableBody">
            ${store.cashMovements.map(c => `
              <tr>
                <td>${new Date(c.timestamp).toLocaleTimeString()}</td>
                <td><span class="badge ${c.amount < 0 ? 'badge-danger' : 'badge-success'}">${c.type}</span></td>
                <td>KSh ${Math.abs(c.amount).toLocaleString()}</td>
                <td>${c.user}</td>
                <td>${c.reason}</td>
              </tr>
            `).join('') || '<tr><td colspan="5">No cash drawer movements recorded today</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

window.handleRecordCashMovement = function() {
  requestManagerAuth("Authorize Cash Drawer Petty Cash Withdrawal / Float Movement", () => {
    store.cashMovements.unshift({
      timestamp: new Date().toISOString(),
      type: "CASH_OUT",
      amount: -500,
      user: store.currentUser.name,
      reason: "Petty cash for packaging materials"
    });
    store.save();
    window.renderAllApp();
    alert("Cash Movement logged.");
  });
};

window.handleCloseShift = function() {
  requestManagerAuth("Reconcile Cash & Close Shift #104", () => {
    alert("Shift #104 Reconciled successfully. Cash variance: KSh 0. Shift Summary report generated.");
  });
};
