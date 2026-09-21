import { store } from '../store/CellarStore.js';

export function renderSettingsView() {
  return `
  <div class="view-container" id="view-settings">
    <div class="grid-2">
      <div class="section-card">
        <div class="section-title">Shop & Tax Settings</div>
        <div class="form-group">
          <label class="form-label">Shop Name</label>
          <input type="text" class="form-input" id="setShopName" value="Cellar Wines & Spirits">
        </div>
        <div class="form-group">
          <label class="form-label">KRA PIN</label>
          <input type="text" class="form-input" id="setKraPin" value="P051234567Z">
        </div>
        <button class="btn btn-primary" id="saveSettingsBtn">Save Configuration</button>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div class="section-title">Staff Management & PINs</div>
          <button class="btn btn-primary btn-sm">+ Add Staff</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>PIN</th>
              </tr>
            </thead>
            <tbody>
              ${store.users.map(u => `
                <tr>
                  <td><strong>${u.name}</strong></td>
                  <td><span class="badge badge-warning">${u.role}</span></td>
                  <td><span style="font-family:monospace;">**** (${u.pin})</span></td>
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
