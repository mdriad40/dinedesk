/* ============================================
   DineDesk — Onboarding & Setup Wizard Logic
   ============================================ */

const Onboarding = {
  user: null,
  currentPath: null, // 'create' or 'join'
  currentStep: 0,

  // Create Mess Settings
  messName: '',
  trackedMeals: { breakfast: true, lunch: true, dinner: true },
  rateMode: 'market', // 'market' or 'fixed'
  fixedRates: { breakfast: 30, lunch: 60, dinner: 60 },
  cutoffs: { breakfast: '07:00', lunch: '08:00', dinner: '16:00' },
  managerMealEnabled: true,
  managerBazarEnabled: true,
  messCode: '',

  // Join Mess State
  inviteCodeInput: '',
  matchedDining: null,

  /**
   * Initialize onboarding flow
   */
  init(user) {
    this.user = user;
    console.log('[DineDesk Onboarding] Initialized for:', user.email);

    // Render left panel brand & bullet points
    this.renderLeftPanel();

    // Render the initial choice view
    this.showStep(0);
  },

  /**
   * Render the static left marketing panel
   */
  renderLeftPanel() {
    const leftPane = document.getElementById('onboardingLeftPanel');
    if (!leftPane) return;

    leftPane.innerHTML = `
      <!-- Floating Dining Animations -->
      <div class="auth-float-icons" aria-hidden="true">
        <!-- Filled Circle 1 (Large) -->
        <div class="float-circle fi-1"></div>

        <!-- Fork (Realistic outline) -->
        <div class="float-icon float-icon--fork fi-2">
          <svg viewBox="0 0 24 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M6 2 L6 18 M12 2 L12 18 M18 2 L18 18" />
            <path d="M6 18 C6 22 18 22 18 18" />
            <line x1="12" y1="20" x2="12" y2="62" />
            <line x1="10" y1="58" x2="14" y2="58" />
          </svg>
        </div>

        <!-- Spoon (Realistic outline with details) -->
        <div class="float-icon float-icon--spoon fi-3">
          <svg viewBox="0 0 24 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M12 2 C8 2 6 6 6 15 C6 22 9.5 25 12 27 L12 62" />
            <path d="M12 2 C16 2 18 6 18 15 C18 22 14.5 25 12 27" />
            <line x1="10" y1="58" x2="14" y2="58" />
          </svg>
        </div>

        <!-- Knife (Realistic outline) -->
        <div class="float-icon float-icon--knife fi-4">
          <svg viewBox="0 0 24 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M12 2 C12 2 17 6 17 22 L12 28 L12 62" />
            <line x1="12" y1="2" x2="12" y2="62" />
            <line x1="10" y1="58" x2="14" y2="58" />
          </svg>
        </div>

        <!-- Filled Circle 2 (Medium) -->
        <div class="float-circle fi-5"></div>

        <!-- Filled Circle 3 (Extra Large) -->
        <div class="float-circle fi-6"></div>

        <!-- Fork 2 (smaller) -->
        <div class="float-icon float-icon--fork2 fi-7">
          <svg viewBox="0 0 20 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M5 2 L5 16 M10 2 L10 16 M15 2 L15 16" />
            <path d="M5 16 C5 19.5 15 19.5 15 16" />
            <line x1="10" y1="18" x2="10" y2="54" />
          </svg>
        </div>

        <!-- Spoon 2 (smaller) -->
        <div class="float-icon float-icon--spoon2 fi-8">
          <svg viewBox="0 0 20 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M10 2 C6.5 2 5 5 5 13 C5 19 8 21.5 10 23 L10 54" />
            <path d="M10 2 C13.5 2 15 5 15 13 C15 19 12 21.5 10 23" />
          </svg>
        </div>
      </div>
      <div class="auth-left-content">
        <!-- Logo -->
        <div class="auth-left-logo">
          <div class="logo-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
            </svg>
          </div>
          <span>DineDesk</span>
        </div>

        <div class="auth-left-badge">DINING MANAGER &middot; BD</div>

        <!-- Desktop-only Banner Content -->
        <div class="desktop-header-content">
          <h1 class="auth-left-title">Track meals.<br>Not spreadsheets.</h1>
          <p class="auth-left-desc">Meals, deposits, bills and bazar for your whole mess &mdash; tracked, split and
            settled in one place everyone can see.</p>

          <div class="auth-features-list">
            <div class="auth-feature-item">
              <div class="auth-feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                  stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div class="auth-feature-text">
                <h4>Meal tracking that never lies</h4>
                <p>Members log their meals before the cutoff &mdash; timestamps do the arguing for you.</p>
              </div>
            </div>
            <div class="auth-feature-item">
              <div class="auth-feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                  stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div class="auth-feature-text">
                <h4>Deposit &amp; balance at a glance</h4>
                <p>Every member sees their balance in real time &mdash; no surprises at month-end.</p>
              </div>
            </div>
            <div class="auth-feature-item">
              <div class="auth-feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div class="auth-feature-text">
                <h4>Auto bill split to the taka</h4>
                <p>Total cost split fairly by meals eaten &mdash; settled and cleared every month.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Navigate steps
   */
  showStep(step) {
    this.currentStep = step;

    // Toggle logout button visibility (only show on step 0)
    const logoutBtn = document.querySelector('.onboarding-logout-btn');
    if (logoutBtn) {
      logoutBtn.style.display = step === 0 ? 'flex' : 'none';
    }

    // Toggle step-welcome-active class on onboarding-right for mobile UI adjustments
    const rightPane = document.querySelector('.onboarding-right');
    if (rightPane) {
      if (step === 0) {
        rightPane.classList.add('step-welcome-active');
      } else {
        rightPane.classList.remove('step-welcome-active');
      }
    }

    // Manage step visibility
    const stepWelcome = document.getElementById('step-welcome');
    const stepName = document.getElementById('step-name');
    const stepMeals = document.getElementById('step-meals');
    const stepSplit = document.getElementById('step-split');
    const stepRates = document.getElementById('step-rates');
    const stepCutoffs = document.getElementById('step-cutoffs');
    const stepBazar = document.getElementById('step-bazar');
    const stepInvite = document.getElementById('step-invite');
    const stepJoin = document.getElementById('step-join');

    // Hide all
    const allSteps = [stepWelcome, stepName, stepMeals, stepSplit, stepRates, stepCutoffs, stepBazar, stepInvite, stepJoin];
    allSteps.forEach(s => { if (s) s.style.display = 'none'; });

    // Progress Bar
    const progressContainer = document.getElementById('wizardProgress');
    const progressHeader = document.getElementById('wizardHeader');
    if (step === 0) {
      if (progressContainer) progressContainer.style.display = 'none';
      if (progressHeader) progressHeader.style.display = 'none';
      if (stepWelcome) stepWelcome.style.display = 'flex';
      return;
    }

    if (progressContainer) progressContainer.style.display = 'flex';
    if (progressHeader) progressHeader.style.display = 'flex';

    if (this.currentPath === 'join') {
      if (progressContainer) progressContainer.style.display = 'none';
      Utils.setText('wizardTitle', 'Join a mess');
      Utils.setText('wizardStepInfo', '1 / 3');
      if (stepJoin) stepJoin.style.display = 'flex';
      return;
    }

    // Path 'create' Step mapping:
    // Step 1: Name
    // Step 2: Meals
    // Step 3: Split Mode
    // Step 4: Fixed Rates OR Cutoffs
    // Step 5: Bazar (Manager Options)
    // Step 6: Invite Code (Finish)

    const totalSteps = 6;
    let stepTitle = '';
    let targetEl = null;

    switch (step) {
      case 1:
        stepTitle = 'Name';
        targetEl = stepName;
        break;
      case 2:
        stepTitle = 'Meals';
        targetEl = stepMeals;
        break;
      case 3:
        stepTitle = 'Split';
        targetEl = stepSplit;
        break;
      case 4:
        if (this.rateMode === 'fixed') {
          stepTitle = 'Rates';
          targetEl = stepRates;
          this.populateRatesForm();
        } else {
          stepTitle = 'Cutoffs';
          targetEl = stepCutoffs;
          this.populateCutoffsForm();
        }
        break;
      case 5:
        stepTitle = 'Bazar';
        targetEl = stepBazar;
        break;
      case 6:
        stepTitle = 'Invites';
        targetEl = stepInvite;
        this.generateInviteCode();
        break;
    }

    if (targetEl) targetEl.style.display = 'flex';

    // Update progress numbers
    Utils.setText('wizardTitle', 'Setup wizard');
    Utils.setText('wizardStepInfo', `Step ${step} of ${totalSteps} · ${stepTitle}`);

    // Render progress bar segments
    if (progressContainer) {
      progressContainer.innerHTML = '';
      for (let i = 1; i <= totalSteps; i++) {
        const active = i <= step ? 'active' : '';
        progressContainer.innerHTML += `<div class="wizard-progress-step ${active}"></div>`;
      }
    }
  },

  /**
   * Path choice (Create or Join)
   */
  choosePath(path) {
    this.currentPath = path;
    if (path === 'create') {
      this.showStep(1);
    } else {
      this.showStep(7); // Show Join Mess form directly
    }
  },

  /**
   * Back button on setup header
   */
  handleBack() {
    if (this.currentStep === 0) return;

    if (this.currentPath === 'join') {
      this.currentPath = null;
      this.showStep(0);
      return;
    }

    // Create Path back transitions
    if (this.currentStep === 1) {
      this.currentPath = null;
      this.showStep(0);
    } else {
      this.showStep(this.currentStep - 1);
    }
  },

  /**
   * Step 1 -> Step 2
   */
  submitName() {
    const input = document.getElementById('onboardMessNameInput');
    const name = input ? input.value.trim() : '';
    if (!name) {
      Notifications.toast('warning', 'Missing Name', 'Please enter a name for your mess.');
      return;
    }
    this.messName = name;
    this.showStep(2);
  },

  /**
   * Step 2 -> Step 3
   */
  submitMeals() {
    const b = document.getElementById('toggleMealsBreakfast').checked;
    const l = document.getElementById('toggleMealsLunch').checked;
    const d = document.getElementById('toggleMealsDinner').checked;

    if (!b && !l && !d) {
      Notifications.toast('warning', 'Select Meal', 'You must select at least one meal time to track.');
      return;
    }

    this.trackedMeals = { breakfast: b, lunch: l, dinner: d };
    this.showStep(3);
  },

  /**
   * Step 3 -> Step 4
   */
  selectRateMode(mode) {
    this.rateMode = mode;

    document.querySelectorAll('.radio-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.mode === mode);
    });

    // Enable/disable next continue button
    document.getElementById('btnSubmitSplitMode').disabled = false;
  },

  submitSplitMode() {
    this.showStep(4);
  },

  /**
   * Populates Fixed Rates inputs based on selected meals
   */
  populateRatesForm() {
    const container = document.getElementById('fixedRatesInputsList');
    if (!container) return;

    container.innerHTML = '';
    const meals = [
      { key: 'breakfast', label: 'Breakfast', icon: '☀️', val: this.fixedRates.breakfast },
      { key: 'lunch', label: 'Lunch', icon: '🍱', val: this.fixedRates.lunch },
      { key: 'dinner', label: 'Dinner', icon: '🌙', val: this.fixedRates.dinner }
    ];

    meals.forEach(m => {
      if (this.trackedMeals[m.key]) {
        container.innerHTML += `
          <div class="option-card-row">
            <div class="option-card-left">
              <div class="option-card-icon">${m.icon}</div>
              <div class="option-card-text">
                <h4>${m.label}</h4>
                <p>per meal price</p>
              </div>
            </div>
            <div class="price-input-wrapper">
              <span class="price-currency">৳</span>
              <input type="number" class="price-input" id="rateInput-${m.key}" value="${m.val}" min="0">
            </div>
          </div>
        `;
      }
    });
  },

  submitRates() {
    // Read rate values
    ['breakfast', 'lunch', 'dinner'].forEach(k => {
      const el = document.getElementById(`rateInput-${k}`);
      if (el) {
        this.fixedRates[k] = parseFloat(el.value) || 0;
      }
    });
    this.showStep(5);
  },

  /**
   * Populates Cutoff times inputs based on selected meals
   */
  populateCutoffsForm() {
    const container = document.getElementById('cutoffsInputsList');
    if (!container) return;

    container.innerHTML = '';
    const meals = [
      { key: 'breakfast', label: 'Breakfast cutoff', icon: '☀️', val: this.cutoffs.breakfast },
      { key: 'lunch', label: 'Lunch cutoff', icon: '🍱', val: this.cutoffs.lunch },
      { key: 'dinner', label: 'Dinner cutoff', icon: '🌙', val: this.cutoffs.dinner }
    ];

    meals.forEach(m => {
      if (this.trackedMeals[m.key]) {
        container.innerHTML += `
          <div class="option-card-row">
            <div class="option-card-left">
              <div class="option-card-icon">${m.icon}</div>
              <div class="option-card-text">
                <h4>${m.label}</h4>
                <p>Locks daily at this time</p>
              </div>
            </div>
            <input type="time" class="time-input-onboarding" id="cutoffInput-${m.key}" value="${m.val}">
          </div>
        `;
      }
    });
  },

  submitCutoffs() {
    // Read time cutoffs
    ['breakfast', 'lunch', 'dinner'].forEach(k => {
      const el = document.getElementById(`cutoffInput-${k}`);
      if (el) {
        this.cutoffs[k] = el.value || '00:00';
      }
    });
    this.showStep(5);
  },

  /**
   * Step 5 -> Step 6
   */
  submitManagerOptions() {
    this.managerMealEnabled = document.getElementById('toggleManagerMealEat').checked;
    this.managerBazarEnabled = document.getElementById('toggleManagerBazarDuty').checked;
    this.showStep(6);
  },

  /**
   * Generate Unique Mess Code
   */
  async generateInviteCode() {
    if (this.messCode) return; // Already generated

    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = 'DD-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      // Confirm uniqueness
      const snap = await db.ref(`messCodes/${code}`).once('value');
      if (snap.exists()) {
        // Regenerate recursively
        this.generateInviteCode();
        return;
      }
      this.messCode = code;
      Utils.setText('generatedMessCodeText', code);
    } catch (err) {
      console.error('Error verifying unique code:', err);
      // Fallback
      this.messCode = code;
      Utils.setText('generatedMessCodeText', code);
    }
  },

  /**
   * Step 6: Perform database transactions to create the Mess!
   */
  async createMess() {
    const btn = document.getElementById('btnOnboardingCreateMess');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating mess...';
    }

    try {
      const uid = this.user.uid;
      const email = this.user.email;
      const phone = this.user.phone || '';
      const name = this.user.name || 'Manager';

      // 1. Generate IDs
      const diningId = Utils.generateId();
      const adminUserId = Utils.generateId();
      const username = name.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 100);

      // 2. Build Settings structure
      const diningSettings = {
        autoMealEnabled: this.rateMode === 'market', // Enable lock deadlines for market rates
        breakfastDeadline: this.cutoffs.breakfast || '07:00',
        lunchDeadline: this.cutoffs.lunch || '08:00',
        dinnerDeadline: this.cutoffs.dinner || '16:00',
        defaultMealState: true,

        trackedMeals: this.trackedMeals,
        rateMode: this.rateMode,
        fixedRates: this.fixedRates,
        managerMealEnabled: this.managerMealEnabled,
        managerBazarEnabled: this.managerBazarEnabled
      };

      // 3. Setup initial admin user in dining
      const diningUsers = {
        [adminUserId]: {
          name: name,
          username: username,
          email: email,
          phone: phone,
          role: 'admin',
          authUid: uid,
          totalDeposit: 0,
          totalMeals: 0,
          mealCost: 0,
          balance: 0,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          mealStatus: {
            breakfast: this.managerMealEnabled,
            lunch: this.managerMealEnabled,
            dinner: this.managerMealEnabled
          }
        }
      };

      // 4. Create Dining record
      const diningData = {
        info: {
          name: this.messName,
          managerName: name,
          email: email,
          phone: phone,
          adminUid: uid,
          messCode: this.messCode,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        },
        users: diningUsers,
        settings: diningSettings
      };

      // Set DB records
      await Promise.all([
        db.ref(`dinings/${diningId}`).set(diningData),
        // Create lookup code mapping
        db.ref(`messCodes/${this.messCode}`).set(diningId),
        // Create user mappings
        db.ref(`userMappings/emailToDining/${Utils.encodeEmail(email)}`).set({
          diningId: diningId,
          userId: adminUserId
        }),
        db.ref(`userMappings/usernameToDining/${username}`).set({
          diningId: diningId,
          userId: adminUserId
        })
      ]);

      // Create notification
      await Notifications.create(diningId, 'Welcome to DineDesk! 🎉', `${this.messName} has been setup successfully.`, 'all', 'info');

      // Success! Refresh the page to reload dashboard under new mapping
      Notifications.toast('success', 'Mess Created', `${this.messName} setup completed!`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('[Onboarding] Create mess error:', err);
      Notifications.toast('error', 'Error', 'Failed to create mess. Please try again.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create mess';
      }
    }
  },

  /**
   * Verify Invite Code (Join Path)
   */
  async verifyInviteCode() {
    const input = document.getElementById('joinMessCodeInput');
    const code = input ? input.value.trim().toUpperCase() : '';

    if (!code) {
      Notifications.toast('warning', 'Missing Code', 'Please enter a mess code.');
      return;
    }

    const btn = document.getElementById('btnVerifyJoinCode');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verifying code...';
    }

    try {
      const snap = await db.ref(`messCodes/${code}`).once('value');
      const diningId = snap.val();

      if (!diningId) {
        Notifications.toast('error', 'Invalid Code', 'No mess found with this code. Check and try again.');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Verify invite code';
        }
        return;
      }

      // Found dining! Load details for preview
      const infoSnap = await db.ref(`dinings/${diningId}/info`).once('value');
      const info = infoSnap.val() || {};

      this.matchedDining = {
        id: diningId,
        name: info.name || 'Unnamed Mess',
        manager: info.managerName || 'Manager'
      };

      // Show preview area
      const previewArea = document.getElementById('joinPreviewArea');
      if (previewArea) {
        previewArea.innerHTML = `
          <div class="choice-card selected" style="margin-top: 1rem; cursor: default;">
            <div class="choice-glass-icon-wrapper">
              <div class="choice-glass-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
            </div>
            <div class="choice-text">
              <h3>${this.matchedDining.name}</h3>
              <p>Manager: <strong>${this.matchedDining.manager}</strong></p>
            </div>
          </div>
        `;
        previewArea.style.display = 'block';
      }

      // Update button to final action
      const finalBtn = document.getElementById('btnJoinConfirmSubmit');
      if (finalBtn) {
        finalBtn.style.display = 'flex';
      }
      if (btn) btn.style.display = 'none';

    } catch (err) {
      console.error('[Onboarding] Verify code error:', err);
      Notifications.toast('error', 'Error', 'Failed to verify invite code.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Verify invite code';
      }
    }
  },

  /**
   * Final Join Action
   */
  async executeJoin() {
    if (!this.matchedDining) return;

    const btn = document.getElementById('btnJoinConfirmSubmit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Joining mess...';
    }

    try {
      const uid = this.user.uid;
      const email = this.user.email;
      const phone = this.user.phone || '';
      const name = this.user.name || 'Member';
      const diningId = this.matchedDining.id;

      // 1. Generate unique member user ID for dining
      const memberUserId = Utils.generateId();
      const username = name.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 100);

      // 2. Fetch dining settings to determine default meal values
      const settingsSnap = await db.ref(`dinings/${diningId}/settings`).once('value');
      const settings = settingsSnap.val() || {};
      const trackedMeals = settings.trackedMeals || { breakfast: true, lunch: true, dinner: true };

      const newUserData = {
        name: name,
        username: username,
        email: email,
        phone: phone,
        role: 'user',
        authUid: uid,
        totalDeposit: 0,
        totalMeals: 0,
        mealCost: 0,
        balance: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        mealStatus: {
          breakfast: !!trackedMeals.breakfast,
          lunch: !!trackedMeals.lunch,
          dinner: !!trackedMeals.dinner
        }
      };

      // 3. Write user details inside dining and mappings
      await Promise.all([
        db.ref(`dinings/${diningId}/users/${memberUserId}`).set(newUserData),
        db.ref(`userMappings/emailToDining/${Utils.encodeEmail(email)}`).set({
          diningId: diningId,
          userId: memberUserId
        }),
        db.ref(`userMappings/usernameToDining/${username}`).set({
          diningId: diningId,
          userId: memberUserId
        })
      ]);

      // Notify
      await Notifications.create(diningId, 'New Member Joined! 👋', `${name} has joined the mess.`, 'all', 'info');
      await Notifications.log(diningId, 'member_joined', `${name} joined the mess`, memberUserId, memberUserId);

      Notifications.toast('success', 'Joined Successfully', `Welcome to ${this.matchedDining.name}!`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('[Onboarding] Execute join error:', err);
      Notifications.toast('error', 'Error', 'Failed to join mess.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Confirm & Join Mess';
      }
    }
  }
};

window.Onboarding = Onboarding;
