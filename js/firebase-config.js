/* ============================================
   DineDesk — Firebase Configuration
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyB_RIGLOegS-fy3IlblsGCnj8TS2AwC0o0",
  authDomain: "dinedesk-57f88.firebaseapp.com",
  databaseURL: "https://dinedesk-57f88-default-rtdb.firebaseio.com",
  projectId: "dinedesk-57f88",
  storageBucket: "dinedesk-57f88.firebasestorage.app",
  messagingSenderId: "867219650851",
  appId: "1:867219650851:web:3a008e34577dbc389bb496",
  measurementId: "G-4KJZHJE7EL"
};

// Gemini API Key for Smart Campus AI Features
const GEMINI_API_KEY = "AQ.Ab8RN6JmUATIy9C08Z-X4hXwVNU618hga9Gi4OwiC_EdzDFWBQ";
const GEMINI_MODEL = "gemini-3.5-flash";

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Persistence — keep user signed in across sessions
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log('[DineDesk] Firebase & Gemini configuration initialized');
