/* ============================================
   DineDesk — Meal Chart Module (user/mealchart.js)
   ============================================ */

const MealChartModule = {
  diningId: null,
  userId: null,
  createdDate: null, // Date object of account creation
  selectedYear: 2026,
  selectedMonth: 7,  // 1-12
  selectedDay: 6,    // 1-31
  mealsData: {},

  monthNames: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],

  /**
   * Initialize Meal Chart
   */
  async init(diningId, userId) {
    this.diningId = diningId;
    this.userId = userId;

    // Set default selected date to today (present date)
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedDay = now.getDate();

    try {
      // Fetch dining creation date
      const infoSnap = await db.ref(`dinings/${this.diningId}/info/createdAt`).once('value');
      const createdAt = infoSnap.val();

      if (createdAt) {
        this.createdDate = new Date(createdAt);
      } else {
        // Fallback to Jan 1, 2026
        this.createdDate = new Date(2026, 0, 1);
      }
    } catch (e) {
      console.error('[MealChartModule] Fetch createdAt error, falling back:', e);
      this.createdDate = new Date(2026, 0, 1);
    }

    // Populate dropdowns initially and load details
    this.populateYearDropdown();
    this.populateMonthDropdown();
    this.populateDayDropdown();
    this.loadMonthData();
  },

  /**
   * Populate Year dropdown starting from creation year to current year
   */
  populateYearDropdown() {
    const valueEl = document.getElementById('mealChartYearValue');
    const menuEl = document.getElementById('mealChartYearMenu');
    if (!valueEl || !menuEl) return;

    const startYear = this.createdDate.getFullYear();
    const endYear = new Date().getFullYear();

    let itemsHTML = '';
    for (let y = startYear; y <= endYear; y++) {
      const isSelected = y === this.selectedYear;
      itemsHTML += `
        <div class="custom-dropdown-item ${isSelected ? 'selected' : ''}" 
             data-value="${y}" 
             onclick="DineDesk.mealChart.selectYear(${y})">
          ${y}
        </div>
      `;
    }
    menuEl.innerHTML = itemsHTML;
    valueEl.textContent = this.selectedYear;
  },

  /**
   * Action when a Year item is clicked
   */
  selectYear(year) {
    this.selectedYear = year;
    const dropdown = document.getElementById('mealChartYearDropdown');
    if (dropdown) dropdown.classList.remove('active');
    this.populateYearDropdown();
    this.onYearChange();
  },

  /**
   * Populate Month dropdown dynamically based on selected year
   */
  populateMonthDropdown() {
    const valueEl = document.getElementById('mealChartMonthValue');
    const menuEl = document.getElementById('mealChartMonthMenu');
    if (!valueEl || !menuEl) return;

    const startYear = this.createdDate.getFullYear();
    const currentYear = new Date().getFullYear();

    let startMonth = 1;
    let endMonth = 12;

    // If selected year is creation year, restrict starting month
    if (this.selectedYear === startYear) {
      startMonth = this.createdDate.getMonth() + 1;
    }
    // If selected year is current year, restrict ending month to current month
    if (this.selectedYear === currentYear) {
      endMonth = new Date().getMonth() + 1;
    }

    // Handle selected month bounds
    if (this.selectedMonth < startMonth) {
      this.selectedMonth = startMonth;
    } else if (this.selectedMonth > endMonth) {
      this.selectedMonth = endMonth;
    }

    let itemsHTML = '';
    for (let m = startMonth; m <= endMonth; m++) {
      const isSelected = m === this.selectedMonth;
      itemsHTML += `
        <div class="custom-dropdown-item ${isSelected ? 'selected' : ''}" 
             data-value="${m}" 
             onclick="DineDesk.mealChart.selectMonth(${m})">
          ${this.monthNames[m - 1]}
        </div>
      `;
    }
    menuEl.innerHTML = itemsHTML;
    valueEl.textContent = this.monthNames[this.selectedMonth - 1];
  },


  /**
   * Action when a Month item is clicked
   */
  selectMonth(month) {
    this.selectedMonth = month;
    const dropdown = document.getElementById('mealChartMonthDropdown');
    if (dropdown) dropdown.classList.remove('active');
    this.populateMonthDropdown();
    this.onMonthChange();
  },

  /**
   * Populate Day dropdown dynamically based on selected year and month
   */
  populateDayDropdown() {
    const valueEl = document.getElementById('mealChartDayValue');
    const menuEl = document.getElementById('mealChartDayMenu');
    if (!valueEl || !menuEl) return;

    const startYear = this.createdDate.getFullYear();
    const startMonth = this.createdDate.getMonth() + 1;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let startDay = 1;
    let endDay = new Date(this.selectedYear, this.selectedMonth, 0).getDate();

    // Restrict starting day if selected year & month is creation date
    if (this.selectedYear === startYear && this.selectedMonth === startMonth) {
      startDay = this.createdDate.getDate();
    }
    // Restrict ending day if selected year & month is today's date
    if (this.selectedYear === currentYear && this.selectedMonth === currentMonth) {
      endDay = new Date().getDate();
    }

    // Handle selected day bounds
    if (this.selectedDay < startDay) {
      this.selectedDay = startDay;
    } else if (this.selectedDay > endDay) {
      this.selectedDay = endDay;
    }

    let itemsHTML = '';
    for (let d = startDay; d <= endDay; d++) {
      const dayStr = String(d).padStart(2, '0');
      const isSelected = d === this.selectedDay;
      itemsHTML += `
        <div class="custom-dropdown-item ${isSelected ? 'selected' : ''}" 
             data-value="${d}" 
             onclick="DineDesk.mealChart.selectDay(${d})">
          ${dayStr}
        </div>
      `;
    }
    menuEl.innerHTML = itemsHTML;
    valueEl.textContent = String(this.selectedDay).padStart(2, '0');
  },

  /**
   * Action when a Day item is clicked
   */
  selectDay(day) {
    this.selectedDay = day;
    const dropdown = document.getElementById('mealChartDayDropdown');
    if (dropdown) dropdown.classList.remove('active');
    this.loadDayMeals();
  },

  /**
   * Actions on year change
   */
  onYearChange() {
    this.populateMonthDropdown();
    this.populateDayDropdown();
    this.loadMonthData();
  },

  /**
   * Actions on month change
   */
  onMonthChange() {
    this.populateDayDropdown();
    this.loadMonthData();
  },

  /**
   * Load entire month's data and update daily breakdown
   */
  async loadMonthData() {
    if (!this.diningId) return;

    const formattedMonth = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}`;

    try {
      const snap = await db.ref(`dinings/${this.diningId}/meals/${formattedMonth}`).once('value');
      this.mealsData = snap.val() || {};
      this.renderDailyDetails();
    } catch (e) {
      console.error('[MealChartModule] Load month data error:', e);
    }
  },

  /**
   * Just load details for selected day and refresh day dropdown text
   */
  loadDayMeals() {
    this.populateDayDropdown();
    this.renderDailyDetails();
  },

  /**
   * Render daily logs table
   */
  async renderDailyDetails() {
    const tbody = document.getElementById('mealChartDetailsBody');
    if (!tbody) return;

    const formattedMonth = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}`;
    const formattedDay = String(this.selectedDay).padStart(2, '0');
    const formattedDate = `${formattedMonth}-${formattedDay}`;

    const detailsDate = document.getElementById('mealChartDetailsDate');
    if (detailsDate) {
      detailsDate.textContent = Utils.formatDate(formattedDate);
    }

    try {
      // Fetch users and settings
      const [usersSnap, settingsSnap] = await Promise.all([
        db.ref(`dinings/${this.diningId}/users`).once('value'),
        db.ref(`dinings/${this.diningId}/settings`).once('value')
      ]);

      const users = usersSnap.val() || {};
      const settings = settingsSnap.val() || {};
      const isManagerMealEnabled = !!settings.managerMealEnabled;

      const userEntries = Object.entries(users).filter(([id, user]) => {
        if (user.role === 'admin') {
          return isManagerMealEnabled;
        }
        return true;
      });

      if (userEntries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6" style="color:var(--text-tertiary);">No members in dining.</td></tr>`;
        return;
      }

      const dayMeals = this.mealsData[formattedDay] || {};
      const breakfast = dayMeals.breakfast || {};
      const lunch = dayMeals.lunch || {};
      const dinner = dayMeals.dinner || {};

      tbody.innerHTML = userEntries.map(([id, u]) => {
        const bCount = breakfast[id] || 0;
        const lCount = lunch[id] || 0;
        const dCount = dinner[id] || 0;
        const total = bCount + lCount + dCount;

        const bBadge = bCount > 0 
          ? `<span class="badge badge-accent">${bCount} Meal${bCount > 1 ? 's' : ''}</span>`
          : `<span class="badge badge-danger" style="opacity: 0.6;">OFF</span>`;

        const lBadge = lCount > 0 
          ? `<span class="badge badge-accent">${lCount} Meal${lCount > 1 ? 's' : ''}</span>`
          : `<span class="badge badge-danger" style="opacity: 0.6;">OFF</span>`;

        const dBadge = dCount > 0 
          ? `<span class="badge badge-accent">${dCount} Meal${dCount > 1 ? 's' : ''}</span>`
          : `<span class="badge badge-danger" style="opacity: 0.6;">OFF</span>`;

        return `
          <tr>
            <td>
              <div class="flex items-center gap-3">
                <div class="avatar avatar-sm" style="background:${DineDesk.users._avatarColor(u.name)};">${Utils.initials(u.name)}</div>
                <span style="font-weight:var(--weight-semibold); color:var(--text-primary);">${u.name}</span>
              </div>
            </td>
            <td class="text-center">${bBadge}</td>
            <td class="text-center">${lBadge}</td>
            <td class="text-center">${dBadge}</td>
            <td class="text-center" style="font-weight:var(--weight-bold);">${total}</td>
          </tr>
        `;
      }).join('');

    } catch (e) {
      console.error('[MealChartModule] Detail render error:', e);
      tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6" style="color:var(--text-tertiary);">Failed to load meal logs.</td></tr>`;
    }
  },

  /**
   * Refresh module data
   */
  refresh() {
    this.loadMonthData();
  }
};

window.MealChartModule = MealChartModule;
