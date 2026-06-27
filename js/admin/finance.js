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
        this.renderSummary();
      }
    });

    // Listen to bazar costs
    db.ref(`dinings/${diningId}/bazar`).orderByChild('timestamp').on('value', (snap) => {
      this.bazarList = {};
      snap.forEach(child => {
        this.bazarList[child.key] = child.val();
      });
      if (Router.currentPage === 'finance') {
        this.renderSummary();
      }
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
      await Notifications.log(this.diningId, 'deposit_added', `Deposit ৳${amount} for ${user?.name}`, DineDesk.state.userId);
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
      await Notifications.log(this.diningId, 'deduction_added', `Deducted ৳${amount} from ${user?.name}: ${reason}`, DineDesk.state.userId);
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
    let totalBazar = 0;

    Object.values(this.deposits).forEach(d => {
      if (d.type === 'deposit') totalDeposits += Utils.num(d.amount);
      else if (d.type === 'deduction') totalDeductions += Math.abs(Utils.num(d.amount));
    });

    Object.values(this.bazarList).forEach(b => {
      totalBazar += Utils.num(b.amount);
    });

    const netBalance = totalDeposits - totalDeductions - totalBazar;

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
        <div class="stat-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Deductions</div>
          <div class="stat-value">${Utils.currency(totalDeductions)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Bazar</div>
          <div class="stat-value">${Utils.currency(totalBazar)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
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
      const dotClass = isDeposit ? 'accent' : isBazar ? 'warning' : 'danger';
      const amountColor = isDeposit ? 'var(--accent-600)' : 'var(--danger-600)';
      const sign = isDeposit ? '+' : '-';
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
            <span class="badge badge-${dotClass}" style="margin-top:var(--space-2);">${t.type}</span>
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
