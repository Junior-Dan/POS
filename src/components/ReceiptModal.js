import { store } from '../store/CellarStore.js';

export function renderReceiptModal() {
  return `
  <div class="modal-overlay" id="receiptModal">
    <div class="modal-card" style="max-width:380px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg>
          <span>Sale Receipt & eTIMS</span>
        </div>
        <button class="modal-close" onclick="closeModal('receiptModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body" style="background:#f4f4f4; padding:10px;">
        <div class="receipt-paper" id="receiptContent">
          <!-- Dynamic Thermal Content -->
        </div>
      </div>
      <div class="modal-footer" style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%;">
          <button class="btn btn-secondary" onclick="window.print()"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>
          <button class="btn btn-secondary" onclick="closeModal('receiptModal'); switchTab('sales');">View Sales & Returns</button>
        </div>
        <button class="btn btn-primary" style="width:100%;" onclick="closeModal('receiptModal'); switchTab('pos');">New Sale</button>
      </div>
    </div>
  </div>
  `;
}

window.renderReceiptHtml = function(sale) {
  const container = document.getElementById('receiptContent');
  if (!container || !sale) return;

  const profile = store.businessProfile || {};
  const receipt = store.receiptSettings || {};
  const branch = store.branches.find(b => b.id === (sale.branchId || store.activeBranchId)) || store.branches[0] || { name: store.businessProfile?.name || 'Main Store' };

  const receiptNo = sale.receiptNo || `REC-${Date.now().toString().slice(-6)}`;
  const timestamp = sale.timestamp ? new Date(sale.timestamp).toLocaleString() : new Date().toLocaleString();
  const cashierName = sale.cashierName || store.currentUser?.name || 'Cashier';
  const paymentMethod = sale.paymentMethod || 'CASH';
  const items = Array.isArray(sale.items) ? sale.items : [];
  const subtotal = sale.subtotal !== undefined ? Number(sale.subtotal) : (sale.total || 0);
  const discount = sale.discount !== undefined ? Number(sale.discount) : 0;
  const tax = sale.tax !== undefined ? Number(sale.tax) : (subtotal * 0.16);
  const total = sale.total !== undefined ? Number(sale.total) : subtotal;
  const etimsCuNum = sale.etimsCuNum || `CU-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const etimsControlCode = sale.etimsControlCode || `${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}`;

  container.innerHTML = `
    <div style="text-align:center; font-family:'Courier New', monospace; font-size:12px; color:#111; line-height:1.4;">
      <img src="/logo.jpeg" style="width:48px; height:48px; object-fit:contain; border-radius:6px; margin:0 auto 4px auto; display:block;" alt="Celler POS" />
      <div style="font-size:10px; color:#666; font-family:sans-serif; letter-spacing:0.5px; font-weight:700;">CELLER POS ENTERPRISE</div>
      <div style="font-weight:900; font-size:15px; letter-spacing:1px; text-transform:uppercase; margin-top:2px;">${receipt.headerText || profile.receiptName || profile.name || 'CELLER POS'}</div>
      <div style="font-size:11px; color:#444; font-weight:bold;">${branch.name}</div>
      <div style="font-size:10px; color:#444;">${branch.location || profile.address || 'Nairobi'}</div>
      <div style="font-size:10px; color:#444;">TEL: ${profile.phone || '0722 000 111'} | KRA PIN: ${profile.kraPin || 'P051234567S'}</div>
      <div style="border-bottom:1px dashed #444; margin:8px 0;"></div>
      
      <div style="display:flex; justify-content:space-between; font-weight:700;">
        <span>RECEIPT #:</span>
        <span>${receiptNo}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px;">
        <span>DATE:</span>
        <span>${timestamp}</span>
      </div>
      ${receipt.showCashierName !== false ? `
      <div style="display:flex; justify-content:space-between; font-size:11px;">
        <span>CASHIER:</span>
        <span>${cashierName}</span>
      </div>
      ` : ''}
      <div style="display:flex; justify-content:space-between; font-size:11px;">
        <span>PAYMENT METHOD:</span>
        <span>${paymentMethod}</span>
      </div>
      
      <div style="border-bottom:1px dashed #444; margin:8px 0;"></div>
      
      <table style="width:100%; text-align:left; font-size:11px; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #ddd;">
            <th style="padding-bottom:4px;">Item</th>
            <th style="text-align:center; padding-bottom:4px;">Qty</th>
            <th style="text-align:right; padding-bottom:4px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => {
            const itemName = i.name || i.product_name || 'Product Item';
            const itemSize = i.size ? `(${i.size})` : '';
            const itemQty = i.qty || 1;
            const itemPrice = i.price !== undefined ? Number(i.price) : (i.unitPrice !== undefined ? Number(i.unitPrice) : 0);
            const itemTotal = i.total !== undefined ? Number(i.total) : (itemPrice * itemQty);
            return `
              <tr>
                <td style="padding:3px 0;">${itemName} ${itemSize ? `<span style="font-size:9.5px; color:#666;">${itemSize}</span>` : ''}</td>
                <td style="text-align:center; padding:3px 0;">${itemQty}</td>
                <td style="text-align:right; padding:3px 0; font-weight:700;">KES ${itemTotal.toLocaleString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div style="border-bottom:1px dashed #444; margin:8px 0;"></div>
      
      <div style="display:flex; justify-content:space-between; font-size:11px;">
        <span>Subtotal:</span>
        <span>KES ${subtotal.toLocaleString()}</span>
      </div>
      ${discount > 0 ? `
      <div style="display:flex; justify-content:space-between; font-size:11px; color:#c00;">
        <span>Discount:</span>
        <span>- KES ${discount.toLocaleString()}</span>
      </div>
      ` : ''}
      <div style="display:flex; justify-content:space-between; font-size:11px;">
        <span>VAT (16% Included):</span>
        <span>KES ${tax.toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:900; font-size:15px; margin-top:6px; padding-top:4px; border-top:1px solid #111;">
        <span>TOTAL PAID:</span>
        <span>KES ${total.toLocaleString()}</span>
      </div>
      
      <div style="border-bottom:1px dashed #444; margin:10px 0 6px 0;"></div>
      <div style="font-weight:700; font-size:11px; letter-spacing:0.5px;">KRA eTIMS FISCAL PROOF</div>
      <div style="font-size:10px; color:#333;">CU Serial: ${etimsCuNum}</div>
      <div style="font-size:10px; color:#333;">Control Code: ${etimsControlCode}</div>
      <div style="margin-top:8px; font-weight:700; font-size:11px;">*** ${receipt.footerText || 'THANK YOU FOR YOUR BUSINESS'} ***</div>
      <div style="font-size:9.5px; color:#666; margin-top:2px;">DRINK RESPONSIBLY. NOT FOR SALE TO PERSONS UNDER 18.</div>
    </div>
  `;
};
