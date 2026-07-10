/* ============================================
   DineDesk — User Dashboard (user/dashboard.js)
   ============================================ */

const UserDashboard = {
  userData: null,
  settings: {},
  countdownInterval: null,
  monthlyDeposit: 0,
  monthlyMeals: 0,

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
      this.updateMyMealVisibility();
    });

    // Listen to settings for deadlines
    db.ref(`dinings/${diningId}/settings`).on('value', (snap) => {
      this.settings = snap.val() || {};
      this.renderMealToggles();
      this.updateMyMealVisibility();
    });

    // Listen to current-month deposits and meals for this user
    this._listenMonthlyData(diningId, userId);

    // Start countdown timer
    this._startCountdown();
  },

  /**
   * Listen to current month deposit + meal data for this user
   */
  _listenMonthlyData(diningId, userId) {
    const currentMonth = Utils.currentMonth();

    // Deposits this month for this user
    db.ref(`dinings/${diningId}/deposits`)
      .orderByChild('userId').equalTo(userId)
      .on('value', (snap) => {
        let total = 0;
        snap.forEach(child => {
          const d = child.val();
          if (d.date && d.date.startsWith(currentMonth) && d.type === 'deposit') {
            total += Utils.num(d.amount);
          }
        });
        this.monthlyDeposit = total;
        this.renderStats();
      });

    // Meals this month for this user
    db.ref(`dinings/${diningId}/meals/${currentMonth}`)
      .on('value', (snap) => {
        const monthData = snap.val() || {};
        let total = 0;
        let breakdown = { breakfast: 0, lunch: 0, dinner: 0 };
        Object.values(monthData).forEach(dayData => {
          Object.entries(dayData).forEach(([type, typeData]) => {
            if (typeof typeData === 'object' && typeData[userId] !== undefined) {
              const count = parseFloat(typeData[userId]) || 0;
              total += count;
              if (breakdown[type] !== undefined) {
                breakdown[type] += count;
              }
            }
          });
        });
        this.monthlyMeals = total;
        this.monthlyMealsBreakdown = breakdown;
        this.renderStats();
      });
  },

  /**
   * Render dashboard stat cards
   */
  renderStats() {
    const container = document.getElementById('dashboardStats');
    if (!container || !this.userData) return;

    const u = this.userData;
    // Use current-month values only
    const mealRate = DineDesk.state.monthlyMealRate || 0;
    const rateMode = this.settings.rateMode || 'market';
    const fixedRates = rateMode === 'fixed' ? (this.settings.fixedRates || null) : null;
    const mealCost = Utils.calcMealCost(mealRate, this.monthlyMeals, this.monthlyMealsBreakdown, fixedRates);
    const balance = Utils.calcBalance(this.monthlyDeposit, mealCost);
    const due = balance < 0 ? Math.abs(balance) : 0;

    container.innerHTML = `
      <div class="stat-card fade-up stagger-1">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">This Month Deposit</div>
          <div class="stat-value">${Utils.currency(this.monthlyDeposit)}</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-2">
        <div class="stat-icon accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">This Month Meals</div>
          <div class="stat-value">${this.monthlyMeals || 0}</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-3">
        <div class="stat-icon warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">This Month Meal Cost</div>
          <div class="stat-value">${Utils.currency(mealCost)}</div>
        </div>
      </div>
      <div class="stat-card fade-up stagger-4">
        <div class="stat-icon ${balance >= 0 ? 'accent' : 'danger'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">This Month Balance</div>
          <div class="stat-value" style="color:${balance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'};">${Utils.currency(balance)}</div>
        </div>
      </div>
    `;
  },

  /**
   * Render meal toggle cards for today
   */
  renderMealToggles() {
    const grid = document.getElementById('mealTogglesGrid');
    if (!grid || !this.userData) return;    const u = this.userData;
    const mealStatus = u.mealStatus || { breakfast: true, lunch: true, dinner: true };
    const s = this.settings;
    const autoEnabled = !!s.autoMealEnabled;
    const trackedMeals = s.trackedMeals || { breakfast: true, lunch: true, dinner: true };

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
    ].filter(m => trackedMeals[m.type] !== false);

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
        isOn ? 'success' : 'error',
        `${label} ${isOn ? 'ON' : 'OFF'}`,
        `Your ${label.toLowerCase()} has been turned ${isOn ? 'on' : 'off'}.`
      );
      await Notifications.log(this.diningId, 'meal_toggled', `${label} ${isOn ? 'ON' : 'OFF'}`, this.userId, this.userId);
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
   * Normalize old verbose meal log details into short clean format.
   * Handles legacy Firebase records that were written in old format.
   */
  _normalizeMealDetail(detail) {
    if (!detail) return '';

    // Old format: "Dinner meal updated from 1 to 2 on Jul 9, 2026"
    const updatedMatch = detail.match(/^(\w+) meal updated from (\d+) to (\d+) on .+$/i);
    if (updatedMatch) {
      const type = updatedMatch[1].charAt(0).toUpperCase() + updatedMatch[1].slice(1).toLowerCase();
      const newCount = parseInt(updatedMatch[3]);
      if (newCount === 0) return `${type} removed`;
      return `${newCount} ${type} added`;
    }

    // Old format: "Dinner meal turned ON" / "Breakfast meal turned OFF"
    const toggledMatch = detail.match(/^(\w+) meal turned (ON|OFF)$/i);
    if (toggledMatch) {
      const type = toggledMatch[1].charAt(0).toUpperCase() + toggledMatch[1].slice(1).toLowerCase();
      return `${type} ${toggledMatch[2].toUpperCase()}`;
    }

    // Old format: "dinner meals updated for 2026-07-09"
    const bulkMatch = detail.match(/^(\w+) meals? updated for .+$/i);
    if (bulkMatch) {
      const type = bulkMatch[1].charAt(0).toUpperCase() + bulkMatch[1].slice(1).toLowerCase();
      return `${type} updated`;
    }

    // Already in new format — return as-is
    return detail;
  },

  /**
   * Group meal logs by calendar day
   */
  _groupMealLogs(logs) {
    const finalLogs = [];
    const mealGroups = {};

    logs.forEach(log => {
      if (log.action === 'meal_updated' || log.action === 'meals_updated') {
        const ts = (typeof log.timestamp === 'number') ? log.timestamp : Date.now();
        const sanitizedLog = { ...log, timestamp: ts };
        const dateObj = new Date(ts);
        const dayKey = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!mealGroups[dayKey]) {
          mealGroups[dayKey] = [];
        }
        mealGroups[dayKey].push(sanitizedLog);
      } else {
        const ts = (typeof log.timestamp === 'number') ? log.timestamp : Date.now();
        finalLogs.push({ ...log, timestamp: ts });
      }
    });

    Object.entries(mealGroups).forEach(([dayKey, items]) => {
      // Sort latest first
      items.sort((a, b) => b.timestamp - a.timestamp);
      const latestTimestamp = items[0].timestamp;

      // Deduplicate: keep only the LATEST log per meal type per day
      const seenTypes = new Set();
      const deduped = items.filter(it => {
        const normalized = this._normalizeMealDetail(it.details);
        const mealType = this._extractMealType(normalized || it.details || '');
        const key = mealType || normalized; // fallback to full detail if type can't be extracted
        if (seenTypes.has(key)) return false;
        seenTypes.add(key);
        return true;
      });

      // Build bullet list from deduplicated items
      const combinedDetails = deduped
        .map(it => `• ${this._normalizeMealDetail(it.details)}`)
        .join('<br>');

      finalLogs.push({
        action: 'meals_updated_group',
        details: combinedDetails,
        timestamp: latestTimestamp,
        performedBy: items[0].performedBy
      });
    });

    finalLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return finalLogs;
  },

  /**
   * Extract meal type (Breakfast / Lunch / Dinner) from a detail string
   */
  _extractMealType(detail) {
    const types = ['Breakfast', 'Lunch', 'Dinner'];
    for (const t of types) {
      if (detail.toLowerCase().includes(t.toLowerCase())) return t;
    }
    return null;
  },

  /**
   * Render recent activity from logs
   */
  renderRecentActivity(diningId) {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const role = DineDesk.state.role;
    const isMember = role !== 'admin';
    const currentUserId = this.userId;

    if (isMember) {
      let userLogsData = [];
      let userDepositsData = [];

      const renderCombined = () => {
        const combined = [];

        // Format user logs
        userLogsData.forEach(l => {
          combined.push({
            action: l.action,
            details: l.details,
            timestamp: l.timestamp,
            performedBy: l.performedBy
          });
        });

        // Format user deposits/deductions
        userDepositsData.forEach(d => {
          const isDeposit = d.type === 'deposit';
          combined.push({
            action: isDeposit ? 'deposit_added' : 'deduction_added',
            details: isDeposit
              ? `Deposit ৳${d.amount} (${d.note || 'Regular Deposit'})`
              : `Deducted ৳${Math.abs(d.amount)}: ${d.note || 'No reason specified'}`,
            timestamp: d.timestamp || (d.date ? new Date(d.date).getTime() : 0),
            performedBy: 'manager'
          });
        });

        // --- Split: toggle logs go to separate section ---
        const toggleLogs = combined
          .filter(l => l.action === 'meal_toggled')
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const nonToggleLogs = combined.filter(l => l.action !== 'meal_toggled');

        // Group meal add/update logs by calendar day
        const groupedLogs = this._groupMealLogs(nonToggleLogs);
        const displayLogs = groupedLogs.slice(0, 10);

        // ---- Render Recent Activity (meals + deposits) ----
        if (displayLogs.length === 0) {
          container.innerHTML = `
            <div class="empty-state" style="padding:var(--space-6);">
              <div class="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3>No Recent Activity</h3>
              <p>Activities will show up here as they happen.</p>
            </div>
          `;
        } else {
          container.innerHTML = displayLogs.map(log => {
            const dotClass = log.action?.includes('deposit') ? 'accent'
              : log.action?.includes('deduction') ? 'danger'
                : log.action?.includes('meal') ? 'warning'
                  : log.action?.includes('bazar') ? ''
                    : log.action?.includes('delete') ? 'danger'
                      : '';

            let title;
            if (log.action === 'meals_updated_group') title = 'Meals';
            else if (log.action === 'deposit_added') title = 'Deposit Added';
            else if (log.action === 'deduction_added') title = 'Deduction';
            else if (log.action === 'bazar_added') title = 'Bazar Added';
            else title = log.action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Activity';

            return `
              <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-content">
                  <div class="timeline-date">${Utils.timeAgo(log.timestamp)}</div>
                  <div class="timeline-title">${title}</div>
                  ${log.details ? `<div class="timeline-desc">${log.details}</div>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }

        // ---- Render Meal Toggle History (separate beautiful section) ----
        const toggleContainer = document.getElementById('mealToggleHistory');
        const toggleSection = document.getElementById('mealToggleSection');
        if (toggleContainer) {
          // Only show section for members
          if (toggleSection) toggleSection.style.display = 'block';

          if (toggleLogs.length === 0) {
            toggleContainer.innerHTML = `
              <div class="empty-state" style="padding:var(--space-6);">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <h3>No Toggle History</h3>
                <p>Your meal on/off history will appear here.</p>
              </div>
            `;
          } else {
            toggleContainer.innerHTML = toggleLogs.map(log => {
              const detail = this._normalizeMealDetail(log.details || '');
              const isOn = detail.toUpperCase().includes(' ON') || (log.details || '').toUpperCase().includes(' ON');
              const mealType = this._extractMealType(detail || log.details || '') || 'Meal';

              // Format full date + time
              const ts = log.timestamp;
              let dateTimeStr = '';
              if (ts && typeof ts === 'number') {
                const d = new Date(ts);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                dateTimeStr = `${dateStr} · ${timeStr}`;
              }

              const pillColor = isOn
                ? 'background:var(--primary-100);color:var(--primary-700);border:1px solid var(--primary-200);'
                : 'background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;';

              const iconPath = isOn
                ? '<path d="M5 12l5 5L20 7"/>'
                : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';

              return `
                <div class="meal-toggle-history-item">
                  <div class="mth-icon-wrap" style="${isOn ? 'background:var(--primary-50);color:var(--primary-600);' : 'background:#FEF2F2;color:#DC2626;'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
                  </div>
                  <div class="mth-info">
                    <div class="mth-meal-type">${mealType}</div>
                    <div class="mth-datetime">${dateTimeStr}</div>
                  </div>
                  <span class="mth-pill" style="${pillColor}">${isOn ? 'ON' : 'OFF'}</span>
                </div>
              `;
            }).join('');
          }
        }
      };

      // Listen to user-specific logs
      db.ref(`dinings/${diningId}/users/${currentUserId}/logs`).on('value', (snap) => {
        userLogsData = [];
        snap.forEach(child => { userLogsData.push(child.val()); });
        renderCombined();
      });

      // Listen to user deposits/deductions
      db.ref(`dinings/${diningId}/deposits`).orderByChild('userId').equalTo(currentUserId).on('value', (snap) => {
        userDepositsData = [];
        snap.forEach(child => { userDepositsData.push(child.val()); });
        renderCombined();
      });

    } else {
      // Admin/Manager: hide the Meal Toggle History section (admin doesn't toggle meals)
      const toggleSection = document.getElementById('mealToggleSection');
      if (toggleSection) toggleSection.style.display = 'none';

      // Admin/Manager: show all logs
      db.ref(`dinings/${diningId}/logs`).orderByChild('timestamp').limitToLast(20).on('value', (snap) => {
        const logs = [];
        snap.forEach(child => logs.push(child.val()));
        logs.reverse();

        // Group meal logs by calendar day for the manager as well
        const groupedLogs = this._groupMealLogs(logs);

        // Limit to 10
        const displayLogs = groupedLogs.slice(0, 10);

        if (displayLogs.length === 0) {
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

        container.innerHTML = displayLogs.map(log => {
          const dotClass = log.action?.includes('deposit') ? 'accent'
            : log.action?.includes('deduction') ? 'danger'
              : log.action?.includes('meal') ? 'warning'
                : log.action?.includes('bazar') ? ''
                  : log.action?.includes('delete') ? 'danger'
                    : '';

          let title;
          if (log.action === 'meals_updated_group') {
            title = 'Meals';
          } else if (log.action === 'deposit_added') {
            title = 'Deposit Added';
          } else if (log.action === 'deduction_added') {
            title = 'Deduction';
          } else if (log.action === 'bazar_added') {
            title = 'Bazar Added';
          } else if (log.action === 'meal_toggled') {
            title = 'Meal Status';
          } else {
            title = log.action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Activity';
          }

          return `
            <div class="timeline-item">
              <div class="timeline-dot ${dotClass}"></div>
              <div class="timeline-content">
                <div class="timeline-date">${Utils.timeAgo(log.timestamp)}</div>
                <div class="timeline-title">${title}</div>
                ${log.details ? `<div class="timeline-desc">${log.details}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');
      });
    }
  },

  /**
   * Start countdown timer interval
   */
  _startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      // Re-render meal toggles every minute to update countdowns
      if (Router.currentPage === 'dashboard' || Router.currentPage === 'mymeal') {
        this.renderMealToggles();
      }
    }, 60000); // Every minute
  },

  /**
   * Update visibility of 'My Meal' section and 'Dining Overview' based on manager settings
   */
  updateMyMealVisibility() {
    const role = DineDesk.state.role;
    const isAdmin = role === 'admin';
    const showMyMeal = isAdmin && !!this.settings.managerMealEnabled;

    const navMyMeal = document.getElementById('navMyMeal');
    const bottomNavMyMeal = document.getElementById('bottomNavMyMeal');

    if (navMyMeal) navMyMeal.style.display = showMyMeal ? 'flex' : 'none';
    if (bottomNavMyMeal) bottomNavMyMeal.style.display = showMyMeal ? 'flex' : 'none';

    // Header updates
    const headerTitle = document.getElementById('headerTitle');
    const headerSubtitle = document.getElementById('headerSubtitle');

    if (isAdmin) {
      // Admin dashboard always shows the Dining Overview, so make sure managerOverviewSection is shown
      const managerOverview = document.getElementById('managerOverviewSection');
      if (managerOverview) {
        managerOverview.style.display = 'block';
        managerOverview.classList.remove('hidden');
      }

      if (Router.currentPage === 'dashboard') {
        if (headerTitle) headerTitle.textContent = 'Dining Overview';
        if (headerSubtitle) {
          headerSubtitle.textContent = 'Complete dining statistics and reports';
          headerSubtitle.style.display = 'block';
        }
      } else if (Router.currentPage === 'mymeal') {
        if (headerTitle) headerTitle.textContent = 'My Meal';
        if (headerSubtitle) {
          headerSubtitle.textContent = '';
          headerSubtitle.style.display = 'none';
        }
      }
    } else {
      // Normal user
      if (Router.currentPage === 'dashboard') {
        if (headerTitle) headerTitle.textContent = 'Dashboard';
        if (headerSubtitle) {
          headerSubtitle.textContent = '';
          headerSubtitle.style.display = 'none';
        }
      }
    }
  },

  /**
   * Refresh dashboard
   */
  refresh() {
    this.renderStats();
    this.renderMealToggles();
    this.updateMyMealVisibility();

    const role = DineDesk.state.role;
    const userContent = document.getElementById('userDashboardContent');
    const mymealContainer = document.getElementById('mymealContainer');
    const dashboardSection = document.getElementById('page-dashboard');

    if (role === 'admin') {
      // Admin: Move userDashboardContent to page-mymeal
      if (userContent && mymealContainer && userContent.parentElement !== mymealContainer) {
        mymealContainer.appendChild(userContent);
      }

      // Admin dashboard always shows the Dining Overview
      const overviewContent = document.getElementById('overviewContent');
      const managerContainer = document.getElementById('managerOverviewSection');
      if (overviewContent && managerContainer && overviewContent.parentElement !== managerContainer) {
        managerContainer.appendChild(overviewContent);
        managerContainer.classList.remove('hidden');
        managerContainer.style.display = 'block';
      }
      DineDesk.overview.refresh();
    } else {
      // Regular user: Make sure userDashboardContent is in page-dashboard
      if (userContent && dashboardSection && userContent.parentElement !== dashboardSection) {
        dashboardSection.insertBefore(userContent, dashboardSection.firstChild);
      }
      // Hide manager overview section for regular users
      const managerContainer = document.getElementById('managerOverviewSection');
      if (managerContainer) {
        managerContainer.style.display = 'none';
        managerContainer.classList.add('hidden');
      }
    }
  }
};

console.log('[DineDesk] User Dashboard loaded');
