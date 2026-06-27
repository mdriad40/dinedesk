/* ============================================
   DineDesk — Main App Entry Point (app.js)
   ============================================ */

/**
 * Global DineDesk namespace
 * All modules are attached here for cross-module access
 */
window.DineDesk = {
  state: {
    user: null,
    userId: null,
    diningId: null,
    role: null,
    mealRate: 0,
    totalMeals: 0,
    totalBazar: 0,
    totalDeposit: 0
  },

  // Module references (assigned during init)
  auth: {
    async logout() {
      try {
        await auth.signOut();
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Logout error:', error);
        Notifications.toast('error', 'Error', 'Failed to sign out.');
      }
    }
  },
  router: Router,
  users: UsersModule,
  meals: MealsModule,
  finance: FinanceModule,
  settings: SettingsModule,
  userDashboard: UserDashboard,
  history: HistoryModule,
  overview: OverviewModule,
  notifications: Notifications,
  charts: Charts,

  /**
   * Initialize the app — called on dashboard.html load
   */
  async init() {
    console.log('[DineDesk] Initializing app...');

    // Auth state listener
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Not authenticated — redirect to login
        window.location.href = 'index.html';
        return;
      }

      this.state.user = user;
      console.log('[DineDesk] Authenticated:', user.email);

      try {
        // Find user's dining via email mapping
        const emailKey = Utils.encodeEmail(user.email);
        const mappingSnap = await db.ref(`userMappings/emailToDining/${emailKey}`).once('value');
        const mapping = mappingSnap.val();

        if (!mapping) {
          console.error('[DineDesk] No dining found for user');
          Notifications.toast('error', 'Error', 'No dining found for your account.');
          auth.signOut();
          return;
        }

        this.state.diningId = mapping.diningId;
        this.state.userId = mapping.userId;

        // Get user role and info
        const userSnap = await db.ref(`dinings/${mapping.diningId}/users/${mapping.userId}`).once('value');
        const userData = userSnap.val();

        if (!userData) {
          console.error('[DineDesk] User data not found');
          Notifications.toast('error', 'Error', 'Your account data was not found.');
          auth.signOut();
          return;
        }

        this.state.role = userData.role || 'user';
        console.log('[DineDesk] Role:', this.state.role, '| Dining:', mapping.diningId);

        // Setup the UI
        this._setupUI(userData);

        // Initialize all modules
        this._initModules(mapping.diningId, mapping.userId);

        // Show the app shell, hide loader
        document.getElementById('pageLoader').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';

        // Initialize router
        Router.init(this.state.role);

        // Calculate initial meal rate
        await this._calcMealRate();

        // Setup online/offline detection
        this._setupConnectivity();

      } catch (error) {
        console.error('[DineDesk] Init error:', error);
        Notifications.toast('error', 'Error', 'Failed to load your dining data.');
        document.getElementById('pageLoader').style.display = 'none';
      }
    });
  },

  /**
   * Setup UI elements (sidebar, header, etc.)
   */
  _setupUI(userData) {
    const role = this.state.role;
    const isAdmin = role === 'admin';

    // Sidebar brand
    db.ref(`dinings/${this.state.diningId}/info/name`).on('value', (snap) => {
      const name = snap.val() || 'DineDesk';
      Utils.setText('sidebarDiningName', name);
      document.title = `DineDesk — ${name}`;
    });

    // Sidebar role label
    Utils.setText('sidebarRole', isAdmin ? 'Admin Panel' : 'Member Panel');

    // User info in sidebar
    Utils.setText('sidebarUserName', userData.name || 'User');
    Utils.setText('sidebarUserRole', isAdmin ? 'Meal Manager' : 'Member');
    Utils.setText('sidebarAvatar', Utils.initials(userData.name));

    // Show/hide admin nav
    const adminNav = document.getElementById('adminNav');
    if (adminNav) adminNav.style.display = isAdmin ? 'block' : 'none';

    // Show/hide admin quick actions on dashboard
    const quickActions = document.getElementById('adminQuickActions');
    if (quickActions) quickActions.classList.toggle('hidden', !isAdmin);

    // Bottom nav labels for non-admin
    if (!isAdmin) {
      const mealsLabel = document.getElementById('bottomNavMealsLabel');
      if (mealsLabel) mealsLabel.textContent = 'Overview';
    }
  },

  /**
   * Initialize all modules
   */
  _initModules(diningId, userId) {
    const isAdmin = this.state.role === 'admin';

    // Always init these
    UsersModule.init(diningId);
    UserDashboard.init(diningId, userId);
    HistoryModule.init(diningId, userId);
    OverviewModule.init(diningId);
    Notifications.initListener(diningId, userId);

    // Admin-only modules
    if (isAdmin) {
      MealsModule.init(diningId);
      FinanceModule.init(diningId);
      SettingsModule.init(diningId);
      UserDashboard.renderAdminQuickActions();
    }

    // Recent activity
    UserDashboard.renderRecentActivity(diningId);

    // Meal history for profile
    HistoryModule.renderMealHistory(diningId, userId);
  },

  /**
   * Calculate meal rate from bazar and total meals
   */
  async _calcMealRate() {
    try {
      const [bazarSnap, mealsSnap] = await Promise.all([
        db.ref(`dinings/${this.state.diningId}/bazar`).once('value'),
        db.ref(`dinings/${this.state.diningId}/meals`).once('value')
      ]);

      let totalBazar = 0;
      let totalMeals = 0;

      const bazars = bazarSnap.val() || {};
      Object.values(bazars).forEach(b => { totalBazar += Utils.num(b.amount); });

      const meals = mealsSnap.val() || {};
      Object.values(meals).forEach(monthData => {
        Object.values(monthData).forEach(dayData => {
          Object.values(dayData).forEach(typeData => {
            if (typeof typeData === 'object') {
              Object.values(typeData).forEach(c => { totalMeals += parseInt(c) || 0; });
            }
          });
        });
      });

      this.state.mealRate = Utils.calcMealRate(totalBazar, totalMeals);
      this.state.totalMeals = totalMeals;
      this.state.totalBazar = totalBazar;

      // Also calculate total deposits
      const depositsSnap = await db.ref(`dinings/${this.state.diningId}/deposits`).once('value');
      let totalDeposit = 0;
      const deposits = depositsSnap.val() || {};
      Object.values(deposits).forEach(d => {
        if (d.type === 'deposit') totalDeposit += Utils.num(d.amount);
      });
      this.state.totalDeposit = totalDeposit;

      console.log('[DineDesk] Meal Rate:', this.state.mealRate.toFixed(2));

      // Re-render user dashboard stats with correct rate
      UserDashboard.renderStats();

    } catch (error) {
      console.error('[DineDesk] Meal rate calc error:', error);
    }

    // Listen for changes to re-calculate
    db.ref(`dinings/${this.state.diningId}/bazar`).on('value', () => this._recalcMealRate());
    db.ref(`dinings/${this.state.diningId}/meals`).on('value', () => this._recalcMealRate());
    db.ref(`dinings/${this.state.diningId}/deposits`).on('value', () => this._recalcDeposits());
  },

  /**
   * Recalculate meal rate (debounced)
   */
  _recalcMealRate: Utils.debounce(async function() {
    try {
      const [bazarSnap, mealsSnap] = await Promise.all([
        db.ref(`dinings/${DineDesk.state.diningId}/bazar`).once('value'),
        db.ref(`dinings/${DineDesk.state.diningId}/meals`).once('value')
      ]);

      let totalBazar = 0;
      let totalMeals = 0;

      Object.values(bazarSnap.val() || {}).forEach(b => { totalBazar += Utils.num(b.amount); });
      Object.values(mealsSnap.val() || {}).forEach(monthData => {
        Object.values(monthData).forEach(dayData => {
          Object.values(dayData).forEach(typeData => {
            if (typeof typeData === 'object') {
              Object.values(typeData).forEach(c => { totalMeals += parseInt(c) || 0; });
            }
          });
        });
      });

      DineDesk.state.mealRate = Utils.calcMealRate(totalBazar, totalMeals);
      DineDesk.state.totalMeals = totalMeals;
      DineDesk.state.totalBazar = totalBazar;

      // Refresh current page
      if (Router.currentPage === 'dashboard') UserDashboard.renderStats();
      if (Router.currentPage === 'profile') HistoryModule.refresh();
    } catch (e) {
      console.error('Recalc error:', e);
    }
  }, 500),

  /**
   * Recalculate total deposits
   */
  _recalcDeposits: Utils.debounce(async function() {
    try {
      const snap = await db.ref(`dinings/${DineDesk.state.diningId}/deposits`).once('value');
      let total = 0;
      Object.values(snap.val() || {}).forEach(d => {
        if (d.type === 'deposit') total += Utils.num(d.amount);
      });
      DineDesk.state.totalDeposit = total;
    } catch (e) {
      console.error('Deposit recalc error:', e);
    }
  }, 500),

  /**
   * Setup online/offline connectivity indicator
   */
  _setupConnectivity() {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;

    // Firebase connectivity
    const connRef = db.ref('.info/connected');
    connRef.on('value', (snap) => {
      const connected = snap.val() === true;
      indicator.className = `sync-indicator ${connected ? 'connected' : 'disconnected'}`;
      indicator.querySelector('span').textContent = connected ? 'Live' : 'Offline';
    });
  }
};

// ======== AUTO-INIT on dashboard.html ========
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('appShell')) {
    DineDesk.init();
  }
});

console.log('[DineDesk] App module loaded');
