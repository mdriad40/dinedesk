/* ============================================
   DineDesk — Meal Management (admin/meals.js)
   ============================================ */

const MealsModule = {
  selectedType: 'breakfast',
  selectedUsers: new Set(),
  currentDate: Utils.today(),
  mealsData: {},

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
      }
    });
  },

  /**
   * Select meal type tab
   */
  selectType(type) {
    this.selectedType = type;
    document.querySelectorAll('.meal-type-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === type);
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
    const userEntries = Object.entries(users);

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

    // Get existing meals for this date + type
    const day = Utils.dayKey(this.currentDate);
    const dayMeals = this.mealsData[day]?.[this.selectedType] || {};

    grid.innerHTML = userEntries.map(([id, user]) => {
      const hasMeal = dayMeals[id] !== undefined;
      const mealCount = dayMeals[id] || 0;
      const isSelected = this.selectedUsers.has(id);

      // Auto-select users who already have a meal
      if (hasMeal && !this.selectedUsers.has(id) && mealCount > 0) {
        this.selectedUsers.add(id);
      }

      const selected = this.selectedUsers.has(id);

      return `
        <div class="meal-user-chip ${selected ? 'selected' : ''}" onclick="DineDesk.meals.toggleUser('${id}', this)" data-userid="${id}">
          <div class="avatar avatar-sm" style="background:${DineDesk.users._avatarColor(user.name)};">${Utils.initials(user.name)}</div>
          <span class="meal-user-chip-name">${user.name}</span>
          <input type="number" class="meal-count-input" value="${hasMeal ? mealCount : 1}" min="0" max="10"
                 onclick="event.stopPropagation()" data-user-count="${id}">
        </div>
      `;
    }).join('');

    this._updateSelectedCount();
  },

  /**
   * Toggle user selection
   */
  toggleUser(userId, chipEl) {
    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
      chipEl.classList.remove('selected');
    } else {
      this.selectedUsers.add(userId);
      chipEl.classList.add('selected');
    }
    this._updateSelectedCount();
  },

  /**
   * Toggle select all
   */
  toggleSelectAll(checked) {
    const users = DineDesk.users.users;
    this.selectedUsers.clear();

    if (checked) {
      Object.keys(users).forEach(id => this.selectedUsers.add(id));
    }

    document.querySelectorAll('.meal-user-chip').forEach(chip => {
      chip.classList.toggle('selected', checked);
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
   * Save bulk meals to database
   */
  async saveBulkMeals() {
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
      const updates = {};
      const users = DineDesk.users.users;

      // Build meal updates
      Object.keys(users).forEach(userId => {
        if (this.selectedUsers.has(userId)) {
          // Get individual count (from the input in the chip)
          const countInput = document.querySelector(`[data-user-count="${userId}"]`);
          const count = countInput ? parseInt(countInput.value) || bulkCount : bulkCount;
          updates[`dinings/${this.diningId}/meals/${month}/${day}/${this.selectedType}/${userId}`] = count;
        } else {
          // Remove meal for unselected users
          updates[`dinings/${this.diningId}/meals/${month}/${day}/${this.selectedType}/${userId}`] = null;
        }
      });

      await db.ref().update(updates);

      // Recalculate totals
      await this._recalculateTotals();

      Notifications.toast('success', 'Meals Saved', `${this.selectedType} meals updated for ${this.currentDate}.`);
      await Notifications.create(
        this.diningId,
        'Meals Updated',
        `${this.selectedType.charAt(0).toUpperCase() + this.selectedType.slice(1)} meals updated for ${Utils.formatDate(this.currentDate)}.`,
        'all',
        'meal'
      );
      await Notifications.log(this.diningId, 'meals_updated', `${this.selectedType} meals updated for ${this.currentDate}`, DineDesk.state.userId);

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
              <th>Member</th>
              <th>☀️ Breakfast</th>
              <th>🍱 Lunch</th>
              <th>🌙 Dinner</th>
              <th>Total</th>
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
            <td>
              <div class="flex items-center gap-2">
                <div class="avatar avatar-sm" style="background:${DineDesk.users._avatarColor(user.name)};">${Utils.initials(user.name)}</div>
                ${user.name}
              </div>
            </td>
            <td>${b > 0 ? `<span class="badge badge-accent">${b}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            <td>${l > 0 ? `<span class="badge badge-accent">${l}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            <td>${d > 0 ? `<span class="badge badge-accent">${d}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            <td><strong>${total}</strong></td>
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
  },

  /**
   * Refresh meals page
   */
  refresh() {
    this.renderUserGrid();
    this.renderMealLog();
  }
};

console.log('[DineDesk] Meals module loaded');
