/**
 * AquaTrack — API Client
 * Handles all communication with the Netlify Functions backend.
 */

const API = (() => {
  const BASE = '/.netlify/functions';

  function getToken() {
    return localStorage.getItem('auth_token');
  }

  function setToken(token) {
    localStorage.setItem('auth_token', token);
  }

  function clearToken() {
    localStorage.removeItem('auth_token');
  }

  function isAuthenticated() {
    return !!getToken();
  }

  /**
   * Core request method.
   * Automatically attaches JWT and handles 401.
   */
  async function request(path, options = {}) {
    const url = `${BASE}/${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 — session expired
      if (response.status === 401) {
        clearToken();
        if (typeof App !== 'undefined' && App.showLogin) {
          App.showLogin();
        }
        throw new Error('Session expired. Please log in again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed (${response.status})`);
      }

      // Check for low inventory alerts in every response
      if (data && typeof data.low_inventory_alert !== 'undefined') {
        Utils.updatePersistentAlert(data);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error('Network error. Please check your connection.');
      }
      throw err;
    }
  }

  /**
   * Login — POST /auth
   */
  async function login(username, password) {
    const data = await request('auth', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  }

  /**
   * Get current inventory — GET /inventory
   */
  async function getInventory() {
    return request('inventory');
  }

  /**
   * Add inventory stock — PUT /inventory
   */
  async function addInventory(data) {
    return request('inventory', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Log daily production & sales — POST /daily-log
   */
  async function logDaily(data) {
    return request('daily-log', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get today's log + inventory + alerts — GET /daily-log
   */
  async function getToday() {
    return request('daily-log');
  }

  /**
   * Get history data — GET /history
   * @param {'daily'|'additions'|'minerals'|'summary'} type
   * @param {number} limit
   * @param {number} offset
   */
  async function getHistory(type, limit = 30, offset = 0, startDate = null, endDate = null) {
    let query = `history?type=${type}`;
    if (type !== 'summary') {
      query += `&limit=${limit}&offset=${offset}`;
    }
    if (startDate) {
      query += `&startDate=${startDate}`;
    }
    if (endDate) {
      query += `&endDate=${endDate}`;
    }
    return request(query);
  }

  /**
   * Edit daily log entry — PUT /daily-log?id=...
   */
  async function updateDailyLog(id, data) {
    return request(`daily-log?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete daily log entry — DELETE /daily-log?id=...
   */
  async function deleteDailyLog(id) {
    return request(`daily-log?id=${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Edit past addition transaction — PUT /inventory?additionId=...
   */
  async function updateAddition(id, data) {
    return request(`inventory?additionId=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete past addition transaction — DELETE /inventory?additionId=...
   */
  async function deleteAddition(id) {
    return request(`inventory?additionId=${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Overwrite baseline inventory directly — PUT /inventory?overwrite=true
   */
  async function overwriteInventory(data) {
    return request('inventory?overwrite=true', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Add expense — POST /expenses
   */
  async function addExpense(data) {
    return request('expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get today's expense — GET /expenses
   */
  async function getTodayExpense() {
    return request('expenses');
  }

  /**
   * Get expense summary — GET /expenses?type=summary&period=...
   */
  async function getExpenseSummary(period) {
    return request(`expenses?type=summary&period=${period}`);
  }

  /**
   * Get expense history — GET /expenses?type=history&limit=...&offset=...
   */
  async function getExpenseHistory(limit = 30, offset = 0) {
    return request(`expenses?type=history&limit=${limit}&offset=${offset}`);
  }

  /**
   * Update expense — PUT /expenses?id=...
   */
  async function updateExpense(id, data) {
    return request(`expenses?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete expense — DELETE /expenses?id=...
   */
  async function deleteExpense(id) {
    return request(`expenses?id=${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Logout — clear token and state.
   */
  function logout() {
    clearToken();
    localStorage.removeItem('aquatrack_alert');
    if (typeof App !== 'undefined' && App.showLogin) {
      App.showLogin();
    }
  }

  return {
    isAuthenticated,
    login,
    getInventory,
    addInventory,
    logDaily,
    getToday,
    getHistory,
    updateDailyLog,
    deleteDailyLog,
    updateAddition,
    deleteAddition,
    overwriteInventory,
    addExpense,
    getTodayExpense,
    getExpenseSummary,
    getExpenseHistory,
    updateExpense,
    deleteExpense,
    logout,
    getToken,
    clearToken
  };
})();
