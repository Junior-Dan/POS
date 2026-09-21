export function renderAddProductModal() {
  return `
  <div class="modal-overlay" id="addProductModal">
    <div class="modal-card" style="max-width: 600px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
          <span id="productModalTitle">Add New Product</span>
        </div>
        <button class="modal-close" onclick="closeModal('addProductModal')">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="prodEditId" value="">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Brand Name</label>
            <input type="text" class="form-input" id="prodBrandInput" placeholder="e.g. Johnnie Walker">
          </div>
          <div class="form-group">
            <label class="form-label">Product Variant Name</label>
            <input type="text" class="form-input" id="prodNameInput" placeholder="e.g. Black Label 12YO">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="prodCategorySelect">
              <option value="Whisky">Whisky</option>
              <option value="Vodka">Vodka</option>
              <option value="Gin">Gin</option>
              <option value="Cognac">Cognac</option>
              <option value="Brandy">Brandy</option>
              <option value="Rum">Rum</option>
              <option value="Tequila">Tequila</option>
              <option value="Wine">Wine</option>
              <option value="Beer">Beer</option>
              <option value="Cider">Cider</option>
              <option value="RTD">RTD</option>
              <option value="Liqueur">Liqueur</option>
              <option value="Mixers">Mixers</option>
              <option value="Soft Drinks">Soft Drinks</option>
              <option value="Water">Water</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Bottle Size</label>
            <select class="form-select" id="prodSizeSelect">
              <option value="250 ml">250 ml</option>
              <option value="330 ml">330 ml</option>
              <option value="350 ml">350 ml</option>
              <option value="500 ml">500 ml</option>
              <option value="700 ml">700 ml</option>
              <option value="750 ml" selected>750 ml</option>
              <option value="1 L">1 L</option>
              <option value="1.5 L">1.5 L</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">ABV %</label>
            <input type="number" step="0.1" class="form-input" id="prodAbvInput" value="40">
          </div>
          <div class="form-group">
            <label class="form-label">SKU Code</label>
            <input type="text" class="form-input" id="prodSkuInput" placeholder="e.g. JWB-750">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Barcode</label>
            <input type="text" class="form-input" id="prodBarcodeInput" placeholder="13-digit EAN Barcode">
          </div>
          <div class="form-group">
            <label class="form-label">Initial Stock Qty</label>
            <input type="number" class="form-input" id="prodStockInput" value="12">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cost Price (KES)</label>
            <input type="number" class="form-input" id="prodCostInput" placeholder="e.g. 3000">
          </div>
          <div class="form-group">
            <label class="form-label">Selling Price (KES)</label>
            <input type="number" class="form-input" id="prodPriceInput" placeholder="e.g. 4200">
          </div>
        </div>

        <div class="form-row" style="align-items:center;">
          <div class="form-group">
            <label class="form-label">Reorder Stock Level</label>
            <input type="number" class="form-input" id="prodReorderInput" value="6">
          </div>
          <div class="form-group" style="flex-direction:row; gap:8px; margin-top:20px;">
            <input type="checkbox" id="prodHighValueInput" style="width:18px; height:18px;">
            <label for="prodHighValueInput" style="font-size:13px; font-weight:700; color:var(--red);">High-Value Product Guard</label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('addProductModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitSaveProduct()">Save Product</button>
      </div>
    </div>
  </div>
  `;
}
