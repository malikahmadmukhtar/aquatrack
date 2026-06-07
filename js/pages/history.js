/**
 * AquaTrack — History & Analytics Page
 * Summary cards, Chart.js charts, and paginated tables with tab switching.
 */

const HistoryPage = (() => {
  let mounted = false;
  let charts = [];
  let tableState = {
    activeTab: 'daily',
    offsets: { daily: 0, additions: 0, minerals: 0 },
    data: { daily: [], additions: [], minerals: [] },
    hasMore: { daily: true, additions: true, minerals: true }
  };

  const LIMIT = 20;

  function getHTML() {
    return `
      <div class="page-header fade-in">
        <h2 class="page-title">History & Analytics</h2>
        <p class="page-subtitle">Track trends, review past logs, and analyze production data</p>
      </div>

      <!-- Summary Cards -->
      <div id="summary-cards" class="stats-grid stats-grid-4 fade-in">
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-cyan">🏭</div>
          <div class="stat-info">
            <div class="stat-label">Total PETs Produced</div>
            <div class="stat-value" id="sum-produced">—</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-emerald">💰</div>
          <div class="stat-info">
            <div class="stat-label">Total PETs Sold</div>
            <div class="stat-value" id="sum-sold">—</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-purple">🧴</div>
          <div class="stat-info">
            <div class="stat-label">Total Bottles Used</div>
            <div class="stat-value" id="sum-bottles">—</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-amber">📅</div>
          <div class="stat-info">
            <div class="stat-label">Total Days Logged</div>
            <div class="stat-value" id="sum-days">—</div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="section-title fade-in-delay">
        <span class="section-dot dot-cyan"></span>
        Production Trends
      </div>
      <div class="charts-grid fade-in-delay">
        <div class="glass-card chart-card">
          <h4 class="chart-title">PETs Produced vs Sold (Daily)</h4>
          <div class="chart-wrapper">
            <canvas id="chart-production"></canvas>
          </div>
        </div>
        <div class="glass-card chart-card">
          <h4 class="chart-title">Daily Bottle Consumption</h4>
          <div class="chart-wrapper">
            <canvas id="chart-bottles"></canvas>
          </div>
        </div>
      </div>

      <!-- Tables Section -->
      <div class="section-title fade-in-delay">
        <span class="section-dot dot-purple"></span>
        Detailed Logs
      </div>
      <div class="glass-card table-card fade-in-delay">
        <div class="tab-switcher">
          <button class="tab-btn active" data-tab="daily">Daily Logs</button>
          <button class="tab-btn" data-tab="additions">Inventory Additions</button>
          <button class="tab-btn" data-tab="minerals">Mineral Usage</button>
        </div>
        <div class="table-container">
          <div id="table-content">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading logs...</p>
            </div>
          </div>
        </div>
        <div class="table-footer" id="table-footer">
          <button class="btn btn-outline" id="load-more-btn" style="display:none">Load More</button>
        </div>
      </div>
    `;
  }

  /**
   * Load summary data.
   */
  async function loadSummary() {
    try {
      const data = await API.getHistory('summary');
      const summary = data.summary || data;

      const totalProduced = (summary.total_pets_produced_1_5L || 0) + (summary.total_pets_produced_0_5L || 0);
      const totalSold = (summary.total_pets_sold_1_5L || 0) + (summary.total_pets_sold_0_5L || 0);
      const totalBottles = (summary.total_bottles_used || 0);
      const totalDays = (summary.total_days || 0);

      Utils.animateCount(document.getElementById('sum-produced'), totalProduced, 1500);
      Utils.animateCount(document.getElementById('sum-sold'), totalSold, 1500);
      Utils.animateCount(document.getElementById('sum-bottles'), totalBottles, 1500);
      Utils.animateCount(document.getElementById('sum-days'), totalDays, 1500);
    } catch (err) {
      console.error('Summary load error:', err);
    }
  }

  /**
   * Build and render Chart.js charts.
   */
  async function loadCharts() {
    try {
      const data = await API.getHistory('daily', 30, 0);
      const logs = (data.logs || data.data || []).reverse();

      if (logs.length === 0) return;

      const labels = logs.map(l => {
        const d = new Date(l.date || l.created_at);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      // Chart defaults
      Chart.defaults.color = 'rgba(255,255,255,0.6)';
      Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
      Chart.defaults.font.family = 'Inter, sans-serif';

      // Production vs Sold Chart
      const prodCtx = document.getElementById('chart-production');
      if (prodCtx) {
        const prodChart = new Chart(prodCtx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Produced 1.5L',
                data: logs.map(l => l.pets_produced_1_5L || 0),
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0,212,255,0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#00d4ff',
                pointRadius: 3,
                pointHoverRadius: 6
              },
              {
                label: 'Produced 0.5L',
                data: logs.map(l => l.pets_produced_0_5L || 0),
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124,58,237,0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#7c3aed',
                pointRadius: 3,
                pointHoverRadius: 6
              },
              {
                label: 'Sold 1.5L',
                data: logs.map(l => l.pets_sold_1_5L || 0),
                borderColor: '#10b981',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointRadius: 3,
                pointHoverRadius: 6
              },
              {
                label: 'Sold 0.5L',
                data: logs.map(l => l.pets_sold_0_5L || 0),
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                pointBackgroundColor: '#f59e0b',
                pointRadius: 3,
                pointHoverRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: {
                labels: { usePointStyle: true, padding: 20 }
              }
            },
            scales: {
              x: { grid: { display: false } },
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
          }
        });
        charts.push(prodChart);
      }

      // Bottle Consumption Chart (stacked bar)
      const bottleCtx = document.getElementById('chart-bottles');
      if (bottleCtx) {
        const bottleChart = new Chart(bottleCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Bottles 1.5L',
                data: logs.map(l => (l.pets_produced_1_5L || 0) * 6),
                backgroundColor: 'rgba(0,212,255,0.7)',
                borderColor: '#00d4ff',
                borderWidth: 1,
                borderRadius: 4
              },
              {
                label: 'Bottles 0.5L',
                data: logs.map(l => (l.pets_produced_0_5L || 0) * 12),
                backgroundColor: 'rgba(124,58,237,0.7)',
                borderColor: '#7c3aed',
                borderWidth: 1,
                borderRadius: 4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { usePointStyle: true, padding: 20 }
              }
            },
            scales: {
              x: { stacked: true, grid: { display: false } },
              y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
          }
        });
        charts.push(bottleChart);
      }
    } catch (err) {
      console.error('Charts load error:', err);
    }
  }

  /**
   * Render table based on active tab.
   */
  function renderTable() {
    const contentEl = document.getElementById('table-content');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!contentEl) return;

    const tab = tableState.activeTab;
    const rows = tableState.data[tab];

    if (!rows || rows.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state-sm">
          <p>No ${tab} records found.</p>
        </div>
      `;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    let tableHTML = '';

    if (tab === 'daily') {
      tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produced 1.5L</th>
              <th>Produced 0.5L</th>
              <th>Sold 1.5L</th>
              <th>Sold 0.5L</th>
              <th>Bottles Used</th>
              <th>Caps Used</th>
              <th>Shelling (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const preview = Utils.calculatePreview(r.pets_produced_1_5L, r.pets_produced_0_5L);
              return `
                <tr>
                  <td>${Utils.formatDate(r.date || r.created_at)}</td>
                  <td>${Utils.formatNumber(r.pets_produced_1_5L || 0)}</td>
                  <td>${Utils.formatNumber(r.pets_produced_0_5L || 0)}</td>
                  <td>${Utils.formatNumber(r.pets_sold_1_5L || 0)}</td>
                  <td>${Utils.formatNumber(r.pets_sold_0_5L || 0)}</td>
                  <td>${Utils.formatNumber(preview.totalBottles)}</td>
                  <td>${Utils.formatNumber(preview.totalCaps)}</td>
                  <td>${Utils.formatKg(preview.totalShelling)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else if (tab === 'additions') {
      tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bottles 1.5L</th>
              <th>Bottles 0.5L</th>
              <th>Caps</th>
              <th>Shelling 1.5L (kg)</th>
              <th>Shelling 0.5L (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${Utils.formatDate(r.date || r.created_at)}</td>
                <td>${Utils.formatNumber(r.bottles_1_5L || 0)}</td>
                <td>${Utils.formatNumber(r.bottles_0_5L || 0)}</td>
                <td>${Utils.formatNumber(r.caps || 0)}</td>
                <td>${Utils.formatKg(r.shelling_1_5L_kg || 0)}</td>
                <td>${Utils.formatKg(r.shelling_0_5L_kg || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (tab === 'minerals') {
      tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Calcium (kg)</th>
              <th>Magnesium (kg)</th>
              <th>Sodium (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const m = r.minerals_used || r;
              return `
                <tr>
                  <td>${Utils.formatDate(r.date || r.created_at)}</td>
                  <td>${Utils.formatKg(m.calcium_kg || 0)}</td>
                  <td>${Utils.formatKg(m.magnesium_kg || 0)}</td>
                  <td>${Utils.formatKg(m.sodium_kg || 0)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    contentEl.innerHTML = tableHTML;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = tableState.hasMore[tab] ? 'inline-flex' : 'none';
    }
  }

  /**
   * Load table data for the active tab.
   */
  async function loadTableData(append = false) {
    const tab = tableState.activeTab;
    if (!append) {
      tableState.offsets[tab] = 0;
      tableState.data[tab] = [];
    }

    try {
      const data = await API.getHistory(tab, LIMIT, tableState.offsets[tab]);
      const rows = data.logs || data.data || data.additions || data.minerals || [];

      if (rows.length < LIMIT) {
        tableState.hasMore[tab] = false;
      }

      tableState.data[tab] = [...tableState.data[tab], ...rows];
      tableState.offsets[tab] += rows.length;

      renderTable();
    } catch (err) {
      const contentEl = document.getElementById('table-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="empty-state-sm">
            <p>Error loading data: ${err.message}</p>
          </div>
        `;
      }
    }
  }

  /**
   * Handle tab switching.
   */
  function handleTabSwitch(e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    const tab = btn.dataset.tab;
    if (tab === tableState.activeTab) return;

    // Update active tab UI
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    tableState.activeTab = tab;
    tableState.hasMore[tab] = true;
    loadTableData();
  }

  /**
   * Mount page.
   */
  async function mount(container) {
    container.innerHTML = getHTML();
    mounted = true;

    // Reset state
    tableState = {
      activeTab: 'daily',
      offsets: { daily: 0, additions: 0, minerals: 0 },
      data: { daily: [], additions: [], minerals: [] },
      hasMore: { daily: true, additions: true, minerals: true }
    };

    // Bind tab switcher
    document.querySelector('.tab-switcher')?.addEventListener('click', handleTabSwitch);

    // Bind load more
    document.getElementById('load-more-btn')?.addEventListener('click', () => {
      loadTableData(true);
    });

    // Load data
    loadSummary();
    loadCharts();
    loadTableData();
  }

  /**
   * Unmount / cleanup.
   */
  function unmount() {
    mounted = false;
    charts.forEach(c => c.destroy());
    charts = [];
  }

  return { mount, unmount };
})();
