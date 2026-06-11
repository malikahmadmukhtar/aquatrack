/**
 * AquaTrack — Expenses Page
 * Track daily expenses, view profit summaries, and manage expense history.
 */

const ExpensesPage = (() => {
  let mounted = false;
  let activePeriod = 'daily';
  let escHandler = null;

  let tableState = {
    offset: 0,
    data: [],
    hasMore: true
  };

  const LIMIT = 20;
  let todayExpenseId = null;

  const EXPENSE_FIELDS = [
    { key: 'bottles', label: 'Bottles' },
    { key: 'caps', label: 'Caps' },
    { key: 'shells', label: 'Shells' },
    { key: 'labels', label: 'Labels' },
    { key: 'labour', label: 'Labour' },
    { key: 'petrol', label: 'Petrol' },
    { key: 'shop_rent', label: 'Shop Rent' },
    { key: 'other', label: 'Other' }
  ];

  function getHTML() {
    return `
      <div class="page-header fade-in">
        <h2 class="page-title">Expenses & Profit</h2>
        <p class="page-subtitle">Track daily expenses, monitor costs, and analyze profit margins</p>
      </div>

      <!-- ====== Profit Summary Cards ====== -->
      <div id="expense-summary-cards" class="stats-grid stats-grid-3 fade-in">
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-emerald">💰</div>
          <div class="stat-info">
            <div class="stat-label">Total Revenue (PKR)</div>
            <div class="stat-value" id="summary-revenue">—</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-rose">📉</div>
          <div class="stat-info">
            <div class="stat-label">Total Expenses (PKR)</div>
            <div class="stat-value" id="summary-expenses">—</div>
          </div>
        </div>
        <div class="stat-card glass-card card-hover">
          <div class="stat-icon stat-icon-cyan">📊</div>
          <div class="stat-info">
            <div class="stat-label">Net Profit (PKR)</div>
            <div class="stat-value" id="summary-profit">—</div>
          </div>
        </div>
      </div>

      <!-- ====== Period Tab Switcher ====== -->
      <div class="glass-card fade-in-delay" style="margin-bottom: 20px;">
        <div class="tab-switcher" id="period-tabs">
          <button class="tab-btn active" data-period="daily">Daily</button>
          <button class="tab-btn" data-period="weekly">Weekly</button>
          <button class="tab-btn" data-period="monthly">Monthly</button>
        </div>
      </div>

      <!-- ====== Add/Edit Expense Form ====== -->
      <div class="glass-card card-hover fade-in-delay" style="max-width: 720px;">
        <div class="card-header">
          <div class="card-title-group">
            <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <h3>💰 Daily Expenses (PKR)</h3>
          </div>
        </div>

        <form id="expense-form" class="form-stack">
          <!-- Row 1: Bottles & Caps -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-dot dot-rose"></span>
              Material Costs
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="exp-bottles">Bottles (PKR)</label>
                <input type="number" id="exp-bottles" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
              <div class="form-group">
                <label for="exp-caps">Caps (PKR)</label>
                <input type="number" id="exp-caps" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="exp-shells">Shells (PKR)</label>
                <input type="number" id="exp-shells" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
              <div class="form-group">
                <label for="exp-labels">Labels (PKR)</label>
                <input type="number" id="exp-labels" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
            </div>
          </div>

          <div class="form-divider"></div>

          <!-- Row 2: Operational Costs -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-dot dot-amber"></span>
              Operational Costs
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="exp-labour">Labour (PKR)</label>
                <input type="number" id="exp-labour" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
              <div class="form-group">
                <label for="exp-petrol">Petrol (PKR)</label>
                <input type="number" id="exp-petrol" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="exp-shop_rent">Shop Rent (PKR)</label>
                <input type="number" id="exp-shop_rent" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
              <div class="form-group">
                <label for="exp-other">Other (PKR)</label>
                <input type="number" id="exp-other" min="0" step="1" placeholder="0" class="expense-calc-input">
              </div>
            </div>
          </div>

          <!-- Live Total Expense Display -->
          <div style="margin-top: 14px; padding: 12px; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);">Total Daily Expense:</span>
            <span id="expense-total-amount" style="font-size: 1.1rem; font-weight: 700; color: var(--rose);">0 PKR</span>
          </div>

          <button type="submit" class="btn btn-gradient-purple" id="expense-submit-btn">
            <span class="btn-text">Save Today's Expenses</span>
            <span class="btn-loader hidden"></span>
          </button>
        </form>
      </div>

      <!-- ====== Expense History Table ====== -->
      <div style="margin-top: 24px;">
        <div class="section-title fade-in-delay">
          <span class="section-dot dot-rose"></span>
          Expense History
        </div>
        <div class="glass-card table-card fade-in-delay">
          <div class="table-container">
            <div id="expense-table-content">
              <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading expenses...</p>
              </div>
            </div>
          </div>
          <div class="table-footer" id="expense-table-footer">
            <button class="btn btn-outline" id="expense-load-more-btn" style="display:none">Load More</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Calculate and update live total expense.
   */
  function updateExpenseTotal() {
    let total = 0;
    EXPENSE_FIELDS.forEach(f => {
      total += Number(document.getElementById(`exp-${f.key}`)?.value) || 0;
    });
    const el = document.getElementById('expense-total-amount');
    if (el) {
      el.textContent = `${Utils.formatNumber(total)} PKR`;
    }
  }

  /**
   * Load today's existing expense and populate form.
   */
  async function loadTodayExpense() {
    try {
      const data = await API.getTodayExpense();
      const expense = data.expense || data;

      if (expense && expense._id) {
        todayExpenseId = expense._id || expense.id;

        // Populate form fields
        EXPENSE_FIELDS.forEach(f => {
          const el = document.getElementById(`exp-${f.key}`);
          if (el && expense[f.key] !== undefined && expense[f.key] !== null) {
            el.value = expense[f.key];
          }
        });

        // Update button text
        const btnText = document.querySelector('#expense-submit-btn .btn-text');
        if (btnText) {
          btnText.textContent = "Update Today's Expenses";
        }

        updateExpenseTotal();
      } else {
        todayExpenseId = null;
      }
    } catch (err) {
      // No existing expense for today — that's fine
      todayExpenseId = null;
    }
  }

  /**
   * Helper to get current period label string in Asia/Karachi timezone.
   */
  function getCurrentPeriodLabel(period) {
    const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    const yyyy = tzDate.getFullYear();
    const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
    const dd = String(tzDate.getDate()).padStart(2, '0');

    if (period === 'daily') {
      return `${yyyy}-${mm}-${dd}`;
    } else if (period === 'weekly') {
      // Calculate ISO week (Monday is first day of week)
      const d = new Date(Date.UTC(yyyy, tzDate.getMonth(), tzDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    } else {
      // monthly
      return `${yyyy}-${mm}`;
    }
  }

  /**
   * Load profit summary for the selected period.
   */
  async function loadSummary() {
    try {
      const response = await API.getExpenseSummary(activePeriod);
      const items = response.data || [];
      const currentLabel = getCurrentPeriodLabel(activePeriod);

      let revenue = 0;
      let expenses = 0;

      // Find the entry matching the current period
      const matched = items.find(item => item.period_label === currentLabel);
      if (matched) {
        revenue = matched.total_revenue || 0;
        expenses = matched.total_expense || 0;
      }

      const profit = revenue - expenses;

      // Update card labels dynamically to match the selected period
      const cardContainer = document.getElementById('expense-summary-cards');
      if (cardContainer) {
        const labels = {
          daily: ["Today's Revenue", "Today's Expenses", "Today's Profit"],
          weekly: ["This Week's Revenue", "This Week's Expenses", "This Week's Profit"],
          monthly: ["This Month's Revenue", "This Month's Expenses", "This Month's Profit"]
        }[activePeriod];

        const labelElements = cardContainer.querySelectorAll('.stat-card .stat-label');
        if (labelElements.length >= 3) {
          labelElements[0].textContent = `${labels[0]} (PKR)`;
          labelElements[1].textContent = `${labels[1]} (PKR)`;
          labelElements[2].textContent = `${labels[2]} (PKR)`;
        }
      }

      Utils.animateCount(document.getElementById('summary-revenue'), revenue, 1200);
      Utils.animateCount(document.getElementById('summary-expenses'), expenses, 1200);

      const profitEl = document.getElementById('summary-profit');
      if (profitEl) {
        // Set the text color immediately (emerald/green for profit, rose/red for loss/negative)
        profitEl.style.color = profit >= 0 ? 'var(--emerald)' : 'var(--rose)';
        
        // Animate the actual profit directly (negative numbers count down to negative and show minus sign)
        Utils.animateCount(profitEl, profit, 1200);
      }
    } catch (err) {
      console.error('Expense summary load error:', err);
    }
  }

  /**
   * Handle expense form submit (add or update).
   */
  async function handleExpenseSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('expense-submit-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    const data = {};
    let hasValue = false;
    EXPENSE_FIELDS.forEach(f => {
      const val = Number(document.getElementById(`exp-${f.key}`).value) || 0;
      data[f.key] = val;
      if (val > 0) hasValue = true;
    });

    if (!hasValue) {
      Utils.showToast('Please enter at least one expense value.', 'warning');
      return;
    }

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
      if (todayExpenseId) {
        await API.updateExpense(todayExpenseId, data);
        Utils.showToast("Today's expenses updated successfully!", 'success');
      } else {
        const response = await API.addExpense(data);
        todayExpenseId = response._id || response.id || (response.expense && (response.expense._id || response.expense.id));
        Utils.showToast("Today's expenses saved successfully!", 'success');
        btnText.textContent = "Update Today's Expenses";
      }

      // Reload summary and history
      loadSummary();
      loadHistory(false);
    } catch (err) {
      Utils.showToast(err.message || 'Failed to save expenses.', 'error');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  /**
   * Calculate the total for an expense record.
   */
  function calcTotal(record) {
    let total = 0;
    EXPENSE_FIELDS.forEach(f => {
      total += Number(record[f.key]) || 0;
    });
    return total;
  }

  /**
   * Render expense history table (desktop + mobile).
   */
  function renderHistory() {
    const contentEl = document.getElementById('expense-table-content');
    const loadMoreBtn = document.getElementById('expense-load-more-btn');
    if (!contentEl) return;

    const rows = tableState.data;

    if (!rows || rows.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state-sm">
          <p>No expense records found.</p>
        </div>
      `;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    const tableHTML = `
      <!-- Desktop Table View -->
      <table class="data-table desktop-only-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Bottles</th>
            <th>Caps</th>
            <th>Shells</th>
            <th>Labels</th>
            <th>Labour</th>
            <th>Petrol</th>
            <th>Shop Rent</th>
            <th>Other</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const total = calcTotal(r);
            return `
              <tr>
                <td>${Utils.formatDate(r.date || r.created_at)}</td>
                <td>${Utils.formatNumber(r.bottles || 0)}</td>
                <td>${Utils.formatNumber(r.caps || 0)}</td>
                <td>${Utils.formatNumber(r.shells || 0)}</td>
                <td>${Utils.formatNumber(r.labels || 0)}</td>
                <td>${Utils.formatNumber(r.labour || 0)}</td>
                <td>${Utils.formatNumber(r.petrol || 0)}</td>
                <td>${Utils.formatNumber(r.shop_rent || 0)}</td>
                <td>${Utils.formatNumber(r.other || 0)}</td>
                <td><strong>${Utils.formatNumber(total)}</strong></td>
                <td>
                  <div class="table-actions">
                    <button class="btn-icon btn-edit" data-id="${r._id || r.id}" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete" data-id="${r._id || r.id}" title="Delete">🗑️</button>
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
          const total = calcTotal(r);
          return `
            <div class="history-mobile-card">
              <div class="card-mobile-header">
                <span class="card-mobile-date">💰 ${Utils.formatDate(r.date || r.created_at)}</span>
                <div class="card-mobile-actions">
                  <button class="btn-icon btn-edit" data-id="${r._id || r.id}" title="Edit">✏️</button>
                  <button class="btn-icon btn-delete" data-id="${r._id || r.id}" title="Delete">🗑️</button>
                </div>
              </div>
              <div class="card-mobile-grid">
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Bottles</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.bottles || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Caps</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.caps || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Shells</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.shells || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Labels</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.labels || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Labour</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.labour || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Petrol</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.petrol || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Shop Rent</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.shop_rent || 0)}</span>
                </div>
                <div class="card-mobile-item">
                  <span class="card-mobile-label">Other</span>
                  <span class="card-mobile-value">${Utils.formatNumber(r.other || 0)}</span>
                </div>
                <div class="card-mobile-item" style="grid-column: span 2; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); flex-direction: row; justify-content: space-between; align-items: center;">
                  <span class="card-mobile-label" style="text-transform: uppercase; margin-bottom: 0;">Total Expense</span>
                  <span class="card-mobile-value" style="color: var(--rose); font-weight: 700; font-size: 0.95rem;">${Utils.formatNumber(total)} PKR</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    contentEl.innerHTML = tableHTML;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = tableState.hasMore ? 'inline-flex' : 'none';
    }
  }

  /**
   * Load expense history data.
   */
  async function loadHistory(append = false) {
    if (!append) {
      tableState.offset = 0;
      tableState.data = [];
      tableState.hasMore = true;
    }

    try {
      const data = await API.getExpenseHistory(LIMIT, tableState.offset);
      const rows = data.records || data.expenses || data.data || [];

      if (rows.length < LIMIT) {
        tableState.hasMore = false;
      }

      tableState.data = [...tableState.data, ...rows];
      tableState.offset += rows.length;

      renderHistory();
    } catch (err) {
      const contentEl = document.getElementById('expense-table-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="empty-state-sm">
            <p>Error loading expenses: ${err.message}</p>
          </div>
        `;
      }
    }
  }

  /**
   * Handle Edit/Delete clicks via delegation.
   */
  function handleTableActionClick(e) {
    const btn = e.target.closest('.btn-icon');
    if (!btn) return;

    const id = btn.dataset.id;
    const isDelete = btn.classList.contains('btn-delete');
    const isEdit = btn.classList.contains('btn-edit');

    if (isDelete) {
      handleDelete(id);
    } else if (isEdit) {
      handleEdit(id);
    }
  }

  /**
   * Delete an expense record.
   */
  async function handleDelete(id) {
    const confirmed = confirm('Are you sure you want to delete this expense record? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await API.deleteExpense(id);
      Utils.showToast('Expense deleted successfully!', 'success');

      // If we deleted today's expense, reset the form
      if (id === todayExpenseId) {
        todayExpenseId = null;
        document.getElementById('expense-form')?.reset();
        updateExpenseTotal();
        const btnText = document.querySelector('#expense-submit-btn .btn-text');
        if (btnText) {
          btnText.textContent = "Save Today's Expenses";
        }
      }

      loadSummary();
      loadHistory(false);
    } catch (err) {
      Utils.showToast(err.message || 'Failed to delete expense.', 'error');
    }
  }

  /**
   * Edit an expense record via modal.
   */
  function handleEdit(id) {
    const record = tableState.data.find(r => (r._id || r.id) === id);
    if (!record) {
      Utils.showToast('Could not find expense record.', 'error');
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

    modalTitle.textContent = `Edit Expense — ${Utils.formatDate(record.date || record.created_at)}`;

    newForm.querySelector('#modal-form-fields').innerHTML = `
      <div class="form-section">
        <div class="form-section-title">Material Costs (PKR)</div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-exp-bottles">Bottles</label>
            <input type="number" id="edit-exp-bottles" min="0" step="1" value="${record.bottles || 0}">
          </div>
          <div class="form-group">
            <label for="edit-exp-caps">Caps</label>
            <input type="number" id="edit-exp-caps" min="0" step="1" value="${record.caps || 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-exp-shells">Shells</label>
            <input type="number" id="edit-exp-shells" min="0" step="1" value="${record.shells || 0}">
          </div>
          <div class="form-group">
            <label for="edit-exp-labels">Labels</label>
            <input type="number" id="edit-exp-labels" min="0" step="1" value="${record.labels || 0}">
          </div>
        </div>
      </div>
      <div class="form-divider"></div>
      <div class="form-section">
        <div class="form-section-title">Operational Costs (PKR)</div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-exp-labour">Labour</label>
            <input type="number" id="edit-exp-labour" min="0" step="1" value="${record.labour || 0}">
          </div>
          <div class="form-group">
            <label for="edit-exp-petrol">Petrol</label>
            <input type="number" id="edit-exp-petrol" min="0" step="1" value="${record.petrol || 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-exp-shop_rent">Shop Rent</label>
            <input type="number" id="edit-exp-shop_rent" min="0" step="1" value="${record.shop_rent || 0}">
          </div>
          <div class="form-group">
            <label for="edit-exp-other">Other</label>
            <input type="number" id="edit-exp-other" min="0" step="1" value="${record.other || 0}">
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

      const data = {};
      EXPENSE_FIELDS.forEach(f => {
        data[f.key] = Number(document.getElementById(`edit-exp-${f.key}`).value) || 0;
      });

      try {
        await API.updateExpense(id, data);
        Utils.showToast('Expense updated successfully!', 'success');

        modal.classList.add('hidden');

        // If we edited today's expense, reload form too
        if (id === todayExpenseId) {
          loadTodayExpense();
        }

        loadSummary();
        loadHistory(false);
      } catch (err) {
        Utils.showToast(err.message || 'Failed to update expense.', 'error');
      } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    });

    // Show modal
    modal.classList.remove('hidden');
  }

  /**
   * Handle period tab switching.
   */
  function handlePeriodSwitch(e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    const period = btn.dataset.period;
    if (period === activePeriod) return;

    // Update active tab UI
    document.querySelectorAll('#period-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activePeriod = period;
    loadSummary();
  }

  /**
   * Mount the page into the given container.
   */
  function mount(container) {
    container.innerHTML = getHTML();
    mounted = true;

    // Reset state
    activePeriod = 'daily';
    todayExpenseId = null;
    tableState = {
      offset: 0,
      data: [],
      hasMore: true
    };

    // Bind expense form submit
    document.getElementById('expense-form')?.addEventListener('submit', handleExpenseSubmit);

    // Bind live total calculation listeners
    document.querySelectorAll('.expense-calc-input').forEach(input => {
      input.addEventListener('input', updateExpenseTotal);
    });

    // Bind period tab switcher
    document.getElementById('period-tabs')?.addEventListener('click', handlePeriodSwitch);

    // Bind load more button
    document.getElementById('expense-load-more-btn')?.addEventListener('click', () => {
      loadHistory(true);
    });

    // Bind table action clicks (Edit / Delete)
    document.getElementById('expense-table-content')?.addEventListener('click', handleTableActionClick);

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
    loadTodayExpense();
    loadSummary();
    loadHistory();
  }

  /**
   * Unmount / cleanup.
   */
  function unmount() {
    mounted = false;

    // Clean up Escape key listener
    if (escHandler) {
      window.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  return { mount, unmount };
})();
