export function renderReceiptModal() {
  return `
  <div class="modal-overlay" id="receiptModal">
    <div class="modal-card" style="max-width:380px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg>
          <span>Sale Receipt & eTIMS</span>
        </div>
        <button class="modal-close" onclick="closeModal('receiptModal')">✕</button>
      </div>
      <div class="modal-body" style="background:#f4f4f4; padding:10px;">
        <div class="receipt-paper" id="receiptContent">
          <!-- Dynamic Thermal Content -->
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.print()">🖨 Print Receipt</button>
        <button class="btn btn-primary" onclick="closeModal('receiptModal'); switchTab('pos');">Done / New Sale</button>
      </div>
    </div>
  </div>
  `;
}
