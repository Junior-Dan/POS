import { store } from '../store/CellarStore.js';

export function renderDamageBottleModal() {
  return `
  <div class="modal-overlay" id="damageBottleModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M2 12h20"/></svg>
          <span>Record Damaged or Broken Bottle</span>
        </div>
        <button class="modal-close" onclick="closeModal('damageBottleModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Select Product</label>
          <select class="form-select" id="damageProdSelect">
            ${store.products.map(p => `<option value="${p.id}">${p.brand} ${p.name} (${p.size}) — Stk: ${p.stock}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity Damaged</label>
          <input type="number" class="form-input" id="damageQtyInput" value="1" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Reason / Incident Note</label>
          <input type="text" class="form-input" id="damageReasonInput" placeholder="e.g. Smashed during shelf stocking">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('damageBottleModal')">Cancel</button>
        <button class="btn btn-danger" onclick="submitDamageLog()">Confirm & Write-Off Stock</button>
      </div>
    </div>
  </div>
  `;
}
