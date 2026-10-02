import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';

export function renderProductsView() {
  return `
  <div class="view-container" id="view-products">
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">Product Catalogue & Prices</div>
          <div class="section-subtitle">Manage alcohol specifications, bottle sizes, stock levels, and pricing</div>
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
                <td><span class="badge badge-secondary" style="font-size:11px;">${catStr}</span></td>
                <td>${abvVal}%</td>
                <td><span class="size-badge">${sizeStr}</span></td>
                <td><span style="font-family:monospace; font-size:11px;">${skuStr} / ${barcodeStr}</span></td>
                <td>KSh ${costVal.toLocaleString()}</td>
                <td><strong style="color:var(--accent);">KSh ${priceVal.toLocaleString()}</strong></td>
                <td><span class="${stockVal <= reorderVal ? 'badge badge-danger' : 'badge badge-success'}">${stockVal}</span></td>
                <td>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <button class="btn btn-secondary btn-sm" onclick="editProductPrice('${p.id}')" title="Edit product specifications"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
                    <button class="btn btn-secondary btn-sm" onclick="openUpdateStockModal('${p.id}')" title="Update inventory stock quantity"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Update Qty</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProductItem('${p.id}')" title="Delete product"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete</button>
                  </div>
                </td>
              </tr>
            `;
            }).join('') : `
              <tr>
                <td colspan="9" style="text-align:center; padding:40px; color:var(--text-faint);">
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
      alert("All products deleted successfully!");
    }
  });
};

window.deleteProductItem = function(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;
  requestManagerAuth(`Delete Product ${p.brand || ''} ${p.name || ''}`, async () => {
    if (confirm(`Are you sure you want to delete '${p.brand || ''} ${p.name || ''}' from catalogue?`)) {
      await store.deleteProduct(id);
      if (window.initApp) window.initApp();
      alert("Product deleted successfully.");
    }
  });
};

window.editProductPrice = function(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;

  requestManagerAuth(`Change Specifications for ${p.brand || ''} ${p.name || ''}`, () => {
    document.getElementById('productModalTitle').textContent = `Edit Product: ${p.brand || ''} ${p.name || ''}`;
    document.getElementById('prodEditId').value = p.id;
    document.getElementById('prodBrandInput').value = p.brand || '';
    document.getElementById('prodNameInput').value = p.name || '';
    
    const catSelect = document.getElementById('prodCategorySelect');
    const existingCat = p.category || 'Spirits';
    const hasOption = Array.from(catSelect.options).some(opt => opt.value === existingCat);
    if (hasOption) {
      catSelect.value = existingCat;
      document.getElementById('prodCustomCategoryContainer').style.display = 'none';
    } else {
      catSelect.value = '__custom__';
      document.getElementById('prodCustomCategoryContainer').style.display = 'block';
      document.getElementById('prodCustomCategoryInput').value = existingCat;
    }

    document.getElementById('prodSizeSelect').value = p.size || '750 ml';
    document.getElementById('prodAbvInput').value = p.abv !== undefined ? p.abv : 40;
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
