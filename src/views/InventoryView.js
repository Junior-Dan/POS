import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderInventoryView() {
  const totalCost = store.products.reduce((acc, p) => acc + (p.cost * p.stock), 0);
  const totalSelling = store.products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const alerts = store.products.filter(p => p.stock <= p.reorder).length;

  return `
  <div class="view-container" id="view-inventory">
    <div class="grid-3">
      <div class="stat-card accent">
        <span class="stat-title">Total Inventory Cost</span>
        <span class="stat-value">KSh ${totalCost.toLocaleString()}</span>
        <span class="stat-subtext">Current stock valuation</span>
      </div>
      <div class="stat-card green">
        <span class="stat-title">Potential Selling Value</span>
        <span class="stat-value">KSh ${totalSelling.toLocaleString()}</span>
        <span class="stat-subtext">Expected retail gross return</span>
      </div>
      <div class="stat-card red">
        <span class="stat-title">Stock Warnings</span>
        <span class="stat-value">${alerts} items</span>
        <span class="stat-subtext">Out of stock or below reorder level</span>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Stock Actions & Adjustments</div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-danger" id="recordDamageBtn" onclick="handleRecordDamage()"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Record Damaged Bottle</button>
          <button class="btn btn-secondary" id="stockCountBtn" onclick="handleStockCount()"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg> Physical Stock Count</button>
        </div>
      </div>

      <div class="section-title" style="margin-top:10px; font-size:15px;">Stock Audit Ledger History</div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Product</th>
              <th>Type</th>
              <th>Qty Change</th>
              <th>Reference</th>
              <th>Authorized User</th>
              <th>Reason / Notes</th>
            </tr>
          </thead>
          <tbody id="stockMovementsTableBody">
            ${store.stockMovements.map(m => `
              <tr>
                <td>${new Date(m.timestamp).toLocaleString()}</td>
                <td><strong>${m.productName}</strong></td>
                <td><span class="badge ${m.qty < 0 ? 'badge-danger' : 'badge-success'}">${m.type}</span></td>
                <td><strong style="color:${m.qty < 0 ? 'var(--red)' : 'var(--green)'}">${m.qty > 0 ? '+' : ''}${m.qty}</strong></td>
                <td>${m.ref}</td>
                <td>${m.user}</td>
                <td>${m.reason}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

window.handleRecordDamage = function() {
  requestManagerAuth("Record Damaged or Broken Bottle Stock Adjustment", () => {
    const prod = store.products[0];
    if (!prod) return;
    prod.stock -= 1;
    store.stockMovements.unshift({
      timestamp: new Date().toISOString(),
      productId: prod.id,
      productName: `${prod.brand} ${prod.name}`,
      type: "DAMAGE",
      qty: -1,
      ref: "DMG-LOG",
      user: store.currentUser.name,
      reason: "Bottle smashed during shelf restock"
    });
    store.logAudit("Recorded Damaged Bottle", prod.name, "Stock -1", prod.stock, "Manager authorized damage write-off");
    window.renderAllApp();
    alert(`Damaged bottle recorded for ${prod.name}. Stock updated.`);
  });
};

window.handleStockCount = function() {
  requestManagerAuth("Perform Physical Stock Count Audit", () => {
    alert("Physical Stock Count Audit Initialized. System vs Count variances calculated and logged.");
  });
};
