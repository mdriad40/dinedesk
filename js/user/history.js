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

    // Listen to all users in the dining group to resolve names in logs
    db.ref(`dinings/${diningId}/users`).on('value', (snap) => {
      this.usersMap = snap.val() || {};
      this.renderHistoryPage();
    });

    // Listen to dining info details (name and messCode)
    db.ref(`dinings/${diningId}/info`).on('value', (snap) => {
      this.diningInfo = snap.val() || {};
      if (this.currentUserData) this.renderProfile(this.currentUserData);
    });

    // Listen to global logs for History page
    db.ref(`dinings/${diningId}/logs`).orderByChild('timestamp').limitToLast(50).on('value', (snap) => {
      const logs = [];
      snap.forEach(child => {
        logs.push(child.val());
      });
      logs.reverse();
      this.globalLogs = logs;
      this.renderHistoryPage();
    });

    // Setup password validation listeners
    this.setupPasswordValidation();
    // Setup profile info validation listeners
    this.setupProfileInfoValidation();
  },

  /**
   * Render user profile header
   */
  renderProfile(user) {
    Utils.setText('profileName', user.name || 'Unknown');
    Utils.setText('profileRole', user.role === 'admin' ? 'Admin / Meal Manager' : 'Dining Member');

    const avatar = document.getElementById('profileAvatar');
    if (avatar) avatar.textContent = Utils.initials(user.name);

    // Update Dining Info Card
    const diningNameEl = document.getElementById('profileDiningName');
    const diningJoinIdEl = document.getElementById('profileDiningJoinId');
    const totalMembersEl = document.getElementById('profileTotalMembers');
    const joinedSinceEl = document.getElementById('profileJoinedSince');

    if (diningNameEl) diningNameEl.textContent = (this.diningInfo && this.diningInfo.name) || 'DineDesk Mess';
    if (diningJoinIdEl) diningJoinIdEl.textContent = (this.diningInfo && this.diningInfo.messCode) || '-';
    if (totalMembersEl) {
      const count = this.usersMap ? Object.keys(this.usersMap).length : 0;
      totalMembersEl.textContent = `${count} ${count === 1 ? 'member' : 'members'}`;
    }
    if (joinedSinceEl) {
      const joinedTime = user.createdAt ? new Date(user.createdAt) : null;
      joinedSinceEl.textContent = joinedTime
        ? `Since ${joinedTime.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        : 'Since setup';
    }

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
        const emailInput = document.getElementById('profileEmailInput');
        if (nameInput && !nameInput.matches(':focus')) {
          nameInput.value = user.name || '';
        }
        if (emailInput) {
          emailInput.value = user.email || (DineDesk.state.user && DineDesk.state.user.email) || '';
        }
        if (phoneInput && !phoneInput.matches(':focus')) {
          phoneInput.value = user.phone || '';
        }
        if (this.validateProfileInfo) {
          this.validateProfileInfo();
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

    if (!newPassword || newPassword.length < 8) {
      Notifications.toast('warning', 'Validation Error', 'Password must be at least 8 characters.');
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
      const btnUpdate = document.getElementById('btnUpdatePassword');
      if (btnUpdate) btnUpdate.disabled = true;
    } catch (error) {
      console.error('[HistoryModule] Change password error:', error);
      if (error.code === 'auth/requires-recent-login') {
        Notifications.toast('error', 'Authentication Error', 'Please sign out and sign back in to change password.');
      } else {
        Notifications.toast('error', 'Error', error.message || 'Failed to update password.');
      }
    }
  },

  setupPasswordValidation() {
    const newPassInput = document.getElementById('profileNewPasswordInput');
    const confirmPassInput = document.getElementById('profileConfirmPasswordInput');
    const btnUpdate = document.getElementById('btnUpdatePassword');
    const errorEl = document.getElementById('passwordValidationError');

    if (!newPassInput || !confirmPassInput || !btnUpdate) return;

    const validate = () => {
      const newPass = newPassInput.value;
      const confirmPass = confirmPassInput.value;

      let errorMsg = '';
      let isValid = true;

      if (newPass.length > 0 || confirmPass.length > 0) {
        if (newPass.length < 8) {
          errorMsg = 'Password must be at least 8 characters long.';
          isValid = false;
        } else if (confirmPass.length > 0 && newPass !== confirmPass) {
          errorMsg = 'Passwords do not match.';
          isValid = false;
        } else if (confirmPass.length === 0) {
          isValid = false;
        }
      } else {
        isValid = false;
      }

      if (errorEl) {
        if (errorMsg) {
          errorEl.textContent = errorMsg;
          errorEl.style.display = 'block';
        } else {
          errorEl.style.display = 'none';
        }
      }

      btnUpdate.disabled = !isValid;
    };

    newPassInput.addEventListener('input', validate);
    confirmPassInput.addEventListener('input', validate);
  },

  setupProfileInfoValidation() {
    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const btnSave = document.getElementById('btnSaveProfile');
    const phoneErrorEl = document.getElementById('phoneValidationError');

    if (!nameInput || !phoneInput || !btnSave) return;

    this.validateProfileInfo = () => {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();

      const phoneRegex = /^\d{11}$/;
      const isPhoneValid = phoneRegex.test(phone);
      const isNameValid = name.length > 0;

      if (phoneErrorEl) {
        if (!isPhoneValid && phone.length > 0) {
          phoneErrorEl.style.display = 'block';
        } else {
          phoneErrorEl.style.display = 'none';
        }
      }

      btnSave.disabled = !isPhoneValid || !isNameValid;
    };

    nameInput.addEventListener('input', this.validateProfileInfo);
    phoneInput.addEventListener('input', this.validateProfileInfo);
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
  },

  /**
   * Render recent activity timeline on History page
   */
  renderHistoryPage() {
    const container = document.getElementById('historyActivityTimeline');
    if (!container) return;

    // Exclude meal updates and toggles from global history
    const logs = (this.globalLogs || []).filter(log => {
      const action = log.action || '';
      return action !== 'meals_updated' && action !== 'meal_toggled' &&
        action !== 'meal_completed' && action !== 'meals_updated_group';
    });

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8) var(--space-4);">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p style="margin-top:var(--space-2);font-size:var(--font-sm);color:var(--text-secondary);">No history logs found yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map(log => {
      let title = 'Activity Log';
      let dotClass = '';
      let borderColor = 'var(--gray-300)';
      let iconBg = 'var(--gray-50)';
      let iconColor = 'var(--gray-600)';
      let svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

      const action = log.action || '';

      if (action === 'user_added' || action === 'member_joined') {
        title = 'Member Joined';
        dotClass = 'accent';
        borderColor = 'var(--accent-500)';
        iconBg = 'var(--accent-50)';
        iconColor = 'var(--accent-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
      } else if (action === 'bazar_added') {
        title = 'Bazar Expense Added';
        dotClass = 'warning';
        borderColor = '#F97316';
        iconBg = 'rgba(249, 115, 22, 0.06)';
        iconColor = '#F97316';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
      } else if (action === 'other_costing_added') {
        title = 'Other Costing Applied';
        dotClass = 'danger';
        borderColor = 'var(--danger-500)';
        iconBg = 'var(--danger-50)';
        iconColor = 'var(--danger-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
      } else if (action === 'deposit_added') {
        title = 'Deposit Received';
        dotClass = 'accent';
        borderColor = 'var(--primary-500)';
        iconBg = 'var(--primary-50)';
        iconColor = 'var(--primary-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
      } else if (action === 'deduction_added') {
        title = 'Deduction Applied';
        dotClass = 'danger';
        borderColor = 'var(--danger-500)';
        iconBg = 'var(--danger-50)';
        iconColor = 'var(--danger-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
      } else if (action === 'meal_toggled') {
        title = 'Meal Status Updated';
        dotClass = 'accent';
        borderColor = 'var(--primary-400)';
        iconBg = 'var(--primary-50)';
        iconColor = 'var(--primary-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M22 4L12 14.01l-3-3"/></svg>`;
      } else if (action === 'meals_updated') {
        title = 'Meal Sheet Updated';
        dotClass = 'warning';
        borderColor = 'var(--warning-500)';
        iconBg = 'var(--warning-50)';
        iconColor = 'var(--warning-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`;
      } else if (action === 'user_deleted') {
        title = 'Member Deleted';
        dotClass = 'danger';
        borderColor = 'var(--danger-600)';
        iconBg = 'var(--danger-50)';
        iconColor = 'var(--danger-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>`;
      } else if (action === 'settings_updated') {
        title = 'Settings Updated';
        dotClass = '';
        borderColor = 'var(--primary-400)';
        iconBg = 'var(--primary-50)';
        iconColor = 'var(--primary-600)';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
      }

      let actor = 'System';
      if (log.performedBy === 'manager') {
        actor = 'Manager';
      } else if (log.performedBy === this.userId) {
        actor = 'You';
      } else if (log.performedBy && log.performedBy !== 'system') {
        if (this.usersMap && this.usersMap[log.performedBy]) {
          actor = this.usersMap[log.performedBy].name || 'Manager';
        } else {
          actor = 'Manager';
        }
      }

      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}"></div>
          <div class="timeline-content" style="border-left: 4px solid ${borderColor}; box-shadow: var(--shadow-sm); display: flex; gap: var(--space-4); align-items: flex-start;">
            <div style="background: ${iconBg}; color: ${iconColor}; width: 36px; height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
              ${svgIcon}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div class="flex items-center justify-between" style="gap: var(--space-2); margin-bottom: 2px;">
                <span class="timeline-title" style="font-size: var(--font-base); font-weight: var(--weight-bold);">${title}</span>
                <span class="timeline-date" style="margin-bottom: 0; white-space: nowrap;">${Utils.timeAgo(log.timestamp)}</span>
              </div>
              <div class="timeline-desc" style="margin-top: var(--space-1.5); font-size: var(--font-sm); line-height: 1.4;">${log.details || ''}</div>
              <div style="font-size: 11px; color: var(--text-tertiary); margin-top: var(--space-2); display: flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Performed by: <strong>${actor}</strong></span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  refreshHistoryPage() {
    this.renderHistoryPage();
  }
};

console.log('[DineDesk] History module loaded');
