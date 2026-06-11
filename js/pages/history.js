/**
 * AquaTrack — History & Analytics Page
 * Summary cards, Chart.js charts, and paginated tables with tab switching and date range filtering.
 */

const HistoryPage = (() => {
  let mounted = false;
  let charts = [];
  let filterStartDate = null;
  let filterEndDate = null;
  let escHandler = null;

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

      <!-- Date Filter Panel -->
      <div class="glass-card filter-card fade-in">
        <div class="filter-row">
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" id="filter-start-date">
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input type="date" id="filter-end-date">
          </div>
          <div class="filter-actions">
            <button class="btn btn-gradient" id="apply-filter-btn">Filter</button>
            <button class="btn btn-outline" id="clear-filter-btn">Clear</button>
          </div>
        </div>
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
      const data = await API.getHistory('summary', 30, 0, filterStartDate, filterEndDate);
      const summary = data.summary || data;

      const totalProduced = (summary.total_pets_produced_1_5L || 0) + (summary.total_pets_produced_0_5L || 0);
      const totalSold = (summary.total_pets_sold_1_5L || 0) + (summary.total_pets_sold_0_5L || 0);
      const totalBottles = (summary.total_bottles_used_1_5L || 0) + (summary.total_bottles_used_0_5L || 0) || (summary.total_bottles_used || 0);
      const totalDays = (summary.total_days || 0);

      Utils.animateCount(document.getElementById('sum-produced'), totalProduced, 1200);
      Utils.animateCount(document.getElementById('sum-sold'), totalSold, 1200);
      Utils.animateCount(document.getElementById('sum-bottles'), totalBottles, 1200);
      Utils.animateCount(document.getElementById('sum-days'), totalDays, 1200);
    } catch (err) {
      console.error('Summary load error:', err);
    }
  }

  /**
   * Build and render Chart.js charts.
   */
  async function loadCharts() {
    try {
      // Clear existing charts first
      charts.forEach(c => c.destroy());
      charts = [];

      const data = await API.getHistory('daily', 30, 0, filterStartDate, filterEndDate);
      const logs = (data.records || data.logs || data.data || []).slice().reverse();

      if (logs.length === 0) {
        // Render empty state on canvases if no data
        const pCtx = document.getElementById('chart-production')?.getContext('2d');
        const bCtx = document.getElementById('chart-bottles')?.getContext('2d');
        if (pCtx) {
          pCtx.clearRect(0, 0, pCtx.canvas.width, pCtx.canvas.height);
          pCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          pCtx.font = '14px Inter, sans-serif';
          pCtx.textAlign = 'center';
          pCtx.fillText('No data available for selected range', pCtx.canvas.width / 2, pCtx.canvas.height / 2);
        }
        if (bCtx) {
          bCtx.clearRect(0, 0, bCtx.canvas.width, bCtx.canvas.height);
          bCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          bCtx.font = '14px Inter, sans-serif';
          bCtx.textAlign = 'center';
          bCtx.fillText('No data available for selected range', bCtx.canvas.width / 2, bCtx.canvas.height / 2);
        }
        return;
      }

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
        <!-- Desktop Table View -->
        <table class="data-table desktop-only-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produced 1.5L</th>
              <th>Produced 0.5L</th>
              <th>Sold 1.5L</th>
              <th>Sold 0.5L</th>
              <th>Revenue (PKR)</th>
              <th>Bottles Used</th>
              <th>Caps Used</th>
              <th>Shelling (kg)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const preview = Utils.calculatePreview(r.pets_produced_1_5L, r.pets_produced_0_5L);
              const revenueStr = r.calculated_revenue ? `${Utils.formatNumber(r.calculated_revenue)} PKR` : '—';
              return `
                <tr>
                  <td>${Utils.formatDate(r.date || r.created_at)}</td>
                  <td>${Utils.formatNumber(r.pets_produced_1_5L || 0)}</td>
                  <td>${Utils.formatNumber(r.pets_produced_0_5L || 0)}</td>
                  <td>${Utils.formatNumber(r.pets_sold_1_5L || 0)}</td>
                  <td>${Utils.formatNumber(r.pets_sold_0_5L || 0)}</td>
                  <td>${revenueStr}</td>
                  <td>${Utils.formatNumber(preview.totalBottles)}</td>
                  <td>${Utils.formatNumber(preview.totalCaps)}</td>
                  <td>${Utils.formatKg(preview.totalShelling)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon btn-edit" data-id="${r._id || r.id}" data-type="daily" title="Edit">✏️</button>
                      <button class="btn-icon btn-delete" data-id="${r._id || r.id}" data-type="daily" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Mobile Cards View -->
        <div class="mobile-only-cards">
          ${rows.map(r => {
            const preview = Utils.calculatePreview(r.pets_produced_1_5L, r.pets_produced_0_5L);
            const revenueStr = r.calculated_revenue ? `${Utils.formatNumber(r.calculated_revenue)} PKR` : '—';
            return `
              <div class="history-mobile-card">
                <div class="card-mobile-header">
                  <span class="card-mobile-date">📅 ${Utils.formatDate(r.date || r.created_at)}</span>
                  <div class="card-mobile-actions">
                    <button class="btn-icon btn-edit" data-id="${r._id || r.id}" data-type="daily" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete" data-id="${r._id || r.id}" data-type="daily" title="Delete">🗑️</button>
                  </div>
                </div>
                <div class="card-mobile-grid">
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Prod 1.5L</span>
                    <span class="card-mobile-value">${Utils.formatNumber(r.pets_produced_1_5L || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Prod 0.5L</span>
                    <span class="card-mobile-value">${Utils.formatNumber(r.pets_produced_0_5L || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Sold 1.5L</span>
                    <span class="card-mobile-value">${Utils.formatNumber(r.pets_sold_1_5L || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Sold 0.5L</span>
                    <span class="card-mobile-value">${Utils.formatNumber(r.pets_sold_0_5L || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Bottles</span>
                    <span class="card-mobile-value">${Utils.formatNumber(preview.totalBottles)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Shelling</span>
                    <span class="card-mobile-value">${Utils.formatKg(preview.totalShelling)}</span>
                  </div>
                  <div class="card-mobile-item" style="grid-column: span 2; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); flex-direction: row; justify-content: space-between; align-items: center;">
                    <span class="card-mobile-label" style="text-transform: uppercase; margin-bottom: 0;">Total Revenue</span>
                    <span class="card-mobile-value" style="color: var(--emerald); font-weight: 700; font-size: 0.95rem;">${revenueStr}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'additions') {
      tableHTML = `
        <!-- Desktop Table View -->
        <table class="data-table desktop-only-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bottles 1.5L</th>
              <th>Bottles 0.5L</th>
              <th>Caps</th>
              <th>Shelling 1.5L (kg)</th>
              <th>Shelling 0.5L (kg)</th>
              <th>Calcium (kg)</th>
              <th>Magnesium (kg)</th>
              <th>Sodium (kg)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const added = r.added || {};
              return `
                <tr>
                  <td>${Utils.formatDate(r.date || r.created_at)}</td>
                  <td>${Utils.formatNumber(added.bottles_1_5L || r.bottles_1_5L || 0)}</td>
                  <td>${Utils.formatNumber(added.bottles_0_5L || r.bottles_0_5L || 0)}</td>
                  <td>${Utils.formatNumber(added.caps || r.caps || 0)}</td>
                  <td>${Utils.formatKg(added.shelling_1_5L_kg || r.shelling_1_5L_kg || 0)}</td>
                  <td>${Utils.formatKg(added.shelling_0_5L_kg || r.shelling_0_5L_kg || 0)}</td>
                  <td>${Utils.formatKg(added.calcium_kg || r.calcium_kg || 0)}</td>
                  <td>${Utils.formatKg(added.magnesium_kg || r.magnesium_kg || 0)}</td>
                  <td>${Utils.formatKg(added.sodium_kg || r.sodium_kg || 0)}</td>
                  <td>
                    ${r.is_overwrite ? `
                      <span class="badge badge-accent">Reset</span>
                    ` : `
                      <div class="table-actions">
                        <button class="btn-icon btn-edit" data-id="${r._id || r.id}" data-type="additions" title="Edit">✏️</button>
                        <button class="btn-icon btn-delete" data-id="${r._id || r.id}" data-type="additions" title="Delete">🗑️</button>
                      </div>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Mobile Cards View -->
        <div class="mobile-only-cards">
          ${rows.map(r => {
            const added = r.added || {};
            return `
              <div class="history-mobile-card">
                <div class="card-mobile-header">
                  <span class="card-mobile-date">📦 ${Utils.formatDate(r.date || r.created_at)}</span>
                  <div class="card-mobile-actions">
                    ${r.is_overwrite ? `
                      <span class="badge badge-accent">Reset</span>
                    ` : `
                      <button class="btn-icon btn-edit" data-id="${r._id || r.id}" data-type="additions" title="Edit">✏️</button>
                      <button class="btn-icon btn-delete" data-id="${r._id || r.id}" data-type="additions" title="Delete">🗑️</button>
                    `}
                  </div>
                </div>
                <div class="card-mobile-grid">
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Bottles 1.5L</span>
                    <span class="card-mobile-value">+${Utils.formatNumber(added.bottles_1_5L || r.bottles_1_5L || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Bottles 0.5L</span>
                    <span class="card-mobile-value">+${Utils.formatNumber(added.bottles_0_5L || r.bottles_0_5L || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Caps</span>
                    <span class="card-mobile-value">+${Utils.formatNumber(added.caps || r.caps || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Shell 1.5L</span>
                    <span class="card-mobile-value">+${Utils.formatKg(added.shelling_1_5L_kg || r.shelling_1_5L_kg || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Shell 0.5L</span>
                    <span class="card-mobile-value">+${Utils.formatKg(added.shelling_0_5L_kg || r.shelling_0_5L_kg || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Calcium</span>
                    <span class="card-mobile-value">+${Utils.formatKg(added.calcium_kg || r.calcium_kg || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Magnesium</span>
                    <span class="card-mobile-value">+${Utils.formatKg(added.magnesium_kg || r.magnesium_kg || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Sodium</span>
                    <span class="card-mobile-value">+${Utils.formatKg(added.sodium_kg || r.sodium_kg || 0)}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'minerals') {
      tableHTML = `
        <!-- Desktop Table View -->
        <table class="data-table desktop-only-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Calcium (kg)</th>
              <th>Magnesium (kg)</th>
              <th>Sodium (kg)</th>
              <th>Actions</th>
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
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon btn-edit" data-id="${r._id || r.id}" data-type="minerals" title="Edit">✏️</button>
                      <button class="btn-icon btn-delete" data-id="${r._id || r.id}" data-type="minerals" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Mobile Cards View -->
        <div class="mobile-only-cards">
          ${rows.map(r => {
            const m = r.minerals_used || r;
            return `
              <div class="history-mobile-card">
                <div class="card-mobile-header">
                  <span class="card-mobile-date">🧪 ${Utils.formatDate(r.date || r.created_at)}</span>
                  <div class="card-mobile-actions">
                    <button class="btn-icon btn-edit" data-id="${r._id || r.id}" data-type="minerals" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete" data-id="${r._id || r.id}" data-type="minerals" title="Delete">🗑️</button>
                  </div>
                </div>
                <div class="card-mobile-grid">
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Calcium</span>
                    <span class="card-mobile-value">${Utils.formatKg(m.calcium_kg || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Magnesium</span>
                    <span class="card-mobile-value">${Utils.formatKg(m.magnesium_kg || 0)}</span>
                  </div>
                  <div class="card-mobile-item">
                    <span class="card-mobile-label">Sodium</span>
                    <span class="card-mobile-value">${Utils.formatKg(m.sodium_kg || 0)}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    contentEl.innerHTML = tableHTML;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = tableState.hasMore[tab] ? 'inline-flex' : 'none';
    }
  }

  /**
   * Handle Edit/Delete clicks via delegation on table content container.
   */
  function handleTableActionClick(e) {
    const btn = e.target.closest('.btn-icon');
    if (!btn) return;

    const id = btn.dataset.id;
    const type = btn.dataset.type;
    const isDelete = btn.classList.contains('btn-delete');
    const isEdit = btn.classList.contains('btn-edit');

    if (isDelete) {
      handleDelete(id, type);
    } else if (isEdit) {
      handleEdit(id, type);
    }
  }

  /**
   * Delete daily log or stock addition.
   */
  async function handleDelete(id, type) {
    const targetType = (type === 'minerals') ? 'daily' : type;
    const typeLabel = (targetType === 'daily') ? 'Daily Log' : 'Inventory Addition';

    const confirmed = confirm(`Are you sure you want to delete this ${typeLabel}? This action will adjust inventory baseline levels and cannot be undone.`);
    if (!confirmed) return;

    try {
      let response;
      if (targetType === 'daily') {
        response = await API.deleteDailyLog(id);
      } else {
        response = await API.deleteAddition(id);
      }

      Utils.showToast(`${typeLabel} deleted successfully!`, 'success');

      // Update persistent alert in header
      if (response && response.inventory) {
        Utils.updatePersistentAlert(response.inventory);
      } else {
        const todayData = await API.getToday();
        Utils.updatePersistentAlert(todayData);
      }

      // Reload all history sections
      loadSummary();
      loadCharts();
      loadTableData(false);
    } catch (err) {
      Utils.showToast(err.message || `Failed to delete ${typeLabel}.`, 'error');
    }
  }

  /**
   * Edit daily log or stock addition details.
   */
  function handleEdit(id, type) {
    const targetType = (type === 'minerals') ? 'daily' : type;
    const tab = tableState.activeTab;
    
    // Find the record in local state
    const record = tableState.data[tab].find(r => (r._id || r.id) === id);
    if (!record) {
      Utils.showToast('Could not find record details.', 'error');
      return;
    }

    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const fieldsContainer = document.getElementById('modal-form-fields');
    const editForm = document.getElementById('modal-edit-form');

    if (!modal || !fieldsContainer || !editForm) return;

    // Clear previous form fields and handlers
    fieldsContainer.innerHTML = '';
    
    // Clone form to clear any previous submit event listeners
    const newForm = editForm.cloneNode(true);
    editForm.parentNode.replaceChild(newForm, editForm);

    if (targetType === 'daily') {
      modalTitle.textContent = `Edit Daily Log — ${Utils.formatDate(record.date || record.created_at)}`;
      
      const minerals = record.minerals_used || {};
      newForm.querySelector('#modal-form-fields').innerHTML = `
        <div class="form-section">
          <div class="form-section-title">Production Metrics</div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-prod-15">Produced 1.5L</label>
              <input type="number" id="edit-prod-15" min="0" step="1" value="${record.pets_produced_1_5L || 0}">
            </div>
            <div class="form-group">
              <label for="edit-prod-05">Produced 0.5L</label>
              <input type="number" id="edit-prod-05" min="0" step="1" value="${record.pets_produced_0_5L || 0}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-sold-15">Sold 1.5L</label>
              <input type="number" id="edit-sold-15" min="0" step="1" value="${record.pets_sold_1_5L || 0}">
            </div>
            <div class="form-group">
              <label for="edit-sold-05">Sold 0.5L</label>
              <input type="number" id="edit-sold-05" min="0" step="1" value="${record.pets_sold_0_5L || 0}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-price-15">Price 1.5L (PKR)</label>
              <input type="number" id="edit-price-15" min="0" step="0.01" value="${record.price_per_pet_1_5L !== null && record.price_per_pet_1_5L !== undefined ? record.price_per_pet_1_5L : ''}" placeholder="Optional PKR">
            </div>
            <div class="form-group">
              <label for="edit-price-05">Price 0.5L (PKR)</label>
              <input type="number" id="edit-price-05" min="0" step="0.01" value="${record.price_per_pet_0_5L !== null && record.price_per_pet_0_5L !== undefined ? record.price_per_pet_0_5L : ''}" placeholder="Optional PKR">
            </div>
          </div>
        </div>
        <div class="form-divider"></div>
        <div class="form-section">
          <div class="form-section-title">Minerals Used</div>
          <div class="form-row form-row-3">
            <div class="form-group">
              <label for="edit-calcium">Calcium (kg)</label>
              <input type="number" id="edit-calcium" min="0" step="0.0001" value="${minerals.calcium_kg || 0}">
            </div>
            <div class="form-group">
              <label for="edit-magnesium">Magnesium (kg)</label>
              <input type="number" id="edit-magnesium" min="0" step="0.0001" value="${minerals.magnesium_kg || 0}">
            </div>
            <div class="form-group">
              <label for="edit-sodium">Sodium (kg)</label>
              <input type="number" id="edit-sodium" min="0" step="0.0001" value="${minerals.sodium_kg || 0}">
            </div>
          </div>
        </div>
      `;

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = newForm.querySelector('#modal-submit-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');

        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        const getVal = (id) => {
          const val = document.getElementById(id).value;
          return val === '' ? null : Number(val);
        };

        const data = {
          pets_produced_1_5L: getVal('edit-prod-15'),
          pets_produced_0_5L: getVal('edit-prod-05'),
          pets_sold_1_5L: getVal('edit-sold-15'),
          pets_sold_0_5L: getVal('edit-sold-05'),
          price_per_pet_1_5L: getVal('edit-price-15'),
          price_per_pet_0_5L: getVal('edit-price-05'),
          minerals_used: {
            calcium_kg: getVal('edit-calcium'),
            magnesium_kg: getVal('edit-magnesium'),
            sodium_kg: getVal('edit-sodium')
          }
        };

        const resolvedSold15 = data.pets_sold_1_5L !== null ? data.pets_sold_1_5L : (record.pets_sold_1_5L || 0);
        const resolvedSold05 = data.pets_sold_0_5L !== null ? data.pets_sold_0_5L : (record.pets_sold_0_5L || 0);

        if (data.price_per_pet_1_5L !== null && resolvedSold15 <= 0) {
          Utils.showToast('Please enter a sold quantity for 1.5L PET to set its price.', 'warning');
          btn.disabled = false;
          btnText.classList.remove('hidden');
          btnLoader.classList.add('hidden');
          return;
        }
        if (data.price_per_pet_0_5L !== null && resolvedSold05 <= 0) {
          Utils.showToast('Please enter a sold quantity for 0.5L PET to set its price.', 'warning');
          btn.disabled = false;
          btnText.classList.remove('hidden');
          btnLoader.classList.add('hidden');
          return;
        }

        try {
          const response = await API.updateDailyLog(id, data);
          Utils.showToast('Daily log updated successfully!', 'success');
          
          if (response && response.inventory) {
            Utils.updatePersistentAlert(response.inventory);
          } else {
            const todayData = await API.getToday();
            Utils.updatePersistentAlert(todayData);
          }

          modal.classList.add('hidden');
          
          // Reload everything
          loadSummary();
          loadCharts();
          loadTableData(false);
        } catch (err) {
          Utils.showToast(err.message || 'Failed to update daily log.', 'error');
        } finally {
          btn.disabled = false;
          btnText.classList.remove('hidden');
          btnLoader.classList.add('hidden');
        }
      });

    } else if (targetType === 'additions') {
      modalTitle.textContent = `Edit Inventory Addition — ${Utils.formatDate(record.date || record.created_at)}`;
      const added = record.added || {};

      newForm.querySelector('#modal-form-fields').innerHTML = `
        <div class="form-section">
          <div class="form-section-title">Packaging Stock Added</div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-bottles-15">Bottles 1.5L</label>
              <input type="number" id="edit-bottles-15" min="0" step="1" value="${added.bottles_1_5L || record.bottles_1_5L || 0}">
            </div>
            <div class="form-group">
              <label for="edit-bottles-05">Bottles 0.5L</label>
              <input type="number" id="edit-bottles-05" min="0" step="1" value="${added.bottles_0_5L || record.bottles_0_5L || 0}">
            </div>
          </div>
          <div class="form-group">
            <label for="edit-caps">Caps</label>
            <input type="number" id="edit-caps" min="0" step="1" value="${added.caps || record.caps || 0}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-shelling-15">Shelling 1.5L (kg)</label>
              <input type="number" id="edit-shelling-15" min="0" step="0.01" value="${added.shelling_1_5L_kg || record.shelling_1_5L_kg || 0}">
            </div>
            <div class="form-group">
              <label for="edit-shelling-05">Shelling 0.5L (kg)</label>
              <input type="number" id="edit-shelling-05" min="0" step="0.01" value="${added.shelling_0_5L_kg || record.shelling_0_5L_kg || 0}">
            </div>
          </div>
        </div>
        <div class="form-divider"></div>
        <div class="form-section">
          <div class="form-section-title">Mineral Stock Added</div>
          <div class="form-row form-row-3">
            <div class="form-group">
              <label for="edit-calcium">Calcium (kg)</label>
              <input type="number" id="edit-calcium" min="0" step="0.01" value="${added.calcium_kg || record.calcium_kg || 0}">
            </div>
            <div class="form-group">
              <label for="edit-magnesium">Magnesium (kg)</label>
              <input type="number" id="edit-magnesium" min="0" step="0.01" value="${added.magnesium_kg || record.magnesium_kg || 0}">
            </div>
            <div class="form-group">
              <label for="edit-sodium">Sodium (kg)</label>
              <input type="number" id="edit-sodium" min="0" step="0.01" value="${added.sodium_kg || record.sodium_kg || 0}">
            </div>
          </div>
        </div>
      `;

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = newForm.querySelector('#modal-submit-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');

        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        const getVal = (id) => {
          const val = document.getElementById(id).value;
          return val === '' ? null : Number(val);
        };

        const data = {
          bottles_1_5L: getVal('edit-bottles-15'),
          bottles_0_5L: getVal('edit-bottles-05'),
          caps: getVal('edit-caps'),
          shelling_1_5L_kg: getVal('edit-shelling-15'),
          shelling_0_5L_kg: getVal('edit-shelling-05'),
          calcium_kg: getVal('edit-calcium'),
          magnesium_kg: getVal('edit-magnesium'),
          sodium_kg: getVal('edit-sodium')
        };

        try {
          const response = await API.updateAddition(id, data);
          Utils.showToast('Inventory addition updated successfully!', 'success');
          
          if (response && response.inventory) {
            Utils.updatePersistentAlert(response.inventory);
          } else {
            const todayData = await API.getToday();
            Utils.updatePersistentAlert(todayData);
          }

          modal.classList.add('hidden');
          
          // Reload everything
          loadSummary();
          loadCharts();
          loadTableData(false);
        } catch (err) {
          Utils.showToast(err.message || 'Failed to update inventory addition.', 'error');
        } finally {
          btn.disabled = false;
          btnText.classList.remove('hidden');
          btnLoader.classList.add('hidden');
        }
      });
    }

    // Show modal
    modal.classList.remove('hidden');
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
      const data = await API.getHistory(tab, LIMIT, tableState.offsets[tab], filterStartDate, filterEndDate);
      const rows = data.records || data.logs || data.data || data.additions || data.minerals || [];

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

    // Reset date variables
    filterStartDate = null;
    filterEndDate = null;

    // Reset table state
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

    // Bind date filter actions
    document.getElementById('apply-filter-btn')?.addEventListener('click', () => {
      filterStartDate = document.getElementById('filter-start-date').value || null;
      filterEndDate = document.getElementById('filter-end-date').value || null;
      
      // Reload everything
      loadSummary();
      loadCharts();
      loadTableData(false);
    });

    document.getElementById('clear-filter-btn')?.addEventListener('click', () => {
      const startEl = document.getElementById('filter-start-date');
      const endEl = document.getElementById('filter-end-date');
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';

      filterStartDate = null;
      filterEndDate = null;

      // Reload everything
      loadSummary();
      loadCharts();
      loadTableData(false);
    });

    // Bind table action clicks (Edit / Delete)
    document.getElementById('table-content')?.addEventListener('click', handleTableActionClick);

    // Bind edit modal close listeners
    const modal = document.getElementById('edit-modal');
    modal?.querySelector('#modal-close-btn')?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      };
    }

    // Keyboard Esc handler to close modal
    escHandler = (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    };
    window.addEventListener('keydown', escHandler);

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

    // Clean up Escape key listener
    if (escHandler) {
      window.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  return { mount, unmount };
})();
