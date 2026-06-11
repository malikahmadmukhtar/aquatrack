/**
 * AquaTrack — End of Day Update Page
 * Single focused card to log daily production & sales with live resource consumption preview.
 */

const EODPage = (() => {
  let mounted = false;
  let todayLogId = null;

  function getHTML() {
    return `
      <div class="page-header fade-in">
        <h2 class="page-title">End of Day Update</h2>
        <p class="page-subtitle">Log today's production & sales and record resource consumption</p>
      </div>

      <div class="eod-single-layout fade-in-delay">
        <!-- ====== Card: Log Production & Sales ====== -->
        <div class="glass-card card-hover max-width-card">
          <div class="card-header">
            <div class="card-title-group">
              <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <h3>Log Daily Production & Sales</h3>
            </div>
          </div>

          <!-- Reference current stock levels -->
          <div class="stock-reference-panel">
            <div class="panel-label">Current Stock Baseline:</div>
            <div id="current-inventory-pills" class="inventory-pills">
              <div class="pill-skeleton"></div>
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
                Sales & Revenue (PKR)
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="log-sold-15">PETs Sold 1.5L</label>
                  <input type="number" id="log-sold-15" min="0" step="1" placeholder="0" class="revenue-calc-input">
                </div>
                <div class="form-group">
                  <label for="log-sold-05">PETs Sold 0.5L</label>
                  <input type="number" id="log-sold-05" min="0" step="1" placeholder="0" class="revenue-calc-input">
                </div>
              </div>
              <div class="form-row" style="margin-top: 12px;">
                <div class="form-group">
                  <label for="log-price-15">Price per PET 1.5L (PKR)</label>
                  <input type="number" id="log-price-15" min="0" step="0.01" placeholder="Optional PKR" class="revenue-calc-input">
                </div>
                <div class="form-group">
                  <label for="log-price-05">Price per PET 0.5L (PKR)</label>
                  <input type="number" id="log-price-05" min="0" step="0.01" placeholder="Optional PKR" class="revenue-calc-input">
                </div>
              </div>
              <!-- Live Revenue Display -->
              <div id="revenue-calc-display" class="hidden" style="margin-top: 14px; padding: 12px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);">Calculated Total Revenue:</span>
                <span id="revenue-amount" style="font-size: 1.1rem; font-weight: 700; color: var(--emerald);">0.00 PKR</span>
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
        <div class="pill">🧴 1.5L: <strong>${Utils.formatNumber(inv.bottles_1_5L || 0)}</strong></div>
        <div class="pill">🧴 0.5L: <strong>${Utils.formatNumber(inv.bottles_0_5L || 0)}</strong></div>
        <div class="pill">🔵 Caps: <strong>${Utils.formatNumber(inv.caps || 0)}</strong></div>
        <div class="pill">📦 Shell 1.5L: <strong>${Utils.formatKg(inv.shelling_1_5L_kg || 0)}</strong></div>
        <div class="pill">📦 Shell 0.5L: <strong>${Utils.formatKg(inv.shelling_0_5L_kg || 0)}</strong></div>
        <div class="pill">🧪 Ca: <strong>${Utils.formatKg(inv.calcium_kg || 0)}</strong></div>
        <div class="pill">🧪 Mg: <strong>${Utils.formatKg(inv.magnesium_kg || 0)}</strong></div>
        <div class="pill">🧪 Na: <strong>${Utils.formatKg(inv.sodium_kg || 0)}</strong></div>
      `;
    } catch (err) {
      pillsEl.innerHTML = `<div class="pill pill-error">Could not load current stock</div>`;
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
   * Update live calculated total revenue in PKR.
   */
  function updateRevenue() {
    const s15 = Number(document.getElementById('log-sold-15')?.value) || 0;
    const s05 = Number(document.getElementById('log-sold-05')?.value) || 0;
    const pr15 = Number(document.getElementById('log-price-15')?.value) || 0;
    const pr05 = Number(document.getElementById('log-price-05')?.value) || 0;

    const totalRevenue = (s15 * pr15) + (s05 * pr05);
    const displayEl = document.getElementById('revenue-calc-display');
    const amountEl = document.getElementById('revenue-amount');

    if (displayEl && amountEl) {
      if (totalRevenue > 0) {
        amountEl.textContent = `${Utils.formatNumber(totalRevenue)} PKR`;
        displayEl.classList.remove('hidden');
      } else {
        displayEl.classList.add('hidden');
      }
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

    const price15Input = document.getElementById('log-price-15');
    const price05Input = document.getElementById('log-price-05');

    const getVal = (id) => {
      const val = document.getElementById(id)?.value;
      return val === '' ? null : Number(val);
    };

    const data = {
      pets_produced_1_5L: getVal('log-produced-15'),
      pets_produced_0_5L: getVal('log-produced-05'),
      pets_sold_1_5L: getVal('log-sold-15'),
      pets_sold_0_5L: getVal('log-sold-05'),
      price_per_pet_1_5L: price15Input && price15Input.value !== '' ? Number(price15Input.value) : null,
      price_per_pet_0_5L: price05Input && price05Input.value !== '' ? Number(price05Input.value) : null,
      minerals_used: {
        calcium_kg: getVal('log-calcium'),
        magnesium_kg: getVal('log-magnesium'),
        sodium_kg: getVal('log-sodium')
      }
    };

    // Validate
    const isZeroOrNull = (v) => v === 0 || v === null || v === undefined;
    if (isZeroOrNull(data.pets_produced_1_5L) && isZeroOrNull(data.pets_produced_0_5L) &&
        isZeroOrNull(data.pets_sold_1_5L) && isZeroOrNull(data.pets_sold_0_5L)) {
      Utils.showToast('Please enter production or sales data.', 'warning');
      return;
    }

    if (data.price_per_pet_1_5L !== null && (data.pets_sold_1_5L || 0) <= 0) {
      Utils.showToast('Please enter a sold quantity for 1.5L PET to set its price.', 'warning');
      return;
    }
    if (data.price_per_pet_0_5L !== null && (data.pets_sold_0_5L || 0) <= 0) {
      Utils.showToast('Please enter a sold quantity for 0.5L PET to set its price.', 'warning');
      return;
    }

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
      let response;
      if (todayLogId) {
        response = await API.updateDailyLog(todayLogId, data);
        Utils.showToast('Daily log updated successfully!', 'success');
      } else {
        response = await API.logDaily(data);
        Utils.showToast('Daily log submitted successfully!', 'success');
        const newLog = response.daily_log || response.log || response;
        todayLogId = newLog._id || newLog.id;
      }
      
      // Update button text to reflect saved state
      const btnText = document.querySelector('#log-submit-btn .btn-text');
      if (btnText) {
        btnText.textContent = 'Update Daily Log';
      }

      loadCurrentInventory();
      
      // Update the low stock persistent alerts toast
      if (response && response.inventory) {
        Utils.updatePersistentAlert(response.inventory);
      } else {
        const todayData = await API.getToday();
        Utils.updatePersistentAlert(todayData);
      }
    } catch (err) {
      Utils.showToast(err.message || 'Failed to submit daily log.', 'error');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  /**
   * Load today's daily log if it exists and populate the form.
   */
  async function loadTodayData() {
    try {
      const response = await API.getToday();
      const log = response.log;
      if (log) {
        todayLogId = log._id || log.id;
        
        // Populate inputs
        const fields = {
          'log-produced-15': log.pets_produced_1_5L,
          'log-produced-05': log.pets_produced_0_5L,
          'log-sold-15': log.pets_sold_1_5L,
          'log-sold-05': log.pets_sold_0_5L,
          'log-price-15': log.price_per_pet_1_5L,
          'log-price-05': log.price_per_pet_0_5L,
          'log-calcium': log.minerals_used?.calcium_kg,
          'log-magnesium': log.minerals_used?.magnesium_kg,
          'log-sodium': log.minerals_used?.sodium_kg
        };

        for (const [id, val] of Object.entries(fields)) {
          const el = document.getElementById(id);
          if (el && val !== undefined && val !== null) {
            el.value = val;
          }
        }

        // Open minerals section if minerals are present
        const minerals = log.minerals_used || {};
        if (minerals.calcium_kg || minerals.magnesium_kg || minerals.sodium_kg) {
          const content = document.getElementById('minerals-content');
          const toggle = document.getElementById('minerals-toggle');
          if (content && toggle) {
            content.classList.add('open');
            toggle.classList.add('open');
          }
        }

        // Update button text
        const btnText = document.querySelector('#log-submit-btn .btn-text');
        if (btnText) {
          btnText.textContent = 'Update Daily Log';
        }

        // Update previews
        updatePreview();
        updateRevenue();
      } else {
        todayLogId = null;
      }
    } catch (err) {
      console.error('Failed to load today log:', err);
      todayLogId = null;
    }
  }

  /**
   * Mount the page into the given container.
   */
  function mount(container) {
    container.innerHTML = getHTML();
    mounted = true;
    todayLogId = null;

    // Load current inventory
    loadCurrentInventory();

    // Load today's existing daily log
    loadTodayData();

    // Bind forms
    document.getElementById('daily-log-form')?.addEventListener('submit', handleDailyLogSubmit);

    // Live preview listeners
    document.querySelectorAll('.preview-input').forEach(input => {
      input.addEventListener('input', updatePreview);
    });

    // Live revenue calculation listeners
    document.querySelectorAll('.revenue-calc-input').forEach(input => {
      input.addEventListener('input', updateRevenue);
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
