import { store } from '../store/CellarStore.js';
import Chart from 'chart.js/auto';

let chartHourly, chartCategory;

// Current wall-clock time in Kenya (Africa/Nairobi) regardless of device timezone.
export function formatKenyaClock() {
  try {
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(new Date());
  } catch (e) {
    return '';
  }
}

export function renderDashboardView() {
  const todaySales = store.getTodaySales();
  const totalRev = store.getTodayRevenue();
  const grossProfit = store.getTodayGrossProfit();
  const itemsSold = store.getTodayItemsSold();
  const cashTotal = store.getTodayCashTotal();
  const mpesaTotal = store.getTodayMpesaTotal();
  const lowStock = store.products.filter(p => p.stock <= p.reorder);

  setTimeout(() => {
    try {
      initDashboardCharts();
    } catch (e) {
      console.warn("Chart initialization notice:", e);
    }
  }, 50);

  // Top products calculation from actual sales
  const prodMap = {};
  store.sales.forEach(s => {
    s.items.forEach(i => {
      if (!prodMap[i.name]) prodMap[i.name] = { qty: 0, rev: 0, size: i.size };
      prodMap[i.name].qty += i.qty;
      prodMap[i.name].rev += i.total;
    });
  });

  const topProds = Object.entries(prodMap).sort((a,b) => b[1].qty - a[1].qty).slice(0, 5);

  return `
  <div class="view-container active" id="view-dashboard">
    <!-- Modern Asymmetric Hero Section (Matches Dribbble Layout) -->
    <div class="dashboard-hero-grid">
      <!-- Main Revenue Chart Card -->
      <div class="section-card main-chart-card">
        <div class="section-header">
          <div>
            <div class="stat-title">Revenue & Hourly Performance</div>
            <div class="hero-revenue-amount" id="dashHeroRevenue">
              KSh ${totalRev.toLocaleString()}
            </div>
          </div>
          <span class="section-subtitle">Hourly sales stream · <span id="dashKenyaClock">${formatKenyaClock()}</span> EAT</span>
        </div>
        <div style="height: 240px; position:relative; padding-top:10px;" dir="ltr">
          <canvas id="chartHourlySales" dir="ltr"></canvas>
        </div>
      </div>

      <!-- 2x2 Key Metric Cards Grid -->
      <div class="hero-stats-grid">
        <!-- Card 1: Sales Today (Signature Coral Highlight Card) -->
        <div class="stat-card accent">
          <div class="stat-header">
            <span class="stat-title">Sales Today</span>
            <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
          </div>
          <div class="stat-value" id="dashStatTodayRevenue">KSh ${totalRev.toLocaleString()}</div>
          <div class="stat-subtext">Updated on every checkout</div>
        </div>

        <!-- Card 2: Gross Profit -->
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Gross Profit</span>
            <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></span>
          </div>
          <div class="stat-value" id="dashStatGrossProfit">KSh ${grossProfit.toLocaleString()}</div>
          <div class="stat-subtext">Net margin calculated from cost</div>
        </div>

        <!-- Card 3: Total Orders -->
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Total Orders</span>
            <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg></span>
          </div>
          <div class="stat-value" id="dashStatTransactions">${todaySales.length}</div>
          <div class="stat-subtext" id="dashStatTransactionsSub">Completed transactions today</div>
        </div>

        <!-- Card 4: Items Sold -->
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Items Sold</span>
            <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg></span>
          </div>
          <div class="stat-value" id="dashStatItemsSold">${itemsSold}</div>
          <div class="stat-subtext">Physical units sold today</div>
        </div>
      </div>

    </div>

    <!-- Products & Inventory Table (Reflects Dribbble Reference Table Layout) -->
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">Top Selling Spirits & Stock</div>
          <span class="section-subtitle">Real-time catalog movement and stock status</span>
        </div>
        <div class="section-actions" style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-primary btn-sm" onclick="switchTab('pos')">+ Add Order</button>
          <button class="btn btn-secondary btn-sm" onclick="switchTab('products')">View All</button>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Bottle Size</th>
              <th>Status</th>
              <th>Units Sold</th>
              <th>Revenue (KES)</th>
            </tr>
          </thead>
          <tbody id="dashTopProductsBody">
            ${topProds.map(([name, data]) => `
              <tr>
                <td><strong>${name}</strong></td>
                <td><span class="size-badge">${data.size || '750ml'}</span></td>
                <td><span class="badge badge-success">Available</span></td>
                <td>${data.qty}</td>
                <td>KSh ${data.rev.toLocaleString()}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">No sales recorded yet today</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Category Breakdown & Slow Moving Stock Row -->
    <div class="grid-2">
      <div class="section-card">
        <div class="section-header">
          <div class="section-title-box">
            <div class="section-title">Sales by Beverage Category</div>
          </div>
          <span class="section-subtitle">Category revenue breakdown</span>
        </div>
        <div style="height: 250px; padding-top:10px;">
          <canvas id="chartCategorySales"></canvas>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Slow-Moving Stock Warning</div>
            <span class="section-subtitle">Low movement inventory</span>
          </div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${store.products.filter(p => p.stock > 10).slice(0, 4).map(p => `
                <tr>
                  <td><strong>${p.brand || ''} ${p.name || 'Spirits Item'}</strong> ${p.size ? `(${p.size})` : ''}</td>
                  <td>${p.stock !== undefined ? p.stock : (p.current_stock || 0)}</td>
                  <td><span class="badge badge-warning">Low Movement</span></td>
                  <td><button class="btn btn-secondary btn-sm" onclick="switchTab('pos')">Promote</button></td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-faint);">All inventory moving normally</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  `;
}

export function initDashboardCharts() {
  // Real-time update for key metrics cards
  try {
    const totalRev = store.getTodayRevenue();
    const grossProfit = store.getTodayGrossProfit();
    const todaySales = store.getTodaySales();
    const itemsSold = store.getTodayItemsSold();
    const cashTotal = store.getTodayCashTotal();
    const mpesaTotal = store.getTodayMpesaTotal();

    const elRev = document.getElementById('dashStatTodayRevenue');
    if (elRev) elRev.textContent = `KSh ${totalRev.toLocaleString()}`;

    const elHeroRev = document.getElementById('dashHeroRevenue');
    if (elHeroRev) elHeroRev.textContent = `KSh ${totalRev.toLocaleString()}`;

    const elProfit = document.getElementById('dashStatGrossProfit');
    if (elProfit) elProfit.textContent = `KSh ${grossProfit.toLocaleString()}`;

    const elTrans = document.getElementById('dashStatTransactions');
    if (elTrans) elTrans.textContent = `${todaySales.length}`;

    const elTransSub = document.getElementById('dashStatTransactionsSub');
    if (elTransSub) elTransSub.textContent = "Completed transactions today";


    const elItems = document.getElementById('dashStatItemsSold');
    if (elItems) elItems.textContent = `${itemsSold}`;

    const elClock = document.getElementById('dashKenyaClock');
    if (elClock) elClock.textContent = formatKenyaClock();

    // Real-time top products table update
    const prodMap = {};
    store.sales.forEach(s => {
      s.items.forEach(i => {
        if (!prodMap[i.name]) prodMap[i.name] = { qty: 0, rev: 0, size: i.size };
        prodMap[i.name].qty += i.qty;
        prodMap[i.name].rev += i.total;
      });
    });
    const topProds = Object.entries(prodMap).sort((a,b) => b[1].qty - a[1].qty).slice(0, 5);
    const topBody = document.getElementById('dashTopProductsBody');
    if (topBody) {
      topBody.innerHTML = topProds.map(([name, data]) => `
        <tr>
          <td><strong>${name}</strong></td>
          <td><span class="size-badge">${data.size || '750ml'}</span></td>
          <td><span class="badge badge-success">Available</span></td>
          <td>${data.qty}</td>
          <td>KSh ${data.rev.toLocaleString()}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">No sales recorded yet today</td></tr>';
    }
  } catch (e) {
    console.warn("Metrics update notice:", e);
  }

  const ChartClass = typeof Chart !== 'undefined' ? Chart : window.Chart;
  if (!ChartClass) return;

  const ctxH = document.getElementById('chartHourlySales');
  const ctxC = document.getElementById('chartCategorySales');
  if (!ctxH || !ctxC) return;

  // Chart.js inherits text direction from the canvas; force LTR so the hourly
  // time axis is never mirrored by an RTL browser/OS locale.
  try { ctxH.setAttribute('dir', 'ltr'); ctxH.style.direction = 'ltr'; } catch (e) {}

  try {
    const traffic = store.getHourlySalesTraffic();
    const catMap = store.getCategorySalesBreakdown();
    const catLabels = Object.keys(catMap);
    const catData = Object.values(catMap);

    // If previous chart instance is attached to a detached canvas (e.g. after re-render), clear reference
    if (chartHourly && (!chartHourly.ctx || !document.body.contains(chartHourly.ctx.canvas))) {
      try { chartHourly.destroy(); } catch (e) {}
      chartHourly = null;
    }

    if (chartCategory && (!chartCategory.ctx || !document.body.contains(chartCategory.ctx.canvas))) {
      try { chartCategory.destroy(); } catch (e) {}
      chartCategory = null;
    }

    // Create Coral Accent Gradient Fill for Hourly Line Chart
    const ctx = ctxH.getContext('2d');
    let gradient = 'rgba(255, 86, 48, 0.12)';
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, 'rgba(255, 86, 48, 0.28)');
      gradient.addColorStop(0.7, 'rgba(255, 86, 48, 0.05)');
      gradient.addColorStop(1, 'rgba(255, 86, 48, 0.0)');
    }

    // Smooth In-Place Data Update for Hourly Sales Line Chart
    if (chartHourly && chartHourly.ctx && chartHourly.ctx.canvas === ctxH) {
      chartHourly.data.labels = traffic.hours;
      chartHourly.data.datasets[0].data = traffic.data;
      chartHourly._trafficOrders = traffic.orders;
      chartHourly.update();
    } else {
      if (chartHourly) chartHourly.destroy();
      chartHourly = new ChartClass(ctxH, {
        type: 'line',
        data: {
          labels: traffic.hours,
          datasets: [{
            label: 'Sales Revenue (KSh)',
            data: traffic.data,
            borderColor: '#ff5630',
            borderWidth: 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35, // Smooth curves for beautiful line graph
            pointBackgroundColor: '#ff5630',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#ff5630'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // Force left-to-right so the time axis always reads earliest hour on
          // the left → latest on the right, even if the browser/OS locale is RTL.
          rtl: false,
          animation: {
            duration: 600,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#ff5630',
              bodyColor: '#ffffff',
              borderColor: 'rgba(255, 86, 48, 0.3)',
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  const idx = context.dataIndex;
                  const currentOrders = chartHourly?._trafficOrders || traffic.orders || [];
                  const orderCount = currentOrders[idx] || 0;
                  return ` Revenue: KSh ${context.parsed.y.toLocaleString()} (${orderCount} transactions)`;
                }
              }
            }
          },
          scales: {
            x: {
              reverse: false,
              grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
              ticks: {
                color: '#94a3b8',
                font: { size: 10, weight: '600', family: 'Manrope' },
                maxRotation: 0,
                autoSkip: true
              }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
              ticks: { 
                color: '#94a3b8', 
                font: { size: 10, weight: '600', family: 'Manrope' },
                callback: function(val) {
                  if (val === 0) return 'KSh 0';
                  if (val >= 1000) return 'KSh ' + (val/1000).toFixed(0) + 'k';
                  return 'KSh ' + val;
                }
              },
              beginAtZero: true
            }
          }
        }
      });
      chartHourly._trafficOrders = traffic.orders;
    }

    // Smooth In-Place Data Update for Category Doughnut Chart
    if (chartCategory && chartCategory.ctx && chartCategory.ctx.canvas === ctxC) {
      chartCategory.data.labels = catLabels.length ? catLabels : ['No Sales Yet'];
      chartCategory.data.datasets[0].data = catData.length ? catData : [1];
      chartCategory.update();
    } else {
      if (chartCategory) chartCategory.destroy();
      chartCategory = new ChartClass(ctxC, {
        type: 'doughnut',
        data: {
          labels: catLabels.length ? catLabels : ['No Sales Yet'],
          datasets: [{
            data: catData.length ? catData : [1],
            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ff5630'],
            borderWidth: 2,
            borderColor: 'rgba(15, 23, 42, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          animation: {
            duration: 750,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { 
                color: '#94a3b8', 
                font: { size: 11, family: 'Manrope', weight: '600' }, 
                boxWidth: 10,
                padding: 14
              }
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn("Could not render charts:", err);
  }
}

window.triggerDashboardCharts = initDashboardCharts;
