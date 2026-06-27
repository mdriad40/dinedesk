/* ============================================
   DineDesk — User Dashboard (user/dashboard.js)
   ============================================ */

const UserDashboard = {
  userData: null,
  settings: {},
  countdownInterval: null,

  /**
   * Initialize user dashboard
   */
  init(diningId, userId) {
    this.diningId = diningId;
    this.userId = userId;

    // Listen to user data
    db.ref(`dinings/${diningId}/users/${userId}`).on('value', (snap) => {
      this.userData = snap.val();
      this.renderStats();
      this.renderMealToggles();
    });

    // Listen to settings for deadlines
    db.ref(`dinings/${diningId}/settings`).on('value', (snap) => {
      this.settings = snap.val() || {};
      this.renderMealToggles();
    });

    // Start countdown timer
    this._startCountdown();
  },

  /**
   * Render dashboard stat cards
   */
  renderStats() {
    const container = document.getElementById('dashboardStats');
    if (!container || !this.userData) return;

    const u = this.userData;
    const mealRate = DineDesk.state.mealRate || 0;
    const mealCost = Utils.calcMealCost(mealRate, u.totalMeals);
    const balance = Utils.calcBalance(u.totalDeposit, mealCost);
    const due = balance < 0 ? Math.abs(balance) : 0;

    container.innerHTML = `
      <div class="stat-card fade-up stagger-1">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Deposit</div>
          <div class="stat-value">${Utils.currency(u.totalDeposit)}</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-2">
        <div class="stat-icon accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Meals</div>
          <div class="stat-value">${u.totalMeals || 0}</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-3">
        <div class="stat-icon warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Meal Cost</div>
          <div class="stat-value">${Utils.currency(mealCost)}</div>
          <div class="stat-change">Rate: ${Utils.currency(mealRate)}/meal</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-4">
        <div class="stat-icon ${balance >= 0 ? 'accent' : 'danger'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Balance</div>
          <div class="stat-value" style="color:${balance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'};">${Utils.currency(balance)}</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-5" ${due === 0 ? 'style="display:none;"' : ''}>
        <div class="stat-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Due Amount</div>
          <div class="stat-value" style="color:var(--danger-600);">${Utils.currency(due)}</div>
        </div>
      </div>
    `;
  },

  /**
   * Render meal toggle cards for today
   */
  renderMealToggles() {
    const grid = document.getElementById('mealTogglesGrid');
    if (!grid || !this.userData) return;

    const u = this.userData;
    const mealStatus = u.mealStatus || { breakfast: true, lunch: true, dinner: true };
    const s = this.settings;
    const autoEnabled = !!s.autoMealEnabled;

    const meals = [
      {
        type: 'breakfast',
        label: 'Breakfast',
        icon: '☀️',
        iconClass: 'breakfast',
        deadline: s.breakfastDeadline || '04:00',
        status: mealStatus.breakfast !== false
      },
      {
        type: 'lunch',
        label: 'Lunch',
        icon: '🍱',
        iconClass: 'lunch',
        deadline: s.lunchDeadline || '10:00',
        status: mealStatus.lunch !== false
      },
      {
        type: 'dinner',
        label: 'Dinner',
        icon: '🌙',
        iconClass: 'dinner',
        deadline: s.dinnerDeadline || '16:00',
        status: mealStatus.dinner !== false
      }
    ];

    // Update date display
    Utils.setText('mealDateDisplay', Utils.formatDate(Utils.today()));

    grid.innerHTML = meals.map(meal => {
      const isPast = autoEnabled && Utils.isPastDeadline(meal.deadline);
      const isLocked = isPast;
      const isOn = meal.status;
      const cardClass = isLocked ? 'locked' : (isOn ? 'on' : 'off');
      const timeRemaining = Utils.timeUntilDeadline(meal.deadline);

      let statusText = '';
      if (isLocked) {
        statusText = `<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Locked · Deadline was ${Utils.formatTime(meal.deadline)}`;
      } else if (autoEnabled) {
        statusText = `⏰ Editable · ${Utils.countdownDisplay(timeRemaining.hours, timeRemaining.minutes)}`;
      } else {
        statusText = isOn ? '✅ Meal is ON' : '❌ Meal is OFF';
      }

      return `
        <div class="meal-toggle-card ${cardClass}">
          <div class="meal-toggle-info">
            <div class="meal-toggle-icon ${meal.iconClass}">
              <span style="font-size:22px;">${meal.icon}</span>
            </div>
            <div class="meal-toggle-text">
              <h4>${meal.label}</h4>
              <div class="meal-toggle-status">${statusText}</div>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox"
                   ${isOn ? 'checked' : ''}
                   ${isLocked ? 'disabled' : ''}
                   onchange="DineDesk.userDashboard.toggleMeal('${meal.type}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
    }).join('');
  },

  /**
   * Toggle a meal ON/OFF
   */
  async toggleMeal(mealType, isOn) {
    try {
      await db.ref(`dinings/${this.diningId}/users/${this.userId}/mealStatus/${mealType}`).set(isOn);

      const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
      Notifications.toast(
        isOn ? 'success' : 'info',
        `${label} ${isOn ? 'ON' : 'OFF'}`,
        `Your ${label.toLowerCase()} has been turned ${isOn ? 'on' : 'off'}.`
      );
    } catch (error) {
      console.error('Toggle meal error:', error);
      Notifications.toast('error', 'Error', 'Failed to update meal status.');
    }
  },

  /**
   * Render admin quick actions
   */
  renderAdminQuickActions() {
    const grid = document.getElementById('quickActionsGrid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="quick-action-card" onclick="DineDesk.router.navigate('users')">
        <div class="quick-action-icon" style="background:var(--primary-100);color:var(--primary-600);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </div>
        <span>Add Member</span>
      </div>
      <div class="quick-action-card" onclick="DineDesk.router.navigate('meals')">
        <div class="quick-action-icon" style="background:var(--accent-100);color:var(--accent-600);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
        </div>
        <span>Add Meals</span>
      </div>
      <div class="quick-action-card" onclick="DineDesk.finance.showDepositModal()">
        <div class="quick-action-icon" style="background:var(--warning-100);color:var(--warning-600);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <span>Add Deposit</span>
      </div>
      <div class="quick-action-card" onclick="DineDesk.finance.showBazarModal()">
        <div class="quick-action-icon" style="background:var(--danger-100);color:var(--danger-600);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
        </div>
        <span>Add Bazar</span>
      </div>
    `;
  },

  /**
   * Render recent activity from logs
   */
  renderRecentActivity(diningId) {
    db.ref(`dinings/${diningId}/logs`).orderByChild('timestamp').limitToLast(10).on('value', (snap) => {
      const container = document.getElementById('recentActivity');
      if (!container) return;

      const logs = [];
      snap.forEach(child => logs.push(child.val()));
      logs.reverse();

      if (logs.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding:var(--space-6);">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3>No Recent Activity</h3>
            <p>Activities will show up here as they happen.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = logs.map(log => {
        const dotClass = log.action?.includes('deposit') ? 'accent'
          : log.action?.includes('meal') ? 'warning'
          : log.action?.includes('bazar') ? ''
          : log.action?.includes('delete') ? 'danger'
          : '';

        return `
          <div class="timeline-item">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
              <div class="timeline-date">${Utils.timeAgo(log.timestamp)}</div>
              <div class="timeline-title">${log.action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Activity'}</div>
              <div class="timeline-desc">${log.details || ''}</div>
            </div>
          </div>
        `;
      }).join('');
    });
  },

  /**
   * Start countdown timer interval
   */
  _startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      // Re-render meal toggles every minute to update countdowns
      if (Router.currentPage === 'dashboard') {
        this.renderMealToggles();
      }
    }, 60000); // Every minute
  },

  /**
   * Refresh dashboard
   */
  refresh() {
    this.renderStats();
    this.renderMealToggles();
  }
};

console.log('[DineDesk] User Dashboard loaded');
