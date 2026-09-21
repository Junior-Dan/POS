import { store } from '../store/CellarStore.js';

export function renderAuditView() {
  return `
  <div class="view-container" id="view-audit">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">Security & Audit Logs</div>
        <span class="section-subtitle">Immutable trail of all high-risk operations</span>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Target Item</th>
              <th>Old Value</th>
              <th>New Value</th>
              <th>Reason / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${store.auditLogs.map(a => `
              <tr>
                <td>${new Date(a.timestamp).toLocaleString()}</td>
                <td><strong>${a.user}</strong></td>
                <td><span class="badge badge-info">${a.action}</span></td>
                <td>${a.item}</td>
                <td>${a.oldVal}</td>
                <td>${a.newVal}</td>
                <td>${a.reason}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
