import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderSalesView() {
  return `
  <div class="view-container" id="view-sales">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Completed Sales Ledger</div>
        <button class="btn btn-secondary" onclick="handleProcessReturn()">↩ Process Refund / Return</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date & Time</th>
              <th>Cashier</th>
              <th>Items Count</th>
              <th>Payment Method</th>
              <th>Total (KES)</th>
              <th>eTIMS Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="salesHistoryTableBody">
            ${store.sales.map(s => `
              <tr>
                <td><strong>${s.receiptNo}</strong></td>
                <td>${new Date(s.timestamp).toLocaleString()}</td>
                <td>${s.cashierName}</td>
                <td>${s.items.reduce((acc,i)=>acc+i.qty,0)} items</td>
                <td><span class="badge badge-info">${s.paymentMethod}</span></td>
                <td><strong>KSh ${s.total.toLocaleString()}</strong></td>
                <td><span class="badge badge-success">${s.etimsStatus}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="viewPastReceipt('${s.id}')">View Receipt</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

window.handleProcessReturn = function() {
  requestManagerAuth("Process Sales Refund / Return", () => {
    alert("Refund Authorization Granted. Enter Receipt # to reference original transaction.");
  });
};
