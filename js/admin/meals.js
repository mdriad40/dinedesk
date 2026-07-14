/* ============================================
   DineDesk — Meal Management (admin/meals.js)
   ============================================ */

const MealsModule = {
  selectedTypes: new Set(['breakfast']),
  selectedUsers: new Set(),
  currentDate: Utils.today(),
  mealsData: {},
  selectedLockedMeals: [],

  /**
   * Initialize meals module
   */
  init(diningId) {
    this.diningId = diningId;

    // Set date input
    const dateInput = document.getElementById('mealDateInput');
    if (dateInput) {
      dateInput.value = this.currentDate;
      dateInput.addEventListener('change', (e) => {
        this.currentDate = e.target.value;
        this.loadMeals();
      });
    }

    // Render tabs dynamically based on settings
    db.ref(`dinings/${diningId}/settings`).on('value', (snap) => {
      const s = snap.val() || {};
      const trackedMeals = s.trackedMeals || { breakfast: true, lunch: true, dinner: true };

      const tabContainer = document.getElementById('mealTypeTabs');
      if (tabContainer) {
        tabContainer.innerHTML = '';
        const mealsList = [
          { type: 'breakfast', label: '☀️ Breakfast' },
          { type: 'lunch', label: '🍱 Lunch' },
          { type: 'dinner', label: '🌙 Dinner' }
        ];

        let firstActive = null;
        mealsList.forEach(m => {
          if (trackedMeals[m.type] !== false) {
            if (!firstActive) firstActive = m.type;
            const activeClass = this.selectedTypes.has(m.type) ? 'active' : '';
            tabContainer.innerHTML += `
              <button class="meal-type-tab ${activeClass}" data-type="${m.type}"
                onclick="DineDesk.meals.selectType('${m.type}')">${m.label}</button>
            `;
          }
        });

        // If current selected types are all disabled, switch to first active
        let hasActiveSelected = false;
        this.selectedTypes.forEach(t => {
          if (trackedMeals[t] !== false) hasActiveSelected = true;
          else this.selectedTypes.delete(t);
        });
        if (!hasActiveSelected && firstActive) {
          this.selectedTypes.clear();
          this.selectedTypes.add(firstActive);
          this.renderUserGrid();
        }
      }
    });

    // Setup realtime listener for current month's meals
    this._listenMeals();
  },

  /**
   * Listen to meals for current month
   */
  _listenMeals() {
    const month = this.currentDate.substring(0, 7); // YYYY-MM
    const mealsRef = db.ref(`dinings/${this.diningId}/meals/${month}`);

    mealsRef.on('value', (snap) => {
      this.mealsData = snap.val() || {};
      if (Router.currentPage === 'meals') {
        this.renderUserGrid();
        this.renderMealLog();
        this.updateCompleteMealSelect();
      }
    });
  },

  /**
   * Select meal type tab (supports multi-select toggle)
   */
  selectType(type) {
    if (this.selectedTypes.has(type)) {
      this.selectedTypes.delete(type);
    } else {
      this.selectedTypes.add(type);
    }
    document.querySelectorAll('.meal-type-tab').forEach(tab => {
      tab.classList.toggle('active', this.selectedTypes.has(tab.dataset.type));
    });
    this.renderUserGrid();
  },

  /**
   * Render user selection grid for meals
   */
  renderUserGrid() {
    const grid = document.getElementById('mealUsersGrid');
    if (!grid) return;

    const users = DineDesk.users.users;
    const isManagerMealEnabled = !!(DineDesk.settings.getSettings().managerMealEnabled);
    const userEntries = Object.entries(users).filter(([id, user]) => {
      if (user.role === 'admin') {
        return isManagerMealEnabled;
      }
      return true;
    });

    if (userEntries.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/></svg>
          </div>
          <h3>No Members</h3>
          <p>Add members first to manage meals.</p>
        </div>
      `;
      return;
    }

    // Get existing meals for this date
    const day = Utils.dayKey(this.currentDate);

    grid.innerHTML = userEntries.map(([id, user]) => {
      // Check if user has meals for any of the selected types
      let hasMeal = false;
      let maxMealCount = 0;
      
      this.selectedTypes.forEach(type => {
        const typeMeals = this.mealsData[day]?.[type] || {};
        if (typeMeals[id] !== undefined && typeMeals[id] > 0) {
          hasMeal = true;
          if (typeMeals[id] > maxMealCount) {
            maxMealCount = typeMeals[id];
          }
        }
      });

      const mealCount = hasMeal ? maxMealCount : 1;

      // Auto-select users who already have a meal
      if (hasMeal && !this.selectedUsers.has(id)) {
        this.selectedUsers.add(id);
      }

      const selected = this.selectedUsers.has(id);

      return `
        <div class="meal-user-chip ${selected ? 'selected' : ''}" onclick="DineDesk.meals.toggleUser('${id}', this)" data-userid="${id}">
          <div class="avatar avatar-sm" style="background:${DineDesk.users._avatarColor(user.name)};">${Utils.initials(user.name)}</div>
          <span class="meal-user-chip-name">${user.name}</span>
          <div class="number-spinner" style="margin-left: auto;" onclick="event.stopPropagation()">
            <button type="button" onclick="DineDesk.meals.decrementUserCount('${id}')">−</button>
            <input type="number" class="user-meal-count" value="${selected ? mealCount : 0}" min="0" max="10"
                   oninput="DineDesk.meals.handleUserCountInput('${id}', this)" data-user-count="${id}">
            <button type="button" onclick="DineDesk.meals.incrementUserCount('${id}')">+</button>
          </div>
        </div>
      `;
    }).join('');

    this._updateSelectedCount();
  },

  /**
   * Toggle user selection
   */
  toggleUser(userId, chipEl) {
    const countInput = chipEl.querySelector(`[data-user-count="${userId}"]`);
    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
      chipEl.classList.remove('selected');
      if (countInput) countInput.value = 0;
    } else {
      this.selectedUsers.add(userId);
      chipEl.classList.add('selected');
      if (countInput && parseInt(countInput.value) === 0) {
        countInput.value = 1;
      }
    }
    this._updateSelectedCount();
  },

  /**
   * Decrement user count spinner
   */
  decrementUserCount(userId) {
    const input = document.querySelector(`[data-user-count="${userId}"]`);
    if (input) {
      let val = parseInt(input.value) || 0;
      if (val > 0) {
        input.value = val - 1;
        this.handleUserCountInput(userId, input);
      }
    }
  },

  /**
   * Increment user count spinner
   */
  incrementUserCount(userId) {
    const input = document.querySelector(`[data-user-count="${userId}"]`);
    if (input) {
      let val = parseInt(input.value) || 0;
      if (val < 10) {
        input.value = val + 1;
        this.handleUserCountInput(userId, input);
      }
    }
  },

  /**
   * Handle manual input on user count field
   */
  handleUserCountInput(userId, inputEl) {
    const val = parseInt(inputEl.value) || 0;
    const chip = inputEl.closest('.meal-user-chip');
    if (val > 0) {
      if (!this.selectedUsers.has(userId)) {
        this.selectedUsers.add(userId);
        if (chip) chip.classList.add('selected');
        this._updateSelectedCount();
      }
    } else {
      if (this.selectedUsers.has(userId)) {
        this.selectedUsers.delete(userId);
        if (chip) chip.classList.remove('selected');
        this._updateSelectedCount();
      }
    }
  },

  /**
   * Toggle select all
   */
  toggleSelectAll(checked) {
    const users = DineDesk.users.users;
    this.selectedUsers.clear();

    if (checked) {
      const isManagerMealEnabled = !!(DineDesk.settings?.getSettings()?.managerMealEnabled);
      Object.entries(users).forEach(([id, user]) => {
        if (user.role === 'admin' && !isManagerMealEnabled) {
          return;
        }
        this.selectedUsers.add(id);
      });
    }

    document.querySelectorAll('.meal-user-chip').forEach(chip => {
      chip.classList.toggle('selected', checked);
      const input = chip.querySelector('.user-meal-count');
      if (input) {
        if (checked) {
          if (parseInt(input.value) === 0) input.value = 1;
        } else {
          input.value = 0;
        }
      }
    });

    this._updateSelectedCount();
  },

  /**
   * Update selected count badge
   */
  _updateSelectedCount() {
    const badge = document.getElementById('selectedMealCount');
    if (badge) {
      const count = this.selectedUsers.size;
      badge.textContent = `${count} selected`;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  /**
   * Decrement bulk count spinner
   */
  decrementBulkCount() {
    const input = document.getElementById('bulkMealCount');
    if (input) {
      let val = parseInt(input.value) || 0;
      if (val > 0) {
        input.value = val - 1;
      }
    }
  },

  /**
   * Increment bulk count spinner
   */
  incrementBulkCount() {
    const input = document.getElementById('bulkMealCount');
    if (input) {
      let val = parseInt(input.value) || 0;
      if (val < 10) {
        input.value = val + 1;
      }
    }
  },

  /**
   * Save bulk meals to database
   */
  async saveBulkMeals() {
    if (this.selectedTypes.size === 0) {
      Notifications.toast('warning', 'No Meal Type Selected', 'Please select at least one meal type (Breakfast, Lunch, Dinner).');
      return;
    }
    if (this.selectedUsers.size === 0) {
      Notifications.toast('warning', 'No Users Selected', 'Please select at least one member.');
      return;
    }

    const btn = document.getElementById('saveMealsBtn');
    btn.disabled = true;

    try {
      const month = this.currentDate.substring(0, 7);
      const day = Utils.dayKey(this.currentDate);
      const bulkCount = parseInt(document.getElementById('bulkMealCount').value) || 1;
      const isBulkOverride = document.getElementById('overrideWithBulkCount')?.checked;
      const updates = {};
      const users = DineDesk.users.users;

      // Get existing meals BEFORE updating the database
      const dayMeals = {};
      this.selectedTypes.forEach(type => {
        dayMeals[type] = { ...(this.mealsData[day]?.[type] || {}) };
      });

      // Build meal updates for all selected meal types
      this.selectedTypes.forEach(mealType => {
        Object.keys(users).forEach(userId => {
          if (this.selectedUsers.has(userId)) {
            let count = bulkCount;
            if (!isBulkOverride) {
              const countInput = document.querySelector(`[data-user-count="${userId}"]`);
              count = countInput ? parseInt(countInput.value) || bulkCount : bulkCount;
            }
            updates[`dinings/${this.diningId}/meals/${month}/${day}/${mealType}/${userId}`] = count;
          } else {
            updates[`dinings/${this.diningId}/meals/${month}/${day}/${mealType}/${userId}`] = null;
          }
        });
      });

      await db.ref().update(updates);

      // Recalculate totals
      await this._recalculateTotals();

      const typesLabel = Array.from(this.selectedTypes)
        .map(t => t.charAt(0).toUpperCase() + t.slice(1))
        .join(' & ');

      Notifications.toast('success', 'Meals Saved', `${typesLabel} meals updated for ${this.currentDate}.`);
      await Notifications.create(
        this.diningId,
        'Meals Updated',
        `${typesLabel} meals updated for ${Utils.formatDate(this.currentDate)}.`,
        'all',
        'meal'
      );
      await Notifications.log(this.diningId, 'meals_updated', `${typesLabel} meals updated for ${this.currentDate}`, DineDesk.state.userId);

      // Log individual meal updates for users whose meal counts changed
      for (const mealType of this.selectedTypes) {
        for (const userId of Object.keys(users)) {
          const oldCount = dayMeals[mealType]?.[userId] !== undefined ? dayMeals[mealType][userId] : 0;
          let newCount = 0;
          if (this.selectedUsers.has(userId)) {
            let count = bulkCount;
            if (!isBulkOverride) {
              const countInput = document.querySelector(`[data-user-count="${userId}"]`);
              count = countInput ? parseInt(countInput.value) || bulkCount : bulkCount;
            }
            newCount = count;
          }

          if (oldCount !== newCount) {
            const user = users[userId];
            if (user) {
              const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
              let detail;
              if (newCount === 0) {
                detail = `${mealLabel} removed`;
              } else {
                detail = `${newCount} ${mealLabel} added`;
              }
              await Notifications.log(
                this.diningId,
                'meal_updated',
                detail,
                DineDesk.state.userId,
                userId,
                this.selectedTypes.size === 1
              );
            }
          }
        }
      }

      this.selectedUsers.clear();
      this.renderUserGrid();

    } catch (error) {
      console.error('Save meals error:', error);
      Notifications.toast('error', 'Error', 'Failed to save meals.');
    } finally {
      btn.disabled = false;
    }
  },

  /**
   * Recalculate total meals for all users
   */
  async _recalculateTotals() {
    const mealsSnap = await db.ref(`dinings/${this.diningId}/meals`).once('value');
    const allMeals = mealsSnap.val() || {};
    const users = DineDesk.users.users;
    const userTotals = {};

    // Initialize totals
    Object.keys(users).forEach(uid => { userTotals[uid] = 0; });

    // Sum all meals across all months/days/types
    let grandTotal = 0;
    Object.values(allMeals).forEach(monthData => {
      Object.values(monthData).forEach(dayData => {
        Object.values(dayData).forEach(typeData => {
          if (typeof typeData === 'object') {
            Object.entries(typeData).forEach(([uid, count]) => {
              const c = parseInt(count) || 0;
              if (userTotals[uid] !== undefined) {
                userTotals[uid] += c;
              }
              grandTotal += c;
            });
          }
        });
      });
    });

    // Update user totals in database
    const updates = {};
    Object.entries(userTotals).forEach(([uid, total]) => {
      updates[`dinings/${this.diningId}/users/${uid}/totalMeals`] = total;
    });

    await db.ref().update(updates);

    // Update state
    DineDesk.state.totalMeals = grandTotal;
  },

  /**
   * Render meal log table for current date
   */
  renderMealLog() {
    const container = document.getElementById('mealLogTable');
    if (!container) return;

    const day = Utils.dayKey(this.currentDate);
    const dayData = this.mealsData[day] || {};
    const users = DineDesk.users.users;
    const types = ['breakfast', 'lunch', 'dinner'];
    const hasAnyMeal = types.some(t => dayData[t] && Object.keys(dayData[t]).length > 0);

    if (!hasAnyMeal) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);">
          <p style="color:var(--text-tertiary);">No meals recorded for ${Utils.formatDate(this.currentDate)}.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="table-wrapper" style="border:none;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left;">Member</th>
              <th style="text-align: center;">☀️ Breakfast</th>
              <th style="text-align: center;">🍱 Lunch</th>
              <th style="text-align: center;">🌙 Dinner</th>
              <th style="text-align: center;">Total</th>
            </tr>
          </thead>
          <tbody>
    `;

    Object.entries(users).forEach(([uid, user]) => {
      const b = parseInt(dayData.breakfast?.[uid]) || 0;
      const l = parseInt(dayData.lunch?.[uid]) || 0;
      const d = parseInt(dayData.dinner?.[uid]) || 0;
      const total = b + l + d;

      if (total > 0) {
        html += `
          <tr>
            <td style="text-align: left;">
              <div class="flex items-center gap-2">
                <div class="avatar avatar-sm" style="background:${DineDesk.users._avatarColor(user.name)};">${Utils.initials(user.name)}</div>
                ${user.name}
              </div>
            </td>
            <td style="text-align: center;">${b > 0 ? `<span class="badge badge-accent">${b}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            <td style="text-align: center;">${l > 0 ? `<span class="badge badge-accent">${l}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            <td style="text-align: center;">${d > 0 ? `<span class="badge badge-accent">${d}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            <td style="text-align: center;"><strong>${total}</strong></td>
          </tr>
        `;
      }
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Load meals for current date
   */
  loadMeals() {
    this.selectedUsers.clear();
    this._listenMeals();
    this.updateCompleteMealSelect();
  },

  /**
   * Refresh meals page
   */
  refresh() {
    this.renderUserGrid();
    this.renderMealLog();
    this.updateCompleteMealSelect();
  },

  /**
   * Update the Complete Locked Meals select options dynamically
   */
  updateCompleteMealSelect() {
    const container = document.getElementById('lockedMealsOptions');
    if (!container) return;

    const s = DineDesk.settings?.getSettings() || {};
    const isToday = this.currentDate === Utils.today();
    const autoEnabled = !!s.autoMealEnabled;

    const meals = [
      { key: 'breakfast', label: 'Breakfast', deadline: s.breakfastDeadline || '04:00', icon: '☀️' },
      { key: 'lunch', label: 'Lunch', deadline: s.lunchDeadline || '10:00', icon: '🍱' },
      { key: 'dinner', label: 'Dinner', deadline: s.dinnerDeadline || '16:00', icon: '🌙' }
    ];

    const day = Utils.dayKey(this.currentDate);
    const dayData = this.mealsData[day] || {};
    const completed = dayData.completed || {};
    const users = DineDesk.users?.users || {};
    const isManagerMealEnabled = !!s.managerMealEnabled;

    // Filter selectedLockedMeals to only keep valid locked meals
    const validLockedMeals = [];
    meals.forEach(m => {
      const isLocked = isToday && autoEnabled && Utils.isPastDeadline(m.deadline);
      const isAlreadyCompleted = !!completed[m.key];
      if (isLocked && !isAlreadyCompleted) {
        validLockedMeals.push(m.key);
      }
    });
    this.selectedLockedMeals = (this.selectedLockedMeals || []).filter(key => validLockedMeals.includes(key));

    // Clear and build the HTML
    container.innerHTML = '';

    meals.forEach(m => {
      const isLocked = isToday && autoEnabled && Utils.isPastDeadline(m.deadline);
      const isAlreadyCompleted = !!completed[m.key];

      let statusClass = 'status-open';
      let statusLabel = 'Open';
      let clickAttr = '';

      if (isAlreadyCompleted) {
        statusClass = 'status-completed';
        statusLabel = 'Completed';
      } else if (isLocked) {
        statusClass = 'status-locked';
        statusLabel = 'Locked';
        const isSelected = this.selectedLockedMeals.includes(m.key);
        if (isSelected) {
          statusClass += ' selected';
        }
        clickAttr = `onclick="DineDesk.meals.toggleLockedMealSelection('${m.key}')"`;
      }

      // Calculate meal count for this type
      let mealCount = 0;
      if (isAlreadyCompleted) {
        const mealEntries = dayData[m.key] || {};
        Object.values(mealEntries).forEach(val => {
          if (typeof val === 'number') mealCount += val;
          else if (val === true) mealCount += 1;
        });
      } else {
        Object.entries(users).forEach(([userId, user]) => {
          if (user.role === 'admin' && !isManagerMealEnabled) {
            return;
          }
          const mealStatus = user.mealStatus || { breakfast: true, lunch: true, dinner: true };
          const statusVal = mealStatus[m.key];
          if (statusVal === true || statusVal === undefined) {
            mealCount += 1;
          } else if (typeof statusVal === 'number' && statusVal > 0) {
            mealCount += statusVal;
          }
        });
      }

      const subLabelText = isAlreadyCompleted 
        ? 'Already Completed' 
        : (isLocked ? `Locked • Deadline ${m.deadline}` : `Open • Deadline ${m.deadline}`);

      container.innerHTML += `
        <div class="glass-option-row ${statusClass}" ${clickAttr} title="${m.label} is currently ${statusLabel}">
          <div class="glass-option-left">
            <div class="glass-option-circle circle-${m.key}">
              ${m.icon}
            </div>
            <div class="glass-option-info">
              <span class="glass-option-label">${m.label}</span>
              <span class="glass-option-sublabel">${subLabelText}</span>
            </div>
          </div>
          <div class="glass-option-count-box">
            ${mealCount}
          </div>
        </div>
      `;
    });

    const btn = document.getElementById('btnCompleteMeal');
    if (btn) {
      const count = (this.selectedLockedMeals || []).length;
      btn.disabled = count === 0;
      const btnSpan = btn.querySelector('span');
      if (btnSpan) {
        btnSpan.textContent = count > 0 ? `Complete Selected (${count})` : 'Complete Selected';
      }
    }
  },

  /**
   * Toggle a locked meal option selection
   */
  toggleLockedMealSelection(mealKey) {
    const index = this.selectedLockedMeals.indexOf(mealKey);
    if (index > -1) {
      this.selectedLockedMeals.splice(index, 1);
    } else {
      this.selectedLockedMeals.push(mealKey);
    }
    this.updateCompleteMealSelect();
  },

  /**
   * Complete all locked meals for the day using members' current mealStatus
   */
  async completeLockedMeal() {
    if (!this.selectedLockedMeals || this.selectedLockedMeals.length === 0) return;

    const btn = document.getElementById('btnCompleteMeal');
    let btnHtmlBackup = '';
    if (btn) {
      btnHtmlBackup = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: var(--space-1);">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" style="opacity: 0.25; fill: none;"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style="opacity: 0.75;"></path>
        </svg>
        <span>Completing...</span>
      `;
    }

    try {
      const month = this.currentDate.substring(0, 7);
      const day = Utils.dayKey(this.currentDate);
      const users = DineDesk.users.users;
      const updates = {};
      const isManagerMealEnabled = !!(DineDesk.settings?.getSettings()?.managerMealEnabled);

      const oldMealsBackup = {};

      // Perform updates for each selected meal type in one batch
      for (const mealType of this.selectedLockedMeals) {
        const dayMeals = { ...(this.mealsData[day]?.[mealType] || {}) };
        oldMealsBackup[mealType] = dayMeals;

        Object.entries(users).forEach(([userId, user]) => {
          if (user.role === 'admin' && !isManagerMealEnabled) {
            return;
          }

          const mealStatus = user.mealStatus || { breakfast: true, lunch: true, dinner: true };
          const statusVal = mealStatus[mealType];

          let count = 0;
          if (statusVal === true || statusVal === undefined) {
            count = 1;
          } else if (typeof statusVal === 'number' && statusVal > 0) {
            count = statusVal;
          }

          if (count > 0) {
            updates[`dinings/${this.diningId}/meals/${month}/${day}/${mealType}/${userId}`] = count;
          } else {
            updates[`dinings/${this.diningId}/meals/${month}/${day}/${mealType}/${userId}`] = null;
          }
        });

        // Mark this meal type as completed in the database
        updates[`dinings/${this.diningId}/meals/${month}/${day}/completed/${mealType}`] = true;
      }

      await db.ref().update(updates);

      // Recalculate totals
      await this._recalculateTotals();

      // Log notifications and activity updates for each completed meal type
      for (const mealType of this.selectedLockedMeals) {
        const dayMeals = oldMealsBackup[mealType] || {};
        const capitalizedMeal = mealType.charAt(0).toUpperCase() + mealType.slice(1);

        Notifications.toast('success', 'Meal Completed', `${capitalizedMeal} meals completed.`);

        await Notifications.create(
          this.diningId,
          'Meal Logged',
          `${capitalizedMeal} meals have been completed by manager for ${Utils.formatDate(this.currentDate)}.`,
          'all',
          'meal'
        );
        await Notifications.log(this.diningId, 'meal_completed', `Completed ${capitalizedMeal} meals for ${this.currentDate}`, DineDesk.state.userId);

        // Log individual meal updates for users whose meal counts changed
        for (const [userId, user] of Object.entries(users)) {
          if (user.role === 'admin' && !isManagerMealEnabled) {
            continue;
          }

          const oldCount = dayMeals[userId] !== undefined ? dayMeals[userId] : 0;
          const mealStatus = user.mealStatus || { breakfast: true, lunch: true, dinner: true };
          const statusVal = mealStatus[mealType];

          let newCount = 0;
          if (statusVal === true || statusVal === undefined) {
            newCount = 1;
          } else if (typeof statusVal === 'number' && statusVal > 0) {
            newCount = statusVal;
          }

          if (oldCount !== newCount) {
            const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
            let detail = newCount === 0 ? `${mealLabel} removed` : `${newCount} ${mealLabel} added`;
            await Notifications.log(
              this.diningId,
              'meal_updated',
              detail,
              DineDesk.state.userId,
              userId,
              this.selectedLockedMeals.length === 1
            );
          }
        }
      }

      // Clear selection
      this.selectedLockedMeals = [];
      this.updateCompleteMealSelect();

    } catch (error) {
      console.error('Error completing meals:', error);
      Notifications.toast('error', 'Error', 'Failed to complete locked meals.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btnHtmlBackup;
      }
    }
  }
};

console.log('[DineDesk] Meals module loaded');
