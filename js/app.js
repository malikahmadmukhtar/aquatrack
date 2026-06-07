/**
 * AquaTrack — Main Application
 * SPA router with authentication gate.
 */

const App = (() => {
  const pages = {
    inventory: AddInventoryPage,
    eod: EODPage,
    today: TodayPage,
    history: HistoryPage
  };

  let currentPage = null;

  /**
   * Show the login screen, hide the app shell.
   */
  function showLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-shell')?.classList.add('hidden');
    document.getElementById('persistent-alert')?.classList.add('hidden');
  }

  /**
   * Show the app shell, hide login screen.
   */
  function showApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');
    Utils.restoreAlert();
  }

  /**
   * Navigate to a page based on hash.
   */
  function navigate() {
    const hash = (window.location.hash || '#eod').replace('#', '');
    const pageName = pages[hash] ? hash : 'eod';

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Unmount current page
    if (currentPage && currentPage.unmount) {
      currentPage.unmount();
    }

    // Mount new page
    const container = document.getElementById('page-container');
    if (container) {
      container.classList.remove('page-enter');
      // Force reflow for animation restart
      void container.offsetWidth;
      container.classList.add('page-enter');

      currentPage = pages[pageName];
      if (currentPage && currentPage.mount) {
        currentPage.mount(container);
      }
    }
  }

  /**
   * Handle login form submission.
   */
  async function handleLogin(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      errorEl.textContent = 'Please enter both username and password.';
      errorEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
      await API.login(username, password);
      showApp();
      navigate();
    } catch (err) {
      errorEl.textContent = err.message || 'Invalid credentials. Please try again.';
      errorEl.classList.remove('hidden');
      passwordInput.value = '';
      passwordInput.focus();
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  /**
   * Handle logout.
   */
  function handleLogout() {
    API.logout();
    showLogin();
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  }

  /**
   * Initialize the application.
   */
  function init() {
    // Auth gate
    if (API.isAuthenticated()) {
      showApp();
    } else {
      showLogin();
    }

    // Bind login form
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);

    // Bind logout
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

    // Hash router
    window.addEventListener('hashchange', () => {
      if (API.isAuthenticated()) {
        navigate();
      }
    });

    // Initial navigation
    if (API.isAuthenticated()) {
      navigate();
    }

    // Handle mobile sidebar toggle (click nav items to navigate)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        // On mobile, clicking a nav item should work naturally via hash
      });
    });
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { showLogin, showApp, navigate, init };
})();
