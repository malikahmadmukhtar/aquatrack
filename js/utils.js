/**
 * AquaTrack — Utility Helpers
 * Formatting, animation, and calculation utilities.
 */

const Utils = (() => {
  /**
   * Format a number with comma separators.
   * @param {number} n
   * @returns {string}
   */
  function formatNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('en-US');
  }

  /**
   * Format a number as kilograms (2 decimals).
   * @param {number} n
   * @returns {string}
   */
  function formatKg(n) {
    if (n == null || isNaN(n)) return '0.00 kg';
    return Number(n).toFixed(2) + ' kg';
  }

  /**
   * Format a number as percentage (1 decimal).
   * @param {number} n
   * @returns {string}
   */
  function formatPercent(n) {
    if (n == null || isNaN(n)) return '0.0%';
    return Number(n).toFixed(1) + '%';
  }

  /**
   * Format an ISO date string to human-readable format.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format date with time.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Animate a number counting up from 0 to target.
   * @param {HTMLElement} element
   * @param {number} target
   * @param {number} duration (ms)
   * @param {string} [suffix=''] — e.g. ' kg', '%'
   * @param {number} [decimals=0]
   */
  function animateCount(element, target, duration = 1200, suffix = '', decimals = 0) {
    if (!element) return;
    const start = 0;
    const startTime = performance.now();
    target = Number(target) || 0;

    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const current = start + (target - start) * easedProgress;

      if (decimals > 0) {
        element.textContent = current.toFixed(decimals) + suffix;
      } else {
        element.textContent = formatNumber(Math.round(current)) + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  /**
   * Calculate resource preview from production numbers.
   * 1 PET 1.5L = 6 bottles, 1 PET 0.5L = 12 bottles
   * 1 cap per bottle
   * 38 shells per kg for 1.5L, 44 shells per kg for 0.5L
   */
  function calculatePreview(produced1_5, produced0_5, sold1_5 = 0, sold0_5 = 0) {
    const p15 = Number(produced1_5) || 0;
    const p05 = Number(produced0_5) || 0;

    const bottles1_5 = p15 * 6;
    const bottles0_5 = p05 * 12;
    const totalBottles = bottles1_5 + bottles0_5;
    const totalCaps = totalBottles; // 1 cap per bottle
    const shelling1_5_kg = p15 / 38;
    const shelling0_5_kg = p05 / 44;
    const totalShelling = shelling1_5_kg + shelling0_5_kg;

    return {
      bottles1_5,
      bottles0_5,
      totalBottles,
      totalCaps,
      shelling1_5_kg,
      shelling0_5_kg,
      totalShelling
    };
  }

  /**
   * Debounce a function call.
   */
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration (ms)
   */
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-enter');
    });

    // Auto-remove
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove());
      }, duration);
    }
  }

  let alertCloseBound = false;

  function bindAlertClose() {
    if (alertCloseBound) return;
    const closeBtn = document.getElementById('alert-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const el = document.getElementById('persistent-alert');
        if (el) el.classList.add('hidden');
        sessionStorage.setItem('dismissed_low_inventory_alert', 'true');
      });
      alertCloseBound = true;
    }
  }

  /**
   * Show/hide the persistent low-inventory alert.
   */
  function updatePersistentAlert(alertData) {
    const el = document.getElementById('persistent-alert');
    const listEl = document.getElementById('alert-metrics-list');
    if (!el || !listEl) return;

    bindAlertClose();

    if (alertData && alertData.low_inventory_alert && alertData.alert_metrics && alertData.alert_metrics.length > 0) {
      // If the alert metrics have changed, reset the session dismissal
      const currentAlerts = JSON.stringify(alertData.alert_metrics);
      const lastSeenAlerts = localStorage.getItem('last_seen_alerts');
      if (lastSeenAlerts !== currentAlerts) {
        sessionStorage.removeItem('dismissed_low_inventory_alert');
        localStorage.setItem('last_seen_alerts', currentAlerts);
      }

      // Respect session dismissal
      if (sessionStorage.getItem('dismissed_low_inventory_alert') === 'true') {
        el.classList.add('hidden');
        return;
      }

      const labelMap = {
        'bottles_1_5L': '1.5L Bottles',
        'bottles_0_5L': '0.5L Bottles',
        'caps': 'Caps',
        'shelling_1_5L_kg': '1.5L Shelling',
        'shelling_0_5L_kg': '0.5L Shelling',
        'calcium_kg': 'Calcium',
        'magnesium_kg': 'Magnesium',
        'sodium_kg': 'Sodium'
      };

      const invSource = alertData.inventory ? alertData.inventory : alertData;

      const metricsText = alertData.alert_metrics
        .map(m => {
          if (typeof m === 'string') {
            const label = labelMap[m] || m;
            const current = invSource[m] || 0;
            const baseline = invSource[`${m}_at_last_addition`] || 0;
            const percentage = baseline > 0 ? (current / baseline) * 100 : 0;
            return `${label} (${formatPercent(percentage)})`;
          }
          if (m && typeof m === 'object') {
            const label = labelMap[m.name] || m.name;
            return `${label} (${formatPercent(m.percentage)})`;
          }
          return '';
        })
        .filter(t => t !== '')
        .join(', ');

      listEl.textContent = metricsText;
      el.classList.remove('hidden');
      localStorage.setItem('aquatrack_alert', JSON.stringify(alertData));
    } else if (alertData && alertData.low_inventory_alert === false) {
      el.classList.add('hidden');
      localStorage.removeItem('aquatrack_alert');
    }
  }

  /**
   * Restore persisted alert on page load.
   */
  function restoreAlert() {
    bindAlertClose();
    const stored = localStorage.getItem('aquatrack_alert');
    if (stored) {
      try {
        updatePersistentAlert(JSON.parse(stored));
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Get inventory status color class.
   */
  function getStatusColor(percentage) {
    if (percentage > 50) return 'status-good';
    if (percentage > 25) return 'status-warn';
    return 'status-danger';
  }

  /**
   * Create an element from HTML string.
   */
  function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  /**
   * Prevent scroll wheel from changing values in focused number inputs.
   * This is a common browser behavior where scrolling over a focused
   * <input type="number"> increments/decrements the value instead of
   * scrolling the page, causing silent data corruption.
   */
  function preventNumberInputScroll() {
    document.addEventListener('wheel', function(e) {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    }, { passive: true });
  }

  return {
    formatNumber,
    formatKg,
    formatPercent,
    formatDate,
    formatDateTime,
    animateCount,
    calculatePreview,
    debounce,
    showToast,
    updatePersistentAlert,
    restoreAlert,
    getStatusColor,
    createElement,
    preventNumberInputScroll
  };
})();
