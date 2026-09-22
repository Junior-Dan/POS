export function renderExpenseModal() {
  return `
  <div class="modal-overlay" id="expenseModal">
    <div class="modal-card" style="max-width: 500px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Record Operational Expense</span>
        </div>
        <button class="modal-close" onclick="closeModal('expenseModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Expense Category *</label>
          <select class="form-select" id="expCategorySelect">
            <option value="Utilities & Electricity">Utilities & Electricity (KPLC / Water)</option>
            <option value="Rent & Premises">Rent & Premises Lease</option>
            <option value="Staff Refreshments & Food">Staff Refreshments & Meal Allowance</option>
            <option value="Transport & Fuel">Transport, Delivery & Fuel</option>
            <option value="Licensing & Permits">Licensing, County & Liquor Permits</option>
            <option value="Maintenance & Repairs">Maintenance, Cleaning & Repairs</option>
            <option value="Stationery & Packaging">Stationery, Thermal Paper & Packaging</option>
            <option value="Other Operational">Other Operational Expense</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Vendor / Recipient *</label>
            <input type="text" class="form-input" id="expVendorInput" placeholder="e.g. Kenya Power / Landlord">
          </div>
          <div class="form-group">
            <label class="form-label">Amount (KES) *</label>
            <input type="number" class="form-input" id="expAmountInput" placeholder="0.00" style="font-size:16px; font-weight:700;">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Payment Method *</label>
          <select class="form-select" id="expPaymentMethodSelect">
            <option value="CASH">Cash (Petty Cash Drawer)</option>
            <option value="M-PESA">M-PESA Paybill / Till</option>
            <option value="BANK">Bank Transfer / Cheque</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Notes & Purpose</label>
          <input type="text" class="form-input" id="expNotesInput" placeholder="e.g. Monthly electricity token for store chilling units">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('expenseModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitRecordExpense()">Record Expense</button>
      </div>
    </div>
  </div>
  `;
}
