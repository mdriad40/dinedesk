/* ============================================
   DineDesk — User Dashboard (user/dashboard.js)
   ============================================ */

const UserDashboard = {
  userData: null,
  settings: {},
  countdownInterval: null,
  monthlyDeposit: 0,
  monthlyMeals: 0,
  monthlyBazar: 0,

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
        let depositTotal = 0;
        let otherCostTotal = 0;
        let deductionTotal = 0;
        snap.forEach(child => {
          const d = child.val();
          if (d.date && d.date.startsWith(currentMonth)) {
            const amt = Math.abs(Utils.num(d.amount));
            if (d.type === 'deposit') {
              depositTotal += amt;
            } else if (d.type === 'other_costing') {
              otherCostTotal += amt;
            } else if (d.type === 'deduction') {
              deductionTotal += amt;
            }
          }
        });
        this.monthlyDeposit = depositTotal;
        this.monthlyOtherCosting = otherCostTotal;
        this.monthlyDeduction = deductionTotal;
        this.renderStats();
      });

    // Bazar this month (total bazar spend)
    db.ref(`dinings/${diningId}/bazar`).on('value', (snap) => {
      let bazarTotal = 0;
      snap.forEach(child => {
        const b = child.val();
        if (b.date && b.date.startsWith(currentMonth)) {
          bazarTotal += Utils.num(b.amount);
        }
      });
      this.monthlyBazar = bazarTotal;
      this.renderStats();
    });

    // Meals this month for this user
    db.ref(`dinings/${diningId}/meals/${currentMonth}`)
      .on('value', (snap) => {
        const monthData = snap.val() || {};
        this.monthMealsData = monthData;
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
        this.renderMealToggles();
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
    
    const otherCosting = this.monthlyOtherCosting || 0;
    const deduction = this.monthlyDeduction || 0;
    const totalCost = mealCost + otherCosting;
    const balance = this.monthlyDeposit - totalCost - deduction;

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
      <div class="stat-card fade-up" style="animation-delay: 0.15s;">
        <div class="stat-icon warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Meal Cost</div>
          <div class="stat-value">${Utils.currency(mealCost)}</div>
        </div>
      </div>
      <div class="stat-card fade-up" style="animation-delay: 0.2s;">
        <div class="stat-icon" style="background:var(--warning-100);color:var(--warning-700);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Other Cost</div>
          <div class="stat-value">${Utils.currency(otherCosting)}</div>
        </div>
      </div>
      <div class="stat-card fade-up" style="animation-delay: 0.25s;">
        <div class="stat-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Deduction</div>
          <div class="stat-value">${Utils.currency(deduction)}</div>
        </div>
      </div>
      <div class="stat-card fade-up" style="animation-delay: 0.3s;">
        <div class="stat-icon ${balance >= 0 ? 'accent' : 'danger'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">This Month Balance</div>
          <div class="stat-value" style="color:${balance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'}">${Utils.currency(balance)}</div>
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
    const trackedMeals = s.trackedMeals || { breakfast: true, lunch: true, dinner: true };

    const todayKey = Utils.dayKey(Utils.today());
    const todayMeals = (this.monthMealsData && this.monthMealsData[todayKey]) || {};
    const completed = todayMeals.completed || {};

    const meals = [
      {
        type: 'breakfast',
        label: 'Breakfast',
        desc: 'Morning meal',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M18 8h1a3 3 0 0 1 0 6h-1" />
                 <path d="M4 8h14v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8z" fill="currentColor" />
                 <line x1="2" y1="21" x2="20" y2="21" stroke-width="2" />
               </svg>`,
        iconClass: 'breakfast',
        deadline: s.breakfastDeadline || '04:00'
      },
      {
        type: 'lunch',
        label: 'Lunch',
        desc: 'Mid-day',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M18 3v18M18 3a3 3 0 0 0-3 3v6h3M6 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 13v9" />
                 <line x1="6" y1="3" x2="6" y2="7" />
                 <line x1="10" y1="3" x2="10" y2="7" />
               </svg>`,
        iconClass: 'lunch',
        deadline: s.lunchDeadline || '10:00'
      },
      {
        type: 'dinner',
        label: 'Dinner',
        desc: 'Evening',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                 <g transform="translate(12,12) rotate(45) translate(-12,-12)">
                   <path d="M12 21v-10" />
                   <path d="M12 11c-1.8 0-2.2-1.5-2.2-4s1-4 2.2-4 2.2 1.5 2.2 4-1 4-2.2 4z" fill="currentColor" />
                 </g>
                 <g transform="translate(12,12) rotate(-45) translate(-12,-12)">
                   <path d="M12 21v-10" />
                   <path d="M12 11c1.5 0 2-1 2-4s-.5-4-2-4v8z" fill="currentColor" />
                 </g>
               </svg>`,
        iconClass: 'dinner',
        deadline: s.dinnerDeadline || '16:00'
      }
    ].filter(m => trackedMeals[m.type] !== false);

    // Update date display
    Utils.setText('mealDateDisplay', Utils.formatDate(Utils.today()));

    // Show/hide completed meals warning card
    const completedList = meals.filter(m => !!completed[m.type]);
    const warningContainer = document.getElementById('mealCompletedWarningContainer');
    if (warningContainer) {
      if (completedList.length > 0) {
        const todayStr = Utils.today();
        const formattedToday = Utils.formatDate(todayStr);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const formattedTomorrow = Utils.formatDate(tomorrowStr);

        warningContainer.innerHTML = `
          <div class="completed-meals-warning-card" style="
            background: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.15);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #991b1b;
            border-radius: 12px;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 400;
            line-height: 1.45;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.03);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:#b91c1c;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="rgba(185, 28, 28, 0.08)"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div>
              Today's (<strong>${formattedToday}</strong>) meal has already been added. You may turn the next meal on or off from <strong>${formattedTomorrow}</strong>.
            </div>
          </div>
        `;
        warningContainer.style.display = 'block';
      } else {
        warningContainer.style.display = 'none';
      }
    }

    grid.innerHTML = meals.map(meal => {
      const isCompleted = !!completed[meal.type];
      const isLocked = !isCompleted && autoEnabled && Utils.isPastDeadline(meal.deadline);

      const val = mealStatus[meal.type];
      let mealCount = 1;
      if (val === false) {
        mealCount = 0;
      } else if (typeof val === 'number') {
        mealCount = val;
      }

      const isOn = mealCount > 0;
      const cardClass = (isLocked ? 'locked ' : '') + (isOn ? 'on' : 'off');

      let statusText = '';
      if (isCompleted) {
        statusText = `
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px; color: var(--primary-600);">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
          </svg>
          <span class="status-text-prefix">Meal is </span><span class="status-state ${isOn ? 'on' : 'off'}">${isOn ? 'ON' : 'OFF'}</span><span class="status-text-sep"> · </span><span class="status-cutoff"><span class="status-cutoff-prefix">Cutoff: </span>${Utils.formatTime(meal.deadline)}</span>
        `;
      } else if (isLocked) {
        statusText = `<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> <span class="status-state locked">Locked</span><span class="status-text-sep"> · </span><span class="status-cutoff"><span class="status-cutoff-prefix">Deadline was </span>${Utils.formatTime(meal.deadline)}</span>`;
      } else {
        // Unlocked meal (both autoEnabled and manual)
        statusText = `
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px; color: ${isOn ? 'var(--primary-600)' : 'var(--danger-600)'};">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="status-text-prefix">Meal is </span><span class="status-state ${isOn ? 'on' : 'off'}">${isOn ? 'ON' : 'OFF'}</span><span class="status-text-sep"> · </span><span class="status-cutoff"><span class="status-cutoff-prefix">Cutoff: </span>${Utils.formatTime(meal.deadline)}</span>
        `;
      }

      return `
        <div class="meal-toggle-card ${cardClass}">
          <div class="meal-toggle-info">
            <div class="meal-toggle-icon ${meal.iconClass}">
              ${meal.icon}
            </div>
            <div class="meal-toggle-text">
              <h4 style="margin:0; line-height:1.2;">${meal.label}</h4>
              <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 1px; margin-bottom: 2px;">${meal.desc}</div>
              <div class="meal-toggle-status">${statusText}</div>
            </div>
          </div>
          <div class="quantity-selector ${isLocked ? 'disabled' : ''}">
            <button class="qty-btn qty-minus" type="button" 
                    ${isLocked || mealCount <= 0 ? 'disabled' : ''} 
                    onclick="DineDesk.userDashboard.adjustMealCount('${meal.type}', -1)">-</button>
            <span class="qty-val">${mealCount}</span>
            <button class="qty-btn qty-plus" type="button" 
                    ${isLocked || mealCount >= 10 ? 'disabled' : ''} 
                    onclick="DineDesk.userDashboard.adjustMealCount('${meal.type}', 1)">+</button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Adjust meal count (plus/minus)
   */
  async adjustMealCount(mealType, delta) {
    try {
      const u = this.userData;
      const mealStatus = u.mealStatus || { breakfast: true, lunch: true, dinner: true };
      const currentVal = mealStatus[mealType];

      let currentCount = 1;
      if (currentVal === false) {
        currentCount = 0;
      } else if (typeof currentVal === 'number') {
        currentCount = currentVal;
      }

      const newCount = Math.min(10, Math.max(0, currentCount + delta));
      if (newCount === currentCount) return;

      // Update database
      await db.ref(`dinings/${this.diningId}/users/${this.userId}/mealStatus/${mealType}`).set(newCount);

      const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);

      let toastType = 'success';
      let toastTitle = '';
      let toastDesc = '';
      let logMsg = '';

      if (newCount === 0) {
        toastType = 'error';
        toastTitle = `${label} OFF`;
        toastDesc = `Your ${label.toLowerCase()} has been turned off.`;
        logMsg = `${label} OFF`;
      } else if (newCount === 1 && currentCount === 0) {
        toastTitle = `${label} ON`;
        toastDesc = `Your ${label.toLowerCase()} has been turned on.`;
        logMsg = `${label} ON`;
      } else {
        toastTitle = `${label} Updated`;
        toastDesc = `Your ${label.toLowerCase()} count has been set to ${newCount}.`;
        logMsg = `${label} count updated to ${newCount}`;
      }

      Notifications.toast(toastType, toastTitle, toastDesc);
      await Notifications.log(this.diningId, 'meal_toggled', logMsg, this.userId, this.userId);
    } catch (error) {
      console.error('Adjust meal count error:', error);
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
      <div class="quick-action-card" onclick="DineDesk.finance.showOtherCostingModal()">
        <div class="quick-action-icon" style="background:var(--warning-100);color:var(--warning-700);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <span>Other Costing</span>
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

        // Format user logs (only user-specific activities, filtering out duplicates and external join/add events)
        userLogsData.forEach(l => {
          if (l.action === 'user_updated' || l.action === 'security_updated' || l.action === 'meal_toggled') {
            combined.push({
              action: l.action,
              details: l.details,
              timestamp: l.timestamp,
              performedBy: l.performedBy
            });
          }
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
          let html = displayLogs.map(log => {
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

          html += this._setupTimelineCollapse(container, displayLogs.length);
          container.innerHTML = html;
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
            let html = toggleLogs.map(log => {
              const detail = this._normalizeMealDetail(log.details || '');
              const isOn = !(
                detail.toUpperCase().includes(' OFF') ||
                detail.toUpperCase().includes(' REMOVED') ||
                detail.toUpperCase().includes(' TO 0') ||
                (log.details || '').toUpperCase().includes(' OFF') ||
                (log.details || '').toUpperCase().includes(' REMOVED') ||
                (log.details || '').toUpperCase().includes(' TO 0')
              );
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

            html += this._setupToggleHistoryCollapse(toggleContainer, toggleLogs.length);
            toggleContainer.innerHTML = html;
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

        let html = displayLogs.map(log => {
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

        html += this._setupTimelineCollapse(container, displayLogs.length);
        container.innerHTML = html;
      });
    }
  },

  /**
   * Setup collapse and expand behavior for the Recent Activity timeline
   */
  _setupTimelineCollapse(container, displayLogsCount) {
    if (displayLogsCount <= 3) {
      container.classList.remove('collapsed');
      return '';
    }

    // Determine if it was already expanded or collapsed
    const isFirstRender = !container.querySelector('.timeline-item');
    const isCollapsed = isFirstRender ? true : container.classList.contains('collapsed');

    if (isCollapsed) {
      container.classList.add('collapsed');
    } else {
      container.classList.remove('collapsed');
    }

    // Add listener if not attached
    if (!container.dataset.listenerAttached) {
      container.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.expand-btn');
        const collapseBtn = e.target.closest('.collapse-btn');
        if (expandBtn) {
          container.classList.remove('collapsed');
        } else if (collapseBtn) {
          container.classList.add('collapsed');
          // Smooth scroll to top of the card when collapsing if user scrolled past
          const card = container.closest('.card');
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
      container.dataset.listenerAttached = 'true';
    }

    return `
      <div class="timeline-expand-wrapper">
        <button class="timeline-action-btn expand-btn" type="button" title="Show More">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>
      <div class="timeline-collapse-wrapper">
        <button class="timeline-action-btn collapse-btn" type="button" title="Show Less">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
        </button>
      </div>
    `;
  },

  /**
   * Setup collapse and expand behavior for the Meal Toggle History list
   */
  _setupToggleHistoryCollapse(container, logsCount) {
    if (logsCount <= 4) {
      container.classList.remove('collapsed');
      return '';
    }

    // Determine if it was already expanded or collapsed
    const isFirstRender = !container.querySelector('.meal-toggle-history-item');
    const isCollapsed = isFirstRender ? true : container.classList.contains('collapsed');

    if (isCollapsed) {
      container.classList.add('collapsed');
    } else {
      container.classList.remove('collapsed');
    }

    // Add listener if not attached
    if (!container.dataset.listenerAttached) {
      container.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.expand-btn');
        const collapseBtn = e.target.closest('.collapse-btn');
        if (expandBtn) {
          container.classList.remove('collapsed');
        } else if (collapseBtn) {
          container.classList.add('collapsed');
          const card = container.closest('.card');
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
      container.dataset.listenerAttached = 'true';
    }

    return `
      <div class="timeline-expand-wrapper">
        <button class="timeline-action-btn expand-btn" type="button" title="Show More">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>
      <div class="timeline-collapse-wrapper">
        <button class="timeline-action-btn collapse-btn" type="button" title="Show Less">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
        </button>
      </div>
    `;
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
