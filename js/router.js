/* ============================================
   DineDesk — Client-Side Router (router.js)
   ============================================ */

const Router = {
  currentPage: 'dashboard',
  adminPages: ['users', 'meals', 'finance', 'settings', 'mymeal', 'more', 'aicontrol'],
  // Note: 'fridaymeal' is accessible to all roles
  scrollPositions: {},

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

    // AI Assistant guard
    if (page === 'aiassistant' && this.role !== 'admin') {
      const settings = DineDesk.history ? DineDesk.history.settings : null;
      if (settings && settings.aiAssistantEnabled === false) {
        Notifications.toast('warning', 'Access Denied', 'AI Assistant is currently disabled by the manager.');
        return;
      }
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
    // If leaving export-slip page, clean up its special layout class
    if (this.currentPage === 'export-slip' && page !== 'export-slip') {
      if (DineDesk.overview && DineDesk.overview._leaveExportPage) {
        DineDesk.overview._leaveExportPage();
      }
    }

    // Save scroll position of current page before switching (skip export-slip — it uses overflow:hidden)
    const contentArea = document.querySelector('.content-area');
    if (this.currentPage && this.currentPage !== 'export-slip') {
      const scrollY = window.scrollY || document.documentElement.scrollTop || (contentArea ? contentArea.scrollTop : 0);
      this.scrollPositions[this.currentPage] = scrollY;
    }

    // Validate page
    const section = document.getElementById(`page-${page}`);
    if (!section) {
      page = 'dashboard';
    }

    // Role guard
    if (this.role !== 'admin' && this.adminPages.includes(page)) {
      page = 'dashboard';
    }

    // AI Assistant guard
    if (page === 'aiassistant' && this.role !== 'admin') {
      const settings = DineDesk.history ? DineDesk.history.settings : null;
      if (settings && settings.aiAssistantEnabled === false) {
        page = 'dashboard';
      }
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

    // Toggle active class on body and content-area for AI Assistant
    if (contentArea) {
      if (page === 'aiassistant') {
        contentArea.classList.add('aiassistant-active');
        document.body.classList.add('aiassistant-active-body');
        document.documentElement.classList.add('aiassistant-active-body');
      } else {
        contentArea.classList.remove('aiassistant-active');
        document.body.classList.remove('aiassistant-active-body');
        document.documentElement.classList.remove('aiassistant-active-body');
      }
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
      history: 'History',
      notifications: 'Notifications',
      fridaymeal: "Friday Meal's",
      'export-slip': 'Export Member Statistics',
      more: 'More Menu',
      aicontrol: 'AI Control Panel',
      aiassistant: 'AI Assistant'
    };
    if (page === 'aiassistant') {
      const headerTitle = document.getElementById('headerTitle');
      if (headerTitle) {
        headerTitle.innerHTML = `AI Assistant <span class="ai-status-badge" style="font-size: 0.65rem; font-weight: 600; padding: 2px 6px; background: rgba(5,150,105,0.1); color: #059669; border: 1px solid rgba(5,150,105,0.2); border-radius: 12px; margin-left: 8px; vertical-align: middle; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; background: #34D399; border-radius: 50%; display: inline-block; animation: aiBotPulse 1.5s infinite;"></span>Active</span>`;
      }
      const subtitle = document.getElementById('headerSubtitle');
      if (subtitle) {
        subtitle.textContent = 'DineDesk AI • Always ready';
        subtitle.style.display = 'block';
      }
    } else {
      Utils.setText('headerTitle', titles[page] || 'Dashboard');
      const subtitle = document.getElementById('headerSubtitle');
      if (subtitle) {
        subtitle.textContent = '';
        subtitle.style.display = 'none';
      }
    }
    // Update the green icon pill in the header
    if (typeof setHeaderIcon === 'function') setHeaderIcon(page);

    // Toggle header back button and mobile menu button visibility
    const backBtn = document.getElementById('headerBackBtn');
    if (backBtn) {
      const showBack = (page === 'mealchart' || page === 'bazar' || page === 'summary' || page === 'history' || page === 'notifications' || page === 'export-slip' || page === 'fridaymeal');
      backBtn.style.display = showBack ? 'inline-flex' : 'none';

      // Set onclick dynamically to handle navigation flow
      if (page === 'notifications') {
        backBtn.onclick = () => window.history.back();
      } else if (page === 'export-slip') {
        backBtn.onclick = () => DineDesk.router.navigate('overview');
      } else {
        backBtn.onclick = () => DineDesk.router.navigate('overview');
      }

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
    if (page === 'mealchart' || page === 'bazar' || page === 'summary' || page === 'history' || page === 'export-slip' || page === 'fridaymeal') {
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

    // Restore scroll position for the new page
    // Skip scroll restoration for export-slip — initExportPage forces scrollTop=0 itself
    if (page !== 'export-slip') {
      const savedScroll = this.scrollPositions[page] || 0;

      // Temporarily disable smooth scrolling to scroll instantly
      const htmlEl = document.documentElement;
      const prevScrollBehavior = htmlEl.style.scrollBehavior;
      htmlEl.style.scrollBehavior = 'auto';

      if (contentArea) {
        contentArea.scrollTop = savedScroll;
      }
      window.scrollTo(0, savedScroll);

      // Reinforced fallback to handle dynamic rendering or layout reflows
      requestAnimationFrame(() => {
        if (contentArea) {
          contentArea.scrollTop = savedScroll;
        }
        window.scrollTo(0, savedScroll);

        // Restore previous scroll behavior
        setTimeout(() => {
          htmlEl.style.scrollBehavior = prevScrollBehavior;
        }, 50);
      });
    }
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
        if (DineDesk.fridayMeals) DineDesk.fridayMeals.refresh();
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
        if (DineDesk.history) DineDesk.history.refreshHistoryPage();
        break;
      case 'export-slip':
        if (DineDesk.overview) DineDesk.overview.initExportPage();
        break;
      case 'fridaymeal':
        if (DineDesk.fridayMealPage) DineDesk.fridayMealPage.refresh();
        break;
      case 'more':
        if (DineDesk.smsAlert) DineDesk.smsAlert.refresh();
        break;
      case 'aicontrol':
        if (DineDesk.aiControl) DineDesk.aiControl.setupListeners();
        break;
      case 'aiassistant':
        if (DineDesk.history) DineDesk.history.refresh();
        break;
    }
  }
};

console.log('[DineDesk] Router loaded');
