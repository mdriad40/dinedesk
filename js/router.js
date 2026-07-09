/* ============================================
   DineDesk — Client-Side Router (router.js)
   ============================================ */

const Router = {
  currentPage: 'dashboard',
  adminPages: ['users', 'meals', 'finance', 'settings', 'mymeal'],

  /**
   * Initialize the router
   */
  init(role) {
    this.role = role;

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      const page = location.hash.replace('#', '') || 'dashboard';
      this._showPage(page);
    });

    // Navigate to initial page from URL hash
    const initialPage = location.hash.replace('#', '') || 'dashboard';
    this._showPage(initialPage);
  },

  /**
   * Navigate to a page
   */
  navigate(page) {
    // Role-based access
    if (this.role !== 'admin' && this.adminPages.includes(page)) {
      Notifications.toast('warning', 'Access Denied', 'You do not have permission to view this page.');
      return;
    }

    location.hash = page;
    this._showPage(page);

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  /**
   * Show a specific page section and update nav state
   */
  _showPage(page) {
    // Validate page
    const section = document.getElementById(`page-${page}`);
    if (!section) {
      page = 'dashboard';
    }

    // Role guard
    if (this.role !== 'admin' && this.adminPages.includes(page)) {
      page = 'dashboard';
    }

    this.currentPage = page;

    // Hide all page sections
    document.querySelectorAll('.page-section').forEach(s => {
      s.classList.remove('active');
    });

    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) {
      target.classList.add('active');
    }

    // Update page title in header
    const titles = {
      dashboard: 'Dashboard',
      users: 'Members',
      meals: 'Meal Management',
      finance: 'Finance',
      overview: 'Dining Overview',
      settings: 'Settings',
      profile: 'Profile',
      mymeal: 'My Meal',
      mealchart: 'Meal Chart',
      bazar: 'Bazar',
      summary: 'Summary',
      history: 'History'
    };
    Utils.setText('headerTitle', titles[page] || 'Dashboard');
    const subtitle = document.getElementById('headerSubtitle');
    if (subtitle) {
      subtitle.textContent = '';
      subtitle.style.display = 'none';
    }

    // Toggle header back button and mobile menu button visibility
    const backBtn = document.getElementById('headerBackBtn');
    if (backBtn) {
      const showBack = (page === 'mealchart' || page === 'bazar' || page === 'summary');
      backBtn.style.display = showBack ? 'inline-flex' : 'none';
      
      const menuBtn = document.querySelector('.mobile-menu-btn');
      if (menuBtn) {
        if (showBack) {
          menuBtn.style.setProperty('display', 'none', 'important');
        } else {
          menuBtn.style.removeProperty('display');
        }
      }
    }

    // Determine which nav page should be highlighted
    let activeNavPage = page;
    if (page === 'mealchart' || page === 'bazar' || page === 'summary') {
      activeNavPage = 'overview';
    }

    // Update sidebar nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === activeNavPage);
    });

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === activeNavPage);
    });

    // Trigger page-specific init
    this._onPageEnter(page);
  },

  /**
   * Called when a page becomes active — trigger any page-specific setup
   */
  _onPageEnter(page) {
    switch (page) {
      case 'dashboard':
        if (DineDesk.userDashboard) DineDesk.userDashboard.refresh();
        break;
      case 'users':
        if (DineDesk.users) DineDesk.users.refresh();
        break;
      case 'meals':
        if (DineDesk.meals) DineDesk.meals.refresh();
        break;
      case 'finance':
        if (DineDesk.finance) DineDesk.finance.refresh();
        break;
      case 'overview':
        if (DineDesk.overview) DineDesk.overview.refresh();
        break;
      case 'settings':
        if (DineDesk.settings) DineDesk.settings.refresh();
        break;
      case 'profile':
        if (DineDesk.history) DineDesk.history.refresh();
        break;
      case 'mymeal':
        if (DineDesk.userDashboard) DineDesk.userDashboard.refresh();
        break;
      case 'mealchart':
        // MealChartModule init is called on app start; no refresh needed here
        break;
      case 'bazar':
        if (DineDesk.bazarHistory) DineDesk.bazarHistory.refresh();
        break;
      case 'summary':
        if (DineDesk.summary) DineDesk.summary.refresh();
        break;
      case 'history':
        // Placeholders for future page-specific logic
        break;
    }
  }
};

console.log('[DineDesk] Router loaded');
