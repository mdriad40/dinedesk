/* ============================================
   DineDesk — Authentication (auth.js)
   ============================================ */

const Auth = {
  isRegistering: false,

  /**
   * Initialize auth on the login page
   */
  init() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.login();
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.register();
      });
    }

    // Check if user is already signed in
    auth.onAuthStateChanged(async (user) => {
      if (Auth.isRegistering) {
        console.log('[DineDesk] Registration in progress. Skipping auth state redirect.');
        return;
      }
      const loader = document.getElementById('pageLoader');
      if (user) {
        // User is signed in — verify they have a dining mapping before redirecting
        try {
          const emailKey = Utils.encodeEmail(user.email);
          const snap = await db.ref(`userMappings/emailToDining/${emailKey}`).once('value');
          if (snap.val()) {
            // Valid dining mapping — redirect to dashboard
            window.location.href = 'dashboard.html';
          } else {
            // No dining mapping — sign out this orphaned account and show login
            console.warn('[DineDesk] User has no dining mapping. Signing out.');
            await auth.signOut();
            if (loader) loader.style.display = 'none';
            const authPage = document.getElementById('authPage');
            if (authPage) authPage.style.display = 'flex';
          }
        } catch (error) {
          console.error('[DineDesk] Auth check error:', error);
          if (loader) loader.style.display = 'none';
          const authPage = document.getElementById('authPage');
          if (authPage) authPage.style.display = 'flex';
        }
      } else {
        // Not signed in — show auth page
        if (loader) loader.style.display = 'none';
        const authPage = document.getElementById('authPage');
        if (authPage) authPage.style.display = 'flex';
      }
    });
  },

  /**
   * Login with email or username + password
   */
  async login() {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');

    if (!identifier || !password) {
      this._showError(errorDiv, errorText, 'Please fill in all fields');
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;
    errorDiv.classList.remove('visible');

    try {
      let email = identifier;

      // Check if identifier is a username (no @ symbol)
      if (!identifier.includes('@')) {
        // Look up username in userMappings
        const snap = await db.ref(`userMappings/usernameToDining/${identifier.toLowerCase()}`).once('value');
        const mapping = snap.val();

        if (!mapping) {
          throw new Error('Username not found. Please check and try again.');
        }

        // Get the user's email from their dining record
        const userSnap = await db.ref(`dinings/${mapping.diningId}/users/${mapping.userId}/email`).once('value');
        email = userSnap.val();

        if (!email) {
          throw new Error('Account not properly configured. Contact your dining manager.');
        }
      }

      // Sign in with email + password
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged will handle redirect

    } catch (error) {
      let msg = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Invalid email/username or password.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try later.';
      } else if (error.message) {
        msg = error.message;
      }
      this._showError(errorDiv, errorText, msg);
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  },

  /**
   * Register a new dining (create admin account + dining structure)
   */
  async register() {
    const managerName = document.getElementById('regManagerName').value.trim();
    const diningName = document.getElementById('regDiningName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const btn = document.getElementById('registerBtn');
    const errorDiv = document.getElementById('registerError');
    const errorText = document.getElementById('registerErrorText');

    // Validation
    if (!managerName || !diningName || !email || !password) {
      this._showError(errorDiv, errorText, 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      this._showError(errorDiv, errorText, 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      this._showError(errorDiv, errorText, 'Password must be at least 6 characters.');
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;
    errorDiv.classList.remove('visible');

    Auth.isRegistering = true;

    try {
      // 1. Create Firebase Auth account
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // 2. Generate dining ID
      const diningId = Utils.generateId();
      const adminUserId = Utils.generateId();
      const username = managerName.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 100);

      // 3. Create dining structure in Realtime Database
      const diningData = {
        info: {
          name: diningName,
          managerName: managerName,
          email: email,
          phone: phone || '',
          adminUid: uid,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        },
        users: {
          [adminUserId]: {
            name: managerName,
            username: username,
            email: email,
            phone: phone || '',
            role: 'admin',
            authUid: uid,
            totalDeposit: 0,
            totalMeals: 0,
            mealCost: 0,
            balance: 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            mealStatus: {
              breakfast: true,
              lunch: true,
              dinner: true
            }
          }
        },
        settings: {
          autoMealEnabled: false,
          breakfastDeadline: '04:00',
          lunchDeadline: '10:00',
          dinnerDeadline: '16:00',
          defaultMealState: true
        }
      };

      // 4. Write dining data
      await db.ref(`dinings/${diningId}`).set(diningData);

      // 5. Create user mappings for lookup
      await db.ref(`userMappings/emailToDining/${Utils.encodeEmail(email)}`).set({
        diningId: diningId,
        userId: adminUserId
      });

      await db.ref(`userMappings/usernameToDining/${username}`).set({
        diningId: diningId,
        userId: adminUserId
      });

      // 6. Create initial notification
      await Notifications.create(diningId, 'Welcome to DineDesk! 🎉', `${diningName} has been created successfully.`, 'all', 'info');

      // Auth state change will redirect to dashboard
      console.log('[DineDesk] Dining created successfully:', diningId);

      Auth.isRegistering = false;
      window.location.href = 'dashboard.html';

    } catch (error) {
      Auth.isRegistering = false;
      let msg = 'Registration failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Try logging in.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password is too weak. Use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (error.message) {
        msg = error.message;
      }
      this._showError(errorDiv, errorText, msg);
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  },

  /**
   * Sign out
   */
  async logout() {
    try {
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Logout error:', error);
      Notifications.toast('error', 'Error', 'Failed to sign out.');
    }
  },

  /**
   * Show error message in auth form
   */
  _showError(errorDiv, errorText, message) {
    if (errorDiv && errorText) {
      errorText.textContent = message;
      errorDiv.classList.add('visible');
    }
  }
};

// Auto-initialize on login page
if (document.getElementById('authPage')) {
  Auth.init();
}

console.log('[DineDesk] Auth loaded');
