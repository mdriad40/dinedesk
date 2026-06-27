/* ============================================
   DineDesk — Utility Functions (utils.js)
   ============================================ */

const Utils = {
  /**
   * Format currency with ৳ symbol
   */
  currency(amount) {
    const num = parseFloat(amount) || 0;
    return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  /**
   * Format a number with commas
   */
  formatNumber(num) {
    return (parseFloat(num) || 0).toLocaleString('en-BD');
  },

  /**
   * Get today's date in YYYY-MM-DD format
   */
  today() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Get current month key YYYY-MM
   */
  currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  /**
   * Get day key DD from a date string
   */
  dayKey(dateStr) {
    return dateStr.split('-')[2];
  },

  /**
   * Format date to readable string
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /**
   * Format timestamp to relative time
   */
  timeAgo(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return Utils.formatDate(new Date(timestamp).toISOString().split('T')[0]);
  },

  /**
   * Format time (HH:MM) to readable 12-hour format
   */
  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  },

  /**
   * Check if current time is past a deadline (HH:MM format)
   */
  isPastDeadline(deadlineStr) {
    if (!deadlineStr) return false;
    const now = new Date();
    const [h, m] = deadlineStr.split(':').map(Number);
    const deadlineMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= deadlineMinutes;
  },

  /**
   * Get time remaining until deadline (returns { hours, minutes, total })
   */
  timeUntilDeadline(deadlineStr) {
    if (!deadlineStr) return { hours: 0, minutes: 0, total: 0 };
    const now = new Date();
    const [h, m] = deadlineStr.split(':').map(Number);
    const deadlineMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let remaining = deadlineMinutes - nowMinutes;

    if (remaining < 0) {
      // Deadline passed for today; show time until tomorrow's deadline
      remaining = (24 * 60) - nowMinutes + deadlineMinutes;
    }

    return {
      hours: Math.floor(remaining / 60),
      minutes: remaining % 60,
      total: remaining
    };
  },

  /**
   * Generate a short unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  /**
   * Get initials from a name (max 2 characters)
   */
  initials(name) {
    if (!name) return '?';
    return name.split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  },

  /**
   * Encode email for use as Firebase key (replace . with ,)
   */
  encodeEmail(email) {
    return email.replace(/\./g, ',');
  },

  /**
   * Debounce function
   */
  debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Throttle function
   */
  throttle(fn, limit = 300) {
    let inThrottle = false;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Create an HTML element from a string
   */
  createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  },

  /**
   * DOM selector shortcuts
   */
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  /**
   * Set value of element safely
   */
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  /**
   * Set innerHTML safely
   */
  setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  },

  /**
   * Calculate meal rate
   * Meal Rate = Total Bazar Cost ÷ Total Meals
   */
  calcMealRate(totalBazar, totalMeals) {
    if (!totalMeals || totalMeals === 0) return 0;
    return totalBazar / totalMeals;
  },

  /**
   * Calculate user's meal cost
   */
  calcMealCost(mealRate, userMeals) {
    return mealRate * (userMeals || 0);
  },

  /**
   * Calculate balance
   */
  calcBalance(deposit, mealCost) {
    return (deposit || 0) - (mealCost || 0);
  },

  /**
   * Safe parse for numbers
   */
  num(val) {
    return parseFloat(val) || 0;
  },

  /**
   * Countdown timer display
   */
  countdownDisplay(hours, minutes) {
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }
};

console.log('[DineDesk] Utils loaded');
