/* ============================================
   DineDesk — Dining Overview (shared/overview.js)
   ============================================ */

const OverviewModule = {
  /**
   * Initialize overview with realtime data
   */
  init(diningId) {
    this.diningId = diningId;

    const triggerRefresh = () => {
      const isOverviewVisible = Router.currentPage === 'overview' || 
                               (Router.currentPage === 'dashboard' && DineDesk.state.role === 'admin');
      if (isOverviewVisible) {
        this.refresh();
      }
    };

    // Multiple listeners will update the overview
    db.ref(`dinings/${diningId}/users`).on('value', triggerRefresh);
    db.ref(`dinings/${diningId}/deposits`).on('value', triggerRefresh);
    db.ref(`dinings/${diningId}/bazar`).on('value', triggerRefresh);
    db.ref(`dinings/${diningId}/meals`).on('value', triggerRefresh);
  },

  /**
   * Refresh all overview sections
   */
  async refresh() {
    try {
      if (Router.currentPage === 'overview') {
        const overviewContent = document.getElementById('overviewContent');
        const originalContainer = document.getElementById('overviewOriginalContainer');
        if (overviewContent && originalContainer && overviewContent.parentElement !== originalContainer) {
          originalContainer.appendChild(overviewContent);
        }
      }

      const [usersSnap, depositsSnap, bazarSnap, mealsSnap, settingsSnap] = await Promise.all([
        db.ref(`dinings/${this.diningId}/users`).once('value'),
        db.ref(`dinings/${this.diningId}/deposits`).once('value'),
        db.ref(`dinings/${this.diningId}/bazar`).once('value'),
        db.ref(`dinings/${this.diningId}/meals`).once('value'),
        db.ref(`dinings/${this.diningId}/settings`).once('value')
      ]);

      const users = usersSnap.val() || {};
      const deposits = depositsSnap.val() || {};
      const bazars = bazarSnap.val() || {};
      const meals = mealsSnap.val() || {};
      const settings = settingsSnap.val() || {};

      this.managerMealEnabled = !!settings.managerMealEnabled;

      // Calculate totals
      let totalDeposit = 0;
      let totalDeductions = 0;
      let totalBazar = 0;
      let totalMeals = 0;

      Object.values(deposits).forEach(d => {
        if (d.type === 'deposit') totalDeposit += Utils.num(d.amount);
        else totalDeductions += Math.abs(Utils.num(d.amount));
      });

      Object.values(bazars).forEach(b => {
        totalBazar += Utils.num(b.amount);
      });

      // Count total meals
      Object.values(meals).forEach(monthData => {
        Object.values(monthData).forEach(dayData => {
          Object.values(dayData).forEach(typeData => {
            if (typeof typeData === 'object') {
              Object.entries(typeData).forEach(([uId, count]) => {
                const u = users[uId];
                if (u && u.role === 'admin' && !this.managerMealEnabled) {
                  return; // Skip manager meals
                }
                totalMeals += parseInt(count) || 0;
              });
            }
          });
        });
      });

      const mealRate = Utils.calcMealRate(totalBazar, totalMeals);
      const netBalance = totalDeposit - totalDeductions - totalBazar;

      // Update global state
      DineDesk.state.mealRate = mealRate;
      DineDesk.state.totalMeals = totalMeals;
      DineDesk.state.totalBazar = totalBazar;

      // Render overview stats
      this.renderStats(totalDeposit, totalMeals, mealRate, totalBazar, netBalance);

      const isAdmin = DineDesk.state.role === 'admin';
      const memberStatsSection = document.getElementById('overviewMemberStatsSection');
      const bazarHistorySection = document.getElementById('overviewBazarHistorySection');
      const memberNavGrid = document.getElementById('memberNavGridSection');

      if (memberStatsSection) {
        memberStatsSection.style.display = isAdmin ? 'block' : 'none';
      }
      if (bazarHistorySection) {
        bazarHistorySection.style.display = isAdmin ? 'block' : 'none';
      }
      if (memberNavGrid) {
        memberNavGrid.style.display = isAdmin ? 'none' : 'block';
        memberNavGrid.classList.toggle('hidden', isAdmin);
      }

      if (isAdmin) {
        // Render member stats table
        this.renderMemberStats(users, mealRate);

        // Render bazar history
        this.renderBazarHistory(bazars);
      }

    } catch (error) {
      console.error('Overview refresh error:', error);
    }
  },

  /**
   * Render overview stat cards
   */
  renderStats(totalDeposit, totalMeals, mealRate, totalBazar, netBalance) {
    const container = document.getElementById('overviewStats');
    if (!container) return;

    const totalCost = totalMeals * mealRate;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Deposit</div>
          <div class="stat-value">${Utils.currency(totalDeposit)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Meals</div>
          <div class="stat-value">${Utils.formatNumber(totalMeals)}</div>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Meal Rate</div>
          <div class="stat-value">${Utils.currency(mealRate)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M16 8H8m8 4H8m4 4H8"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Cost</div>
          <div class="stat-value">${Utils.currency(totalCost)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${netBalance >= 0 ? 'accent' : 'danger'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">Net Balance</div>
          <div class="stat-value" style="color:${netBalance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'};">${Utils.currency(netBalance)}</div>
        </div>
      </div>
    `;
  },

  /**
   * Render member stats table
   */
  renderMemberStats(users, mealRate) {
    const tbody = document.getElementById('memberStatsBody');
    if (!tbody) return;

    const entries = Object.entries(users).filter(([id, u]) => {
      if (u.role === 'admin') {
        return !!this.managerMealEnabled;
      }
      return true;
    });
    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center p-6" style="color:var(--text-tertiary);">No members yet</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(([id, u]) => {
      const mealCost = Utils.calcMealCost(mealRate, u.totalMeals);
      const balance = Utils.calcBalance(u.totalDeposit, mealCost);
      const status = balance >= 0
        ? '<span class="badge badge-accent">Paid</span>'
        : '<span class="badge badge-danger">Due</span>';

      return `
        <tr>
          <td>
            <div class="flex items-center gap-2">
              <div class="avatar avatar-sm" style="background:${UsersModule._avatarColor(u.name)};">${Utils.initials(u.name)}</div>
              <div>
                <div style="font-weight:var(--weight-medium);">${u.name}</div>
                <div style="font-size:var(--font-xs);color:var(--text-tertiary);">@${u.username || '—'}</div>
              </div>
            </div>
          </td>
          <td>${u.totalMeals || 0}</td>
          <td>${Utils.currency(u.totalDeposit)}</td>
          <td>${Utils.currency(mealCost)}</td>
          <td style="font-weight:var(--weight-bold);color:${balance >= 0 ? 'var(--accent-600)' : 'var(--danger-600)'};">${Utils.currency(balance)}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join('');
  },


  /**
   * Render bazar history
   */
  renderBazarHistory(bazars) {
    const container = document.getElementById('bazarHistory');
    if (!container) return;

    const entries = Object.values(bazars).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
          </div>
          <h3>No Bazar Records</h3>
          <p>Bazar expenses will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = entries.slice(0, 20).map(b => `
      <div class="timeline-item">
        <div class="timeline-dot warning"></div>
        <div class="timeline-content">
          <div class="timeline-date">${Utils.formatDate(b.date)} · ${Utils.timeAgo(b.timestamp)}</div>
          <div class="flex items-center justify-between">
            <div>
              <div class="timeline-title">${b.items || 'Bazar'}</div>
              <div class="timeline-desc">By ${b.shopperName || 'N/A'}</div>
            </div>
            <div style="font-weight:var(--weight-bold);color:var(--warning-600);white-space:nowrap;">
              ${Utils.currency(b.amount)}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },


  /**
   * Export report as printable HTML
   */
  exportReport() {
    const overviewSection = document.getElementById('page-overview');
    if (!overviewSection) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DineDesk Report — ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: 'Inter', Arial, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #111; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          h2 { font-size: 18px; margin: 24px 0 12px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; font-size: 13px; }
          th { background: #f5f5f5; font-weight: 600; }
          .stats { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
          .stat-box { padding: 16px; border: 1px solid #ddd; border-radius: 8px; flex: 1; min-width: 120px; }
          .stat-box label { font-size: 12px; color: #666; display: block; }
          .stat-box strong { font-size: 20px; }
          .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>🍽 DineDesk Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        <div class="stats">
          <div class="stat-box"><label>Total Deposit</label><strong>${Utils.currency(DineDesk.state.totalDeposit || 0)}</strong></div>
          <div class="stat-box"><label>Total Meals</label><strong>${DineDesk.state.totalMeals || 0}</strong></div>
          <div class="stat-box"><label>Meal Rate</label><strong>${Utils.currency(DineDesk.state.mealRate || 0)}</strong></div>
          <div class="stat-box"><label>Total Bazar</label><strong>${Utils.currency(DineDesk.state.totalBazar || 0)}</strong></div>
        </div>
        <h2>Member Statistics</h2>
        ${document.getElementById('memberStatsTable')?.outerHTML || '<p>No data</p>'}
        <div class="footer">DineDesk — Modern Dining Management System</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();

    Notifications.toast('info', 'Report', 'Report opened for printing.');
  }
};

console.log('[DineDesk] Overview module loaded');
