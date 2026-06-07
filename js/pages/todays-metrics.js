/**
 * AquaTrack — Today's Metrics Page
 * Dashboard showing production stats, resource consumption, and inventory status.
 */

const TodayPage = (() => {
  let mounted = false;

  function getHTML() {
    return `
      <div class="page-header fade-in">
        <h2 class="page-title">Today's Metrics</h2>
        <p class="page-subtitle">Real-time overview of today's production, consumption, and inventory</p>
      </div>

      <div id="today-content" class="fade-in-delay">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading today's data...</p>
        </div>
      </div>
    `;
  }

  /**
   * Build the full dashboard content.
   */
  function renderDashboard(data) {
    const container = document.getElementById('today-content');
    if (!container) return;

    const log = data.daily_log || data.log || {};
    const inventory = data.inventory || {};
    const hasData = log && (log.pets_produced_1_5L || log.pets_produced_0_5L || log.pets_sold_1_5L || log.pets_sold_0_5L);

    if (!hasData) {
      container.innerHTML = `
        <div class="empty-state glass-card">
          <div class="empty-icon">📋</div>
          <h3>No Data for Today</h3>
          <p>No daily log has been submitted yet. Head to <a href="#eod">End of Day</a> to log your production and sales.</p>
        </div>
      `;
      return;
    }

    // Calculate consumption
    const produced15 = log.pets_produced_1_5L || 0;
    const produced05 = log.pets_produced_0_5L || 0;
    const sold15 = log.pets_sold_1_5L || 0;
    const sold05 = log.pets_sold_0_5L || 0;
    const preview = Utils.calculatePreview(produced15, produced05);
    const minerals = log.minerals_used || {};

    // Inventory status
    const invItems = [
      { label: 'Bottles 1.5L', current: inventory.bottles_1_5L || 0, icon: '🧴', key: 'bottles_1_5L' },
      { label: 'Bottles 0.5L', current: inventory.bottles_0_5L || 0, icon: '🧴', key: 'bottles_0_5L' },
      { label: 'Caps', current: inventory.caps || 0, icon: '🔵', key: 'caps' },
      { label: 'Shelling 1.5L', current: inventory.shelling_1_5L_kg || 0, icon: '📦', isKg: true, key: 'shelling_1_5L_kg' },
      { label: 'Shelling 0.5L', current: inventory.shelling_0_5L_kg || 0, icon: '📦', isKg: true, key: 'shelling_0_5L_kg' },
      { label: 'Calcium', current: inventory.calcium_kg || 0, icon: '🧪', isKg: true, key: 'calcium_kg' },
      { label: 'Magnesium', current: inventory.magnesium_kg || 0, icon: '🧪', isKg: true, key: 'magnesium_kg' },
      { label: 'Sodium', current: inventory.sodium_kg || 0, icon: '🧪', isKg: true, key: 'sodium_kg' }
    ];

    container.innerHTML = `
      <!-- Production Stats Row -->
      <div class="section-title fade-in">
        <span class="section-dot dot-cyan"></span>
        Production & Sales
      </div>
      <div class="stats-grid stats-grid-4 fade-in">
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-cyan">🏭</div>
          <div class="stat-info">
            <div class="stat-label">PETs Produced 1.5L</div>
            <div class="stat-value" data-count="${produced15}">0</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-purple">🏭</div>
          <div class="stat-info">
            <div class="stat-label">PETs Produced 0.5L</div>
            <div class="stat-value" data-count="${produced05}">0</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-emerald">💰</div>
          <div class="stat-info">
            <div class="stat-label">PETs Sold 1.5L</div>
            <div class="stat-value" data-count="${sold15}">0</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-amber">💰</div>
          <div class="stat-info">
            <div class="stat-label">PETs Sold 0.5L</div>
            <div class="stat-value" data-count="${sold05}">0</div>
          </div>
        </div>
      </div>

      <!-- Resource Consumption Row -->
      <div class="section-title fade-in">
        <span class="section-dot dot-purple"></span>
        Resource Consumption
      </div>
      <div class="stats-grid stats-grid-4 fade-in">
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-cyan">🧴</div>
          <div class="stat-info">
            <div class="stat-label">Total Bottles Used</div>
            <div class="stat-value" data-count="${preview.totalBottles}">0</div>
            <div class="stat-sub">${Utils.formatNumber(preview.bottles1_5)} (1.5L) + ${Utils.formatNumber(preview.bottles0_5)} (0.5L)</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-purple">🔵</div>
          <div class="stat-info">
            <div class="stat-label">Total Caps Used</div>
            <div class="stat-value" data-count="${preview.totalCaps}">0</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-amber">📦</div>
          <div class="stat-info">
            <div class="stat-label">Shelling Used</div>
            <div class="stat-value stat-value-sm" data-count="${preview.totalShelling}" data-decimals="2" data-suffix=" kg">0</div>
            <div class="stat-sub">${Utils.formatKg(preview.shelling1_5_kg)} (1.5L) + ${Utils.formatKg(preview.shelling0_5_kg)} (0.5L)</div>
          </div>
        </div>
        ${(minerals.calcium_kg || minerals.magnesium_kg || minerals.sodium_kg) ? `
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-emerald">🧪</div>
          <div class="stat-info">
            <div class="stat-label">Minerals Used</div>
            <div class="stat-value stat-value-sm">—</div>
            <div class="stat-sub">Ca: ${Utils.formatKg(minerals.calcium_kg || 0)}, Mg: ${Utils.formatKg(minerals.magnesium_kg || 0)}, Na: ${Utils.formatKg(minerals.sodium_kg || 0)}</div>
          </div>
        </div>` : ''}
      </div>

      <!-- Inventory Status Section -->
      <div class="section-title fade-in">
        <span class="section-dot dot-emerald"></span>
        Inventory Status
      </div>
      <div class="glass-card inventory-status-card fade-in">
        ${invItems.map(item => {
          const baselineKey = `${item.key}_at_last_addition`;
          const lastAddVal = inventory[baselineKey] || item.current || 100;
          const pct = lastAddVal > 0 ? Math.min((item.current / lastAddVal) * 100, 100) : 100;
          const statusClass = Utils.getStatusColor(pct);
          const displayValue = item.isKg ? Utils.formatKg(item.current) : Utils.formatNumber(item.current);
          return `
            <div class="inventory-bar-row">
              <div class="inventory-bar-header">
                <span class="inventory-bar-label">${item.icon} ${item.label}</span>
                <span class="inventory-bar-values">
                  <strong>${displayValue}</strong>
                  <span class="inventory-pct ${statusClass}">${Utils.formatPercent(pct)}</span>
                </span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill ${statusClass}" style="--target-width: ${pct}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Animate count-up on stat values
    setTimeout(() => {
      container.querySelectorAll('.stat-value[data-count]').forEach(el => {
        const target = Number(el.dataset.count);
        const decimals = Number(el.dataset.decimals || 0);
        const suffix = el.dataset.suffix || '';
        Utils.animateCount(el, target, 1200, suffix, decimals);
      });

      // Animate progress bars
      container.querySelectorAll('.progress-bar-fill').forEach(bar => {
        requestAnimationFrame(() => {
          bar.style.width = bar.style.getPropertyValue('--target-width');
        });
      });
    }, 100);
  }

  /**
   * Mount page.
   */
  async function mount(container) {
    container.innerHTML = getHTML();
    mounted = true;

    try {
      const data = await API.getToday();
      if (mounted) {
        renderDashboard(data);
      }
    } catch (err) {
      if (mounted) {
        document.getElementById('today-content').innerHTML = `
          <div class="empty-state glass-card">
            <div class="empty-icon">⚠️</div>
            <h3>Error Loading Data</h3>
            <p>${err.message}</p>
          </div>
        `;
      }
    }
  }

  function unmount() {
    mounted = false;
  }

  return { mount, unmount };
})();
