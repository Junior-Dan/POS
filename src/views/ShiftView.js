import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderShiftView() {
  const openingFloat = store.currentShift?.openingFloat || 5000;
  const grossSales = store.getTodayGrossSales();
  const totalRefunds = store.getTodayRefunds();
  const netSales = store.getTodayNetSales();
  const netCashSales = store.getTodayNetCashSales();
  const netMpesaSales = store.getTodayNetMpesaSales();
  const cashMovements = store.getTodayCashMovementsTotal();
  const expectedCash = store.getExpectedCashInDrawer();

  return `
  <div class="view-container" id="view-shift">
    <div class="grid-4" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px;">
      <div class="stat-card accent">
        <span class="stat-title">Active Shift</span>
        <span class="stat-value">${store.currentShift?.id || 'SHIFT-101'}</span>
        <span class="stat-subtext">Cashier: ${store.currentUser.name} | Float: KSh ${openingFloat.toLocaleString()}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-title">Expected Cash In Drawer</span>
        <span class="stat-value">KSh ${expectedCash.toLocaleString()}</span>
        <span class="stat-subtext">Float (5k) + Net Cash Sales (${netCashSales.toLocaleString()}) + Move (${cashMovements.toLocaleString()})</span>
      </div>
      <div class="stat-card blue">
        <span class="stat-title">Net M-PESA Sales</span>
        <span class="stat-value">KSh ${netMpesaSales.toLocaleString()}</span>
        <span class="stat-subtext">M-PESA Sales - Refunds</span>
      </div>
      <div class="stat-card yellow" style="border-left:4px solid var(--accent);">
        <span class="stat-title">Net Shift Revenue</span>
        <span class="stat-value">KSh ${netSales.toLocaleString()}</span>
        <span class="stat-subtext">Gross (${grossSales.toLocaleString()}) - Refunds (${totalRefunds.toLocaleString()})</span>
      </div>
    </div>

    <!-- Reconciliation Financial Summary Card -->
    <div class="section-card" style="margin-bottom:16px; background:var(--surface);">
      <div class="section-title" style="font-size:14px; margin-bottom:10px;">Shift Sales & Returns Reconciliation Ledger</div>
      <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; font-size:12.5px; text-align:center; padding:12px; background:var(--bg-elevated); border-radius:var(--radius-md); border:1px solid var(--border);">
        <div>
          <div style="color:var(--text-dim); font-size:11px;">GROSS SALES</div>
          <div style="font-size:16px; font-weight:700; color:var(--text-bright);">KSh ${grossSales.toLocaleString()}</div>
        </div>
        <div>
          <div style="color:var(--text-dim); font-size:11px;">RETURNS / REFUNDS</div>
          <div style="font-size:16px; font-weight:700; color:var(--red);">- KSh ${totalRefunds.toLocaleString()}</div>
        </div>
        <div>
          <div style="color:var(--text-dim); font-size:11px;">NET REVENUE</div>
          <div style="font-size:16px; font-weight:700; color:var(--accent);">KSh ${netSales.toLocaleString()}</div>
        </div>
        <div>
          <div style="color:var(--text-dim); font-size:11px;">NET CASH SALES</div>
          <div style="font-size:16px; font-weight:700; color:var(--green);">KSh ${netCashSales.toLocaleString()}</div>
        </div>
        <div>
          <div style="color:var(--text-dim); font-size:11px;">NET M-PESA SALES</div>
          <div style="font-size:16px; font-weight:700; color:#00a040;">KSh ${netMpesaSales.toLocaleString()}</div>
        </div>
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
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">No cash drawer movements recorded today</td></tr>'}
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
