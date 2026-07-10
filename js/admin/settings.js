/* ============================================
   DineDesk — Settings (admin/settings.js)
   ============================================ */

const SettingsModule = {
  settings: {},

  /**
   * Initialize settings with realtime listener
   */
  init(diningId) {
    this.diningId = diningId;

    db.ref(`dinings/${diningId}/settings`).on('value', (snap) => {
      this.settings = snap.val() || {};
      this._populateUI();
    });

    db.ref(`dinings/${diningId}/info`).on('value', (snap) => {
      this.info = snap.val() || {};
      this._populateDiningInfo();
    });
  },

  /**
   * Populate settings UI from database values
   */
  _populateUI() {
    const s = this.settings;
    const autoToggle = document.getElementById('autoMealToggle');
    if (autoToggle) autoToggle.checked = !!s.autoMealEnabled;

    const managerToggle = document.getElementById('managerMealToggle');
    if (managerToggle) managerToggle.checked = !!s.managerMealEnabled;

    const bf = document.getElementById('breakfastDeadline');
    const lf = document.getElementById('lunchDeadline');
    const df = document.getElementById('dinnerDeadline');
    if (bf) bf.value = s.breakfastDeadline || '04:00';
    if (lf) lf.value = s.lunchDeadline || '10:00';
    if (df) df.value = s.dinnerDeadline || '16:00';

    // Tracked Meals checkboxes
    const tracked = s.trackedMeals || { breakfast: true, lunch: true, dinner: true };
    const tb = document.getElementById('settingsTrackedBreakfast');
    const tl = document.getElementById('settingsTrackedLunch');
    const td = document.getElementById('settingsTrackedDinner');
    if (tb) tb.checked = tracked.breakfast !== false;
    if (tl) tl.checked = tracked.lunch !== false;
    if (td) td.checked = tracked.dinner !== false;

    // Rate Mode selector
    const rateMode = s.rateMode || 'market';
    const rateModeSelect = document.getElementById('settingsRateMode');
    if (rateModeSelect) rateModeSelect.value = rateMode;

    // Fixed Rates pricing fields
    const fixedRatesSection = document.getElementById('settingsFixedRatesSection');
    if (fixedRatesSection) {
      fixedRatesSection.style.display = rateMode === 'fixed' ? 'block' : 'none';
    }
    const fixedRates = s.fixedRates || { breakfast: 30, lunch: 60, dinner: 60 };
    const frb = document.getElementById('settingsFixedRateBreakfast');
    const frl = document.getElementById('settingsFixedRateLunch');
    const frd = document.getElementById('settingsFixedRateDinner');
    if (frb) frb.value = fixedRates.breakfast || 0;
    if (frl) frl.value = fixedRates.lunch || 0;
    if (frd) frd.value = fixedRates.dinner || 0;

    // Manager Bazar Duty toggle
    const managerBazarToggle = document.getElementById('settingsManagerBazarToggle');
    if (managerBazarToggle) managerBazarToggle.checked = s.managerBazarEnabled !== false;

    // Mess Code display
    const codeDisplay = document.getElementById('settingsMessCodeDisplay');
    if (codeDisplay && this.info) {
      codeDisplay.textContent = this.info.messCode || '-';
    }
  },

  /**
   * Populate dining info fields
   */
  _populateDiningInfo() {
    const nameInput = document.getElementById('settingsDiningName');
    const managerInput = document.getElementById('settingsManagerName');
    if (nameInput) nameInput.value = this.info?.name || '';
    if (managerInput) managerInput.value = this.info?.managerName || '';
  },

  /**
   * Toggle auto meal system
   */
  async toggleAutoMeal(enabled) {
    try {
      await db.ref(`dinings/${this.diningId}/settings/autoMealEnabled`).set(enabled);
      Notifications.toast('success', 'Auto Meal', enabled ? 'Auto meal system enabled.' : 'Auto meal system disabled.');
    } catch (error) {
      Notifications.toast('error', 'Error', 'Failed to update setting.');
    }
  },

  /**
   * Toggle manager meal visibility on dashboard
   */
  async toggleManagerMeal(enabled) {
    try {
      await db.ref(`dinings/${this.diningId}/settings/managerMealEnabled`).set(enabled);
      
      // If disabled, also turn OFF manager's own meal status in DB
      if (!enabled) {
        const userId = DineDesk.state.userId;
        if (userId) {
          await db.ref(`dinings/${this.diningId}/users/${userId}/mealStatus`).set({
            breakfast: false,
            lunch: false,
            dinner: false
          });
        }
      }

      Notifications.toast('success', 'My Meal', enabled ? 'My meal section enabled.' : 'My meal section disabled.');
    } catch (error) {
      Notifications.toast('error', 'Error', 'Failed to update setting.');
    }
  },

  /**
   * Save a deadline value
   */
  async saveDeadline(mealType, time) {
    try {
      await db.ref(`dinings/${this.diningId}/settings/${mealType}Deadline`).set(time);
      Notifications.toast('info', 'Deadline Updated', `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} deadline set to ${Utils.formatTime(time)}.`);
    } catch (error) {
      Notifications.toast('error', 'Error', 'Failed to save deadline.');
    }
  },

  /**
   * Save dining info
   */
  async saveDiningInfo() {
    const name = document.getElementById('settingsDiningName').value.trim();
    const manager = document.getElementById('settingsManagerName').value.trim();

    if (!name) {
      Notifications.toast('warning', 'Missing', 'Dining name is required.');
      return;
    }

    try {
      await db.ref(`dinings/${this.diningId}/info`).update({
        name,
        managerName: manager
      });

      // Update sidebar
      Utils.setText('sidebarDiningName', name);
      Notifications.toast('success', 'Saved', 'Dining information updated.');
      await Notifications.log(this.diningId, 'settings_updated', `Dining info updated: ${name}`, DineDesk.state.userId);
    } catch (error) {
      Notifications.toast('error', 'Error', 'Failed to save dining info.');
    }
  },

  /**
   * Confirm data reset
   */
  confirmReset() {
    document.getElementById('confirmTitle').textContent = 'Reset All Data?';
    document.getElementById('confirmMessage').textContent = 'This will permanently delete ALL meals, deposits, bazar records, and logs. Users will be kept. This cannot be undone!';
    document.getElementById('confirmActionBtn').textContent = 'Reset Everything';
    document.getElementById('confirmActionBtn').onclick = () => this.resetData();
    openModal('confirmDialog');
  },

  /**
   * Reset all financial + meal data
   */
  async resetData() {
    try {
      const updates = {};
      updates[`dinings/${this.diningId}/meals`] = null;
      updates[`dinings/${this.diningId}/deposits`] = null;
      updates[`dinings/${this.diningId}/bazar`] = null;
      updates[`dinings/${this.diningId}/logs`] = null;
      updates[`dinings/${this.diningId}/notifications`] = null;
      updates[`dinings/${this.diningId}/summary`] = null;

      // Reset user totals
      const users = DineDesk.users.users;
      Object.keys(users).forEach(uid => {
        updates[`dinings/${this.diningId}/users/${uid}/totalDeposit`] = 0;
        updates[`dinings/${this.diningId}/users/${uid}/totalMeals`] = 0;
        updates[`dinings/${this.diningId}/users/${uid}/mealCost`] = 0;
        updates[`dinings/${this.diningId}/users/${uid}/balance`] = 0;
      });

      await db.ref().update(updates);

      Notifications.toast('success', 'Data Reset', 'All data has been reset successfully.');
      closeModal('confirmDialog');

    } catch (error) {
      console.error('Reset error:', error);
      Notifications.toast('error', 'Error', 'Failed to reset data.');
    }
  },

  async updateTrackedMeals() {
    const b = document.getElementById('settingsTrackedBreakfast').checked;
    const l = document.getElementById('settingsTrackedLunch').checked;
    const d = document.getElementById('settingsTrackedDinner').checked;

    if (!b && !l && !d) {
      Notifications.toast('warning', 'Invalid Input', 'At least one meal time must be active.');
      this._populateUI(); // Reset UI
      return;
    }

    try {
      await db.ref(`dinings/${this.diningId}/settings/trackedMeals`).set({
        breakfast: b,
        lunch: l,
        dinner: d
      });
      Notifications.toast('success', 'Settings Saved', 'Tracked meals updated.');
    } catch (e) {
      Notifications.toast('error', 'Error', 'Failed to update tracked meals.');
    }
  },

  async updateRateMode(mode) {
    try {
      await db.ref(`dinings/${this.diningId}/settings/rateMode`).set(mode);
      // Toggle inputs visibility
      const fixedRatesSection = document.getElementById('settingsFixedRatesSection');
      if (fixedRatesSection) {
        fixedRatesSection.style.display = mode === 'fixed' ? 'block' : 'none';
      }
      Notifications.toast('success', 'Settings Saved', `Rate mode changed to ${mode === 'fixed' ? 'Fixed Rate' : 'Market Rate'}.`);
    } catch (e) {
      Notifications.toast('error', 'Error', 'Failed to update rate mode.');
    }
  },

  async saveFixedRates() {
    const b = parseFloat(document.getElementById('settingsFixedRateBreakfast').value) || 0;
    const l = parseFloat(document.getElementById('settingsFixedRateLunch').value) || 0;
    const d = parseFloat(document.getElementById('settingsFixedRateDinner').value) || 0;

    try {
      await db.ref(`dinings/${this.diningId}/settings/fixedRates`).set({
        breakfast: b,
        lunch: l,
        dinner: d
      });
      Notifications.toast('success', 'Prices Saved', 'Fixed meal rates updated.');
    } catch (e) {
      Notifications.toast('error', 'Error', 'Failed to update fixed meal prices.');
    }
  },

  async toggleManagerBazar(enabled) {
    try {
      await db.ref(`dinings/${this.diningId}/settings/managerBazarEnabled`).set(enabled);
      Notifications.toast('success', 'Settings Saved', enabled ? 'Manager added to bazar rotation.' : 'Manager removed from bazar rotation.');
    } catch (e) {
      Notifications.toast('error', 'Error', 'Failed to update setting.');
    }
  },

  /**
   * Get current settings (for other modules)
   */
  getSettings() {
    return this.settings;
  },

  /**
   * Refresh settings page
   */
  refresh() {
    this._populateUI();
    this._populateDiningInfo();
  }
};

console.log('[DineDesk] Settings module loaded');
