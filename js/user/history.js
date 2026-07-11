/* ============================================
   DineDesk — User History (user/history.js)
   ============================================ */

const HistoryModule = {
  /**
   * Initialize history for profile page
   */
  init(diningId, userId) {
    this.diningId = diningId;
    this.userId = userId;
    this.mealsBreakdown = { breakfast: 0, lunch: 0, dinner: 0 };
    this.settings = {};

    // Listen to deposits for this user
    db.ref(`dinings/${diningId}/deposits`).orderByChild('userId').equalTo(userId).on('value', (snap) => {
      const deposits = [];
      snap.forEach(child => deposits.push(child.val()));
      deposits.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.userDepositsList = deposits;
      this.renderDepositHistory(deposits);
      if (this.currentUserData) this.renderProfile(this.currentUserData);
    });

    // Listen to settings
    db.ref(`dinings/${diningId}/settings`).on('value', (snap) => {
      this.settings = snap.val() || {};
      if (this.currentUserData) this.renderProfile(this.currentUserData);
    });

    // Listen to meals breakdown
    db.ref(`dinings/${diningId}/meals`).on('value', (snap) => {
      this.mealsBreakdown = { breakfast: 0, lunch: 0, dinner: 0 };
      const allMeals = snap.val() || {};
      Object.values(allMeals).forEach(monthData => {
        Object.values(monthData).forEach(dayData => {
          Object.entries(dayData).forEach(([type, typeData]) => {
            if (typeof typeData === 'object' && typeData[this.userId] !== undefined) {
              const count = parseFloat(typeData[this.userId]) || 0;
              if (this.mealsBreakdown[type] !== undefined) {
                this.mealsBreakdown[type] += count;
              }
            }
          });
        });
      });
      if (this.currentUserData) this.renderProfile(this.currentUserData);
    });

    // Listen to user data for profile
    db.ref(`dinings/${diningId}/users/${userId}`).on('value', (snap) => {
      const user = snap.val();
      if (user) {
        this.currentUserData = user;
        this.renderProfile(user);
      }
    });
  },

  /**
   * Render user profile header
   */
  renderProfile(user) {
    Utils.setText('profileName', user.name || 'Unknown');
    Utils.setText('profileRole', user.role === 'admin' ? 'Admin / Meal Manager' : 'Dining Member');

    const avatar = document.getElementById('profileAvatar');
    if (avatar) avatar.textContent = Utils.initials(user.name);

    const isMember = user.role !== 'admin';
    const statsHistory = document.getElementById('profileStatsAndHistory');
    const settingsSection = document.getElementById('profileSettingsSection');

    if (statsHistory) {
      statsHistory.style.display = isMember ? 'none' : 'block';
    }

    if (settingsSection) {
      settingsSection.classList.toggle('hidden', !isMember);
      settingsSection.style.display = isMember ? 'block' : 'none';
      if (isMember) {
        const nameInput = document.getElementById('profileNameInput');
        const phoneInput = document.getElementById('profilePhoneInput');
        if (nameInput && !nameInput.matches(':focus')) {
          nameInput.value = user.name || '';
        }
        if (phoneInput && !phoneInput.matches(':focus')) {
          phoneInput.value = user.phone || '';
        }
      }
    }

    // Profile stats
    this.currentUserData = user;
    const mealRate = DineDesk.state.mealRate || 0;
    const rateMode = this.settings?.rateMode || 'market';
    const fixedRates = rateMode === 'fixed' ? (this.settings?.fixedRates || null) : null;
    const mealCost = Utils.calcMealCost(mealRate, user.totalMeals, this.mealsBreakdown, fixedRates);

    // Calculate dynamic deposits, other costing, deductions from userDepositsList
    let userDeposit = 0;
    let userOtherCost = 0;
    let userDeduction = 0;

    (this.userDepositsList || []).forEach(d => {
      const amt = Math.abs(Utils.num(d.amount));
      if (d.type === 'deposit') {
        userDeposit += amt;
      } else if (d.type === 'other_costing') {
        userOtherCost += amt;
      } else if (d.type === 'deduction') {
        userDeduction += amt;
      }
    });

    const totalCost = mealCost + userOtherCost;
    const balance = userDeposit - totalCost - userDeduction;

    const container = document.getElementById('profileStats');
    if (container) {
      container.style.display = 'grid';
      container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
      container.style.gap = 'var(--space-3)';
      container.style.marginBottom = 'var(--space-5)';

      container.innerHTML = `
        <div class="stat-card card-compact">
          <div class="stat-info text-center">
            <div class="stat-label">Deposit</div>
            <div class="stat-value" style="font-size:var(--font-lg);">${Utils.currency(userDeposit)}</div>
          </div>
        </div>
        <div class="stat-card card-compact">
          <div class="stat-info text-center">
            <div class="stat-label">Meals</div>
            <div class="stat-value" style="font-size:var(--font-lg);">${user.totalMeals || 0}</div>
          </div>
        </div>
        <div class="stat-card card-compact">
          <div class="stat-info text-center">
            <div class="stat-label">Meal Cost</div>
            <div class="stat-value" style="font-size:var(--font-lg);">${Utils.currency(mealCost)}</div>
          </div>
        </div>
        <div class="stat-card card-compact">
          <div class="stat-info text-center">
            <div class="stat-label">Other Cost</div>
            <div class="stat-value" style="font-size:var(--font-lg);">${Utils.currency(userOtherCost)}</div>
          </div>
        </div>
        <div class="stat-card card-compact">
          <div class="stat-info text-center">
            <div class="stat-label">Deduction</div>
            <div class="stat-value" style="font-size:var(--font-lg); color:var(--danger-600);">${Utils.currency(userDeduction)}</div>
          </div>
        </div>
        <div class="stat-card card-compact">
          <div class="stat-info text-center">
            <div class="stat-label">Total Cost</div>
            <div class="stat-value" style="font-size:var(--font-lg);">${Utils.currency(totalCost)}</div>
          </div>
        </div>
        <div class="stat-card card-compact" style="grid-column: 1 / -1;">
          <div class="stat-info text-center">
            <div class="stat-label" style="font-weight:var(--weight-bold);">Balance</div>
            <div class="stat-value" style="font-size:var(--font-xl);font-weight:var(--weight-bold);color:${balance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'};">${Utils.currency(balance)}</div>
          </div>
        </div>
      `;
    }
  },

  async updateProfileInfo() {
    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    if (!nameInput || !phoneInput) return;

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name) {
      Notifications.toast('warning', 'Validation Error', 'Full name is required.');
      return;
    }

    try {
      await db.ref(`dinings/${this.diningId}/users/${this.userId}`).update({
        name,
        phone
      });
      Notifications.toast('success', 'Success', 'Profile updated successfully.');
      await Notifications.log(this.diningId, 'user_updated', `Profile updated by user`, this.userId, this.userId);
    } catch (error) {
      console.error('[HistoryModule] Update profile error:', error);
      Notifications.toast('error', 'Error', 'Failed to update profile.');
    }
  },

  async changePassword() {
    const newPassInput = document.getElementById('profileNewPasswordInput');
    const confirmPassInput = document.getElementById('profileConfirmPasswordInput');
    if (!newPassInput || !confirmPassInput) return;

    const newPassword = newPassInput.value;
    const confirmPassword = confirmPassInput.value;

    if (!newPassword || newPassword.length < 6) {
      Notifications.toast('warning', 'Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Notifications.toast('warning', 'Validation Error', 'Passwords do not match.');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        Notifications.toast('error', 'Error', 'No authenticated user found.');
        return;
      }
      await user.updatePassword(newPassword);
      Notifications.toast('success', 'Success', 'Password updated successfully.');
      await Notifications.log(this.diningId, 'security_updated', `Password changed by user`, this.userId, this.userId);
      newPassInput.value = '';
      confirmPassInput.value = '';
    } catch (error) {
      console.error('[HistoryModule] Change password error:', error);
      if (error.code === 'auth/requires-recent-login') {
        Notifications.toast('error', 'Authentication Error', 'Please sign out and sign back in to change password.');
      } else {
        Notifications.toast('error', 'Error', error.message || 'Failed to update password.');
      }
    }
  },

  /**
   * Render deposit history timeline
   */
  renderDepositHistory(deposits) {
    const container = document.getElementById('profileDepositHistory');
    if (!container) return;

    if (deposits.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <h3>No Deposits</h3>
          <p>Your deposit history will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = deposits.map(d => {
      const isDeposit = d.type === 'deposit';
      const isOtherCosting = d.type === 'other_costing';
      const isDeduction = d.type === 'deduction';

      let dotClass, sign, color, typeLabel;
      if (isDeposit) {
        dotClass = 'accent'; sign = '+'; color = 'var(--accent-600)'; typeLabel = 'Deposit';
      } else if (isOtherCosting) {
        dotClass = 'primary'; sign = '-'; color = 'var(--primary-600)'; typeLabel = 'Other Costing';
      } else {
        dotClass = 'danger'; sign = '-'; color = 'var(--danger-600)'; typeLabel = 'Deduction';
      }

      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}"></div>
          <div class="timeline-content">
            <div class="timeline-date">${Utils.formatDate(d.date)} · ${Utils.timeAgo(d.timestamp)}</div>
            <div class="flex items-center justify-between">
              <div>
                <div class="timeline-title">${d.note || typeLabel}</div>
                <div style="font-size:var(--font-xs); color:var(--text-tertiary); margin-top:2px;">${typeLabel}</div>
              </div>
              <div style="font-weight:var(--weight-bold);color:${color};white-space:nowrap;">
                ${sign}${Utils.currency(Math.abs(d.amount))}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render meal history (monthly breakdown)
   */
  renderMealHistory(diningId, userId) {
    const container = document.getElementById('profileMealHistory');
    if (!container) return;

    db.ref(`dinings/${diningId}/meals`).once('value').then(snap => {
      const allMeals = snap.val() || {};
      const userMeals = [];

      // Collect all meals for this user
      Object.entries(allMeals).forEach(([month, monthData]) => {
        Object.entries(monthData).forEach(([day, dayData]) => {
          let dayTotal = 0;
          const mealTypes = {};
          Object.entries(dayData).forEach(([type, typeData]) => {
            if (typeData[userId]) {
              const count = parseInt(typeData[userId]) || 0;
              mealTypes[type] = count;
              dayTotal += count;
            }
          });
          if (dayTotal > 0) {
            userMeals.push({
              date: `${month}-${day}`,
              meals: mealTypes,
              total: dayTotal
            });
          }
        });
      });

      // Sort descending
      userMeals.sort((a, b) => b.date.localeCompare(a.date));

      if (userMeals.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding:var(--space-6);">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/></svg>
            </div>
            <h3>No Meal Records</h3>
            <p>Your meal history will appear here.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper" style="border:none;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>☀️ B</th>
                <th>🍱 L</th>
                <th>🌙 D</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${userMeals.slice(0, 30).map(m => `
                <tr>
                  <td>${Utils.formatDate(m.date)}</td>
                  <td>${m.meals.breakfast || '—'}</td>
                  <td>${m.meals.lunch || '—'}</td>
                  <td>${m.meals.dinner || '—'}</td>
                  <td><strong>${m.total}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });
  },

  /**
   * Refresh history
   */
  refresh() {
    if (this.diningId && this.userId) {
      this.renderMealHistory(this.diningId, this.userId);
    }
  }
};

console.log('[DineDesk] History module loaded');
