/* ============================================
   DineDesk — Finance Management (admin/finance.js)
   ============================================ */

const FinanceModule = {
  deposits: {},
  bazarList: {},
  currentFilter: 'all',

  /**
   * Initialize finance module with realtime listeners
   */
  init(diningId) {
    this.diningId = diningId;

    // Listen to deposits
    db.ref(`dinings/${diningId}/deposits`).orderByChild('timestamp').on('value', (snap) => {
      this.deposits = {};
      snap.forEach(child => {
        this.deposits[child.key] = child.val();
      });
      if (Router.currentPage === 'finance') {
        this.renderTransactions();
      }
    });

    // Listen to bazar costs
    db.ref(`dinings/${diningId}/bazar`).orderByChild('timestamp').on('value', (snap) => {
      this.bazarList = {};
      snap.forEach(child => {
        this.bazarList[child.key] = child.val();
      });
    });
  },

  /**
   * Show deposit modal
   */
  showDepositModal() {
    document.getElementById('depositForm').reset();
    document.getElementById('depositModalTitle').textContent = 'Add Deposit';
    this._populateUserSelect('depositUserSelect');
    openModal('depositModal');
  },

  /**
   * Show deduct modal
   */
  showDeductModal() {
    document.getElementById('deductForm').reset();
    this._populateUserSelect('deductUserSelect');
    openModal('deductModal');
  },

  /**
   * Show bazar modal
   */
  showBazarModal() {
    document.getElementById('bazarForm').reset();
    document.getElementById('bazarDateInput').value = Utils.today();
    openModal('bazarModal');
  },

  /**
   * Show Other Costing modal
   */
  showOtherCostingModal() {
    document.getElementById('otherCostingForm').reset();
    document.getElementById('otherCostingSplitInfo').style.display = 'none';

    const checklist = document.getElementById('otherCostingMembersChecklist');
    const selectAll = document.getElementById('otherCostingSelectAll');
    if (selectAll) selectAll.checked = false;

    const users = DineDesk.users.users;
    // Use UsersModule.settings (reliably populated for admins)
    const settings = UsersModule.settings || {};
    const isManagerMealEnabled = !!settings.managerMealEnabled;

    if (!users || Object.keys(users).length === 0) {
      Notifications.toast('warning', 'No Members', 'No members found. Please add members first.');
      return;
    }

    checklist.innerHTML = Object.entries(users)
      .filter(([id, u]) => u.role !== 'admin' || isManagerMealEnabled)
      .map(([id, u]) => `
        <label class="members-checklist-item" for="member_check_${id}">
          <div class="members-checklist-avatar" style="background:${UsersModule._avatarColor(u.name)};">
            ${Utils.initials(u.name)}
          </div>
          <div class="members-checklist-info">
            <div class="members-checklist-name">${u.name}</div>
            <div class="members-checklist-sub">@${u.username || '—'}</div>
          </div>
          <input type="checkbox" id="member_check_${id}" value="${id}" class="members-checklist-checkbox"
            onchange="DineDesk.finance.updateOtherCostingSplit()">
        </label>
      `).join('');

    openModal('otherCostingModal');
  },

  /**
   * Toggle Select All checkboxes for Other Costing
   */
  toggleSelectAllOtherCosting(source) {
    const checkboxes = document.querySelectorAll('#otherCostingMembersChecklist .members-checklist-checkbox');
    checkboxes.forEach(cb => { cb.checked = source.checked; });
    this.updateOtherCostingSplit();
  },

  /**
   * Update real-time split info preview
   */
  updateOtherCostingSplit() {
    const amount = parseFloat(document.getElementById('otherCostingAmountInput').value) || 0;
    const checkboxes = document.querySelectorAll('#otherCostingMembersChecklist .members-checklist-checkbox:checked');
    const count = checkboxes.length;
    const splitInfo = document.getElementById('otherCostingSplitInfo');
    const splitText = document.getElementById('otherCostingSplitText');
    const selectAll = document.getElementById('otherCostingSelectAll');

    // Sync select-all checkbox
    const allCheckboxes = document.querySelectorAll('#otherCostingMembersChecklist .members-checklist-checkbox');
    if (selectAll && allCheckboxes.length > 0) {
      selectAll.checked = (count === allCheckboxes.length && count > 0);
      selectAll.indeterminate = (count > 0 && count < allCheckboxes.length);
    }

    if (amount > 0 && count > 0) {
      const splitAmount = amount / count;
      splitInfo.style.display = 'flex';
      splitText.textContent = `${Utils.currency(amount)} ÷ ${count} member${count > 1 ? 's' : ''} = ${Utils.currency(splitAmount)} each`;
    } else {
      splitInfo.style.display = amount > 0 || count > 0 ? 'flex' : 'none';
      if (amount <= 0 && count > 0) {
        splitText.textContent = 'Enter an amount to see the split';
      } else if (amount > 0 && count === 0) {
        splitText.textContent = 'Select at least one member';
      }
    }
  },

  /**
   * Save Other Costing - splits equally across selected members
   */
  async saveOtherCosting() {
    const amount = parseFloat(document.getElementById('otherCostingAmountInput').value);
    const reason = document.getElementById('otherCostingReasonInput').value.trim();
    const checkboxes = document.querySelectorAll('#otherCostingMembersChecklist .members-checklist-checkbox:checked');
    const selectedUserIds = Array.from(checkboxes).map(cb => cb.value);

    if (!amount || amount <= 0) {
      Notifications.toast('warning', 'Invalid Input', 'Please enter a valid total amount.');
      return;
    }
    if (!reason) {
      Notifications.toast('warning', 'Invalid Input', 'Please enter a reason / description.');
      return;
    }
    if (selectedUserIds.length === 0) {
      Notifications.toast('warning', 'No Members Selected', 'Please select at least one member.');
      return;
    }

    const splitAmount = amount / selectedUserIds.length;
    const users = DineDesk.users.users;
    const today = Utils.today();

    try {
      // Write one transaction per selected member
      const promises = selectedUserIds.map(async (userId) => {
        const user = users[userId];
        await db.ref(`dinings/${this.diningId}/deposits`).push().set({
          userId,
          userName: user?.name || 'Unknown',
          amount: -splitAmount,
          type: 'other_costing',
          note: reason,
          date: today,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // Update user's totalDeposit in db (subtract splitAmount)
        const currentDeposit = Utils.num(user?.totalDeposit);
        await db.ref(`dinings/${this.diningId}/users/${userId}/totalDeposit`).set(currentDeposit - splitAmount);
      });

      await Promise.all(promises);

      // Log and notify
      const memberNames = selectedUserIds.map(id => users[id]?.name || 'Unknown').join(', ');
      await Notifications.log(
        this.diningId, 'other_costing_added',
        `Other Costing ৳${amount} (${reason}) split among: ${memberNames}`,
        DineDesk.state.userId
      );
      // Notify each selected user
      for (const userId of selectedUserIds) {
        await Notifications.create(
          this.diningId, 'Other Costing Applied',
          `${Utils.currency(splitAmount)} charged to you for: ${reason}`,
          userId, 'finance'
        );
      }

      Notifications.toast('success', 'Other Costing Applied',
        `${Utils.currency(amount)} split among ${selectedUserIds.length} member${selectedUserIds.length > 1 ? 's' : ''} (${Utils.currency(splitAmount)} each).`);
      closeModal('otherCostingModal');

    } catch (error) {
      console.error('Save other costing error:', error);
      Notifications.toast('error', 'Error', 'Failed to apply other costing.');
    }
  },

  /**
   * Populate user select dropdown
   */
  _populateUserSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const users = DineDesk.users.users;
    select.innerHTML = '<option value="">Choose a member...</option>' +
      Object.entries(users).map(([id, u]) => `<option value="${id}">${u.name}</option>`).join('');
  },

  /**
   * Save deposit
   */
  async saveDeposit() {
    const userId = document.getElementById('depositUserSelect').value;
    const amount = parseFloat(document.getElementById('depositAmountInput').value);
    const note = document.getElementById('depositNoteInput').value.trim();

    if (!userId || !amount || amount <= 0) {
      Notifications.toast('warning', 'Invalid Input', 'Please select a member and enter a valid amount.');
      return;
    }

    try {
      const user = DineDesk.users.users[userId];

      // Save deposit record
      await db.ref(`dinings/${this.diningId}/deposits`).push().set({
        userId,
        userName: user?.name || 'Unknown',
        amount,
        type: 'deposit',
        note: note || 'Deposit',
        date: Utils.today(),
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });

      // Update user's total deposit
      const currentDeposit = Utils.num(user?.totalDeposit);
      await db.ref(`dinings/${this.diningId}/users/${userId}/totalDeposit`).set(currentDeposit + amount);

      // Notify
      await Notifications.create(this.diningId, 'Deposit Received', `${Utils.currency(amount)} deposited for ${user?.name || 'User'}.`, userId, 'deposit');
      await Notifications.log(this.diningId, 'deposit_added', `Deposit ৳${amount} for ${user?.name}`, DineDesk.state.userId, userId);
      Notifications.toast('success', 'Deposit Added', `${Utils.currency(amount)} added for ${user?.name}.`);
      closeModal('depositModal');

    } catch (error) {
      console.error('Save deposit error:', error);
      Notifications.toast('error', 'Error', 'Failed to save deposit.');
    }
  },

  /**
   * Save deduction
   */
  async saveDeduction() {
    const userId = document.getElementById('deductUserSelect').value;
    const amount = parseFloat(document.getElementById('deductAmountInput').value);
    const reason = document.getElementById('deductReasonInput').value.trim();

    if (!userId || !amount || amount <= 0 || !reason) {
      Notifications.toast('warning', 'Invalid Input', 'Please fill all fields.');
      return;
    }

    try {
      const user = DineDesk.users.users[userId];

      // Save deduction record
      await db.ref(`dinings/${this.diningId}/deposits`).push().set({
        userId,
        userName: user?.name || 'Unknown',
        amount: -amount,
        type: 'deduction',
        note: reason,
        date: Utils.today(),
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });

      // Update user's total deposit (subtract)
      const currentDeposit = Utils.num(user?.totalDeposit);
      await db.ref(`dinings/${this.diningId}/users/${userId}/totalDeposit`).set(currentDeposit - amount);

      await Notifications.create(this.diningId, 'Balance Deducted', `${Utils.currency(amount)} deducted from ${user?.name}. Reason: ${reason}`, userId, 'deposit');
      await Notifications.log(this.diningId, 'deduction_added', `Deducted ৳${amount} from ${user?.name}: ${reason}`, DineDesk.state.userId, userId);
      Notifications.toast('success', 'Deduction Applied', `${Utils.currency(amount)} deducted from ${user?.name}.`);
      closeModal('deductModal');

    } catch (error) {
      console.error('Save deduction error:', error);
      Notifications.toast('error', 'Error', 'Failed to apply deduction.');
    }
  },

  /**
   * Save bazar cost
   */
  async saveBazar() {
    const date = document.getElementById('bazarDateInput').value;
    const amount = parseFloat(document.getElementById('bazarAmountInput').value);
    const items = document.getElementById('bazarItemsInput').value.trim();
    const shopper = document.getElementById('bazarShopperInput').value.trim();

    if (!date || !amount || amount <= 0 || !items) {
      Notifications.toast('warning', 'Invalid Input', 'Please fill date, amount, and items.');
      return;
    }

    try {
      await db.ref(`dinings/${this.diningId}/bazar`).push().set({
        amount,
        items,
        shopperName: shopper || 'N/A',
        date,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });

      await Notifications.create(this.diningId, 'Bazar Expense Added', `${Utils.currency(amount)} spent on bazar. Items: ${items}`, 'all', 'bazar');
      await Notifications.log(this.diningId, 'bazar_added', `Bazar ৳${amount}: ${items}`, DineDesk.state.userId);
      Notifications.toast('success', 'Bazar Saved', `${Utils.currency(amount)} bazar cost recorded.`);
      closeModal('bazarModal');

    } catch (error) {
      console.error('Save bazar error:', error);
      Notifications.toast('error', 'Error', 'Failed to save bazar cost.');
    }
  },

  /**
   * Render finance summary cards
   */
  renderSummary() {
    const container = document.getElementById('financeSummary');
    if (!container) return;

    let totalDeposits = 0;
    let totalDeductions = 0;
    let totalOtherCosting = 0;
    let totalBazar = 0;

    Object.values(this.deposits).forEach(d => {
      if (d.type === 'deposit') totalDeposits += Utils.num(d.amount);
      else if (d.type === 'deduction') totalDeductions += Math.abs(Utils.num(d.amount));
      else if (d.type === 'other_costing') totalOtherCosting += Math.abs(Utils.num(d.amount));
    });

    Object.values(this.bazarList).forEach(b => {
      totalBazar += Utils.num(b.amount);
    });

    // Meal Cost is tracked through bazar (Meal Rate * Total Meals) — use bazar as proxy
    const totalMealCost = totalBazar;
    const totalCost = totalMealCost + totalOtherCosting;
    const netBalance = totalDeposits - totalDeductions - totalCost;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Deposits</div>
          <div class="stat-value">${Utils.currency(totalDeposits)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Meal Cost (Bazar)</div>
          <div class="stat-value">${Utils.currency(totalMealCost)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--warning-100);color:var(--warning-700);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Other Costing</div>
          <div class="stat-value">${Utils.currency(totalOtherCosting)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Deductions</div>
          <div class="stat-value">${Utils.currency(totalDeductions)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--danger-100);color:var(--danger-700);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M16 8H8m8 4H8m4 4H8"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Cost</div>
          <div class="stat-value">${Utils.currency(totalCost)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${netBalance >= 0 ? 'primary' : 'danger'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Net Balance</div>
          <div class="stat-value" style="color:${netBalance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'};">${Utils.currency(netBalance)}</div>
        </div>
      </div>
    `;

    // Update global state
    DineDesk.state.totalBazar = totalBazar;
    DineDesk.state.totalDeposit = totalDeposits;
    DineDesk.state.totalOtherCosting = totalOtherCosting;
    DineDesk.state.totalDeductions = totalDeductions;
  },

  /**
   * Render transaction history timeline
   */
  renderTransactions() {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    // Merge deposits and bazar into one list
    let transactions = [];

    Object.entries(this.deposits).forEach(([id, d]) => {
      transactions.push({ id, ...d, category: d.type });
    });

    Object.entries(this.bazarList).forEach(([id, b]) => {
      transactions.push({
        id,
        ...b,
        type: 'bazar',
        category: 'bazar',
        note: b.items,
        userName: b.shopperName || 'N/A'
      });
    });

    // Sort by timestamp descending
    transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Apply filter
    if (this.currentFilter !== 'all') {
      transactions = transactions.filter(t => t.category === this.currentFilter);
    }

    if (transactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <h3>No Transactions</h3>
          <p>Financial transactions will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = transactions.slice(0, 50).map(t => {
      const isDeposit = t.type === 'deposit';
      const isBazar = t.type === 'bazar';
      const isOtherCosting = t.type === 'other_costing';
      const isDeduction = t.type === 'deduction';

      let dotClass, amountColor, sign, typeLabel;
      if (isDeposit) {
        dotClass = 'accent'; amountColor = 'var(--accent-600)'; sign = '+'; typeLabel = 'Deposit';
      } else if (isBazar) {
        dotClass = 'warning'; amountColor = 'var(--warning-600)'; sign = '-'; typeLabel = 'Bazar';
      } else if (isOtherCosting) {
        dotClass = 'primary'; amountColor = 'var(--primary-600)'; sign = '-'; typeLabel = 'Other Costing';
      } else {
        dotClass = 'danger'; amountColor = 'var(--danger-600)'; sign = '-'; typeLabel = 'Deduction';
      }

      const amount = Math.abs(Utils.num(t.amount));

      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}"></div>
          <div class="timeline-content">
            <div class="timeline-date">${Utils.formatDate(t.date)} · ${Utils.timeAgo(t.timestamp)}</div>
            <div class="flex items-center justify-between">
              <div>
                <div class="timeline-title">${t.userName || 'Unknown'}</div>
                <div class="timeline-desc">${t.note || t.type}</div>
              </div>
              <div style="font-weight:var(--weight-bold);color:${amountColor};font-size:var(--font-md);white-space:nowrap;">
                ${sign}${Utils.currency(amount)}
              </div>
            </div>
            <span class="badge badge-${dotClass}" style="margin-top:var(--space-2);">${typeLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Filter transactions
   */
  filterTransactions(filter) {
    this.currentFilter = filter;
    this.renderTransactions();
  },

  /**
   * Refresh finance page
   */
  refresh() {
    this.renderSummary();
    this.renderTransactions();
  }
};

console.log('[DineDesk] Finance module loaded');
