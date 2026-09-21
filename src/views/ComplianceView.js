import { store } from '../store/CellarStore.js';

export function renderComplianceView() {
  return `
  <div class="view-container" id="view-compliance">
    <div class="grid-2">
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">Alcohol Retail Licensing</div>
          <span class="badge badge-success">ACTIVE LICENSE</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
          <div><strong>License Type:</strong> Retail Liquor License</div>
          <div><strong>License #:</strong> NBI/CL/2026/04881</div>
          <div><strong>Issuing Authority:</strong> Nairobi County Liquor Board</div>
          <div><strong>Premises:</strong> Plot 12, Westlands Road, Nairobi</div>
          <div><strong>Permitted Sales Hours:</strong> 10:00 AM - 11:00 PM</div>
          <div><strong>Expiry Date:</strong> <span style="color:var(--accent); font-weight:700;">2026-12-31</span></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div class="section-title">KRA eTIMS Transmission Feed</div>
          <button class="btn btn-secondary btn-sm">🔄 Sync Pending Queue</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
          <div><strong>KRA PIN:</strong> P051234567Z</div>
          <div><strong>eTIMS Serial:</strong> KRA-ETIMS-2026-NBI-08472</div>
          <div><strong>Pending Transmissions:</strong> <span class="badge badge-warning">0 Pending</span></div>
        </div>
        <div class="table-container" style="max-height:160px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>KRA Status</th>
              </tr>
            </thead>
            <tbody>
              ${store.sales.map(s => `
                <tr>
                  <td>${s.receiptNo}</td>
                  <td>KSh ${s.total.toLocaleString()}</td>
                  <td><span class="badge badge-success">ACCEPTED</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  `;
}
