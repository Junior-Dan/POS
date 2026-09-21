export function renderPurchasesView() {
  return `
  <div class="view-container" id="view-purchases">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Purchase Orders & Goods Receiving</div>
        <button class="btn btn-primary">+ Create Purchase Order</button>
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
            <tr>
              <td><strong>PO-2026-041</strong></td>
              <td>Kenya Breweries Limited (KBL)</td>
              <td>${new Date().toLocaleDateString()}</td>
              <td><span class="badge badge-success">RECEIVED</span></td>
              <td>KSh 185,000</td>
              <td><button class="btn btn-secondary btn-sm">View Goods Receipt</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
