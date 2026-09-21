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

          <div class="payment-actions">
            <button class="btn btn-primary btn-lg" id="payCashBtn" style="grid-column: span 2; background:var(--green); color:#111;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
              <span>CASH PAYMENT</span>
            </button>
            <button class="btn btn-secondary btn-lg" id="payMpesaBtn" style="background:#00a040; color:#fff;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>
              <span>M-PESA STK PUSH</span>
            </button>
            <button class="btn btn-secondary btn-lg" id="paySplitBtn">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3"/><path d="m21 3-7.83 7.87A4 4 0 0 0 12 13.7V22"/></svg>
              <span>SPLIT PAYMENT</span>
            </button>
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
  
  // Highlight clicked category pill and remove active class from others
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
