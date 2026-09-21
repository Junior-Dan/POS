import { store } from '../store/CellarStore.js';

export function renderReportsView() {
  const rev = store.sales.reduce((a,s)=>a+s.total, 0);
  const cogs = store.sales.reduce((a,s)=>a+s.items.reduce((ia, i)=>ia+(i.costSnapshot*i.qty),0), 0);
  const gross = rev - cogs;
  const exp = store.expenses.reduce((a,e)=>a+e.amount, 0);
  const net = gross - exp;

  const brandMatrix = store.getBrandProfitabilityMatrix();

  return `
  <div class="view-container" id="view-reports">
    <div class="grid-4">
      <div class="stat-card accent">
        <span class="stat-title">Gross Revenue</span>
        <span class="stat-value">KSh ${rev.toLocaleString()}</span>
      </div>
      <div class="stat-card red">
        <span class="stat-title">COGS (Snapshot Cost)</span>
        <span class="stat-value">KSh ${cogs.toLocaleString()}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-title">Gross Profit</span>
        <span class="stat-value">KSh ${gross.toLocaleString()}</span>
      </div>
      <div class="stat-card blue">
        <span class="stat-title">Net Operating Result</span>
        <span class="stat-value">KSh ${net.toLocaleString()}</span>
      </div>
    </div>

    <div class="section-card">
      <div class="section-title">Brand Profitability Matrix</div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Units Sold</th>
              <th>Revenue (KES)</th>
              <th>Cost of Goods (KES)</th>
              <th>Gross Margin (KES)</th>
              <th>Margin %</th>
            </tr>
          </thead>
          <tbody>
            ${brandMatrix.map(b => `
              <tr>
                <td><strong>${b.brand}</strong></td>
                <td>${b.units} units</td>
                <td>KSh ${b.revenue.toLocaleString()}</td>
                <td>KSh ${b.cogs.toLocaleString()}</td>
                <td>KSh ${b.margin.toLocaleString()}</td>
                <td><span class="badge badge-success">${b.marginPct}%</span></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">No sales transactions recorded yet for brand matrix</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
