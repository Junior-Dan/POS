import { store } from '../store/CellarStore.js';
import Chart from 'chart.js/auto';

let chartHourly, chartCategory;

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
    <!-- Alert Banner -->
    <div class="alert-banner" id="dashAlertBanner">
      <div class="alert-content">
        <span class="alert-icon">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
        </span>
        <div>
          <strong>Operational Summary:</strong>
          <span>${lowStock.length} items below reorder level. License active. eTIMS queue operational.</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="switchTab('inventory')">Review Items</button>
    </div>

    <!-- Key Metrics Cards -->
    <div class="grid-4">
      <div class="stat-card accent">
        <div class="stat-header">
          <span class="stat-title">Today's Revenue</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
        </div>
        <div class="stat-value">KSh ${totalRev.toLocaleString()}</div>
        <div class="stat-subtext">Live revenue calculation</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">Gross Profit</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></span>
        </div>
        <div class="stat-value">KSh ${grossProfit.toLocaleString()}</div>
        <div class="stat-subtext">Snapshot cost margin calculation</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">Transactions</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg></span>
        </div>
        <div class="stat-value">${todaySales.length}</div>
        <div class="stat-subtext">Cash: KSh ${cashTotal.toLocaleString()} | M-PESA: KSh ${mpesaTotal.toLocaleString()}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-header">
          <span class="stat-title">Items Sold</span>
          <span class="stat-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg></span>
        </div>
        <div class="stat-value">${itemsSold} units</div>
        <div class="stat-subtext">Across all bottle sizes</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid-2">
      <div class="section-card">
        <div class="section-header">
          <div class="section-title-box">
            <div class="section-title">Today's Hourly Traffic</div>
          </div>
          <span class="section-subtitle">Sales volume by hour</span>
        </div>
        <div style="height: 240px;">
          <canvas id="chartHourlySales"></canvas>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div class="section-title-box">
            <div class="section-title">Sales by Beverage Category</div>
          </div>
          <span class="section-subtitle">Category revenue breakdown</span>
        </div>
        <div style="height: 240px;">
          <canvas id="chartCategorySales"></canvas>
        </div>
      </div>
    </div>

    <!-- Performance Lists -->
    <div class="grid-2">
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">Top Selling Products</div>
          <button class="btn btn-secondary btn-sm" onclick="switchTab('reports')">Full Report</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Bottle Size</th>
                <th>Units Sold</th>
                <th>Revenue (KES)</th>
              </tr>
            </thead>
            <tbody>
              ${topProds.map(([name, data]) => `
                <tr>
                  <td><strong>${name}</strong></td>
                  <td><span class="size-badge">${data.size}</span></td>
                  <td>${data.qty}</td>
                  <td>KSh ${data.rev.toLocaleString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-faint);">No sales recorded yet today</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div class="section-title">Slow-Moving Stock Warning</div>
          <span class="section-subtitle">Low movement inventory</span>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock</th>
                <th>Cost Value</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${store.products.filter(p => p.stock > 10).slice(0, 4).map(p => `
                <tr>
                  <td>${p.brand} ${p.name} (${p.size})</td>
                  <td>${p.stock}</td>
                  <td>KSh ${(p.cost * p.stock).toLocaleString()}</td>
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

function initDashboardCharts() {
  const ChartClass = typeof Chart !== 'undefined' ? Chart : window.Chart;
  if (!ChartClass) return;

  const ctxH = document.getElementById('chartHourlySales');
  const ctxC = document.getElementById('chartCategorySales');
  if (!ctxH || !ctxC) return;

  try {
    if (chartHourly) chartHourly.destroy();
    if (chartCategory) chartCategory.destroy();

    const traffic = store.getHourlySalesTraffic();
    chartHourly = new ChartClass(ctxH, {
      type: 'line',
      data: {
        labels: traffic.hours,
        datasets: [{
          label: 'Sales (KES)',
          data: traffic.data,
          borderColor: '#d3a94e',
          backgroundColor: 'rgba(211, 169, 78, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const catMap = store.getCategorySalesBreakdown();
    const catLabels = Object.keys(catMap);
    const catData = Object.values(catMap);

    chartCategory = new ChartClass(ctxC, {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['No Sales Yet'],
        datasets: [{
          data: catData.length ? catData : [1],
          backgroundColor: ['#d3a94e', '#4ebf7b', '#4a9eff', '#aa77ff', '#e05648', '#f3f1ed']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } catch (err) {
    console.warn("Could not render charts:", err);
  }
}
