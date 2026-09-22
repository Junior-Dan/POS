import { store } from '../store/CellarStore.js';

export function renderPurchasesView() {
  const totalPos = store.purchases.length;
  const totalValue = store.purchases.reduce((acc, p) => acc + (p.totalValue || 0), 0);
  const pendingPos = store.purchases.filter(p => p.status === 'ORDERED' || p.status === 'DRAFT').length;

  return `
  <div class="view-container" id="view-purchases">
    <!-- Summary Header Cards -->
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="stat-card accent">
        <div class="stat-header">
          <span class="stat-title">Total PO Value</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
        </div>
        <div class="stat-value">KSh ${totalValue.toLocaleString()}</div>
        <div class="stat-subtext">Cumulative stock orders</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">Total Orders</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></span>
        </div>
        <div class="stat-value">${totalPos} LPOs</div>
        <div class="stat-subtext">Issued to suppliers</div>
      </div>
      <div class="stat-card red">
        <div class="stat-header">
          <span class="stat-title">Pending Deliveries</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
        </div>
        <div class="stat-value">${pendingPos} Pending</div>
        <div class="stat-subtext">Awaiting goods receipt</div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Purchase Orders & Goods Receiving</div>
        <button class="btn btn-primary" onclick="openCreatePoModal()">+ Create Purchase Order</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Date Issued</th>
              <th>Status</th>
              <th>Total Value (KES)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${store.purchases.map(p => {
              const isReceived = p.status === 'RECEIVED';
              const badgeClass = isReceived ? 'badge-success' : 'badge-warning';
              return `
                <tr>
                  <td><strong>${p.id}</strong></td>
                  <td>${p.supplierName}</td>
                  <td>${p.dateIssued}</td>
                  <td><span class="badge ${badgeClass}">${p.status}</span></td>
                  <td><strong>KSh ${(p.totalValue || 0).toLocaleString()}</strong></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      ${!isReceived ? `
                        <button class="btn btn-primary btn-sm" onclick="openReceiveGoodsModal('${p.id}')" style="background:var(--green); color:#000; font-weight:700;">Receive Goods</button>
                      ` : `
                        <button class="btn btn-secondary btn-sm" onclick="viewGoodsReceiptVoucher('${p.id}')">View GRN Voucher</button>
                      `}
                      <button class="btn btn-danger btn-sm" onclick="deletePurchaseOrder('${p.id}')">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-faint);">No purchase orders issued yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
