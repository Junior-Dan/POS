import { store } from '../store/CellarStore.js';
import { requestManagerAuth } from '../services/authService.js';
import { MpesaDarajaService } from '../services/mpesaDaraja.js';
import { KraEtimsService } from '../services/kraEtims.js';

let currentCart = [];
let activeCategoryFilter = "ALL";

export function renderPosView() {
  const categories = ["ALL", ...new Set(store.products.map(p => p.category))];
  
  setTimeout(() => {
    bindPosToolbarEvents();
  }, 50);

  return `
  <div class="view-container" id="view-pos">
    <div class="pos-grid">
      <!-- Catalog Left -->
      <div class="pos-catalog">
        <div class="pos-toolbar">
          <div style="position:relative; flex:1;">
            <input type="text" class="form-input" id="posSearchInput" placeholder="Scan barcode or type product name, brand, SKU (e.g. JWB)... [F2]">
          </div>
          <button class="btn btn-secondary" id="posClearSearchBtn">Clear Filter</button>
        </div>

        <div class="category-pills" id="posCategoryPills">
          ${categories.map(cat => `
            <button class="cat-pill ${cat === activeCategoryFilter ? 'active' : ''}" onclick="filterPosCat('${cat}')">${cat}</button>
          `).join('')}
        </div>

        <div class="product-grid" id="posProductGrid">
          ${renderProductGridHtml()}
        </div>
      </div>

      <!-- Cart Right -->
      <div class="pos-cart">
        <div class="cart-header">
          <div class="cart-title">Cart & Checkout</div>
          <button class="btn btn-danger btn-sm" id="posClearCartBtn" onclick="clearCart()">Clear Cart</button>
        </div>

        <div class="cart-items-list" id="posCartItemsList">
          ${renderCartItemsHtml()}
        </div>

        <div class="cart-summary">
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label" style="font-size:11px; color:var(--text-dim);">Customer (Loyalty Tracking)</label>
            <select class="form-select" id="posCustomerSelect" style="padding:4px 8px; font-size:12px;">
              ${(store.customers || []).map(c => `<option value="${c.id}">${c.name} (${c.phone || 'N/A'})</option>`).join('')}
            </select>
          </div>
          <div class="summary-row">
            <span>Subtotal</span>
            <span id="posSubtotal">KSh 0</span>
          </div>
          <div class="summary-row">
            <span>Discount</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="number" class="form-input" id="posDiscountInput" value="0" min="0" max="100" style="width:60px; padding:4px 6px; font-size:12px; text-align:right;">
              <span>%</span>
            </div>
          </div>
          <div class="summary-row">
            <span>Tax (VAT 16% Included)</span>
            <span id="posTaxAmount">KSh 0</span>
          </div>
          <div class="summary-row total">
            <span>TOTAL DUE</span>
            <span class="total-amount" id="posTotalDue">KSh 0</span>
          </div>

          <div class="payment-actions" style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-accent btn-lg" id="payQuickBtn" style="width:100%; font-weight:800; font-size:14px;">
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>COMPLETE SALE</span>
            </button>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
              <button class="btn btn-primary btn-lg" id="payCashBtn">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
                <span>CASH</span>
              </button>
              <button class="btn btn-secondary btn-lg" id="payMpesaBtn" style="border-color:var(--green); color:var(--green-text); background:var(--green-bg);">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>
                <span>M-PESA STK</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function bindPosToolbarEvents() {
  const searchInput = document.getElementById('posSearchInput');
  const clearBtn = document.getElementById('posClearSearchBtn');

  if (searchInput) {
    searchInput.oninput = () => {
      const grid = document.getElementById('posProductGrid');
      if (grid) grid.innerHTML = renderProductGridHtml();
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      if (searchInput) searchInput.value = '';
      window.filterPosCat('ALL');
    };
  }

  const payQuickBtn = document.getElementById('payQuickBtn');
  if (payQuickBtn) payQuickBtn.onclick = () => window.completePosSale('CASH');

  const payCashBtn = document.getElementById('payCashBtn');
  if (payCashBtn) payCashBtn.onclick = () => window.completePosSale('CASH');

  const payMpesaBtn = document.getElementById('payMpesaBtn');
  if (payMpesaBtn) payMpesaBtn.onclick = () => window.completePosSale('M-PESA');
}

function renderProductGridHtml() {
  const query = (document.getElementById('posSearchInput')?.value || '').toLowerCase().trim();
  const filtered = store.products.filter(p => {
    if (!p.active) return false;
    const matchesCat = activeCategoryFilter === "ALL" || p.category === activeCategoryFilter;
    const matchesSearch = p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query) || p.barcode.includes(query);
    return matchesCat && matchesSearch;
  });

  return filtered.map(p => `
    <div class="product-card" onclick="addToCart('${p.id}')">
      <div class="product-badge-bar">
        <span class="size-badge">${p.size}</span>
        ${p.highValue ? '<span class="high-val-badge">HIGH VALUE</span>' : ''}
      </div>
      <div class="product-brand">${p.brand}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-meta-row">
        <div class="product-price">KSh ${p.price.toLocaleString()}</div>
        <div class="product-stock ${p.stock <= p.reorder ? 'low' : ''}">Stk: ${p.stock}</div>
      </div>
    </div>
  `).join('') || '<div style="grid-column: span 3; text-align:center; padding:40px; color:var(--text-faint);">No matching products found</div>';
}

function renderCartItemsHtml() {
  if (currentCart.length === 0) {
    return '<div style="text-align:center; padding:60px 20px; color:var(--text-faint); font-size:13px;">Cart is empty.<br>Scan barcode or tap items to add.</div>';
  }
  return currentCart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-header">
        <div class="cart-item-title">${item.name} <span style="font-size:11px; color:var(--accent);">(${item.size})</span></div>
        <div class="cart-item-price">KSh ${(item.price * item.qty).toLocaleString()}</div>
      </div>
      <div class="cart-item-controls">
        <div style="font-size:11.5px; color:var(--text-dim);">@ KSh ${item.price.toLocaleString()}</div>
        <div class="qty-picker">
          <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

window.addToCart = function(productId) {
  const prod = store.products.find(p => p.id === productId);
  if (!prod) return;
  if (prod.stock <= 0) return alert("Warning: Product is out of stock!");
  
  const existing = currentCart.find(item => item.productId === productId);
  if (existing) {
    if (existing.qty + 1 > prod.stock) return alert("Cannot exceed available stock!");
    existing.qty += 1;
  } else {
    currentCart.push({
      productId: prod.id,
      name: `${prod.brand} ${prod.name}`,
      size: prod.size,
      price: prod.price,
      costSnapshot: prod.cost,
      qty: 1
    });
  }
  refreshCartUi();
};

window.updateCartQty = function(index, delta) {
  const item = currentCart[index];
  const prod = store.products.find(p => p.id === item.productId);
  if (delta > 0 && item.qty + 1 > prod.stock) return alert("Cannot exceed physical stock!");
  item.qty += delta;
  if (item.qty <= 0) currentCart.splice(index, 1);
  refreshCartUi();
};

window.clearCart = function() {
  currentCart = [];
  refreshCartUi();
};

window.filterPosCat = function(cat) {
  activeCategoryFilter = cat;
  
  const pills = document.querySelectorAll('#posCategoryPills .cat-pill');
  pills.forEach(pill => {
    if (pill.textContent.trim() === cat) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  const grid = document.getElementById('posProductGrid');
  if (grid) grid.innerHTML = renderProductGridHtml();
};

function refreshCartUi() {
  const list = document.getElementById('posCartItemsList');
  if (list) list.innerHTML = renderCartItemsHtml();

  const subtotal = currentCart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const discPercent = parseFloat(document.getElementById('posDiscountInput')?.value) || 0;
  const discountAmt = (subtotal * discPercent) / 100;
  const total = subtotal - discountAmt;
  const tax = total * 0.16;

  if (document.getElementById('posSubtotal')) document.getElementById('posSubtotal').textContent = `KSh ${subtotal.toLocaleString()}`;
  if (document.getElementById('posTaxAmount')) document.getElementById('posTaxAmount').textContent = `KSh ${tax.toFixed(2)}`;
  if (document.getElementById('posTotalDue')) document.getElementById('posTotalDue').textContent = `KSh ${total.toLocaleString()}`;
}

window.completePosSale = function(paymentMethod = 'CASH') {
  if (currentCart.length === 0) {
    alert("Cart is empty! Tap products from catalogue to add to cart.");
    return;
  }

  const subtotal = currentCart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const discPercent = parseFloat(document.getElementById('posDiscountInput')?.value) || 0;
  const custId = document.getElementById('posCustomerSelect')?.value;
  
  const proceedWithCheckout = () => {
    const discountAmt = (subtotal * discPercent) / 100;
    const total = subtotal - discountAmt;
    const tax = total * 0.16;

    const activeBranchId = store.activeBranchId === 'ALL' ? 'B1' : store.activeBranchId;

    const sale = {
      id: `SALE-${Date.now()}`,
      receiptNo: `REC-2026-${Math.floor(1000 + Math.random()*9000)}`,
      timestamp: new Date().toISOString(),
      branchId: activeBranchId,
      customerId: custId,
      cashierName: store.currentUser.name,
      shiftId: store.currentShift.id,
      items: currentCart.map(item => ({
        productId: item.productId,
        name: item.name,
        size: item.size,
        price: item.price,
        costSnapshot: item.costSnapshot,
        qty: item.qty,
        total: item.price * item.qty
      })),
      subtotal,
      discount: discountAmt,
      tax,
      total,
      paymentMethod,
      etimsStatus: "TRANSMITTED",
      etimsCuNum: `KRA202609210${Math.floor(1000 + Math.random()*9000)}`,
      etimsControlCode: `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      refunded: false
    };

    // Deduct physical stock & record stock movement ledger
    currentCart.forEach(item => {
      const prod = store.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock -= item.qty;
        store.stockMovements.unshift({
          timestamp: new Date().toISOString(),
          productId: prod.id,
          productName: `${prod.brand} ${prod.name}`,
          type: "SALE",
          qty: -item.qty,
          ref: sale.receiptNo,
          user: store.currentUser.name,
          reason: `POS Checkout (${paymentMethod})`
        });
      }
    });

    // Update customer spend & visits if attached
    if (custId) {
      const customer = store.customers.find(c => c.id === custId);
      if (customer) {
        customer.visits = (customer.visits || 0) + 1;
        customer.totalSpend = (customer.totalSpend || 0) + total;
      }
    }

    store.sales.unshift(sale);
    store.logAudit(
      "Completed POS Sale",
      sale.receiptNo,
      "-",
      `KES ${sale.total.toLocaleString()}`,
      `Payment Method: ${paymentMethod} (Assumed Paid)`
    );
    store.save();

    currentCart = [];
    
    if (window.renderReceiptHtml) window.renderReceiptHtml(sale);
    window.openModal('receiptModal');

    if (window.renderAllApp) window.renderAllApp();
  };

  if (discPercent > (store.securitySettings?.maxDiscountPercentWithoutAuth || 5)) {
    requestManagerAuth(`Authorize Discount of ${discPercent}% (Over Policy Limit)`, proceedWithCheckout);
  } else {
    proceedWithCheckout();
  }
};
