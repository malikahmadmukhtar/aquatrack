/**
 * AquaTrack — End of Day Update Page
 * Two glass cards: Add Inventory (left) + Log Production/Sales (right)
 */

const EODPage = (() => {
  let mounted = false;

  function getHTML() {
    return `
      <div class="page-header fade-in">
        <h2 class="page-title">End of Day Update</h2>
        <p class="page-subtitle">Add inventory stock and log today's production & sales</p>
      </div>

      <div class="eod-grid fade-in-delay">
        <!-- ====== Card A: Add Inventory ====== -->
        <div class="glass-card card-hover">
          <div class="card-header">
            <div class="card-title-group">
              <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              <h3>Add Inventory</h3>
            </div>
          </div>

          <!-- Current inventory summary -->
          <div id="current-inventory-pills" class="inventory-pills">
            <div class="pill-skeleton"></div>
          </div>

          <form id="inventory-form" class="form-stack">
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
            <button type="submit" class="btn btn-gradient" id="inv-submit-btn">
              <span class="btn-text">Add to Inventory</span>
              <span class="btn-loader hidden"></span>
            </button>
          </form>
        </div>

        <!-- ====== Card B: Log Production & Sales ====== -->
        <div class="glass-card card-hover">
          <div class="card-header">
            <div class="card-title-group">
              <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <h3>Log Production & Sales</h3>
            </div>
          </div>

          <form id="daily-log-form" class="form-stack">
            <!-- Production Section -->
            <div class="form-section">
              <div class="section-label">
                <span class="section-dot dot-cyan"></span>
                Production
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="log-produced-15">PETs Produced 1.5L</label>
                  <input type="number" id="log-produced-15" min="0" step="1" placeholder="0" class="preview-input">
                </div>
                <div class="form-group">
                  <label for="log-produced-05">PETs Produced 0.5L</label>
                  <input type="number" id="log-produced-05" min="0" step="1" placeholder="0" class="preview-input">
                </div>
              </div>
            </div>

            <div class="form-divider"></div>

            <!-- Sales Section -->
            <div class="form-section">
              <div class="section-label">
                <span class="section-dot dot-emerald"></span>
                Sales
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="log-sold-15">PETs Sold 1.5L</label>
                  <input type="number" id="log-sold-15" min="0" step="1" placeholder="0">
                </div>
                <div class="form-group">
                  <label for="log-sold-05">PETs Sold 0.5L</label>
                  <input type="number" id="log-sold-05" min="0" step="1" placeholder="0">
                </div>
              </div>
            </div>

            <!-- Live Preview Panel -->
            <div id="preview-panel" class="preview-panel">
              <div class="preview-title">📊 Resource Consumption Preview</div>
              <div class="preview-grid">
                <div class="preview-item">
                  <span class="preview-label">Bottles (1.5L)</span>
                  <span class="preview-value" id="prev-bottles-15">0</span>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Bottles (0.5L)</span>
                  <span class="preview-value" id="prev-bottles-05">0</span>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Total Caps</span>
                  <span class="preview-value" id="prev-caps">0</span>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Shelling 1.5L</span>
                  <span class="preview-value" id="prev-shelling-15">0.00 kg</span>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Shelling 0.5L</span>
                  <span class="preview-value" id="prev-shelling-05">0.00 kg</span>
                </div>
                <div class="preview-item preview-total">
                  <span class="preview-label">Total Bottles</span>
                  <span class="preview-value" id="prev-total-bottles">0</span>
                </div>
              </div>
            </div>

            <div class="form-divider"></div>

            <!-- Minerals (collapsible) -->
            <div class="collapsible">
              <button type="button" class="collapsible-toggle" id="minerals-toggle">
                <span>🧪 Minerals Used (optional)</span>
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="collapsible-content" id="minerals-content">
                <div class="form-row form-row-3">
                  <div class="form-group">
                    <label for="log-calcium">Calcium (kg)</label>
                    <input type="number" id="log-calcium" min="0" step="0.01" placeholder="0.00">
                  </div>
                  <div class="form-group">
                    <label for="log-magnesium">Magnesium (kg)</label>
                    <input type="number" id="log-magnesium" min="0" step="0.01" placeholder="0.00">
                  </div>
                  <div class="form-group">
                    <label for="log-sodium">Sodium (kg)</label>
                    <input type="number" id="log-sodium" min="0" step="0.01" placeholder="0.00">
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-gradient-purple" id="log-submit-btn">
              <span class="btn-text">Submit Daily Log</span>
              <span class="btn-loader hidden"></span>
            </button>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Load and display current inventory pills.
   */
  async function loadCurrentInventory() {
    const pillsEl = document.getElementById('current-inventory-pills');
    if (!pillsEl) return;

    try {
      const data = await API.getInventory();
      const inv = data.inventory || data;
      pillsEl.innerHTML = `
        <div class="pill">🧴 Bottles 1.5L: <strong>${Utils.formatNumber(inv.bottles_1_5L || 0)}</strong></div>
        <div class="pill">🧴 Bottles 0.5L: <strong>${Utils.formatNumber(inv.bottles_0_5L || 0)}</strong></div>
        <div class="pill">🔵 Caps: <strong>${Utils.formatNumber(inv.caps || 0)}</strong></div>
        <div class="pill">📦 Shell 1.5L: <strong>${Utils.formatKg(inv.shelling_1_5L_kg || 0)}</strong></div>
        <div class="pill">📦 Shell 0.5L: <strong>${Utils.formatKg(inv.shelling_0_5L_kg || 0)}</strong></div>
      `;
    } catch (err) {
      pillsEl.innerHTML = `<div class="pill pill-error">Could not load inventory</div>`;
    }
  }

  /**
   * Update the live preview panel as user types.
   */
  function updatePreview() {
    const p15 = document.getElementById('log-produced-15')?.value || 0;
    const p05 = document.getElementById('log-produced-05')?.value || 0;

    const preview = Utils.calculatePreview(p15, p05);

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('prev-bottles-15', Utils.formatNumber(preview.bottles1_5));
    setVal('prev-bottles-05', Utils.formatNumber(preview.bottles0_5));
    setVal('prev-caps', Utils.formatNumber(preview.totalCaps));
    setVal('prev-shelling-15', Utils.formatKg(preview.shelling1_5_kg));
    setVal('prev-shelling-05', Utils.formatKg(preview.shelling0_5_kg));
    setVal('prev-total-bottles', Utils.formatNumber(preview.totalBottles));
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
      shelling_0_5L_kg: Number(document.getElementById('inv-shelling-05').value) || 0
    };

    // Validate at least one field
    if (Object.values(data).every(v => v === 0)) {
      Utils.showToast('Please enter at least one inventory value.', 'warning');
      return;
    }

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
      await API.addInventory(data);
      Utils.showToast('Inventory added successfully!', 'success');
      e.target.reset();
      loadCurrentInventory();
    } catch (err) {
      Utils.showToast(err.message || 'Failed to add inventory.', 'error');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  /**
   * Handle Daily Log form submit.
   */
  async function handleDailyLogSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('log-submit-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    const data = {
      pets_produced_1_5L: Number(document.getElementById('log-produced-15').value) || 0,
      pets_produced_0_5L: Number(document.getElementById('log-produced-05').value) || 0,
      pets_sold_1_5L: Number(document.getElementById('log-sold-15').value) || 0,
      pets_sold_0_5L: Number(document.getElementById('log-sold-05').value) || 0,
      minerals_used: {
        calcium_kg: Number(document.getElementById('log-calcium').value) || 0,
        magnesium_kg: Number(document.getElementById('log-magnesium').value) || 0,
        sodium_kg: Number(document.getElementById('log-sodium').value) || 0
      }
    };

    // Validate
    if (data.pets_produced_1_5L === 0 && data.pets_produced_0_5L === 0 &&
        data.pets_sold_1_5L === 0 && data.pets_sold_0_5L === 0) {
      Utils.showToast('Please enter production or sales data.', 'warning');
      return;
    }

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
      await API.logDaily(data);
      Utils.showToast('Daily log submitted successfully!', 'success');
      e.target.reset();
      updatePreview();
      loadCurrentInventory();
    } catch (err) {
      Utils.showToast(err.message || 'Failed to submit daily log.', 'error');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  /**
   * Mount the page into the given container.
   */
  function mount(container) {
    container.innerHTML = getHTML();
    mounted = true;

    // Load current inventory
    loadCurrentInventory();

    // Bind forms
    document.getElementById('inventory-form')?.addEventListener('submit', handleInventorySubmit);
    document.getElementById('daily-log-form')?.addEventListener('submit', handleDailyLogSubmit);

    // Live preview listeners
    document.querySelectorAll('.preview-input').forEach(input => {
      input.addEventListener('input', updatePreview);
    });

    // Minerals collapsible toggle
    const toggle = document.getElementById('minerals-toggle');
    const content = document.getElementById('minerals-content');
    if (toggle && content) {
      toggle.addEventListener('click', () => {
        const isOpen = content.classList.toggle('open');
        toggle.classList.toggle('open', isOpen);
      });
    }
  }

  /**
   * Unmount / cleanup.
   */
  function unmount() {
    mounted = false;
  }

  return { mount, unmount };
})();
