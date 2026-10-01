import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderSalesView() {
  const hasSales = store.sales.length > 0;

  return `
  <div class="view-container" id="view-sales">
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">Completed Sales Ledger & Returns</div>
          <div class="section-subtitle">Real-time audit log of all completed transactions and eTIMS transmission records</div>
        </div>
        <button class="btn btn-secondary" onclick="handleProcessReturn()">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 6 6v1"/></svg>
          <span>Process Refund / Return</span>
        </button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date & Time</th>
              <th>Cashier</th>
              <th>Items & Qtys</th>
              <th>Payment Method</th>
              <th>Total (KES)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="salesHistoryTableBody">
            ${hasSales ? store.sales.map(s => {
              const receiptNo = s.receiptNo || s.receipt_no || 'REC-000';
              const timestamp = s.timestamp || s.created_at ? new Date(s.timestamp || s.created_at).toLocaleString() : new Date().toLocaleString();
              const cashierName = s.cashierName || s.cashier_name || 'Cashier';
              const items = Array.isArray(s.items) ? s.items : [];
              const itemsStr = items.map(i => `${i.name || i.product_name || 'Item'} (x${i.qty || 1})`).join(', ') || 'Item';
              const method = s.paymentMethod || s.payment_method || 'CASH';
              const totalVal = s.total !== undefined ? Number(s.total) : 0;
              const isRefunded = Boolean(s.refunded);
              const refundReason = s.refundReason || s.refund_reason || 'Returned';
              const etimsStatus = s.etimsStatus || 'TRANSMITTED';

              return `
              <tr style="${isRefunded ? 'opacity:0.75; background:rgba(220,53,69,0.05);' : ''}">
                <td><strong style="font-family:monospace; font-size:13px;">${receiptNo}</strong></td>
                <td>${timestamp}</td>
                <td>${cashierName}</td>
                <td>
                  <div style="font-size:11.5px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${itemsStr}">
                    ${itemsStr}
                  </div>
                </td>
                <td>
                  <span class="badge ${method === 'M-PESA' ? 'badge-success' : 'badge-info'}">${method}</span>
                  ${(method === 'M-PESA' && (s.mpesaCode || s.mpesa_code)) ? `<div style="font-size:10.5px; font-weight:800; font-family:monospace; color:#10b981; margin-top:2px;">${s.mpesaCode || s.mpesa_code}</div>` : ''}
                </td>
                <td><strong style="color:var(--accent);">KSh ${totalVal.toLocaleString()}</strong></td>
                <td>
                  ${isRefunded 
                    ? `<span class="badge badge-danger">REFUNDED (${refundReason})</span>` 
                    : `<span class="badge badge-success">${etimsStatus}</span>`}
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="viewPastReceipt('${s.id}')">Receipt</button>
                    ${!isRefunded ? `
                      <button class="btn btn-danger btn-sm" onclick="quickInitiateRefund('${receiptNo}', ${totalVal})">Refund</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
            }).join('') : `
              <tr>
                <td colspan="8" style="text-align:center; padding:40px; color:var(--text-faint);">
                  No sales recorded yet.<br>
                  <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="switchTab('pos')">Go to Point of Sale & Complete a Sale</button>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

window.handleProcessReturn = function() {
  requestManagerAuth("Authorize Sales Refund / Return Process", () => {
    window.openModal('returnRefundModal');
  });
};

window.viewPastReceipt = function(saleId) {
  const sale = store.sales.find(s => s.id === saleId);
  if (!sale) return alert("Receipt record not found!");
  if (window.renderReceiptHtml) window.renderReceiptHtml(sale);
  window.openModal('receiptModal');
};

window.quickInitiateRefund = function(receiptNo, totalAmount) {
  requestManagerAuth(`Authorize Return/Refund for Receipt ${receiptNo}`, () => {
    document.getElementById('returnReceiptNoInput').value = receiptNo;
    document.getElementById('refundAmountInput').value = totalAmount;
    window.openModal('returnRefundModal');
  });
};
