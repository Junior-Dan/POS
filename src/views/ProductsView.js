import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderProductsView() {
  return `
  <div class="view-container" id="view-products">
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">Product Catalogue & Prices</div>
          <div class="section-subtitle">Manage alcohol specifications, bottle sizes, ABV %, and pricing rules</div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-danger btn-sm" id="deleteAllProductsBtn" onclick="deleteAllProducts()"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete All Products</button>
          <button class="btn btn-primary" id="addNewProductBtn">+ Add New Product</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product & Brand</th>
              <th>Category</th>
              <th>ABV %</th>
              <th>Bottle Size</th>
              <th>SKU / Barcode</th>
              <th>Cost Price</th>
              <th>Selling Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="productsTableBody">
            ${store.products.length > 0 ? store.products.map(p => {
              const brandStr = p.brand || '';
              const nameStr = p.name || 'Unnamed Product';
              const catStr = p.category || 'Spirits';
              const abvVal = p.abv !== undefined && p.abv !== null ? p.abv : 0;
              const sizeStr = p.size || '750 ml';
              const skuStr = p.sku || 'N/A';
              const barcodeStr = p.barcode || 'N/A';
              const costVal = p.cost !== undefined && p.cost !== null ? Number(p.cost) : Number(p.cost_price || 0);
              const priceVal = p.price !== undefined && p.price !== null ? Number(p.price) : Number(p.selling_price || 0);
              const stockVal = p.stock !== undefined && p.stock !== null ? Number(p.stock) : Number(p.current_stock || 0);
              const reorderVal = p.reorder !== undefined && p.reorder !== null ? Number(p.reorder) : Number(p.reorder_level || 5);
              
              return `
              <tr>
                <td>
                  <strong>${brandStr} ${nameStr}</strong>
                  ${p.highValue ? '<span class="badge badge-danger" style="font-size:9px; margin-left:4px;">HIGH VALUE</span>' : ''}
                </td>
                <td>${catStr}</td>
                <td>${abvVal}%</td>
                <td><span class="size-badge">${sizeStr}</span></td>
                <td><span style="font-family:monospace; font-size:11px;">${skuStr} / ${barcodeStr}</span></td>
                <td>KSh ${costVal.toLocaleString()}</td>
                <td><strong style="color:var(--accent);">KSh ${priceVal.toLocaleString()}</strong></td>
                <td><span class="${stockVal <= reorderVal ? 'badge badge-danger' : 'badge badge-success'}">${stockVal}</span></td>
                <td>${p.active ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-danger">INACTIVE</span>'}</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn-icon-only" onclick="editProductPrice('${p.id}')" title="Edit Price & Details"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn-secondary btn-sm" onclick="toggleProductActive('${p.id}')">${p.active ? 'Deactivate' : 'Activate'}</button>
                  </div>
                </td>
              </tr>
            `;
            }).join('') : `
              <tr>
                <td colspan="10" style="text-align:center; padding:40px; color:var(--text-faint);">
                  No products in catalogue.<br>
                  <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="document.getElementById('addNewProductBtn').click()">+ Add Your First Product</button>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

window.deleteAllProducts = function() {
  requestManagerAuth("Delete All Products in Catalogue", async () => {
    if (confirm("Are you sure you want to delete ALL products? This action cannot be undone.")) {
      await store.deleteAllProducts();
      if (window.initApp) window.initApp();
      alert("All products deleted successfully! You can now add new products.");
    }
  });
};

window.editProductPrice = function(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;

  requestManagerAuth(`Change Price / Specifications for ${p.brand || ''} ${p.name || ''}`, () => {
    document.getElementById('productModalTitle').textContent = `Edit Product: ${p.brand || ''} ${p.name || ''}`;
    document.getElementById('prodEditId').value = p.id;
    document.getElementById('prodBrandInput').value = p.brand || '';
    document.getElementById('prodNameInput').value = p.name || '';
    document.getElementById('prodCategorySelect').value = p.category || 'Whisky';
    document.getElementById('prodSizeSelect').value = p.size || '750ml';
    document.getElementById('prodAbvInput').value = p.abv || 0;
    document.getElementById('prodSkuInput').value = p.sku || '';
    document.getElementById('prodBarcodeInput').value = p.barcode || '';
    document.getElementById('prodStockInput').value = p.stock !== undefined ? p.stock : (p.current_stock || 0);
    document.getElementById('prodCostInput').value = p.cost !== undefined ? p.cost : (p.cost_price || 0);
    document.getElementById('prodPriceInput').value = p.price !== undefined ? p.price : (p.selling_price || 0);
    document.getElementById('prodReorderInput').value = p.reorder !== undefined ? p.reorder : (p.reorder_level || 5);
    document.getElementById('prodHighValueInput').checked = !!p.highValue;
    
    window.openModal('addProductModal');
  });
};

window.toggleProductActive = function(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;
  const newStatus = !p.active;

  // Optimistic: flip the status and re-render IMMEDIATELY so the button reacts
  // instantly. Persist to the (cloud) server in the background; revert if it
  // fails so the UI never lies about the saved state.
  p.active = newStatus;
  if (window.initApp) window.initApp();

  Promise.resolve(store.updateProductActive(id, newStatus))
    .then(() => {
      store.logAudit("Toggled Product Status", p.name, !newStatus, newStatus, "Owner/Manager update");
    })
    .catch((err) => {
      p.active = !newStatus; // revert
      if (window.initApp) window.initApp();
      alert("Could not update product status: " + (err && err.message ? err.message : 'server error'));
    });
};
