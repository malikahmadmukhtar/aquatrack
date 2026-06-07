/**
 * AquaTrack — Add Inventory Page
 * Module to handle adding new stock into baseline inventory or overriding baseline values directly.
 */

const AddInventoryPage = (() => {
  let mounted = false;
  let isOverwriteMode = false;

  function getHTML() {
    return `
      <div class="page-header fade-in">
        <h2 class="page-title">Inventory</h2>
        <p class="page-subtitle">Manage stock levels, correct baseline metrics, and review current inventory</p>
      </div>

      <!-- Current Inventory Cards Grid -->
      <div class="section-title fade-in-delay">
        <span class="section-dot dot-cyan"></span>
        Current Stock Status
      </div>
      <div id="current-inventory-cards" class="stats-grid stats-grid-4 fade-in-delay" style="margin-bottom: 32px;">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading current stock...</p>
        </div>
      </div>

      <div class="section-title fade-in-delay">
        <span class="section-dot dot-purple"></span>
        Update Inventory
      </div>
      <div class="inventory-grid fade-in-delay">
        <div class="glass-card card-hover max-width-card">
          <div class="card-header">
            <div class="card-title-group">
              <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              <h3 id="form-card-title">Add New Stock</h3>
            </div>
          </div>

          <!-- Mode Selector Toggle -->
          <div class="mode-toggle-container">
            <span>Adjustment Mode</span>
            <div class="toggle-buttons">
              <button type="button" class="toggle-btn active" id="mode-add-btn">📦 Add Stock</button>
              <button type="button" class="toggle-btn" id="mode-overwrite-btn">🔧 Direct Correct</button>
            </div>
          </div>

          <form id="inventory-form" class="form-stack">
            <!-- Packaging Items -->
            <div class="form-section">
              <div class="section-label">
                <span class="section-dot dot-cyan"></span>
                Packaging Stock
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="inv-bottles-15">Bottles 1.5L</label>
                  <input type="number" id="inv-bottles-15" min="0" step="1" placeholder="0">
                </div>
                <div class="form-group">
                  <label for="inv-bottles-05">Bottles 0.5L</label>
                  <input type="number" id="inv-bottles-05" min="0" step="1" placeholder="0">
                </div>
              </div>
              <div class="form-group">
                <label for="inv-caps">Caps</label>
                <input type="number" id="inv-caps" min="0" step="1" placeholder="0">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="inv-shelling-15">Shelling 1.5L (kg)</label>
                  <input type="number" id="inv-shelling-15" min="0" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label for="inv-shelling-05">Shelling 0.5L (kg)</label>
                  <input type="number" id="inv-shelling-05" min="0" step="0.01" placeholder="0.00">
                </div>
              </div>
            </div>

            <div class="form-divider"></div>

            <!-- Minerals Stock -->
            <div class="form-section">
              <div class="section-label">
                <span class="section-dot dot-purple"></span>
                Mineral Stock
              </div>
              <div class="form-row form-row-3">
                <div class="form-group">
                  <label for="inv-calcium">Calcium (kg)</label>
                  <input type="number" id="inv-calcium" min="0" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label for="inv-magnesium">Magnesium (kg)</label>
                  <input type="number" id="inv-magnesium" min="0" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label for="inv-sodium">Sodium (kg)</label>
                  <input type="number" id="inv-sodium" min="0" step="0.01" placeholder="0.00">
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-gradient" id="inv-submit-btn">
              <span class="btn-text" id="submit-btn-text">Add to Inventory</span>
              <span class="btn-loader hidden"></span>
            </button>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Load and display current inventory cards.
   */
  async function loadCurrentInventory() {
    const cardsEl = document.getElementById('current-inventory-cards');
    if (!cardsEl) return;

    try {
      const data = await API.getInventory();
      const inv = data.inventory || data;

      const items = [
        { label: 'Bottles 1.5L', current: inv.bottles_1_5L || 0, baseline: inv.bottles_1_5L_at_last_addition || 0, icon: '🧴', isKg: false, key: 'bottles_1_5L', colorClass: 'cyan' },
        { label: 'Bottles 0.5L', current: inv.bottles_0_5L || 0, baseline: inv.bottles_0_5L_at_last_addition || 0, icon: '🧴', isKg: false, key: 'bottles_0_5L', colorClass: 'purple' },
        { label: 'Caps', current: inv.caps || 0, baseline: inv.caps_at_last_addition || 0, icon: '🔵', isKg: false, key: 'caps', colorClass: 'amber' },
        { label: 'Shelling 1.5L', current: inv.shelling_1_5L_kg || 0, baseline: inv.shelling_1_5L_kg_at_last_addition || 0, icon: '📦', isKg: true, key: 'shelling_1_5L_kg', colorClass: 'cyan' },
        { label: 'Shelling 0.5L', current: inv.shelling_0_5L_kg || 0, baseline: inv.shelling_0_5L_kg_at_last_addition || 0, icon: '📦', isKg: true, key: 'shelling_0_5L_kg', colorClass: 'purple' },
        { label: 'Calcium', current: inv.calcium_kg || 0, baseline: inv.calcium_kg_at_last_addition || 0, icon: '🧪', isKg: true, key: 'calcium_kg', colorClass: 'emerald' },
        { label: 'Magnesium', current: inv.magnesium_kg || 0, baseline: inv.magnesium_kg_at_last_addition || 0, icon: '🧪', isKg: true, key: 'magnesium_kg', colorClass: 'emerald' },
        { label: 'Sodium', current: inv.sodium_kg || 0, baseline: inv.sodium_kg_at_last_addition || 0, icon: '🧪', isKg: true, key: 'sodium_kg', colorClass: 'emerald' }
      ];

      cardsEl.innerHTML = items.map(item => {
        const isLow = item.baseline > 0 && item.current <= item.baseline * 0.25;
        const displayValue = item.isKg ? Utils.formatKg(item.current) : Utils.formatNumber(item.current);
        const cardClass = isLow ? 'stat-card glass-card card-hover low-stock-alert' : 'stat-card glass-card card-hover';
        const valueClass = isLow ? 'stat-value text-rose' : 'stat-value';
        const pctText = item.baseline > 0 ? ` (${Math.round((item.current / item.baseline) * 100)}%)` : '';

        return `
          <div class="${cardClass}">
            <div class="stat-icon stat-icon-${item.colorClass}">
              ${item.icon}
            </div>
            <div class="stat-info">
              <div class="stat-label">
                ${item.label}${isLow ? ' <span class="badge-danger">LOW</span>' : ''}
              </div>
              <div class="${valueClass}" ${item.isKg ? 'style="font-size: 1.5rem;"' : ''}>
                ${displayValue}
                ${isLow ? `<span class="low-stock-pct">${pctText}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      cardsEl.innerHTML = `
        <div class="empty-state glass-card" style="grid-column: 1 / -1;">
          <div class="empty-icon">⚠️</div>
          <h3>Error Loading Inventory</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }

  /**
   * Handle Inventory form submit.
   */
  async function handleInventorySubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('inv-submit-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    const data = {
      bottles_1_5L: Number(document.getElementById('inv-bottles-15').value) || 0,
      bottles_0_5L: Number(document.getElementById('inv-bottles-05').value) || 0,
      caps: Number(document.getElementById('inv-caps').value) || 0,
      shelling_1_5L_kg: Number(document.getElementById('inv-shelling-15').value) || 0,
      shelling_0_5L_kg: Number(document.getElementById('inv-shelling-05').value) || 0,
      calcium_kg: Number(document.getElementById('inv-calcium').value) || 0,
      magnesium_kg: Number(document.getElementById('inv-magnesium').value) || 0,
      sodium_kg: Number(document.getElementById('inv-sodium').value) || 0
    };

    // Validate at least one field unless in overwrite mode
    if (!isOverwriteMode && Object.values(data).every(v => v === 0)) {
      Utils.showToast('Please enter at least one inventory value.', 'warning');
      return;
    }

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
      let response;
      if (isOverwriteMode) {
        response = await API.overwriteInventory(data);
        Utils.showToast('Inventory baseline adjusted successfully!', 'success');
      } else {
        response = await API.addInventory(data);
        Utils.showToast('Inventory added successfully!', 'success');
      }
      
      e.target.reset();
      loadCurrentInventory();
      
      // Update alerts
      if (response && response.inventory) {
        Utils.updatePersistentAlert(response.inventory);
      } else {
        const todayData = await API.getToday();
        Utils.updatePersistentAlert(todayData);
      }
    } catch (err) {
      Utils.showToast(err.message || 'Failed to update inventory.', 'error');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  /**
   * Mount the page.
   */
  function mount(container) {
    isOverwriteMode = false;
    container.innerHTML = getHTML();
    mounted = true;

    loadCurrentInventory();

    // Bind mode toggle buttons
    const addBtn = document.getElementById('mode-add-btn');
    const overwriteBtn = document.getElementById('mode-overwrite-btn');
    const formTitle = document.getElementById('form-card-title');
    const submitText = document.getElementById('submit-btn-text');

    addBtn?.addEventListener('click', () => {
      isOverwriteMode = false;
      addBtn.classList.add('active');
      overwriteBtn.classList.remove('active');
      if (formTitle) formTitle.textContent = "Add New Stock";
      if (submitText) submitText.textContent = "Add to Inventory";
    });

    overwriteBtn?.addEventListener('click', () => {
      isOverwriteMode = true;
      overwriteBtn.classList.add('active');
      addBtn.classList.remove('active');
      if (formTitle) formTitle.textContent = "Direct Baseline Correction";
      if (submitText) submitText.textContent = "Overwrite Baseline Stock";
    });

    document.getElementById('inventory-form')?.addEventListener('submit', handleInventorySubmit);
  }

  /**
   * Unmount the page.
   */
  function unmount() {
    mounted = false;
  }

  return { mount, unmount };
})();
