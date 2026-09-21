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
          <button class="btn btn-secondary" id="importCsvBtn">📥 Import CSV</button>
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
            ${store.products.map(p => `
              <tr>
                <td>
                  <strong>${p.brand} ${p.name}</strong>
                  ${p.highValue ? '<span class="badge badge-danger" style="font-size:9px; margin-left:4px;">HIGH VALUE</span>' : ''}
                </td>
                <td>${p.category}</td>
                <td>${p.abv}%</td>
                <td><span class="size-badge">${p.size}</span></td>
                <td><span style="font-family:monospace; font-size:11px;">${p.sku} / ${p.barcode}</span></td>
                <td>KSh ${p.cost.toLocaleString()}</td>
                <td><strong style="color:var(--accent);">KSh ${p.price.toLocaleString()}</strong></td>
                <td><span class="${p.stock <= p.reorder ? 'badge badge-danger' : 'badge badge-success'}">${p.stock}</span></td>
                <td>${p.active ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-danger">INACTIVE</span>'}</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-primary btn-sm" onclick="editProductPrice('${p.id}')">✏️ Edit Price</button>
                    <button class="btn btn-secondary btn-sm" onclick="toggleProductActive('${p.id}')">${p.active ? 'Deactivate' : 'Activate'}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

window.editProductPrice = function(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;

  requestManagerAuth(`Change Price / Specifications for ${p.brand} ${p.name}`, () => {
    document.getElementById('productModalTitle').textContent = `Edit Product: ${p.brand} ${p.name}`;
    document.getElementById('prodEditId').value = p.id;
    document.getElementById('prodBrandInput').value = p.brand;
    document.getElementById('prodNameInput').value = p.name;
    document.getElementById('prodCategorySelect').value = p.category;
    document.getElementById('prodSizeSelect').value = p.size;
    document.getElementById('prodAbvInput').value = p.abv;
    document.getElementById('prodSkuInput').value = p.sku;
    document.getElementById('prodBarcodeInput').value = p.barcode;
    document.getElementById('prodStockInput').value = p.stock;
    document.getElementById('prodCostInput').value = p.cost;
    document.getElementById('prodPriceInput').value = p.price;
    document.getElementById('prodReorderInput').value = p.reorder;
    document.getElementById('prodHighValueInput').checked = !!p.highValue;
    
    window.openModal('addProductModal');
  });
};

window.toggleProductActive = function(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;
  p.active = !p.active;
  store.logAudit("Toggled Product Status", p.name, !p.active, p.active, "Owner/Manager update");
  window.renderAllApp();
};
